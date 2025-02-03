---
title: Deeply Incoherent and Generic
---

_The code for this article is available as a [gist][gist], giving an example
implementation of all the concepts mentioned below._

The [`higgledy`][higgledy] library started out as an internal project in an old
job. The company was an online mortgage broker, and as you can imagine, this
comes with a lot of paperwork. A large part of a user's time in the application
was spent filling out a lengthy form requiring all sorts of personal and
financial information. Because of this, we designed everything assuming that
users would spend days filling in this form in no particular order as they
collected all the relevant data.

This meant that, while we would _eventually_ be able to populate a type to
represent a mortgage application, we would have to handle a lot of partial
information to get there. Figuring out how to do this became the engineering
department's favourite puzzle, and countless hours were spent devising all
sorts of approaches, from which a lot of very interesting projects were
extracted[^bag].

## Higher-kinded data

One possible approach is to use higher-kinded data (HKD), an idea I first
discovered from [Sandy Maguire's blog post][reasonably-polymorphic] on the
subject. In short, we index a type by a type constructor, and then wrap all its
fields with that constructor:

```haskell
type UserF :: (Type -> Type) -> Type
data UserF f
  = User
      { name      :: f String
      , age       :: f Int
      , likesDogs :: f Bool
      }

type PartialUser :: Type
type PartialUser = UserF Maybe

type UserValidation :: Type
type UserValidation = UserF (Either String)

type User :: Type
type User = UserF Identity
```

By changing the `f` type, we can get all sorts of interesting versions of the
same type. [The `barbies` library][barbies], built by another colleague at the
same job, provides all sorts of useful tools for working with HKDs, too:

```haskell
-- Print each error to the screen.
reportErrors :: UserValidation -> IO ()
reportErrors = bfoldMap (either putStrLn mempty)

-- Turn `UserF (Either String)` into `UserF Maybe`.
ignoreErrors :: UserValidation -> PartialUser
ignoreErrors = bmap (either (const Nothing) Just)
```

Where I think this starts to get exciting is when we think about nested HKDs:

```haskell
type ApplicationF :: (Type -> Type) -> Type
data ApplicationF f
  = ApplicationF
      { userDetails  :: UserF f
      , workHistory  :: WorkF f
      , isRemortgage :: f Bool
      }
```

The magic of higher-kinded data and the `barbies` library is that the nesting
here works without an issue: we can still implement all the `barbies` classes
and have features like partiality wherever we want throughout the type.

## Generic higher-kinded data

While this approach definitely works, the types are quite cumbersome to work
with, especially when `f` is `Identity`. In this case, I really just want to
forget about the constructor and focus instead on the content within.
Furthermore, deriving simple instances like `Eq`, `Ord`, and `Show` end up
being rather more verbose and technical in this representation. There are a few
approaches to this problem, but mine is what eventually became `higgledy`: what
if I just define the type without the `f` parameter, and then use a wrapper to
inject it back in?

```haskell
type User :: Type
data User
  = User
      { name      :: String
      , age       :: Int
      , likesDogs :: Bool
      }
  deriving (Generic, Show)

type PartialUser :: Type
type PartialUser = HKD User Maybe
```

[The `HKD` type][hkd-type] stores a modified version of the type's `Generic`
representation in which the leaves are wrapped with the given `f` type. We then
use things like [`generic-lens`][generic-lens] to provide an API for accessing
and mutating these types. Nowadays, features like `OverloadedRecordUpdate`
could go even further to make the internals virtually invisible.

## The problem

If you're wondering how the nesting I mentioned earlier works in this world,
you've figured out the fatal flaw in this approach: `higgledy` derives the HKD
automatically, so we can't tell it which leaf types are themselves meant to
become HKDs. If we factor in the constraints of the library, there are two
conditions under which we'd want to make something a nested `HKD`:

* It has a `Generic` instance, which is required by `higgledy` to generate the
  HKD representation.

* It's a type we actually _want_ to be a nested HKD. `String` is a good example
  of a `Generic` type we probably want to leave as a leaf type, rather than
  turning it into an HKD. So, we need a way of skipping these.

[Generic deriving of generic traversals][csongor-paper] is a fantastic paper
for many reasons, many of which I'll surely end up discussing in future posts,
but one thing that stood out for me was the notion of "interesting types": when
we create or traverse a generic type, we can do so equipped with a list of
types we consider "leaves", and thus won't explore further. In practice - or to
strawman a justification for this blog post - this can become unwieldy as we
add more and more leaf domain types; currencies, refined numeric values, and
validated identifiers quickly add up to a hefty list.

This is the point at which I had an idea: why don't we instead recurse into
_all_ `Generic` types _unless_ they're in an "uninteresting types" list? This
list, in theory, should grow a lot more slowly as most of our leaf types don't
need to have `Generic` instances, but those that _do_ can still be explicitly
marked to ignore. It sounds like a good idea, but with this approach we
immediately hit a wall: how do we detect whether a type is `Generic`?

## Looks like we're stuck

The detection of a `Generic` instance _should_ be impossible. We shouldn't be
able to write a function whose behaviour changes based on whether we implement
a particular class, and solving this problem has always required plugins like
[`constraints-emerge`][constraints-emerge] to extend the language. However,
thanks to the miracle of incoherence, [Adam Gundry][adam-gundry] figured out
how to [detect `Generic` instances][generic-discrimination] using a couple of
the darker corners of GHC.

Type families can be thought of as type-level functions, but with a few key
differences. The most relevant to us is that type families don't have to be
total: we don't need to write equations for all possible inputs[^closed-kinds].
Of course, we should immediately ask what happens when we provide an input not
covered by the type family. For example, `GHC.Generics.Rep` is the type family
that maps types to their generic representations:

```
ghci> :k! Rep Bool
Rep Bool :: * -> *
= M1
    D
    (MetaData "Bool" "GHC.Types" "ghc-prim" False)
    (M1 C (MetaCons "False" PrefixI False) U1
     :+: M1 C (MetaCons "True" PrefixI False) U1)
```

The result of applying the `Rep` function to `Bool` is the generic
representation of `Bool`. However, the result of applying `Rep` to `Int` - a
type with no `Generic` implementation - seems to be a little less helpful:

```
ghci> :k! Rep Int
Rep Int :: * -> *
= Rep Int
```

In this instance, GHC has no idea how to compute an answer for `Rep Int`, and
so it instead parrots it back to us. We refer to this evaluation as _stuck_:
GHC has got to a point where it can make no further progress with this
expression. We can use stuck values in functions to return larger stuck values,
but until we figure out what `Rep Int` is, we're... well, stuck.

This is an issue for us: how do we know whether a type has a `Rep` if asking
gets us stuck? Really, [stuckness should be undetectable][stuck-errors], so if
we try to branch on a stuck value, the branching logic will get stuck, and so
on. However, there is one quirk that plays to our advantage: instance head
resolution still works on stuck families.

```haskell
type IsGeneric :: (Type -> Type) -> Constraint
class IsGeneric rep where isGeneric :: Bool

instance IsGeneric (M1 D m x) where
  isGeneric = True

instance {-# INCOHERENT #-} IsGeneric x where
  isGeneric = False

ghci> isGeneric @(Rep Bool) -- True
ghci> isGeneric @(Rep Int) -- False
```

There's one key insight needed to understand what's happening here: when we
match on two instances and one is `INCOHERENT`, we automatically pick the other
one. In other words, we only pick an `INCOHERENT` instance when we have no
other choice.

When we call `IsGeneric` with `Rep Bool`, GHC evaluates `Rep Bool` to the
structure we saw above: `M1 D (MetaData ...) ...`, which just so happens to
match both instances. One is incoherent, so we default to the first instance,
making `isGeneric` then `True`.

When we call `IsGeneric` with `Rep Int`, however, GHC immediately gets stuck:
in this instance, we've no idea if the result would match `M1 D m x`, so we're
left with one instance: the one in which `isGeneric` is `False`. Using an
unholy unity of stuckness and incoherence, we've found ourselves a very sneaky
way to figure out whether we're dealing with a `Generic` type.

## Stuckness as an input

We may be able to detect a `Generic` instance, but we're not out of the woods
yet: to solve the `higgledy` problem, we need a way of saying, "if the type has
a `Generic` rep, then it should be wrapped in `HKD`, otherwise in `f`. When I
have a problem like this, I immediately think about functional
dependencies[^associated-type-family]:

```haskell
type Leaf :: (Type -> Type) -> (Type -> Type) -> Type -> Constraint
class Leaf f rep leaf output | f rep leaf -> output

instance Leaf f (M1 D m x) l (HKD l f)
instance {-# INCOHERENT #-} Leaf f x l (f l)
```

This would be ideal, but our generic detection trick comes with a price: as far
as GHC is concerned, the output type _isn't_ uniquely determined by the input
types. The coverage checker is not clever enough to detect the dark arts we're
using, and instead simply complains that the instances overlap, and thus the
functional dependency is invalid. Unfortunately, it looks like both these ideas
are off the table, so we'll have to dabble in the dark arts one more time.

Almost ten years ago, Chris Done wrote a post on [the constraint trick for
instances][constraint-trick], and it took me about three reads over several
years to understand the implications. Rather than arrogantly assume I can do a
better job in a paragraph, I'll assume you've read the post and skip to the
punchline: instance head matching can't prompt unification, but solving the
_constraints_ of a matched instance can. In other words:

```haskell
type C :: Type -> Type -> Constraint
class C x y where f :: x -> y

instance C () () where f = id
instance x ~ Bool => C Bool x where f = id
```

```
ghci> :t f ()
f () :: C () y => y

ghci> :t f True
f True :: Bool
```

`C () ()` is an instance head that will only ever match if both values are
_known_ to be `()`. For this reason, the type of `f ()` isn't _known_ to be
`()` - instead, we have to specify what `y` is to match the instance, and so we
get no inference help at all.

By contrast, `C Bool x` is an instance head that will match if the first value
is known to be `Bool` _regardless_ of the second value. So, when we call `f
True`, GHC can immediately solve the constraint and select the second instance.
When it does so, we then get a new constraint to solve: `x ~ Bool`. Applying
this constraint teaches us that the output of `f True` must be a `Bool` too,
and so the ambiguity is removed.

What makes this interesting to us is that, despite there being no `x -> y`
functional dependency on `C`, `ghci` tells us that the type has indeed been
fully determined! Using the same trick, we can write code whose type changes
depending on the presence of a `Generic` instance _as long as_ the output type
is only ever defined by the constraints, rather than the instance head:

```haskell
type IsGeneric :: (Type -> Type) -> Type -> Constraint
class IsGeneric rep x where problem :: x

instance o ~ () => IsGeneric (f x) o where
  problem = ()

instance {-# INCOHERENT #-} (o ~ String, Typeable x)
    => IsGeneric x o where
  problem = show (typeRep @x) ++ " has no rep!"

examples :: IO ()
examples = do
  print (problem @(Rep Bool)) -- ()
  print (problem @(Rep Int)) -- "Int has no rep!"
```

## Bringing it home

Having learnt several dirty tricks, we can return to the `higgledy` problem.
Most of the code isn't too interesting: we walk the generic representation of
the type, and at the leaves, we use the aforementioned dirty tricks to decide
whether they should be wrapped in `f` or HKDs themselves. Because we're not
allowed to use type families, the `HKD` type becomes a little more creative:

```haskell
type HKD :: Type -> (Type -> Type) -> Type
data HKD x f where
  HKD :: forall o x f. GHKD (Rep x) f o => o Void -> HKD x f
```

_I've removed the "interesting types" references to make the point a bit
clearer, but they're visible in the gist._

The inner representation of `HKD` is now determined by a constraint, and we
want that type to be hidden from the outside world, so we package up the `GHKD`
dictionary _inside_ the `HKD` type. Now, all that's left to do is get all the
other machinery to work (`barbies`, `generic-lens`, and so on), and for that...
we're going to need a way to work with the `HKD` type generically.

## Deriving `Generic` for undetermined types

The immediate problem is that `Generic` is a class with a type family, and
we've said several times that type families are out of the question. This is a
non-starter: there's nothing we can really do (to my knowledge) to solve this
problem directly. However, we could side-step the problem by defining a very
simple type for wrapping generic representations...

```haskell
type RepWrapper :: (Type -> Type) -> Type
newtype RepWrapper o = RepWrapper { unRepWrap :: o Void }

instance (Contravariant o, Functor o)
    => Generic (RepWrapper o) where
  type Rep (RepWrapper o) = o

  from (RepWrapper o) = phantom o
  to = RepWrapper . phantom
```

This type isn't very interesting at all: it stores a generic representation,
and its generic representation is defined as whatever representation it stores.
It's effectively a transparent `newtype`. However, with this type, we can solve
all our other `Generic` problems simply by _first_ transforming our HKD type
into our `Wrapped` type:

```haskell
repWrapper :: forall xs p x f. GHKD xs (Rep x) f p => Iso' (RepWrapper p) (HKD xs x f)
repWrapper = L.iso (HKD . unRepWrap) \(HKD x) ->
  RepWrapper (unsafeCoerce @(_ Void) @(p Void) x)

type HasField' t f o s a
    = ( GHKD Uninteresting (Rep s) f o
      , G.HasField' t (RepWrapper o) a
      )

field :: forall t x f i o r. HasField' t f o x r => Lens' (HKD_ x f) r
field = L.from (repWrapper @Uninteresting @o) . G.field' @t
```

These may look like an awful lot of type variables, but that's because we're
talking in extremely abstract terms. As soon as we know what `x` is here,
everything becomes a _lot_ less polymorphic, and we are at last rewarded for
doing the inference dance[^unsafe-coerce]:

```haskell
-- Found type wildcard ‘_’ standing for ‘f [Char]’
eg1 :: Applicative f => HKD_ User f -> _
eg1 u = u ^. field @"userName"

-- Found type wildcard ‘_’ standing for ‘HKD_ Pet f’
eg2 :: Applicative f => HKD_ User f -> _
eg2 u = u ^. field @"userPet"
```

At long last, we've made it. We have a working version of `higgledy` that
allows for nested `HKD` fields, while also being able to support all the
external, `Generic`-driven tools that are already present in the library. Add
to that the delightfully good type inference demonstrated in the above
examples, and I think we've done pretty well here!

## Review

It's been a long time since I left the job and the colleagues that inspired
this library. These days, it's looked after by the wonderful [Jonathan
King][jonathan king], a far more reliable maintainer than I've ever been.
However, I do occasionally find myself daydreaming about this library and
various ways to improve it, so this little experiment has been a lot of fun.

At this point, it's good to ask whether such a change is worth it. On balance,
I would say yes: these details don't leak to the outside world any more than
the current implementation does, and it's substantially more flexible. I find
that the litmus test for things like this is quite simple: will a user of the
library ever need to understand how this works internally? If so, it's probably
not a good idea to add it. The one thing I still think is rather clunky here is
the "uninteresting types" notion. We haven't really discussed it much in this
post, but if you read through the [gist][gist], the `xs` of uninteresting types
is everywhere, and I'm sure there's a neater way to determine what should and
shouldn't be expanded.

In any case, thanks for reading along, and please feel free to ask questions -
if you open an issue on [the site's repository][site], I'll try to respond and
update the posts if need be!

[^associated-type-family]: Associated type families are another option, but
    they run into exactly the same hurdle as described in this article for
    functional dependencies.

[^bag]: Csongor Kiss' [`generic-lens`][generic-lens] is perhaps the most
    notable example, though it's not the only example. I'll probably talk about
    others in future blog posts.

[^higgledy-barbies]: Of course, you can use `higgledy` with `barbies`, but
    you're immediately a little restricted.

[^fundep-issue]: you can see this issue for yourself if you open [this post's
    gist][gist] and try to add a functional dependency on `GSOP` and `SOP`.

[^closed-kinds]: More upsettingly still, we can't write total type families
    even if we want to: [there are no closed kinds][closed-kinds].

[^unsafe-coerce]: You may be wondering, reasonably, why I've glossed over the
    `unsafeCoerce` in `repWrapper`. If `GHKD` had a functional dependency to
    determine the representation of our HKD, then these two types would unify.
    However, as we've already discussed that we can't have one, we need GHC to
    trust us.

[barbies]: https://hackage.haskell.org/package/barbies
[closed-kinds]: https://gist.github.com/ekmett/ac881f3dba3f89ec03f8fdb1d8bf0a40
[constraint-trick]: https://chrisdone.com/posts/haskell-constraint-trick
[constraints-emerge]: https://github.com/isovector/constraints-emerge
[csongor-paper]: https://dl.acm.org/doi/10.1145/3236780
[generic-discrimination]: https://gist.github.com/adamgundry/37e29ca9c8a30e3d94f61b0ee11d67a8
[generic-lens]: https://github.com/kcsongor/generic-lens
[higgledy]: https://github.com/i-am-tom/higgledy
[hkd-type]: https://github.com/i-am-tom/higgledy/blob/8d0d87e63919de3c8be4a45915ae33e2f89f2d0f/src/Data/Generic/HKD/Types.hs#L84
[jonathan king]: https://github.com/jonathanlking
[gist]: https://gist.github.com/i-am-tom/b8c7288f661ca11a8ac7f2012dd63f31
[reasonably-polymorphic]: https://reasonablypolymorphic.com/blog/higher-kinded-data
[site]: https://github.com/i-am-tom/i-am-tom.github.io/issues
[strategic-deriving]: https://www.youtube.com/watch?v=U0j9iIKOj40
[stuck-errors]: https://blog.csongor.co.uk/report-stuck-families/
[adam-gundry]: https://github.com/adamgundry

---
layout: article
title: "Fantas, Eel, and Specification 9: Applicative"
description: Apply to Applicative, and the fuss about Monoid.
redirect_from: /2017/04/17/fantas-eel-and-specification-9/
tags: untranslated
---

_I asked my **German** friend whether any of this series' posts particularly stood out. They said **9**, so I'd better make this a good one!_ I told you we were doing jokes now, right? Moving on... _Today_, we're going to finish up a topic we started last week and move from our `Apply` types to `Applicative`. If you understood [the Apply post](/2017/04/10/fantas-eel-and-specification-8/), this one is _hopefully_ going to be pretty intuitive. **Hooray**!

`Applicative` types are `Apply` types with one extra function, which we define in [Fantasy Land](https://github.com/fantasyland/fantasy-land#applicative) as `of`:

```haskell
of :: Applicative f => a -> f a
```

With `of`, we can take a value, and **lift** it into the given `Applicative`. That's it! In the wild, _most_ `Apply` types you practically use will also be `Applicative`, but we'll go through a counter-example later on! Anyway, wouldn't you know, there are a few **laws** to go with it, tying `ap` and `of` together:

```javascript
// For some applicative A...

// Identity.
v.ap(A.of(x => x)) === v

// Homomorphism
A.of(x).ap(A.of(f)) === A.of(f(x))

// Interchange
A.of(y).ap(u) === u.ap(A.of(f => f(y)))
```

With **identity**, we've lifted the identity function (`x => x`) into our **context**, applied it to the inner value, and, surprise, **nothing happened**.

The **homomorphism** law says that we can lift a function and its argument **separately** and _then_ combine them, **or** combine them and _then_ lift the result. Either way, we'll end up with the same answer! The `of` function can do _nothing_ but put the value into the `Applicative`. No tricks. **No side effects**.

**Interchange** is a little more complex. We can lift `y` and apply it to the function in `u`, _or_ we can lift `f => f(y)`, and apply `u` to that. I think of this one as, "_Nothing special happens to one particular side of `ap` - it just applies the value in the right side to the value in the left_".

---

So, why is this `of` thing _useful_? Well, the most exciting reason is that we can write functions generic to **any applicative**. Let's write a function that takes a **list** of **applicative-wrapped** values, and returns an **applicative-wrapped list** of values. Note that `T` is a `TypeRep` variable - we've seen these before in [the monoid post](/2017/03/21/fantas-eel-and-specification-5/). We need it in case the list is empty:

```javascript
// append :: a -> [a] -> [a]
const append = y => xs => xs.concat([y])

// There's that sneaky lift2 again!
// lift2 :: Applicative f
//       => (a -> b -> c, f a, f b)
//       -> f c
const lift2 = (f, a, b) => b.ap(a.map(f))

// insideOut :: Applicative f
//           => [f a] -> f [a]
const insideOut = (T, xs) => xs.reduce(
  (acc, x) => lift2(append, x, acc),
  T.of([])) // To start us off!

// For example...

// Just [2, 10, 3]
insideOut(Maybe, [ Just(2)
                 , Just(10)
                 , Just(3) ])

// Nothing
insideOut(Maybe, [ Just(2)
                 , Nothing
                 , Just(3) ])
```

**First of all**, we lift an empty list into the applicative context. Then, value by value, we **combine** the contexts with a function to `append` the value to that inner list. _Neat_, right? We'll see in a few weeks that this `insideOut` can be generalised further to become a super-helpful function called [`sequenceA`](http://hackage.haskell.org/package/base-4.9.1.0/docs/Data-Traversable.html#v:sequenceA) that works on a lot more than just lists!

> This is pretty useful for AJAX, too. We can use our `data.task` applicative to create a list of requests - a `[Task e a]` - and then combine them into a single `Task` containing the eventual results - a `Task e [a]` - using `insideOut`!

Notice that we only _need_ an `Applicative` because the list _could_ be empty. Otherwise, we could just `map` over the first with `x => [x]` and use that one as the accumulator - we'd only need `Apply`! _Anyone else having [flashbacks to monoids](http://www.tomharding.me/2017/03/13/fantas-eel-and-specification-5/)_? They're all **very strongly-connected**:

- `concat` can combine any non-zero number of **values** (of the same type) into one.

- `ap` can combine any non-zero number of **contexts** (of the same type) into one.

- If we might need to handle zero **values**, we will need to use `empty`.

- If we might need to handle zero **contexts**, we will need to use `of`.

Wizardry. **For our next trick**, let's notice that you can turn _any_ `Applicative` into a valid `Monoid` if the inner type is a `Monoid`:

```javascript
// Note: we need a TypeRep to get empty!
const MyApplicative = T => {
  // Whatever your instance is...
  // const MyApp = daggy.tagged('MyApp', ['x'])
  // Put your map/ap/of here...

  // concat :: Semigroup a => MyApp a
  //                       ~> MyApp a
  //                       -> MyApp a
  MyApp.prototype.concat =
    function (that) {
      return lift2((x, y) => x.concat(y),
                   this, that)
    }

  // empty :: Monoid a => () -> MyApp a
  MyApp.prototype.empty =
    () => MyApp.of(T.empty())

  return MyApp
}
```

The above will _always_ be **valid**. Notice that it doesn't care about the shape of our `Applicative` at all - we can write these implementations using just the **interface** (`map`, `ap`, and `of`) for _any_ applicative. Of course, `Applicative` types _can_ use different implementations for `Monoid`. For example, look at `Maybe`:

```javascript
// Usual implementation:
Just([2]).concat(Just([3])) // Just([2, 3])
Just([2]).concat(Nothing)   // Just([2])
Nothing.concat(Just([3]))   // Just([3])
Nothing.concat(Nothing)     // Nothing

Maybe.empty = () => Nothing

// With the above implementation:
Just([2]).concat(Just([3])) // Just([2, 3])
Just([2]).concat(Nothing)   // Nothing
Nothing.concat(Just([3]))   // Nothing
Nothing.concat(Nothing)     // Nothing

Maybe.empty = () => Just(
  MyInnerType.empty())
```

A type _might_ have more than one implementation for any given typeclass (such as `Semigroup`); the choice is up to the **implementer** and the **users**! As we can see, `Maybe`'s usual implementation probably works better. Particularly the `empty` bit.

Still, if we have an `Applicative` type, we know **for sure** that have at least _one_ valid `Monoid` definition! **Magical**, _right_?

---

All the `Apply` types we've seen so far have, coincidentally, been `Applicative`. We can see it's pretty easy in many cases to make an `of`:

```javascript
Array.of = x => [x]
Either.of = x => Right(x)
Function.of = x => _ => x
Maybe.of = x => Just(x)
Task.of = x => new Task((_, res) => res(x))
```

We're really just constructing the simplest possible value within a type that can hold a value for us. No tricks, nothing fancy. Even `Task`, if you remember our `Promise` analogy, is about as routine as we could make it. However, let's talk about **pairs**:

```javascript
// Pair :: (l, r) -> Pair l r
const Pair = daggy.tagged('Pair', ['x', 'y'])

// Map over the RIGHT side. The functor
// is `Pair l` and `r` is the inner type.
// map :: Pair l r ~> (r -> s)
//                 -> Pair l s
Pair.prototype.map = function (f) {
  return Pair(this.x, f(this.y))
}

// Apply this to that, retain this' left.
// ap :: Pair l r ~> Pair l (r -> s)
//                -> Pair l s
Pair.prototype.ap = function (that) {
  return Pair(this.x, that.y(this.y))
}

// But wait...
// of :: r -> Pair l r
Pair.of = function (x) {
  return Pair({WHAT GOES HERE}, x)
}
```

... _Ah_. Look at the signature for `of` - there's a magical `l` value that just appears! We don't know what type it is, so we don't know what it can do, which means we can't find a value to fill this gap. Sure, we can `ap` - because we have two `l` values to choose from! - but we can't `of`.

How do we solve this? With the same _magical_ pattern that has been going on throughout this post: we require `l` to be a `Monoid`. If `l` is a `Monoid`, we know we can call `l.empty()` to get a value for that gap!

```javascript
// TypeRep!
const Pair = T => {
  Pair_ = daggy.tagged('Pair', ['x', 'y'])

  // And now we're fine! Hooray!
  Pair_.of = x => Pair_(T.empty(), x)

  return Pair_
}

Array.empty = () => []

// SUCCESS!
const MyPair = Pair(Array)
MyPair.of(2) // Pair([], 2)
```

> So, an `Apply` is an `Applicative` without `of`. An `Applicative` without `ap` also has a name: [`Pointed`](https://hackage.haskell.org/package/pointed-5/docs/Data-Pointed.html). However, there are **no laws** attached to it independently, so it's not particularly useful on its own - just a bit of trivia!

---

That, good people of The Internet, is _all_ there is to `Applicative`. Most of this was covered in the last post, so there are hopefully no great surprises. The important take away is that the relationship between `Semigroup` and `Monoid` is _very_ similar to that of `Apply` and `Applicative`. This isn't the last time we'll see such a relationship, either! Isn't it weird how everything's **connected**? Baffles me, at least.

Anyway, I hope this has been useful, and, as always, [I'm available on twitter](http://twitter.com/am_i_tom) to answer any questions you might have. Next time, we'll be tackling `Alt`. Don't worry: it's going to be pretty familiar-looking if you've been through all the posts in this series. Until then, though, go forth and `Apply`!

Thank you _so much_ for reading, and take care &hearts;

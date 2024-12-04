---
layout: article
title: "Dependable Types 3: Reductio Sine Absurdum"
description: "Parametric simplification, and a whole lot of proofs."
redirect_from: /2018/02/19/dependable-types-3/
tags: untranslated
---

Welcome back! This time, we're going to write that `evaluate` function we
mentioned in [the last article](/2018/01/27/dependable-types-2/)...  Strictly,
this function will be better named `reduce`, as it will perform an operation
called **beta reduction** (or **β-reduction**, if you're so inclined). What
this means is that, any time we see an `Abstraction` on the **left**-hand side
of an `Application`, we can **simplify** by taking the abstraction's body, and
**replacing** any mention of its parameter with the **argument**.

For example:

> `(λx.x)y`

We can **reduce** this down to `y` simply by **substituting** `y` for all
occurrences of `x` _inside_ the `x` abstraction. **Woo!**

As a more _complicated_ example:

> `(λx.(λy.(λz.z)y)x)a`

Here, we have a few **nested** functions, so we handle them one at a time.
First, we substitute `a` in place of `x`:

> `(λy.(λz.z)y)a`

Now, we've **eliminated** the abstraction for `x` (and so the **context** no
longer has an `x`), but we see that `a` is now applied to the `y` abstraction.
Let's do the same thing for `y` as we did for `x`:

> `(λz.z)a`

This is exactly the same as the _body_ of the `y` abstraction, but all the
mentions of `y` have been replaced by `a`, and so `y` has been totally
**eliminated**! Finally, we substitute `a` in place of `z`:

> `a`

**Boom**. This, reader mine, is what we're going to do today. Before we go any
further, think about why this might be a bit **trickier** with De Bruijn
indices. **Buckle up**, friends: we're gonna need to write some **proofs**.

---

Before we get to code, let's think about the **type signature**. If we get
everything right, the **context** of the reduced expression won't change, and
nor will the **type**. As our `Expression` type is indexed by both of these
things, this helps us to refine the set of **possible implementations**, and
hence produce fewer **bugs**!

```haskell
reduce
   : Expression ctx ptype
  -> Expression ctx ptype
```

> _As usual, to make this code fit on a mobile screen, a lot of the variables
> have been abbreviated. If you'd prefer to read a more verbose form, [the code
> for this
> post](https://github.com/i-am-tom/LICK/blob/master/src/LICK/Reduction.idr) is
> a good place to start!_

Apart from an `Application` in an `Abstraction`, there's not anything we can do
to **reduce** our expression. So, with that one exception, all this is going to
look pretty uninteresting, and just like any other recursive function you might
imagine for this type:

```haskell
reduce
   : Expression ctx ptype
  -> Expression ctx ptype

reduce (Abstraction param body)
  = Abstraction param (reduce body)

reduce (Variable ref)
  = Variable ref

reduce (Application fn arg)
  with (reduce fn, reduce arg)
    | (Abstraction param body, arg')
        = substitute Here body arg'
    | (fn', arg')
        = Application fn' arg'
```

We can see that, when we encounter the magical situation we're looking for, we
do some kind of **substitution** of `arg'` in place of `Here` inside the
`body`. There's a catch, though: we're using `Here` and `There` as **De Bruijn
indices**.

Take the following:

> `(λx.λy.(λz.x)x)`

When we use _this_ format, we can **identify** all the references to `x` simply
because they're written as `x`. However, let's look at the _same_ expression
when written with De Bruijn indices:

> `λλ(λ3)2`

The variable _three lambdas ago_ and the variable _two lambdas ago_ are
actually the **same** variable! De Bruijn indices change depending on the
**level** of abstraction-**nesting**, which means that we'll also have to keep
track of that!

---

Once again, let's think about the **type** for `substitute` before we write any
code. The `body` is in a different **context** to the `arg'`: it has an extra
variable that isn't present in the `arg'`. However, once we finish
substitution, we will have **eliminated** that variable entirely, so it is also
missing from the result!

```haskell
substitute
   : (ref : Elem atype ctx)
  -> Expression
       ctx
       ptype
  -> Expression
       (dropElem ctx ref)
       atype
  -> Expression
       (dropElem ctx ref)
       ptype
```

Let's start with the simplest case: `Application`. In this instance, we recurse
down through **both sides**, and we're done. We'll find that `Application` is
very much the **simple case** in this process, as it is the only one of the
three constructors that doesn't touch the **context**.

```haskell
substitute ref (Application fn x) arg
  = Application (substitute ref fn arg)
                (substitute ref x  arg)
```

Now, let's have a little look at the case of `Abstraction`. We probably want to
increment the index we're looking for, so we'll stick a `There` on it:

```haskell
substitute ref (Abstraction param body) arg
  = Abstraction
      param
      (substitute (There ref) body arg)
```

... Not quite.

```
Type mismatch between
  Expression
    (dropElem ctx ref)
    atype

    (Type of arg)
and
  Expression
    (dropElem (param :: ctx) (There ref))
    atype

    (Expected type)
```

This type error rightly tells us that `arg` is the problem here, and
specifically that it is in the **wrong context**: inside the `Abstraction`,
there is an **extra** parameter in our context to worry about, so we need to
update the `arg` context accordingly. Luckily, we know that the `arg` works in
the `ctx` context, so `param` doesn't get a mention inside. All we need to do
is **increment** the references.

_... Ish_. If a variable is introduced _within_ that `body`, we should **not**
bump the reference - we only care about those that come from **outside** the
`body`, which we call the **free** variables of the `body` expression.
Symmetrically, those that come from **inside** the `body` will be referred to
as **bound** variables.

```haskell
expandContext
   : (bound : Context)
  -> Expr (bound ++      free) t
  -> Expr (bound ++ a :: free) t
```

This type describes what we want: _expand the **context** by one more **bound**
variable_. Consequently, we'll need to **increment** all `free` references, but
none of the `bound` references. _Sorry if these last few paragraphs take a few
readthroughs..._

```haskell
expandContext ctx (Application fn x)
  = Application (expandContext ctx fn)
                (expandContext ctx x)

expandContext ctx (Abstraction param body)
  = Abstraction
      param
      (expandContext (param :: ctx) body)

expandContext ctx (Variable ref)
  = Variable (expandElemContext ctx ref)
```

As before, `Application` is nice and easy. `Abstraction` is a bit ugly, but as
expected: we add this new `param` to the **bound** list, and recurse. The fun
happens in the `Variable` case: we want to update the `ref` when it's a
reference to a **free** variable. Let's have a look at that function:

```haskell
expandElemContext
   : (bound : Context)
  -> Elem t (bound ++      free)
  -> Elem t (bound ++ a :: free)

expandElemContext [] ref
  = There ref

expandElemContext (_ :: _) Here
  = Here

expandElemContext (_ :: xs) (There later)
  = There (expandElemContext xs later)
```

When we have an **empty context**, all references must be **free**. If we have
a `Here` reference to a **non-empty** context, we know it must be **bound**! In
any other case, we can just drop the most recent bound variable, and a layer of
the reference, and **recurse**! This function isn't too scary, really: we
**ignore** a reference **within** the context, and increment a reference
**beyond**. _Don't panic!_

Now we have all that out the way, we can rewrite our `substitute` statement:

```haskell
substitute ref (Abstraction param body) arg
  = Abstraction
      param
      ( substitute
          (There ref)
          body
          (expandContext [] arg)
      )
```

**Magnifique**.

---

The only case we haven't considered for `substitute` yet is `Variable`. I've
deliberately left this one until last because, well, it's quite **scary**. To
people unfamiliar with Idris, this is going to look...  well, **unfamiliar**.
Nevertheless, let's **crack on**!

When we encounter a `Variable` within an expression, one of **two things** may
be true:

- The `Variable`'s reference is _not_ the one we're looking to eliminate, so we
  just **update** it if necessary.

- The `Variable`'s reference _is_ the one we're looking for, and we want to
  **replace** this `Variable` with the given `arg`.

Now, if the variable _is_ the one we're looking for, we're going to have to
**prove** a couple things to Idris. First of all, `atype` and `ptype` are going
to have to be **equivalent**. If we can't prove this, Idris won't let us unify
`atype` and `ptype`, as they _could_ be different. Secondly, we have to prove
that the context references are indeed the same! The order isn't especially
important, but **both** are required to satisfy the compiler.

Enough stalling for time; let's see the **beast**:

```haskell
substitute {atype} {ptype} ref (Variable ref') arg
    with (decEq ptype atype)
  substitute {atype = ptype} ref (Variable ref') arg
    | (Yes Refl)
          with (decEq ref' ref)
        substitute ref' (Variable ref') arg
          | (Yes Refl)
          | (Yes Refl)
          = arg
        substitute ref (Variable ref') arg
          | (Yes Refl)
          | (No contra)
          = Variable (independentRefs ref' ref contra)
  substitute ref (Variable ref') arg
    | (No contra)
    = Variable (independentValues ref' ref contra)
```

_Warned you, right?_ There are a couple things going on here. Firstly, we're
**pulling terms out of the type**. This is another bit of "dependently-typed
magic": we can **reflect** things down from the type-level, such as `atype` and
`ptype` (the `ProgramType` indices for the expression and the substitution),
and then use them **within our function**! _Types are terms are types are
terms._ It really is **magical**.

Now we have access to those values, we can use `decEq` (**decidable equality**)
to compare them. The result of doing so is either `Yes prf` or `No contra`,
where `prf` and `contra` are **proofs** of one way or the other. We'll see more
of these in a moment.

> _I'm omitting the accompanying [`DecEq ProgramType`
> implementation](https://github.com/i-am-tom/LICK/blob/master/src/LICK/ProgramType.idr#L21-L62)
> because it's quite **mechanical**, and doesn't contain anything we're not about
> to see. However, if you're enjoying this, I'd encourage you to go take a
> look!_

If we successfully prove **both**, the result is simply `arg`: we know that
we're safe to make the substitution, so we replace the `Variable` with the
`arg` we've been carrying. **Job done**! If that _isn't_, the case, however, we
have a _little_ more work to do. Specifically, we need to **update** the
`Variable` index to account for the now-eliminated parameter. To avoid a
`Maybe`, let's have a go at **proving** that our reference can be adjusted
safely. You'll notice that the above code had two proofs: `independentRefs` and
`independentValues` are the holes that we're going to have to fill.

> _Don't think there was any magic in the selection of proofs. Most of this
> code was written with a **lot** of help from Idris' editor plugin. Most of
> the time with proofs, the **obvious proof search** will do most (if not all)
> the work for you!_

---

Firstly, let's look at the **type** of `independentRefs`:

```haskell
independentRefs
   : (l : Elem x xs)
  -> (r : Elem x xs)
  -> Not (l = r)
  -> Elem x (dropElem xs r)
```

Here, we have to prove that, if the `l` and `r` values are **not** equal, `x`
will exist in the list **without** the element to which `r` refers. In other,
simpler words: if `l` and `r` are both references to a value of some type, and
they're not the same, that type must be in there at least twice, and we can
remove one _and_ provide a reference to another!

```haskell
independentRefs Here Here prf
  = absurd (prf Refl)
```

We first deal with the case in which the two references _are_ the same.
However, we already have a proof that this can't be the case, so this is...
`absurd`! The proof is `Refl` (we can think of this as "obvious" for now),
given the proof that `Not (l = r)`.

> I won't go into too much detail, but `absurd` is a function from `Void` to
> **anything**. In other words, _there's no way this can happen!_

```haskell
independentRefs Here (There later) prf
  = Here
```

If `l` points to the **first** element, and `r` to any **other**, then we know
that dropping `r` will make no difference - the element will be in **first**
place!

```haskell
independentRefs (There later) Here prf
  = later
```

Similarly, if `r` points to the **first**, and `l` to something **later**, the
element is simply one place **closer** to the start than before.

```haskell
independentRefs (There this) (There that) prf
  = There (independentRefs this that (prf . cong))
```

Here's our recursive step. If _both_ references are later on, we recurse.
Notice the `cong` function here:

```haskell
cong : a = b -> f a = f b
```

_"If `a` and `b` are the same, applying `f` to both will give the same
answer"_. The `f` here is `There`: if we can remove a `There` from each and
still prove that they're the same, we're good! Now, what about that
`independentValues` function? Well, it's almost **identical** to the above. The
only reason it has to exist is that, this time, we want to prove that, if the
referenced **values** are different, removing one won't remove the other:

```haskell
independentValues
   : (l : Elem x xs)
  -> (r : Elem y xs)
  -> Not (x = y)
  -> Elem x (dropElem xs r)
```

This one is even simpler, as we don't have to carry the `cong` proof: we only
care about the proof at the point that it **fails**. _Voila_:

```haskell
independentValues Here Here prf
  = absurd (prf Refl)

independentValues (There later) Here prf
  = later

independentValues Here (There later) prf
  = Here

independentValues (There x) (There later) prf
  = There (independentValues x later prf)
```

Now, we have **everything** we need. We've made it, friends: the above is
**almost everything** from [this article's
code](https://github.com/i-am-tom/LICK/blob/master/src/LICK/Reduction.idr).
Still, while we're here, why don't we try one last **party trick**?

---

Earlier, we had this expression:

> `(λx.(λy.(λz.z)y)x)a`

If we convert this to our format, we get something rather more **ugly**:

```haskell
Test : Expression (x :: context) x
Test {x} -- x is just a type!
  = Application
      ( Abstraction
          x
          ( Application
              ( Abstraction
                  x
                  ( Application
                      ( Abstraction
                          x
                          ( Variable Here
                          )
                      )
                      ( Variable Here
                      )
                  )
              )
              ( Variable Here
              )
          )
      )
      ( Variable Here
      )
```

Here, we're saying that `Test` is an **expression** in _any_ context with an
`x` at the head, and it has a **return type** of `x`. Given that we already
_know_ the result of reducing this expression is just `Variable Here`, why
don't we write a test?

**Dependent types to the rescue** once more. Thanks to the magic of Idris,
where terms are types and types are terms, we can write our tests at the
**type-level**, and have them checked whenever we **compile**! On top of that,
the compiler will recognise them as dead code _after_ type-checking, so they
won't appear in the output binary! Here's how we'd write the **type** of our
test:

```haskell
allClear
  : reduce (Test {context = []} {x = PInt})
  = Variable Here
```

We're giving the compiler a couple hints here: to avoid polymorphism confusion,
we **specialise** our `context` and `x` values to make it easier for the
type-checker. In actual fact, this is _required_ for the next step. What this
**type** says is that reducing our expression is **equivalent** to the reduced
form we expect. What do we write for our body, though?

```haskell
allClear
  = Refl
```

The most **beautiful** line in this whole post. The type-checker will do the
reduction, arrive at the result of `Variable Here`, and then the proof of this
test becomes **obvious**. Now, whenever we **change** our code, this reduction
will be carried out, and the result will be checked. If the result does not
match the intended output, **compilation** will **fail**.

**Failing tests are now type errors**. How _awesome_ is that?

---

Ok, this has been the longest post I've written by quite a way, but there was a
lot to cover! I hope this has given you some sort of idea about how we write
**proofs** for the type system, and how they allow us to expand **contexts**,
update variable **references**, and all sorts of things we haven't covered
here!

Next time, we'll be looking at some serious dependently-typed **magic**. We'll
be turning our `Expression` values into **actual Idris functions** that we can
call with arguments and receive results, all while remaining totally
**type-safe**.  Until then, feel free to [contact me on
Twitter](https://twitter.com/am_i_tom) with any suggestions, questions,
criticisms, and so on. I'd love to hear from you, and see what you've been
concocting!

Until next time, take care &hearts;

_As always, a huge thanks to [Liam](https://twitter.com/goodacre_liam) for
teaching me everything I know about Idris. Thanks also to
[Gabe](https://twitter.com/gabeijohnson) for proofreading this article (among
many)!_

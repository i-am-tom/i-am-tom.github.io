---
layout: article
title: "Fantas, Eel, and Specification 19: Semigroupoid and Category"
description: The True Zen of Fantasy Land
redirect_from: /2017/07/10/fantas-eel-and-specification-19/
tags: untranslated
---

**It's not goodbye**, Fantasists. We'll have other projects, new memories, more chance encounters. Let's end on a high: talking about the humble `Category`, and how we've been learning this since the beginning. While it may not be the most _immediately useful_ structure, it's a **gem for the curious**.

Before we go any further, let's get the **methods** and **laws** on the table. A `Semigroupoid` has one method, called `compose`:

```haskell
compose :: Semigroupoid c
        => c i j
        ~> c j k
        -> c i k
```

There's also one **law**, which is going to look _boringly_ familiar:

```javascript
// Associativity..
a.compose(b.compose(c)) ===
  a.compose(b).compose(c)
```

A `Category` is a `Semigroupoid` with **one new method**:

```haskell
id :: Category c => () -> c a a
```

Now, if you've been following the series, there are no prizes for guessing the two laws that come with this:

```javascript
// Left and right identity!
a === C.id().compose(a)
  === a.compose(C.id())
```

Yep, it's another `Monoid`-looking structure. Let's all **pretend to be surprised**.

---

_Now_, there's a reason to get excited about these things. You may not **directly** interact with them every day, but they're _everywhere_ underneath the surface:

```javascript
Function.prototype.compose =
  function (that) {
    return x => that(this(x))
  }

Function.id = () => x => x
```

Yep. Under function **composition**, our functions form a `Category`! Do notice that `Function#compose` is defined the exact same way as `Function#map`, too. Of course, this might be a bit easier to introduce to your codebase than `Function#map`:

```javascript
// Much more colleague-friendly?
const app =
  readInput
  .compose(clean)
  .compose(capitalise)
  .compose(etCetera)
```

We can think of `s a b` (for some `Semigroupoid s`) as "a relationship from `a` to `b`" (the set of which, in **fancy talk**, are called **morphisms**), and `Category` types as having "an identity relationship". When we did [the deep dive with `Monad`](/2017/06/05/fantas-eel-and-specification-15/), we actually looked at another `Category`:

```javascript
//- We need a TypeRep for M to do `id`.
//- Note that, for a `Chain` type, we could
//- only make a `Semigroupoid`, not a
//- `Category`!
const MCompose = M => {
  //+ type MCompose m a b = a -> m b
  const MCompose_ = daggy.tagged('MCompose', ['f'])

  //+ compose :: Chain m
  //+         => MCompose m a b
  //+         ~> MCompose m b c
  //+         -> MCompose m a c
  MCompose_.prototype.compose =
    function (that) {
      return x => this.f(x).chain(that.f)
    }

  //+ id :: Monad m => () -> MCompose m a a
  MCompose_.id = () => MCompose_(M.of)

  return MCompose_
}
```

Note that we originally wrote a `Monoid` for operations `a -> m a`. With a `Category`, we can talk about operations `a -> m b`, and we have much more **freedom**. Symmetrically, [our `Comonad` friends](/2017/06/19/fantas-eel-and-specification-17/) give us an almost identical `Category`:

```javascript
//- Extend for Semigroupoid, Comonad for
//- Category!
//+ type WCompose w a b = w a -> b
const WCompose = daggy.tagged('WCompose', ['f'])

//+ compose :: Extend w
//+         => (w a -> b)
//+         ~> (w b -> c)
//+         -> (w a -> c)
WCompose.prototype.compose =
  function (that) {
    return x => this.f(x).extend(that.f)
  }

//+ id :: Comonad w => () -> WCompose w a a
WCompose.id = () =>
  WCompose(x => x.extract())
```

Why limit ourselves? We have **composition**! Let's turn [the `Applicative`](/2017/04/17/fantas-eel-and-specification-9/)'s composition into a `Category`:

```javascript
//+ Apply for Semigroupoid, Applicative for
//+ Category!

const ApCompose = (A, C) => {
  //+ type ApCompose f c a b = f (c a b)
  const ApCompose_ = daggy.tagged('ApCompose', ['f'])

  //+ compose :: Apply f
  //+         => Semigroupoid s
  //+         => f s a b
  //+         ~> f s b c
  //+         -> f s a c
  ApCompose_.prototype.compose =
    function (that) {
      return that.f.ap(this.f.map(
        x => y => x.compose(y)))
    }

  //+ id :: Applicative f
  //+    => Category s
  //+    => () -> f s a a
  ApCompose_.id = () => A.of(C.id())
}
```

The really **neat** thing here is that, instead of limiting ourselves to the `Category` of _functions_ within `Applicative` context, we've generalised `Function` to `Category`! It's all getting a bit **abstract** and **scary**, right? **Don't panic**.

---

With the **helpful exception** of `Function`, these examples may all seem a bit impractical. _Granted_, you might find that `MCompose#compose` gives you a nice, declarative way to chain together **monadic actions**, or something to that effect, but this largely seems a bit too... well, **abstract**!

While this _may_ not be the one you use every day, the `Semigroupoid` and `Category` structures form a _very_ important idea. We hinted at this earlier: _`Category` is like a `Monoid` with **more freedom**_. Well, if everything we've seen ended up looking like `Semigroup` or `Monoid`... effectively, the **base concept** been `Category` all along!

> I had originally wanted to show `Monoid` in terms of `Category`. Let's just say the **page of required declarations** compiled with the **help of three other people** made me think that, if _I_ couldn't understand it, I probably shouldn't put it here!

It's not _crucial_ that we understand why. [Discussion around categories](https://graphicallinearalgebra.net/2017/04/16/a-monoid-is-a-category-a-category-is-a-monad-a-monad-is-a-monoid/) leads me to **all sorts** of headaches, and to no avail. What is important is that I make a **small confession**...

_This **entire** series has been about a branch of maths called **Category Theory**: the theory of **categories**_.

**Blam**! Here in programmer land, using our shiny new structures to write **fault-tolerant database systems** and  **reactive event streams**, we thought we were safe from maths... but **no**! The whole **purpose** of Fantasy Land is to utilise concepts from category theory that help us to write **safer code**. "Was `Functor` maths?" _I'm afraid so_. "Surely our `Semigroup` was innocent, though?" _I wish I could tell you so_. "Not `Alt` though, right? ... Right?" _All category theory. Please stop asking._

Perhaps you'll never need to think about `Category` again, and that's **fine**. Function composition is more than valuable enough to justify its existence. _However_, sooner or later, if you continue down this **rabbit hole**, you'll start asking **why** and **how**, and I'm sure you'll find your way back here...

Simply, there's really not much (immediately practical) to say about `Category` and `Semigroupoid` at this level of generality, but it's a neat little concept, and I thought it was nice to put a name to the pattern we've been seeing **all the time**! Next time you define a weird type of **relationship** (perhaps one involving `Monad`?), give a thought to the humble `Category` we've just seen, and see whether you can simplify your code with a more specific `compose` implementation.

---

The keen-eyed among you will have noticed that this is **the last Fantasy Land structure**, and that we've really come to **the end of the series**. Well... **don't panic**! I have **one more** article to publish before we call this whole thing a day. Call it the _encore_ that no one wanted.

On that note, next time, we'll be talking about **bringing concepts together** to build some cool little projects, and where you can go next! Otherwise, **thank you _so much_** for reading through **at least** 19 pages of my mindless rambling, and I hope that it has been useful in some small way.

Now, **write beautiful JavaScript**.

&hearts; &hearts; &hearts;

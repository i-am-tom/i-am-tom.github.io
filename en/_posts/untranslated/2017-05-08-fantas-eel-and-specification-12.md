---
layout: article
title: "Fantas, Eel, and Specification 12: Traversable"
description: Brace yourself; there's a lot to traverse.
redirect_from: /2017/05/08/fantas-eel-and-specification-12/
tags: untranslated
---

It's **`Traversable` Monday™**, everyone! Granted, _tomorrow_ would have made for a catchier opening, but I wasn't thinking this far ahead when I picked the day to release these. Still, I bet you can't _wait_ for `Monad`s now! Putting all that aside, does everyone remember how great the `insideOut` function from [the `Applicative` post](/2017/04/17/fantas-eel-and-specification-9/) was? Well, today's post is all about your **new favourite typeclass**.

This little class comes with, hands down, the most _frightening_ signature we've seen so far! Just _look_ at this thing:

```haskell
traverse :: Applicative f, Traversable t
         => t a -> (TypeRep f, a -> f b)
         -> f (t b)
```

_Right_? Let's break it down. We can take a `Traversable` structure (whatever _that_ means) with an inner `a` type, use this `a -> f b` function (where `f` is some `Applicative`), and we'll land on `f (t b)`. _Wait, **what**_?

The little bit of **magic** here is that, if we used the `a -> f b` with `map`, we'd end up with `t (f b)`, right? The `f b` replaces the `a` in the `t a`; nothing we haven't seen before. **However**, with `traverse`, the `f` and `t` come out **the other way round!**

---

In a **shocking** development, let's see some examples _before_ we trouble ourselves with the laws, as they're a bit **intimidating**. Let's say you have an `Array` of `Int` user IDs, and we need to do some **AJAX** for each one to get some details:

```javascript
// getById :: Int -> Task e User
const getById = id => // Do some AJAX
```

Luckily, we have our wonderful `Task` applicative to encapsulate the AJAX requests. We map over our `Array` with `getById`, and we end up with an `Array` of `Task` objects. **Neat**! However, whatever we're doing with them, we probably want to do it on the _entire_ `Array`, so wouldn't it be better to combine them into a single `Task e [User]`? Well, our luck just continues, because we have our nifty little `insideOut`:

```javascript
// insideOut :: Applicative f
//           => [f a] -> f [a]
const insideOut = (T, xs) => xs.reduce(
  (acc, x) => lift2(append, x, acc),
  T.of([]))

// paralleliseTaskArray
//   :: [Int] -> Task e [User]
const paralleliseTaskArray = users =>
  insideOut(Task, users.map(API.getById))
```

First we `map`, then we `insideOut`. Thanks to `Task`'s `Applicative` instance, we've successfully reached our goal! On top of _that_, the wonder of  `Apply` means all our AJAX will happen **in parallel**, with no extra effort!

Well, it turns out that there's a name for `insideOut` that encompasses more outer types than just `Array`, and we call it `sequence`! What's more, a `map` immediately followed by `sequence` has a more common name: `traverse`!

```javascript
Array.prototype.traverse =
  function (T, f) {
    return this.reduce(
      //    Here's the map bit! vvvv
      (acc, x) => lift2(append, f(x), acc),
      T.of([]))
  }

// Don't worry, though: `sequence` can also
// be written as a super-simple `traverse`!
const sequence = (T, xs) =>
  xs.traverse(T, x => x)
```

So, whenever we see `map` followed by `sequence`, we can just use `traverse`. Whenever all we want to do is **flip the types**, we can use `sequence`.

> _I usually define `sequence` **and** `traverse` on my `Traversable` types because they both get plenty of use._

Thinking about inner types, why stop with `Task`? What if we use another `Applicative` instead? Let's play with `Either`:

```javascript
// toChar :: Int -> Either String Char
const toChar = n => n < 0 || n > 25
  ? Left(n + ' is out of bounds!')
  : Right(String.fromCharCode(n + 65))

// Right(['A', 'B', 'C', 'D'])
;[0,  1,  2,  3].traverse(Either, toChar)

// Left('-2 is out of bounds!')
;[0, 15, 21, -2].traverse(Either, toChar)
```

By using `traverse` with an inner type of `Either`, we get back the first `Left` if _any_ of the values `map` to a `Left`! In other words, we get back the **first error**. Consider, for a minute, how **incredibly useful** this is for **form validation**.

> _What if we just want the successes, and to filter out the rest_? We `map` our function, then `map(map(x => [x]))` to get all the `Right` values into a singleton list, then `fold` the list with the `Either` **semigroup** starting with `Right([])`. I swear, I can't get through a single post without mentioning some sort of fold!

In fact, why stop with `Array`? We can define `Traversable` instances for all sorts of things: `Maybe`, `Either`, `Pair`, and even our `Tree` from last time! What's the _secret_, though?

A `Traversable` type needs to know how to **rebuild itself**. It pulls itself apart, lifts each part into the `Applicative`, and then puts itself back together. With the wonderful help of `of` and `ap`, it's not hard to get all the pieces _into_ the `Applicative`, so the only trickery is the work on either side. _Luckily_, this is often very straightforward:

```javascript
// Transform _2, then `map` in the _1!
Pair.prototype.traverse = function (_, f) {
  return f(this._2).map(
    x => Pair(this._1, x))
}

// Keep the nothing OR map in the Just!
Maybe.prototype.traverse = function (T, f) {
  return this.cata({
    Just: x => f(x).map(Maybe.Just),
    Nothing: () => T.of(Maybe.Nothing)
  })
}

// Lift all the bits, then rebuild!
Tree.prototype.traverse = function (T, f) {
  return this.cata({
    Node: (l, n, r) => lift3(
      l => n => r =>
        Tree.Node(l, n, r),

      l.traverse(T, f),
      f(n),
      r.traverse(T, f))
    Leaf: () => T.of(Tree.Leaf)
  })
}
```

> _If you've been following the [Reader](/2017/04/15/functions-as-functors/)/[Writer](/2017/04/27/pairs-as-functors/)/State series, we'll actually be taking a look at the `Pair` traversable in the finale!_

If you can `map` and `reduce` your type (i.e. it's a `Functor` and a `Foldable`), there's a really good chance that it can be a `Traversable`, too. Trust me: `Task`'s `Applicative` instance is _enough_ reason to get excited about this!

> `Task` is also a good example of a type that _isn't_ `Traversable`, despite it having a similar structure to `Either`. What's the difference? Well, consider a `Task` that returns a `Maybe` to denote success. If we _could_ traverse `Task`, we'd get back `Just` a successful task, or `Nothing`. See why this is impossible? We don't _know_ whether the `Task` succeeds until we run it!

---

Before you get _too_ excited and go all **super-villian** on me with your new-found **superpowers**, let's end on **the laws**. _Brace yourselves_. We'll start with **identity**, as it's definitely the simplest:

```javascript
u.traverse(F, F.of) === F.of(u)
```

If we take a `Traversable` structure of type `T a`, and _traverse_ it with `F.of` (which is `a -> F a` for some `Applicative F`), we'll get back `F (T a)`. **Map and turn inside-out**. What _this_ law says is that we'd have ended up in the same place if we'd just called `F.of` on the whole `T a` structure. Squint a little, and ignore the `TypeRep`: `U.traverse(F.of) === F.of(U)` doesn't look a million miles from `U.map(id) === id(U)` (the identity law for `Functor`), does it?

Next up is **naturality**, which is a bit of a mess in the spec, so let's try to **clean it up**. Let's imagine we have two `Applicative` types, `F` and `G`, and some function `t :: F a -> G a`, that does nothing but **change the `Applicative`**.

> A function that transforms one `Functor` into another _without_ touching the inner value is called a **natural transformation**!

```javascript
t(u.sequence(F)) === u.traverse(G, t)
```

So, we start with some `U (F a)`-type thing, `sequence` it, and land on `F (U a)`. We then call `t` on the result, and finally land on `G (u a)`. **Naturality** says that we could just call `t` directly in a `traverse` and end up in the same place! I read this as saying, "_A `traverse` should behave the same way regardless of the inner `Applicative`_"; it doesn't matter whether we do the transformation **during** or **after**.

> This law is actually _implied_ by **parametricity**, which is a topic we might cover in the future. Basically, it means that the type signature of `traverse` is restricted enough that this can't **not** be true for any `Traversable` that follows the **other two** laws!

Last up is **composition**, and we're going to need to introduce a type we haven't seen before. `Compose` is a way of combining two `Functor`s into one (and even two `Applicative`s into one!), and it goes a little something like this:

```javascript
// Type Compose f g a = Compose (f (g a))
const Compose = (F, G) => {
  const Compose_ = daggy.tagged('Compose', ['stack'])

  // compose(F.of, G.of)
  Compose_.of = x =>
    Compose_(F.of(G.of(x)))

  // Basically map(map(f))
  Compose_.map = function (f) {
    return Compose_(
      this.stack.map(
        x => x.map(f)
      )
    )
  }

  // Basically lift2(ap, this, fs)
  Compose_.ap = function (fs) {
    return Compose_(
      this.stack
          .map(x => f => x.ap(f))
          .ap(fs.stack)
    )
  }

  return Compose_
}
```

We're not going to spend too much time on this type, so have a **couple of looks** to make sure you're following. The key point here is that we've stacked two `Applicative`s to form a **composite** `Applicative` - how **amazing** is that? Even more excitingly, this rule generalises to **any number** of nested `Applicative`s - they compose **completely mechanically**!

> `Compose` will _also_ be an important part of the upcoming `State` post, so don't think we've seen the last of it!

Anyway, let's get back to the point of introducing this type _here_. We'll use `F` and `G` as our `Applicative` placeholders again, and end up with the law below. [The spec](https://github.com/fantasyland/fantasy-land#traversable) only uses `traverse`, but this should make things a bit clearer:

```javascript
const Comp = Compose(F, G)

// The type signature helps, I think:
// t (F (G a)) -> Compose F G (t a)
u.map(Comp).sequence(Comp) ===
  Comp(u.sequence(F)
        .map(x => x.sequence(G)))
```

This one's the **ugliest** of the bunch! We start with some `u` of type `t (F (G a))`, where `t` is `Traversable`. On the **left-hand** side, we `map` over this with `Comp` and land on `t (Compose F G a)`. Because `Compose F G` is an `Applicative`, we can turn this **inside out** and land on `Compose F G (t a)`. Whew!

The **right-hand** side says we can `sequence` the `t (F (G a))` to get us to `F (t (G a))`, then `map` a `sequence` over it to get us to `F (G (t a))`. If we pass this into `Comp`, we land on `Compose F G (t a)`, and we **must land** on the **same result** as the left-hand side did!

This is a _really_ dense law, but **just remember this**: we can either `Compose` the `Applicative`s **inside** the `Traversable` and _then_ `sequence`, or `sequence` and _then_ `Compose`. **It shouldn't matter**. I read this as a kind of **re-inforcement** of **naturality**; not only should the `Traversable` leave the `Applicative` alone, but it should **respect `Applicative` composition**.

---

`Traversable` has some _thorough_ laws, but this is a **good thing**! The tighter the **restrictions**, the better we can **optimise** the instances we write: we've already had a _taste_ of the power behind the `Traversable` / `Applicative` relationship! _However_, there's a problem that we still haven't addressed:

We know we can do **parallel** computation with our `Applicative`, but how do we do **serial** computation? How do we **compose** functions that return `Functor`s? These questions, and others, will be solved **next week** when we cover `chain`.

Until then, `traverse` all the things! A Gist of this post's [motivating examples](https://gist.github.com/i-am-tom/0fa536e81787df1c94a55f1b4c92e94e) is available. `Array` will, by far, be the one you use the most, but don't be afraid to experiment. I look forward to your creations!

&hearts;

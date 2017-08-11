---
layout: post
title: "Fantas, Eel, and Specification 18: Bifunctor and Profunctor"
description: Yippee Ki-Yay, All the Functors!
---

**The worst is behind us**. We've [mastered the `Monad`](/2017/06/05/fantas-eel-and-specification-15/), [conquered the `Comonad`](/2017/06/19/fantas-eel-and-specification-17/), and [surmounted the `Semigroup`](/2017/03/13/fantas-eel-and-specification-4/). Consider these last two posts to be a **cool-down**, because **the end is in sight**. Today, to enjoy our first week of rest, we're going to revise **functors**.
A number of times, we've seen types with **two** inner types: `Either`, `Pair`, `Task`, `Function`, and so on. However, in all cases, we've **only** been able to `map` over the **right-hand** side. Well, Fantasists, the reason has something to do with a concept called **kinds** that we won't go into. Instead, let's look at **solutions**.

We'll take a type like `Either` or `Pair`. These types have **two** inner types (_left_ and _right_!) that we could `map` over. The `Bifunctor` class allows us to deal with both:

```haskell
bimap :: Bifunctor f
      => f a c
      ~> (a -> b, c -> d)
      -> f b d
```

It's pretty much **exactly like `Functor`**, except we are mapping **two at a time**! What does this look like in _actual_ code?

```javascript
Either.prototype.bimap =
  function (f, g) {
    return this.cata({
      Left: f,
      Right: g
    })
  }

Pair.prototype.bimap =
  function (f, g) {
    return Pair(f(this._1),
                g(this._2))
  }

Task.prototype.bimap =
  function (f, g) {
    return Task((rej, res) =>
      this.fork(e => rej(f(e)),
                x => res(g(e))))
  }
```

Hopefully, no huge surprises. We apply the **left function** to any mention of the **left value**, and the same for the right. Even the laws are just **doubled-up** versions of the `Functor` laws:

```javascript
// For some functor U:

// Identity
U.map(x => x) === U

// Composition
U.map(f).map(g) ===
  U.map(x => g(f(x)))

// For some bifunctor C:

// Identity
C.bimap(x => x, x => x) === C

// Composition
C.bimap(f, g).bimap(h, i) ===
  C.bimap(l => h(f(l)),
          r => i(g(r)))
```

A lot of brackets, but look closely: the laws are the same, but we have **two independent "channels"** on the go!

> _Fun fact: if you have a `Bifunctor` instance for some type `T`, you can automatically derive a fully-lawful `Functor` instance for `T a` with `f => bimap(x => x, f)`. **Hooray, Free upgrades**!_

So, is this useful? **Yes**! Let's look at a neat little example using `Either` for a second:

```javascript
//- Where everything changes...
const login = user =>
  isValid(user) ? Right(user)
                : Left('Boo')

//- Function map === "piping".
//+ failureStream :: String
//+               -> HTML
const failureStream =
  (x => x.toUpperCase())
  .map(x => x + '!')
  .map(x => '<em>' + x + '</em>')

//+ successStream :: User
//+               -> HTML
const successStream =
  (x => x.name)
  .map(x => 'Hey, ' + x + '!')
  .map(x => '<h1>' + x + '</h1>')

//- We can now pass in our two
//- possible application flows
//- using `bimap`!
login(user).bimap(
  failureStream,
  successStream)
```

Note that this would also work with `Task`! We're in a situation where we want to transform a potential success _or_ failure, and `bimap` lets us supply both at once. _Cool_, right? **Straightforward**, too!

---

Now, `Function` is a _slightly_ different story. Effectively, we can `contramap` over its **left-hand type** (the **input**) and `map` over its **right-hand type** (the **output**). It turns out there's a fancy name for this sort of thing, too: `Profunctor`.

```haskell
promap :: Profunctor p
       => p b c
       ~> (b -> a, c -> d)
       -> p a d
```

You can think of it as adding a **before** and **after** step to some process. Naturally, the laws look like a **mooshmash** of `Contravariant` and `Functor`:

```javascript
// For some profunctor p:

// Identity...
P.promap(a => a, b => b) === P

// Composition...
p.promap(f, i).promap(g, h) ===
  p.promap(a => f(g(a)),
           b => h(i(b)))
```

> _Guess what? You can build a functor `P a` out of any profunctor `P`: `f => promap(x => x, f)` is all it takes. So many **free upgrades**!_

The **left-hand** side looks like `Contravariant`, and the **right-hand** side like `Functor`. Of course, we've seen a `Profunctor` already: **`Function`**! However, to give a slightly more **exciting** example, let's look at one of my **favourites**: `Costar`.

```javascript
//- Fancy wrapping around a specific type
//- of function: an "f a" to a "b"
//+ Costar f a b = f a -> b
const Costar = daggy.tagged('run')

//- Contramap with the "before" function,
//- fold, then apply the "after" function.
//+ promap :: Functor f
//+        => Costar f b c
//+        -> (b -> a, c -> d)
//+        -> Costar f a d
Costar.prototype.promap = function (f, g) {
  return Costar(x => g(this.run(x.map(f))))
}

//- Takes a list of ints to the sum
//+ sum :: Costar Array Int Int
const sum = Costar(xs =>
  xs.reduce((x, y) => x + y, 0))

//- Make every element 1, then sum them!
const length = sum.promap(_ => 1, x => x)

//- Is the result over 5?
const isOk = sum.promap(x => x, x => x > 5)

//- Why not both? Is the length over 5?
const longEnough = sum.promap(
  _ => 1, x => x > 5)

// Returns false!
longEnough.run([1, 3, 5, 7])
```

`Costar` allows us to take the idea of `reduce` and wrap it in a `Profunctor`. We can use `promap` to **prepare** different inputs for the reduction _and_ **manipulate** the result. You may have heard of this idea before: **map/reduce**. No matter how **complex** the process, there's a good chance that you can express it in a `Profunctor`!

---

These are, of course, _very_ quick overviews of `Bifunctor` and `Profunctor`. That said, if you're comfortable now with `Functor` and you remember the post on `Contravariant`, there's **nothing new** to learn! We're really just building on ideas we've already had. `Bifunctor` might seem a little _underwhelming_ now that we've seen the **power** of `Monad` and `Comonad`, but it's _twice_ as powerful as `Functor`: we can define a flow for **success** and **error**, for **left** and **right**, for... well, any **two things**!

As for `Profunctor`, it's a pretty massive topic once you start digging. `Costar` is the opposite of `Star`, which is an `a -> f b` function; why not think about how to implement that? Would you need any **special conditions** to make it a `Profunctor`?

Take [the article's gist](https://gist.github.com/i-am-tom/d28e4e5d4803e59195a4f872da744fa9), and `bimap` and `promap` until the cows come home, Fantasists, for there is only **one** article left: `Semigroupoid` and `Category`. Expect **high drama**, **hard maths**, and **herds of monoids**. Well, maybe not the second thing...

Until then!

&hearts;

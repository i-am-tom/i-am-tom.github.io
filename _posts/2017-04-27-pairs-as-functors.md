---
layout: post
title: Pairs as Functors
description: Building the Writer monad.
---

Two-ish weeks ago, we talked about the [wonderful flexibility of `Function`](/2017/04/15/functions-as-functors/) when you start treating it as a `Functor`. We started off with **composition**, then **branching** composition, and then finally **environment-aware** composition. We also gave our humble function a new name: `Reader`. Today, we're going to walk the same path for `Pair`, and build up a closely-related idea.

## `Functor`

It's pretty simple to write an implementation of `Functor` for a `Pair a b` structure:

```javascript
const Pair = daggy.tagged('_1', '_2')

// We just transform the second value!
// map :: Pair a b ~> (b -> c) -> Pair a c
Pair.prototype.map = function (f) {
  return Pair(this._1, f(this._2))
}
```

We transform the second half, but leave the first alone. I'm going to suggest that we treat the `Pair` functor as a way of modelling **values with metadata** - some **extra information** about the value. I'll admit that this, in isolation, is not particularly useful. However, we'll see that, with some extra functionality provided by `ap` and `chain`, it'll start to make sense.

## `Applicative`

Now, let's make something _interesting_. Turns out that one useful `Applicative` implementation requires the left-hand side to be a `Monoid`. We can implement this like so:

```javascript
const Pair = T => {
  const Pair_ = daggy.tagged('_1', '_2')

  Pair_.prototype.map = function (f) {
    return Pair_(this._1, f(this._2))
  }

  Pair_.prototype.ap = function (fs) {
    return Pair_(fs._1.concat(this._1),
                 fs._2(this._2))
  }

  Pair_.of = x => Pair_(T.empty(), x)

  return Pair_
}
```

> _As usual, note that only a `Semigroup` is required for `Apply`, but `of` needs `empty` to produce a valid left-hand value_.

Turns out this is a pretty useful implementation, which is definitely made more readable with some help from `lift2`. _Readers of the Fantasy Land series will remember [the post on `Apply`](http://www.tomharding.me/2017/04/10/fantas-eel-and-specification-8/), where we discussed `lift2` as a way of "combining contexts" with a given function._ Let's imagine we have a set of actions that have "costs". We can write them as a `Pair` with `Sum` as the left-side monoid:

```javascript
const CostPair = Pair(Sum)

//- Database lookups are pretty costly...
//+ userFromDB :: Int
//+            -> Pair (Sum Int) String
const nameFromDB = id => CostPair(
  Sum(100), getUserById(id))

//- ... but ordering/counting is harder.
//+ rankFromDB :: Int
//+            -> Pair (Sum Int) Int
const rankFromDB = id => CostPair(
  Sum(500), getUserRankById(id))

//- Do both jobs, end up with Sum(600)!
//+ getUserData :: Int
//+             -> Pair (Sum Int) User
const getUserData = id => lift2(
  x => y => ({ name: x, rank: y }),
  nameFromDB(id), rankFromDB(id))

// ===================== //

//- By the way, we can use `Function` as an
//- `Applicative` as we did last time, and
//- that lets us write this with a couple
//- of `lift2` calls! Beautiful point-free!
//+ getUserData_ :: Int
//+              -> Pair (Sum Int) User
const getUserData_ = lift2(
  lift2(x => y => ({ name: x, rank: y }),
  nameFromDB, rankFromDB)
```

So, we can collect the "cost" of our computation as we go, which we could then analyse at the end. As we said with `Functor`, the `Pair` allows for **metadata**, which, in this case, is cost of computation. We could also swap out `Sum` for `Max` to find the most expensive operation in our app, or `Average` to... well, find the average!

## `Monad`

```javascript
const Pair = T => {
  ...

  Pair_.prototype.chain = function (f) {
    const that = f(this._2)

    return Pair_(this._1.concat(that._1),
                 that._2)
  }

  ...
}
```

> Again, `Monad` requires `of` (`Applicative`) and thus needs a `Monoid` for the left side. `Chain` doesn't require `of`, and so we can get away with a `Semigroup`.

This `chain` function allows us to string actions together, while also collecting a value in the monoid, as we did before. Of course, this will work with the `CostPair` we defined above, but let's try something a bit different. Let's instead use `[String]` as our monoid, and play some [Guess Who?](https://en.wikipedia.org/wiki/Guess_Who%3F)

```javascript
// Sneaky monkey patch!
Array.empty = () => []

LogPair = Pair(Array)

// Lift the users into the LogPair type.
// (The left side at this point is [])
LogPair.of(users)

// Keep only the users with brown hair
.chain(users => LogPair(
  ['Brown hair'],
  users.filter(user =>
    user.hair === 'brown')))

// Keep only the users over 180cm tall
.chain(users => LogPair(
  ['Tall'],
  users.filter(user =>
    user.height > 180)))

// Count the remaining users
.map(users => users.length)

// e.g.: Pair(['Brown Hair', 'Tall'], 36)
```

We can see that our final result is another `Pair`, whose right side holds the number of remaining users, as we'd expect. However, the left side is now a list of all the actions that got us to that number! If you built your whole app inside the `Pair` monad, you would have a purely-functional **logger**, to which you could write any number of messages at any time. On top of that, `Array`'s `Monoid` implementation doesn't care about the _inner_ type, so you can log any data structure you want!

This nifty little pattern - writing something to a log (or really just appending to a monoid) while transforming the other value - is what gives this type the common name `Writer`. It is, in essence, the opposite of `Reader`: `Reader` can _read_ from some "global" state, `Writer` can _write_ to some "global" state.

---

So, we've seen that, through a different lens, `s -> a` is a `Reader`, and `(s, a)` is a `Writer`. We have **readable or writable state**, and they're purely functional! There's only one downside, though: what if we want _both_?

Think about what state _is_ in stateful languages. It's a thing that can change as a result of **any instruction**. This means, really, our stateful languages execute functions kinda like this:

```haskell
execute :: (State, Action) -> State
```

We take an **instruction** (`Action`) and the **current state**, and we get back a potentially **new state**. Maybe something has been written the console, maybe a variable has been updated, etc. That's really the most abstract that we can make it, and will look familiar to users of packages like [Redux](http://redux.js.org/docs/basics/Reducers.html#handling-actions). Now, take a closer look at `execute`:

```haskell
--                FUNCTION v
execute :: (State, Action) -> State
--               ^ PAIR
```

**OMGWTF**. Turns out that `execute` is a combination of `Reader` and `Writer`! Well, if we can make **read-only** state purely functional, and **write-only** state purely functional, and we can see that `State` is really just a combination of the two... there has to be a way to build purely functional **read and write** state, right?

**Right**. Next time, we'll look at the `State` type, and see how we can combine these two principles to give us everything we need to combat those **pesky naysayers** who think functional programming is impractical. **Get excited**!

&hearts;

_PS: if you want to play with the code in this post, I've put [all the code in a Gist](https://gist.github.com/i-am-tom/286cb133f74404305814e311e7162351), so why not mess around with it?_

---
layout: post
title: "Fantas, Eel, and Specification 13: Chain"
description: Context composition
---

_You told me to **leave you alone**. My Papa said, "**Come on home**". My doctor said, "**Take it easy**", but your lovin' is **much too strong**. I'm added to your... `Chain`, `Chain`, `Chain`_! Maybe we didn't compose _that_ one, but we're going to `compose` plenty of things today!

Let's take a moment to recap a few previous posts. When [we covered `Functor`](/2017/03/27/fantas-eel-and-specification-6/), we saw that functors created **contexts** in which our "language" could be **extended**:

```haskell
a :: a -> [b]        -- Multiple results
m :: a -> Maybe b    -- Possible failure
e :: a -> Either e b -- Possible exception
t :: a -> Task e b   -- Async action
```

We've also seen that [`Applicative` functors](/2017/04/10/fantas-eel-and-specification-8/)' contexts can be **combined** to give us cool tricks like parallel `Task` actions and [`Traversable`](/2017/05/08/fantas-eel-and-specification-12/):

```javascript
// Just([-1, -2, -3])
;[1, 2, 3].traverse(Maybe, x => Just(-x))

// Logs 50 (after only 2000ms!)
lift2(
  x => y => x + y,

  new Task((_, res) =>
    setTimeout(
      () => res(20),
      2000)),

  new Task((_, res) =>
    setTimeout(
      () => res(30),
      1000)))
.fork(
  _ => console.error('???'),
  x => console.log(x))
```

There's one thing we _can't_ do, though. What if we want to `compose` two `Functor`-returning functions? Take a look at this example:

```javascript
//+ prop :: String -> StrMap a -> Maybe a
const prop = k => xs =>
  k in xs ? Just(xs[k])
          : Nothing

const data = { a: { b: { c: 2 } } }
const map = f => xs => xs.map(f)

// How do we get to the 2?
prop('a')(data) // Just({ b: { c: 2 } })
.map(prop('b')) // Just(Just({ c: 2 }))
.map(map(prop('c'))) // Just(Just(Just(2)))

// And if we fail?
prop('a')(data) // Just({ b: { c: 2 }})
.map(prop('badger')) // Just(Nothing)
.map(map(prop('c'))) // Just(Nothing)
```

So, we **can** get to the `2`, but not without a lot of **mess**. We `map` more and more each time, when all we _really_ want is a `Just 2` if it works and a `Nothing` if it doesn't. What we're missing is a way to **flatten** layers of `Maybe`. Enter `join`:

```javascript
//+ join :: Maybe (Maybe a) ~> Maybe a
Maybe.prototype.join = function () {
  return this.cata({
    Just: x => x,
    Nothing: () => Nothing
  })
}

prop('a')(data) // Just({ b: { c: 2 } })
.map(prop('b')).join() // Just({ c: 2 })
.map(prop('c')).join() // Just(2)

prop('a')(data) // Just({ b: { c: 2 } })
.map(prop('badger')).join() // Nothing
.map(prop('c')).join() // Nothing
```

We seem to have **solved** our problem! Each time we `map` with a `Maybe`-returning function, we call `join` to flatten the two `Maybe` layers into one. `map`, `join`, `map`, `join`, and so on. Back in [the `Traversable` post](/2017/05/08/fantas-eel-and-specification-12/), we saw that the `map`/`sequence` pattern was common enough that we gave it an alias: `traverse`. Wouldn't you know it, the same applies here: the `map`/`join` pattern is so common, we call it `chain`.

```javascript
//+ chain :: Maybe a ~> (a -> Maybe b)
//+                  -> Maybe b
Maybe.prototype.chain = function (f) {
  return this.cata({
    Just: f,
    Nothing: () => this // Do nothing
  })
}

// Just like `sequence` is `traverse` with
// `id`,  `join` is `chain` with `id`!
//+ join :: Chain m => m (m a) ~> m a
const join = xs => xs.chain(x => x)

// Our example one more time...
prop('a')(data) // Just({ b: { c: 2 } })
.chain(prop('b')) // Just({ c: 2 })
.chain(prop('c')) // Just(2)
```

**So many parallels!** Now, this fancy little pattern is useful far beyond an occasional `Maybe`. It turns out that we can unlock a **lot** of behaviour this way:

```javascript
//+ chain :: Either e a
//+       ~> (a -> Either e b)
//+       -> Either e b
Either.prototype.chain = function (f) {
  return this.cata({
    Right: f,
    Left: _ => this // Do nothing
  })
}

const sqrt = x => x < 0
  ? Left('Hey, no!')
  : Right(Math.sqrt(x))

Right(16)
.chain(sqrt) // Right(4)
.chain(sqrt) // Right(2)

Right(81)
.chain(sqrt)  // Right(9)
.map(x => -x) // Right(-9) 😮
.chain(sqrt)  // Left('Hey, no!')
.map(x => -x) // Left('Hey, no!')

Left('eep')
.chain(sqrt) // Left('eep')
```

Just as `Maybe`'s `chain` would carry forward a `Nothing`, `Either`'s will carry forward the first `Left`. We can then chain a bunch of `Either`-returning functions and get the first `Left` if anything goes wrong - just like **throwing exceptions**! With `Either`, we can model exceptions in a **completely pure way**. **Pure**. Savour this moment. We **fixed** exceptions.

This one's **exciting**, right? Let's see what `Array` can do:

```javascript
//+ chain :: Array a
//+       ~> (a -> Array b)
//+       -> Array b
Array.prototype.chain = function (f) {
  // Map, then concat the results.
  return [].concat(... this.map(f))
}

// NB: **totally** made up.
const flights = {
  ATL: ['LAX', 'DFW'],
  ORD: ['DEN'],
  LAX: ['JFK', 'ATL'],
  DEN: ['ATL', 'ORD', 'DFW'],
  JFK: ['LAX', 'DEN']
}

//- Where can I go from airport X?
//+ whereNext :: String -> [String]
const whereNext = x => flights[x] || []

// JFK, ATL
whereNext('LAX')

// LAX, DEN, LAX, DFW
.chain(whereNext)

// JFK, ATL, ATL, ORD, DFW, JFK, ATL
.chain(whereNext)
```

With `Array`, we `map` with some `Array`-returning function, then flatten all the results into one list. `map` and `join`, just like everything else! Here, we're essentially **traversing a graph**, and building up a list of **possible positions** after each **step**. In fact, languages like [**PureScript** use `chain` to model **loops**](https://github.com/purescript/purescript/wiki/Differences-from-Haskell#array-comprehensions)_*_:

```javascript
//- An ugly implementation for range.
//+ range :: (Int, Int) -> [Int]
const range = (from, to) =>
  [... Array(to - from)]
  .map((_, i) => i + from)

//- The example from that link in JS.
//+ factors :: Int -> [Pair Int Int]
const factors = n =>
  range(1, n).chain(a =>
    range(1, a).chain(b =>
      a * b !== n
      ? []
      : [ Pair(a, b) ]))

// (4, 5), (2, 10)
factors(20)
```

---

Now, let's talk about [our `Task` type](https://github.com/folktale/data.task)<sup>†</sup>. We've seen that, with its `Apply` implementation, we get **parallelism for free**. However, we haven't actually talked about how to get **serial** behaviour. For example, what if we wanted to do some AJAX to get a _user_, and then use the result to get their _friends_? Well, `chain` would appear to be exactly what we need:

```javascript
//+ getUser :: String -> Task e Int
const getUser = email => new Task(
  (rej, res) => API.getUser(email)
                .map(x => x.id)
                .then(res)
                .catch(rej))

//+ getFriendsOf :: Int -> Task e [User]
const getFriends = id => new Task(
  (rej, res) => API.getFriends(id)
                .then(res)
                .catch(rej))

// Task e [User] - hooray?
getUser('test@test.com').chain(getFriends)
```

It turns out this behaviour **is** defined on our `Task` type, so we can `chain` together `Task` objects to get **sequencing** when we need it, and `ap` them together for **free parallelism**. Before we get _too_ excited, though, let's talk about what's **wrong** here.

If a type **lawfully** implements `Chain` (and hence `Apply` and `Functor`), we can **derive** `ap` using `chain` and `map`:

```javascript
//+ ap :: Chain m => m a ~> m (a -> b) -> m b
MyType.prototype.ap = function (fs) {
  return fs.chain(f => this.map(f))
}
```

**So what**? Well, this `ap` doesn't behave like the `ap` we already have. Most importantly, there's **no parallelism**! Houston, **we have a problem**. In the case of `Task`, either the `ap` or `chain` method is therefore **unlawful**.

> There have been [similar discussions](https://github.com/ekmett/either/pull/38#issuecomment-95688646) that are worth reading for more background, but this point is quite an _advanced_ discussion, so brace yourself.

This means that, to write **law-obiding** code, we need to accept that either our `ap` method is wrong, or our `chain` method shouldn't exist. _Personally, I've always chosen to view `chain` as the "problem method", and asserted that `Task` is an `Applicative` but **not** a `Chain`_. What we **should** do is **convert** our `Task` to some "sequential" type when we want to do something sequential:

```javascript
// A "sequential" async type.
const Promise = require('fantasy-promises')

// For "errors" within Promise.
const { Left, Right }
  = require('fantasy-eithers')

//- Convert a Task to a Promise
//+ taskToPromise :: Task e a
//+               -> Promise (Either e a)
const taskToPromise = task => Promise(
  res => task.fork(e => res(Left(e)),
                   x => res(Right(x))))

//+ promiseToTask :: Promise (Either e a)
//+               -> Task e a
const promiseToTask = promise =>
  new Task((rej, res) =>
    promise.fork(either =>
      either.cata({
        Left: rej,
        Right: res
      })
    )
  )

//- Finally...
//+ andThen :: Task e a ~> (a -> Task e b)
//+                     -> Task e b
Task.prototype.andThen = function (f) {
  return promiseToTask(
    taskToPromise(this)
    .chain(either => either.cata({
      // We "lift" failure using Promise'
      // Applicative instance.
      Left: _ => Promise.of(either),

      Right: x => taskToPromise(f(x))
    }))
  )
}

//- ... which gives us:
getUser('test@test.com')
.andThen(getFriends)
```

**Big and scary**, but don't panic. Here, we're taking advantage of the **natural transformation** between `Task` and the composition of `Promise` and `Either e` in **both** directions: we move to a **sequential** context, do something sequential, then move back to the **parallel** context.

With `promiseToTask` and `taskToPromise`, we can convert any `Promise` into a `Task` and vice versa. This is exactly what we need in order to say that `Promise` and `Task` are **isomorphic**!

> **Isomorphisms** come up a lot to avoid these problems: if we can "convert" a type into another type with a required **capability**, and then convert it back, it's as good as having that capability in our **original** type! The difference is, however, that we're not breaking the **laws**.

Of course, you could just as easily go ahead and use `chain`, and accept that it is **badly-behaved**. That's cool, as long as you're **aware** of this, and know to expect some **unexpected** results. You could also write a simple implementation of `andThen`:

```javascript
//+ No intermediate type!
Task.prototype.andThen = function (f) {
  return new Task((rej, res) =>
    this.fork(rej, x =>
      f(x).fork(rej, res))
  )
}
```

It's really down to you, but the _lengthier_ method means that we neatly separate our **parallel** and **sequential** types, and can know what behaviour is expected in each. `Task`'s author wrote a [blog post on async control](http://robotlolita.me/2014/03/20/a-monad-in-practicality-controlling-time.html), which may shed more light here.

---

We've seen what `chain` does: `map` then `join`. This is why you'll hear it called `flatMap` sometimes: it `maps` and then "flattens" two layers of `Chain` type into one. You might also hear `concatMap` (named after `Array`'s particular implementation) or `bind`.

We've also seen that we can define `ap` in terms of `chain` in a way that will work for **any** law-obiding type. _If you don't believe me, try it with `Maybe`, `Either`, or `Array`_! This, however, isn't the only **rule** that we have to follow. There's one, very _familiar_, **law** that comes with this class:

```javascript
// Associativity.
m.chain(f).chain(g)
  === m.chain(x => x.chain(g))

// Remember Semigroups?
a.concat(b).concat(c)
  === a.concat(b.concat(c))
```

Just as `Semigroup` was associative at **value**-level, and `Apply` was associative at **context**-level, we can see that `Chain` seems to be associative at an **order**-level: unlike `Apply`, which we saw would freely allow for parallelism, `Chain` **implies order**. Just look at the type of `chain`:

```haskell
chain :: Chain m => m a
                 ~> (a -> m b)
                 -> m b
```

Our `chain` function is useless until we know what the `a` in `m a` is. How can we `chain` a function on a `Promise` until the first part has completed? How can we `chain` a function on a `Maybe` until we know whether the first part failed? With `chain`, we finally have a way to **encode** order into our programs, and strictly **forbid** parallelism when we need to.

I think it's **amazing** that we managed to achieve all that we have so far _without_ this concept! We're so used to order being determined by the ordering of the lines in our file, but that's because of **state**: we can't mix those lines up because they may depend on one another.

With **purely-functional** code, we know that can't be true, and that all dependencies are **explicit**. Who cares which side of an `ap` gets calculated first? Who cares whether a `map` happens now or later? Until we `fork` or `extract` a value from a `Functor`, it's just not important - it's an **implementation detail**!

A note to end on: for `Semigroup`, we had `Monoid`, which brought the **empty value**. For `Apply`, we had `Applicative`, which brought the **pure context**. Seems logical that `Chain` would have a similar partner, right? We'll get to it in a _fortnight_.

Until then, mess around with [this post's Gist](https://gist.github.com/i-am-tom/f7b6059ee739764b56e702a612090d27), and **`chain` all the things**! With **parallel** and **sequential** power, you actually now have **everything** you need to write any app in an **entirely pure** manner. Check out [the `fantasy-io` library](https://github.com/fantasyland/fantasy-io) to see how we can encode **any** IO in a `Chain` type and completely **remove** the need for **state**. Go on: **I dare you**!

&hearts;

<iframe src="https://open.spotify.com/embed/track/2oZmMp5M6L0Rh7G84Um2tF" width="300" height="80" frameborder="0" allowtransparency="true"></iframe>

_* `do` notation really just connects each line with a `chain` call (or `bind`, as it's known in Haskell/PureScript). Here's [more information on `do`](https://en.wikibooks.org/wiki/Haskell/do_notation#Just_sugar), but I wouldn't worry too much at this stage._

_<sup>†</sup> Hat-tip to [@safareli](https://twitter.com/safareli/), who reminded me to include this bit!_

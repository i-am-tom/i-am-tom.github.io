---
layout: article
title: "Functions as Functors"
description: From Function through to Reader, via Functor, Applicative, and Monad.
redirect_from: /2017/04/15/functions-as-functors/
tags: untranslated
---

Hello! I was explaining the other day how `Function`'s implementations of the different typeclasses can be useful, and I thought I might as well write them up in case they can be useful to someone. It's also _much_ easier than writing **140-character blocks**. Specifically, we'll go through `Functor`, `Apply`, and `Chain`, with examples all the way.

In all these cases, I've represented the `Function` type as `((->) x)`. So, `Function a` means `((->) x) a`, which _probably_ looks more familiar as `x -> a`. Read it as, "_A function from values of type_ `x` _to values of type_ `a`". I've written the signatures in all three styles, along with the general rule where applicable.

## `Functor`

```javascript
//       f  a ~> (a -> b) ->       f  b
// Function a ~> (a -> b) -> Function b
// ((->) x) a ~> (a -> b) -> ((->) x) b
//  (x -> a)  ~> (a -> b) ->  (x -> b)
Function.prototype.map = function (that) {
  return x => that(this(x))
}
```

What `map` does is create a _new_ function that calls the original, _and then_ the mapping function, to build up a kind of pipeline:

```javascript
const myFunction =
  (x => x.length)
  .map(x => x + 2)
  .map(x => x / 2)

// Returns "7.5"
myFunction('Hello, world!')
```

Of course, you probably know of another tool for creating pipelines of functions:

```javascript
// The `map` we know and love.
// map :: Functor f => (b -> c)
//                  -> f b -> f c
const map = f => xs => xs.map(f)

// WHAT IF I TOLD YOU...

// Read `f` in the above as ((->) a)...
// compose :: (b -> c)
//         -> (a -> b)
//         ->  a -> c
const compose = map // WHAT
```

I _know_, right?

## `Apply`

```javascript
// f  a ~> f (a -> b)
//      -> f  b

// Function a ~> Function (a -> b)
//            -> Function b

// ((->) x) a ~> ((->) x) (a -> b)
//            -> ((->) x) b

//  (x -> a) ~> (x -> a -> b)
//           ->  (x -> b)

Function.prototype.ap = function (that) {
  return x => that(x)(this(x))
}
```

Some of you will know that I find `Apply` to be best appreciated through the lens of `lift2`. As mentioned in [the `Apply` article of the Fantasy Land series](http://www.tomharding.me/2017/04/10/fantas-eel-and-specification-8/), `lift2` _combines_ two contexts into one:

```javascript
// (a -> b -> c) -> f a
//               -> f b
//               -> f c

// (a -> b -> c) -> Function a
//               -> Function b
//               -> Function c

// (a -> b -> c) -> ((->) x) a
//               -> ((->) x) b
//               -> ((->) x) c

// (a -> b -> c) -> (x -> a)
//               -> (x -> b)
//               -> (x -> c)

const lift2 = (f, a, b) => b.ap(a.map(f))
```

What we end up with is a function of one argument (type `x`), which applies to `f` the result of applying that argument to `a` and `b`. Ramda fans may recognise this as [`converge`](http://ramdajs.com/docs/#converge):

```javascript
// From the Ramda docs:
const divide = x  => y => x / y

const sum = xs => xs.reduce(
  (x, y) => x + y, 0
)

const length = xs => xs.length

// divide(sum, length)
//   === 28 / 7 === 4
const average = lift2(divide, sum, length)
average([1, 2, 3, 4, 5, 6, 7])

// This generalises to liftN!
const lift3 = (f, a, b, c) =>
  c.ap(b.ap(a.map(f)))

// Some password checks...

const longEnough =
  length.map(x => x > 8) // Functor!

const hasNumber = x =>
  null !== x.match(/\d+/g)

const hasUppercase = x =>
  null !== x.match(/[A-Z]+/g)

// Some combining function...
const and3 = x => y => z => x && y && z

// Combine the three functions with and3
const passwordCheck = lift3(
  and3, longEnough
      , hasNumber
      , hasUppercase)

passwordCheck('abcdef')    // false
passwordCheck('abcdefghi') // false
passwordCheck('abcdefgh1') // false
passwordCheck('Abcdefgh1') // true
```

So, we can take a set of functions that act on the same type, and **combine** their outputs with another function. **This is the magic of `ap`**.

## `Chain`

```javascript
// m  a ~> (a -> m b)
//      -> m b

// Function a ~> (a -> Function b)
//            -> Function b

// ((->) x) a ~> (a -> ((->) x) b)
//            -> ((->) x) b

//  (x -> a) ~> (a -> x -> b)
//           -> x -> b
Function.prototype.chain =
  function (that) {
    return x => that(this(x))(x)
  }
```

The `Function` type also has a `Chain` implementation, with an eventual type that looks really similar to `Functor`. The difference this time, however, is that the intermediate function can **access the _original_ argument**. No matter how many functions we `chain` together, the second argument to the `chain` function will always be of type `x`, and the value of the original input.

```javascript
const myNextFunction =
  (x => x.length)
  .map(x => x + 2)
  .map(x => x / 2)
  .chain(x => s =>
    'started from the ' + s
      + ' now we ' + x)

// started from the Hello! now we 4
myNextFunction('Hello!')
```

So, after two `map` calls that transform the input entirely, `chain` _re-introduces_ the original value. In fact, we can call `chain` _whenever_ we want access to that initial value. We can't _modify_ the value - it's effectively **read-only**. This is why the `Function` type, when used as a `Functor`, is often called `Reader`.

`Reader`'s most obvious application is to provide a way of accessing some global application state (e.g. config or a database):

```javascript
// a ->       f  a
// a -> Function a
// a -> ((->) x) a
// a ->   x -> a
Function.of = x => _ => x

const MyApp =
  // Set a "starting value"... or just
  // a function that _takes_ a starting
  // value and THEN the environment!
  Function.of('Hello, ')

  // Get a variable from environment,
  // augment the string.
  .chain(x => ({ isProduction }) =>
    x + (isProduction ? 'customers'
                      : 'developers'))

  // Augment the string.
  .map(x => x + '!')

  // Get ANOTHER variable from the
  // environment, augment the string.
  .chain(x => ({ caller }) =>
    caller === 'browser'
    ? '<h1>' + x + '</h1>'
    : '{ data: "' + x + '}" }')

  // Send to the consumer.
  .map(sendToConsumer)

// This object becomes our app's "global
// config", and the function returns
// whatever `sendToConsumer` would if given
// '{ data: "hello, customers!" }'
MyApp({
  isProduction: true,
  caller: 'api'
})
```

Here, our argument is a config object, and our app is free to pick bits out whenever it chooses. Also notice the `Function.of` at the top - this is the `Pointed` implementation. This was the ingredient missing from `Apply` for an `Applicative`, and from `Chain` for a `Monad`. Developers, meet **the `Reader` monad**, in all its glory.

I think `Function` provides three instances here that are of immediate benefit, and they all have uses in **practical** code! I hope you found this useful, and I hope to see a lot more uses of `Function` as a `Functor`  in the wild.

Until Monday, have fun, enjoy the long weekend, and take care! &hearts;

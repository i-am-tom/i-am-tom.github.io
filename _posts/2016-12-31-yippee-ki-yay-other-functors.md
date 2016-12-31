---
layout: post
title: Yippee Ki-Yay, All the Functors!
description: Diving into the world of functors with some JS.
---

_More information on functors than you probably ever wanted, with all sorts of weird and wonderful examples._

Hullo! I hope you've all been finding a pleasant way to see out 2016. To add just a touch more to the merriment, let's talk about **functors**!

## What the Functor?

Let's go over the `map` method for arrays, starting with a little curried function to help us out (_I've written [a blog post about currying](http://www.tomharding.me/2016/11/12/curry-on-wayward-son/) if you're unsure about it_):

```javascript
// map :: (a -> b) -> Array a -> Array b
const map = f => U => U.map(f)
```

So, we pass in a function (from some type `a` to some type `b`) and an array of type `a`, and get back an array of type `b`. Nothing scary, and we might notice:

- The identity function, `id = x => x`, has _no effect_ when we `map` over an array. In other words, `map(id)` is exactly equal to `id`!

- If we define `compose = (f, g) => x => f(g(x))`, we can say that `compose(map(f), map(g))` is no different to `map(compose(f, g))`.

_`compose(f, g)(x)` basically means, "run `g` on `x`, then run `f` on the result", so we can build up pipelines. Think of the shell pipe,_ `|`_!_

In formal language, we call these properties **identity** and **composition**, respectively. Take some time to convince yourself that these laws make sense for arrays - particularly the second one:

```javascript
const compose = (f, g) => x => f(g(x))
const data = ['i', 'am', 'tom']

// Try them out - both should equal [2, 4, 6]!
compose(map(x => x * 2), map(x => x.length))(data)
map(compose(x => x * 2,      x => x.length))(data)
```

_This actually gives us a cool property called **loop fusion**: any two neighbouring `map` calls can be combined into one, meaning we don't have to loop over the data structure twice! In plain English (sort of),_ `map g THEN map f` _is the same as_ `map (g THEN f)` _._

By this point, we should be confident that arrays are **structures with a `map` method that respect the identity and composition properties**. Well, are there any _other_ structures that do this? No prizes for guessing what we call them... Let's update that type signature for `map`:

```javascript
// map :: Functor f => (a -> b) -> f a -> f b
const map = f => U => U.map(f)
```

Instead of saying `Array` explicitly, we now just use any functor `f`. So, to prove that `Array` isn't the only functor, let's take a look at some favourites!

## Identity

This is probably the easiest functor of them all.

```javascript
const Identity = x => ({
  // Transform the inner value
  // map :: Identity a ~> (a -> b) -> Identity b
  map: f => Identity(f(x)),

  // Get the inner value
  // fold :: Identity a ~> (a -> b) -> b
  fold: f => f(x)
})
```

_The value on the left of the squiggly arrow is how we'll refer to the object with the method we're using. Ignore the `fold` - it's just there to give us a way to get the value out!_

Does this satisfy **identity**? Let's see:

```javascript
Identity(X).map(id)

  // By definition of `map`
  === Identity(id(X))

  // By definition of `id`
  === Identity(X)
```

Yep! For any `X`, given that `id` just returns what it is given, we can see that `Identity` satisfies **identity**. Probably how it got its name, really. How about composition?

```javascript
Identity(X).map(g).map(f)

  // By definition of `map`
  === Identity(g(X)).map(f)

  // By definition of `map`
  === Identity(f(g(X)))

  // By definition of `compose`
  === Identity(compose(f, g)(X))

  // By definition of `map`
  === Identity(X).map(compose(f, g))
```

We can see, just by swapping around sides of our definitions, that the two sides of **composition** are equivalent. Yay! So, we have `map`, identity, and composition, but it's not really... useful, is it? Let's look at something with more obvious utility:

## Maybe

There are two constructors for `Maybe`: `Just` and `Nothing`. If you're unfamiliar with type constructors: `Bool` has constructors `True` and `False`, `String` has constructors... well, _every possible string_! The point is that, for a given type, all its constructors have the **same interface**, albeit with **different behaviours**.

```javascript
const Just = x => ({
  // Transform the inner value
  // map :: Maybe a ~> (a -> b) -> Maybe b
  map: f => Just(f(x)),

  // Get the inner value
  // fold :: Maybe a ~> (b, a -> b) -> b
  fold: (_, f) => f(x)
})

const Nothing = ({
  // Do nothing
  // map :: Maybe a ~> (a -> b) -> Maybe b
  map: f => Nothing,

  // Return the default value
  // fold :: Maybe a ~> (b, a -> b) -> b
  fold: (d, _) => d
})
```

We can see that, apart from an ignored value in `fold`, `Just` is the `Identity` functor with a different name!

`Nothing`, however, is a bit more interesting. If we `map` over it, **nothing happens**. If we `fold` a `Nothing`, we get the value that `Just` ignores (`d` is short for default; can you see why?)

_Why_ would we ever want this? Well, let's say you have the following:

```javascript
const getLight = i => ['Red', 'Amber', 'Green'][i]
const choice = getLight(someUserInput)

console.log(
  choice == undefined
    ? 'Invalid choice!'
    : 'The light is ' + choice.toUpperCase()
)
```

This is a fairly simple program, but there is already some mess here. Because `getLight` might return `undefined`, we have to check for this before we do anything. That means we have to store it in some variable, and our program flow isn't just **top-to-bottom**. Can `Maybe` help us out?

```javascript
// A little helper method that we'll see a lot...
// fromNullable :: ?a -> Maybe a
const fromNullable = x =>
  x != null ? Just(x) : Nothing

// This now returns a Maybe
// getLight :: Int -> Maybe String
const getLight = i => fromNullable(
  ['Red', 'Amber', 'Green'][i]
)

console.log(
  getLight(someUserInputFromSomewhere)
    .map(x => x.toUpperCase())
    .map(x => 'The light is ' + x)
    .fold('Invalid choice!', id)
)
```

_I'll use the ?a style to mean "possibly null"._

What have we gained here? Well, for a start, we've used `map` to describe our algorithm step-by-step, which tidies up the logic. Secondly, we don't have to save the `getLight` call result because we're only using it once. Thirdly, and most importantly, **we explicitly deal with the null** - we can't forget about it!

This means that we write our program **as if it works**, and then deal with possible failure at the end. Our program isn't littered with `if` checks for `undefined`; just one branch at the `fold` step. If we want to add more logic, we simply add more `map` steps!

How about those **laws**? Well, we know `Just` satisfies them, because it's pretty much the same as `Identity`! But how about `Nothing`? If we `map` over `Nothing`, nothing happens. That means mapping with `id` does nothing (which means **identity** holds), and mapping twice over nothing still does nothing, which means **composition** holds!

## Either

We'll fly through this one! An `Either` is a `Left` or a `Right`:

```javascript
const Right = x => ({
  // Transform the inner value
  // map :: Either a b ~> (b -> c) -> Either a c
  map: f => Right(f(x)),

  // Get the value with the right-hand function
  // fold :: Either a b ~> (a -> c, b -> c) -> c
  fold: (_, r) => r(x)
})

const Left = x => ({
  // Do nothing
  // map :: Either a b ~> (b -> c) -> Either a c
  map: f => Left(x),

  // Get the value with the left-hand function
  // fold :: Either a b ~> (a -> c, b -> c) -> c
  fold: (l, _) => l(x)
})
```

Note that we talked about `Array a`, `Identity a`, and `Maybe a`, but we're now talking about `Either a b`. That's because, whereas the others could (_should_) only hold one type, Either can hold **two**: the `Left` and `Right` branches can have different types!

We can immediately see that our `Right` looks almost identical to `Just`! The `Left`, however, is slightly different to `Nothing`. Whereas `Nothing` held no value, `Left` actually holds something. Still, when we `map` over a `Left`, the value is unchanged. Let's modify our traffic light example to use `Either`:

```javascript
// Now, we provide a "default" for null values
// fromNullable :: (a, ?b) -> Either a b
const fromNullable = (d, x) =>
  x != null ? Right(x) : Left(d)

// getLight :: Int -> Either String String
const getLight = i => fromNullable(
  i + ' is not a valid choice!',
  ['Red', 'Amber', 'Green'][i]
)

console.log(
  getLight(someUserInput)
    .map(x => x.toUpperCase())
    .map(x => 'The light is ' + x)
    .fold(
      e => 'ERROR: ' + e,
      s => 'SUCCESS: ' + s
    )
)
```

See how our `fold` step takes a function for each of the possible constructors to handle their individual values, so we can handle them separately. The `map` functions don't touch the `Left` value at all, though.

See how the signature for the `map` implementations take `Either a b` to `Either a c`? If a `map` takes `f b` to `f c`, that means our _functor_ must be `Either a`!

If `Maybe` helps us deal with `null` safely, what does `Either` deal with? Perhaps this function will help us see:

```javascript
// tryCatch :: (* -> a) -> Either Error a
const tryCatch = f => {
  try {
    return Right(f())
  } catch (e) {
    return Left(e)
  }
}
```

`Either` models **type-safe exceptions**! At the `fold` step, we're _forced_ to deal with the "exception" by supplying a function for the `Left` value. If the original function _does_ return a `Left`, that value can leap-frog over the rest of the `map` calls!

We'll see how `Either` is actually **more powerful** than exceptions when we come to **bifunctors** and other concepts. For now, though, this is a pretty neat start.

_Are the laws satisfied? I'll leave that as an exercise!_

## Function

There are plenty of other examples, why don't we end mind-bender? **Functions are functors**. Let's look again at that type:

```haskell
map :: Functor f => (a -> b) -> f a -> f b
```

Now, bear with me. Our `Either a` type was a functor because we could `map` over `b` (to get `Either a b` to `Either a c`). Our functions are `a -> b`; can we `map` over `b` to get `a -> c`?

```javascript
// (a -> b) ~> (b -> c) -> a -> c
Function.prototype.map = function (that) {
  return x => that(this(x))
}
```

**Yes**, omgwtf, we can write a `map` implementation. Does it satisfy **identity**?

```javascript
f.map(id)

  // By definition function's `map`
  === x => id(f(x))

  // By definition of `id`
  === x => f(x)

  // We're there!
  === f
```

**Yes**. OMGwtf. What about **composition**? Brace yourself:

```javascript
compose(map(h), map(g))(f)

  // By composition's definition
  === map(h)(map(g)(f))

  // By map's definition
  === (map(g)(f)).map(h)

  // ... and again...
  === f.map(g).map(h)

  // By function's map definition
  === (x => g(f(x))).map(h)

  // ... and again... eep...
  === y => h((x => g(f(x)))(y))

  // Applying y to (x => g(f(x)))...
  === y => h(g(f(y)))

  // By composition's definition...
  === y => compose(h, g)(f(y))

  // By function's map definition...
  === (y => f(y)).map(compose(h, g))

  // YAY!
  === f.map(compose(h, g))
```

It's a pretty big and ugly proof, but we can indeed see that **composition holds**. The question remains, though: why would we _ever_ want this? Well, why would we ever want `map`? To build up processing pipelines!

```javascript
const toUpper = x => x.toUpperCase()
const exclaim = x => x + '!'
const greet   = x => 'Hello, ' + x
const log     = console.log.bind(console)

// Ok, cheating a little bit...
const getUserInput = () => 'Tom'

const myProgram =
  getUserInput
    .map(greet)
    .map(exclaim)
    .map(toUpper)
    .map(log)

myProgram() // logs "HELLO, TOM!"
```

Mapping over functions lets us **compose** big processes from **small building blocks**. This gives us some wonderful opportunities for code reuse and simplified testing: many functions can be simplified to this style, and then we can reuse the code they have in common without duplication.

**Less duplication** obviously means **less code** means **less to test**! Everyone wins :)

---

Well, sorry if that's an awful lot to take in! In summary, functors are probably one of the most simple types of structure (we call these types **typeclasses**) that you'll see regularly in FP, but you can hopefully already see their power. Imagine what we could do with a bit more freedom? We'll find out when we talk about **applicatives**.

Until then, have a wonderful new year!

Enjoy yourself, and take care &hearts;

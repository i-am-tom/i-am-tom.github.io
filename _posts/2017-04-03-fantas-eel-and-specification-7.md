---
layout: post
title: "Fantas, Eel, and Specification 7: Contravariant"
description: MY ARROWS ARE BACKWARDS.
---

Well, well, well. We're a fair few weeks into this - I hope this is all still making sense! In the last article, we talked about **functors**, and how they're really just containers to provide "language extensions" (or **contexts**). Well, today, we're going to talk about another _kind_ of functor that looks... _ooky spooky_:

```haskell
-- Functor
map :: f a ~> (a -> b) -> f b

-- Contravariant
contramap :: f a ~> (b -> a) -> f b
```

It's no typo: the arrow is **the wrong way round**. This _blew my mind_. It _looks_ like `contramap` can somehow magically work out how to _undo_ a function. Imagine the possibilities:

```javascript
// f :: String -> Int
const f = x => x.length

// ['Hello', 'world']
;['Hello', 'world'].map(f).contramap(f)
```

**Impossible**, I hear you say? Well...

... _Yes_, you're right this time. `Array` isn't a `Contravariant` functor - just a normal `Functor` (which we can more specifically call a **covariant** functor). In fact, there's **no magic** here at all if we look at the examples of functors that _are_ potential `Contravariant` instances. Try this one for size:

```javascript
// type Predicate a = a -> Bool
// The `a` is the *INPUT* to the function!
const Predicate = daggy.tagged('Predicate', ['f'])

// Make a Predicate that runs `f` to get
// from `b` to `a`, then uses the original
// Predicate function!
// contramap :: Predicate a ~> (b -> a)
//                          -> Predicate b
Predicate.prototype.contramap =
  function (f) {
    return Predicate(
      x => this.f(f(x))
    )
  }

// isEven :: Predicate Int
const isEven = Predicate(x => x % 2 === 0)

// Take a string, run .length, then isEven.
// lengthIsEven :: Predicate String
const lengthIsEven =
  isEven.contramap(x => x.length)
```

The `Predicate a` is saying that, _if I can get from my type_ `a` _to_ `Bool`_, and you can get from your type_ `b` _to_ `a`_, I can get from_ `b` _to_ `Bool` _**via**_ `a`_, and hence give you a_ `Predicate b`! Sorry if that bit takes a couple of read-throughs; in short, `lengthIsEven` converts a `String` to an `Int`, then to a `Bool`. We don't _care_ that there's an `Int` somewhere in the pipeline - we just care about what the input value has to be.

All smoke and mirrors, right? There's no magical `undo` here; it's just that we're adding our actions to the _beginning_ of a mapping. Trust me: you're not as **heartbroken** as I was.

Still, if we can see _past_ this _betrayal_, we'll of course see that there are some cool things going on here. First of all, our **laws** are basically just the same as `Functor`, but a little bit upside down:

```javascript
// Identity
U.contramap(x => x) === U

// Composition
U.contramap(f).contramap(g)
  === U.contramap(x => f(g(x)))
```

Identity is the same because "doing nothing" is still "doing nothing" if you do it backwards. _Probably not a sentence that'll win me awards_. Composition is pretty much the same, but the functions are composed **the other way round**!

A _lot_ - probably the overwhelming majority - of `Contravariant` examples in the wild will be mappings _to_ specific types. Imagine a `ToString` type:

```javascript
// type ToString a :: a -> String
const ToString = daggy.tagged('ToString', ['f'])

// Add a pre-processor to the pipeline.
ToString.prototype.contramap =
  function (f) {
    return ToString(
      x => this.f(f(x))
    )
  }

// Convert an int to a string.
// intToString :: ToString Int
const intToString =
  ToString(x => 'int(' + x + ')')
  .contramap(x => x | 0) // Optional

// Convert an array of strings to a string.
// stringArrayToString :: ToString [String]
const stringArrayToString =
  ToString(x => '[ ' + x + ' ]')
  .contramap(x => x.join(', '))

// Given a ToString instance for a type,
// convert an array of a type to a string.
// arrayToString :: ToString a
//               -> ToString [a]
const arrayToString = t =>
  stringArrayToString
  .contramap(x => x.map(t.f))

// Convert an integer array to a string.
// intsToString :: ToString [Int]
const intsToString =
  arrayToString(intToString)

// Aaand they compose! 2D int array:
// matrixToString :: ToString [[Int]]
const matrixToString =
  arrayToString(intsToString)

// "[ [ int(1), int(2), int(3) ] ]"
matrixToString.f([[1, 3, 4]])
```

It's pretty clear to see how this approach could be used to develop a **serializer**: you could output **JSON**, **XML**, or even your own **new format**! It's also a _great_ example of the beauty of **composition**: with functions like `arrayToString`, we're using smaller `ToString` instances to make instances for other, more _complex_ types!

Another good example that's worth a look is the `Equivalence` type:

```javascript
// type Equivalence a = a -> a -> Bool
// `a` is the type of *BOTH INPUTS*!
const Equivalence = daggy.tagged('Equivalence', ['f'])

// Add a pre-processor for the variables.
Equivalence.prototype.contramap =
  function (g) {
    return Equivalence(
      (x, y) => this.f(g(x), g(y))
    )
  }

// Do a case-insensitive equivalence check.
// searchCheck :: Equivalence String
const searchCheck =

  // Basic equivalence
  Equivalence((x, y) => x === y)

  // Remove symbols
  .contramap(x => x.replace(/\W+/, ''))

  // Lowercase alpha
  .contramap(x => x.toLowerCase())

// And some tests...
searchCheck.f('Hello', 'HEllO!') // true
searchCheck.f('world', 'werld')  // false
```

So, we're saying we can compare anything that works with `===`, and we can therefore compare values of any type as long as they can be _converted_ to something that works with `===`. For `searchCheck`, this is really neat - we can supply **steps** for making a value comparable,  for transforming _single_ values, and the `Contravariant` instance will compare the inputs after being transformed accordingly. **Hooray**!

> If you fancy an exercise, why not play around with an `Equivalence` using our [Setoid comparison](/2017/03/09/fantas-eel-and-specification-3/) - perhaps a starter function of `(x, y) => x.equals(y)`? This should give a **lot** more control when comparing complex types.

---

Well, that's about it! There's not much to `Contravariant` types, and they're relatively rare. However, they're a really good way of making your code more **expressive** (or **self-documenting**, or whatever we call it at the moment):

```haskell
filter :: Predicate   a -> [a] ->  [a]
group  :: Equivalence a -> [a] -> [[a]]
sort   :: Comparison  a -> [a] ->  [a]
unique :: Equivalence a -> [a] ->  [a]
```

I'll leave it to you to write the `Comparison` type and its `contramap` - it'll look quite a lot like `Equivalence` - but you see that these type signatures make it _really_ clear what the functions are probably going to do.

If all else fails, just remember:

- When `f` is a (**covariant**) `Functor`, `f a` says, "_If you can give me an_ `(a -> b)`_, I can give you a_ `Functor b`".

- When `f` is a `Contravariant` functor, `f a` says, "_If you can give me a_ `(b -> a)`_, I can give you a_ `Contravariant b`".

It's the same - it's just backwards. There's sadly no way we could write `contramap` for an array, but do think about why we also couldn't write a `map` for `Predicate` - some things just aren't meant to be! _Sigh_.

**One last thing** before you go: many of these types are [monoids](/2017/03/21/fantas-eel-and-specification-5/). See? _Everything's connected_:

```javascript
// It's like a function to our `All` monoid!
Predicate.prototype.empty = () =>
  Predicate(_ => true)

Predicate.prototype.concat =
  function (that) {
    return Predicate(x => this.f(x)
                       && that.f(x))
  }

// The possibilities, they are endless
Equivalence.prototype.empty = () =>
  Equivalence((x, y) => true)

Equivalence.prototype.concat =
  function (that) {
    return Equivalence(
      (x, y) => this.f(x, y)
             && that.f(x, y))
  }
```

How about that? We can combine various `Predicate` and `Equivalence` instances of the same type to make new instances!

> Imagine a **search** tool with options for search criteria and strictness, with each one represented as an `Equivalence` structure. When the user makes a selection, we just combine the selected structures, and we have our **purpose-built** search utility!

Something to explore! Next time, we'll talk about `Apply` (and probably `Applicative`) - my **second favourite** typeclass (after `Comonad` - we'll get to _that_ one in a few more weeks!) I hope you're all well, and hopefully learning a thing or two along the way. See you in a week!

Take care &hearts;

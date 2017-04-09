---
layout: post
title: "Fantas, Eel, and Specification 5: Monoid"
description: And then there were five.
---

Good Tuesday, Fantasists! This week, we're going to take a quick(!) look at [the semigroup](/2017/03/13/fantas-eel-and-specification-4/)'s older sibling: the **monoid**. We saw last week that a `Semigroup` type is one that has some concept of _combining_ values (via `concat`). _Well_, a `Monoid` type is any `Semigroup` type that happens to have a special value - we'll call it an **identity** value - stored on the type as a function called `empty`.

Here's its (in my opinion, not-too-helpful) signature:

```haskell
empty :: Monoid m => () -> m
```

_Far_ more useful, I think, are the laws for how `empty` must act for a type to be a valid `Monoid`. We call these the identity laws:

```javascript
// Right identity
MyType(x).concat(MyType.empty()) === MyType(x)

// Guess what this one's called?
MyType.empty().concat(MyType(x)) === MyType(x)
```

Whichever side of `concat` we put our `empty`, it _must_ make **no difference** to the value. Let's look at some examples of `empty` values for our favourite semigroups. Try them on the laws above if you're unsure of _why_ they're valid `empty` values:

```javascript
// ''.concat('hello')
//   === 'hello'.concat('')
//   === 'hello'
String.empty  = () => ''

// [].concat([1, 2, 3])
//   === [1, 2, 3].concat([])
//   === [1, 2, 3]
Array.empty   = () => []

// And so on...
Sum.empty     = () => Sum(0)
Product.empty = () => Product(1)
Max.empty     = () => Max(-Infinity)
Min.empty     = () => Min(Infinity)
All.empty     = () => All(true)
Any.empty     = () => Any(false)

// BUT not every semigroup is a monoid...
First.empty = () => // ???
Last.empty  = () => // ???
```

Eek, got a bit stuck at the end... `First` and `Last` are _not_ monoids; see if you can work out why!

> Ok, so, `First` and `Last` actually _are_ monoids in Haskell. This **cheat** is done by sneaking in [an inner `Maybe` type](https://hackage.haskell.org/package/base-4.9.1.0/docs/src/Data.Monoid.html#line-189), where `Nothing` becomes the `empty` value. This actually works for **any semigroup** that you want to turn into a monoid, but _[don't let Connor McBride catch you doing it...](https://youtu.be/VXl0EEd8IcU?t=11m17s)_

_This is all very interesting, but what's the point_? I'm glad you asked, imaginary reader! With a `Semigroup` type, you can combine **one or more** values to make another, right? All a monoid does is let us upgrade that to **zero or more**. This is actually a **Pretty Big Deal™**, as we can take **any** array (including an empty array!) of monoids and `reduce` them to one value.

_... Wait, what?_

As a surprisingly good intuition, **monoids encapsulate the logic of `Array.reduce`**. That's what they do. That's what they're _for_. That's it right there. If you know [how to reduce lists](/2017/02/24/reductio-and-abstract-em/), then congratulations, you're now a [monoid warrior](http://tardis.wikia.com/wiki/Monoid):

```javascript
// A friendly neighbourhood monoid fold.
// fold :: Monoid m => (a -> m) -> [a] -> m
const fold = M => xs => xs.reduce(
  (acc, x) => acc.concat(M(x)),
  M.empty())

// We can now use our monoids for (almost) all
// our array reduction needs!
fold(Sum)([1, 2, 3, 4, 5]).val // 15
fold(Product)([1, 2, 3]).val   // 6
fold(Max)([9, 7, 11]).val      // 11
fold(Sum)([]).val              // 0 - ooer!
```

We actually get a **double win** here. Not only do we now have a generic way to `fold` _any_ **reducible structure** (arrays, **trees**, etc) in our app with _any_ `Monoid` type (`Sum`, `Max`, etc), we also have an opportunity to do some _really_ cool optimisations:

The thing that we didn't explicitly mention about the semigroup laws is that _associativity_ gives us an opportunity to **parallelise**. If we split a list of semigroups into chunks, `concat` the elements of each chunk in parallel, and then `concat` the results, we're guaranteed to get the same result!

```javascript
// In practice, you'd want a generator here...
// Non-tail-recursion is expensive in JS!
const chunk = xs => xs.length < 5000
  ? xs : [ xs.slice(0, 5000)
         , ... chunk(xs.slice(5000)) ]

// ... You get the idea.
const parallelMap = f => xs => xs.map(x =>
  RunThisThingOnANewThread(f, x))

// Chunk, fold in parallel, fold the result.
// In practice, this would probably be async.
const foldP = M => xs => fold(M)(
  parallelMap(fold(M))(chunk(xs)))

// With all that in place...

// Numbers from 0 to 999,999...
const bigList = [... Array(1e6)].map((_, i) => i)

// ... Ta-da! 499999500000
// Parallel-ready map/reduce; isn't it *neat*?
foldP(Sum)(bigList).val
```

**Thanks, associativity!** By being _certain_ that the `Semigroup` and `Monoid` laws hold for our type, we can write functions to **optimise** for different data sets, and other developers can use our API with no idea of the **wizardry** underneath!

---

So, monoids let us write easily-optimised and _expressive_ `reduce` operations. Pretty neat, huh? There is a tiny downside, though...

The _fiddly_ part about monoids in JavaScript is that we have to pass in _type representations_ (what we called `M`). The [Fantasy Land spec](https://github.com/fantasyland/fantasy-land) puts these in signatures as `TypeRep` values, in case you've wondered what they were. These have to be here because JavaScript, unlike other languages, can't _deduce_ the type we're working with, so we have to give it a friendly nudge. For example:

```javascript
// How do we know which `empty` we want? In
// Haskell, the correct `empty` would be used
// because the type would be checked to find the
// right monoid instance in the context.
const concatAll = xs => xs.reduce(concat, empty)

// In JS, the TypeRep avoids this issue.
const concatAll_ = M => xs =>
  xs.reduce(concat, M.empty())
```

This becomes more apparent when we get onto **composed monoids**. Just as we saw with semigroups, let's imagine we want to make `Pair` a monoid:

```javascript
const Pair = daggy.tagged('a', 'b')

Pair.empty = () => // ???
```

Remember: the `empty` value must work for all cases, and a Pair could be made of _any_ of our monoids. The solution? Pass in the `TypeRep`s:

```javascript
// We now have a kind of "Pair factory"!
// Pair_ :: (Monoid a, Monoid b) =>
//   (TypeRep a, TypeRep b) -> (a, b) -> Pair a b
const Pair_ = (typeA, typeB) => {
  const Pair = daggy.tagged('a', 'b')

  Pair.empty = () => Pair(typeA.empty(),
                          typeB.empty())

  // You could write `concat` here and include
  // some type-checking in its logic!

  return Pair
}

// We can partially apply to get Pair
// constructors for specific types...
const MyPair = Pair_(Sum, Any)

// ... and these have valid empty() values!
// Pair(Sum(0), Any(False))
MyPair.empty()

// We can also call it directly.
// Pair(All(True), Max(-Infinity))
Pair_(All, Max).empty()
```

Some extra ugly boilerplate, but we _do_ end up with the same result. We're going to see a lot more of these `TypeRep` values floating about, and it _is_ unfortunate. Still, if you want to write type-safe JavaScript _without_ all this hassle, check out [PureScript](http://www.purescript.org)!

---

There are loads of weird and wonderful monoids that we haven't covered. For example, an `a -> b` function is a monoid if `b` is a monoid:

```javascript
// concat :: (Semigroup b) =>
//   (a -> b) ~> (a -> b) -> (a -> b)
Function.prototype.concat = function (that) {
  return x => this(x).concat(that(x))
}

// Are you fed up of TypeReps yet? If you _did_
// want to implement this, you're probably better
// off setting it manually for the functions you
// are likely to concat... Sigh.
Function.prototype.empty = // result.empty()
```

Effectively, we just concatenate the results of calling _both_ functions with a given argument. If this seems useless, check out Hardy Jones' post on implementing [FizzBuzz with monoids](https://joneshf.github.io/programming/2014/09/24/FizzBuzz-With-Semigroups-And-Apply.html)! They are _really_ clever structures that, with a bit of imagination, can be spotted **everywhere** in the wild. We'll actually come back to them time and time again in the articles to come, so get used to them!

Again, this post only touches the _surface_ of [what monoids can do](https://www.youtube.com/watch?v=moAfgDFVLUs), and I'm surprised by new examples all the time. Keep researching, keep looking for examples, see whether you could replace some of your code's `Array.reduce` calls with monoid folds, and start to build up a library of reusable `Monoid` types to encapsulate your logic. **Exciting times**!

Next time, we'll look at `Functor` - our first step on the road to the magical `Monad`. Until then, Fantasists,

Take care &hearts;

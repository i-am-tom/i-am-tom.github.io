---
layout: post
title: "Fantas, Eel, and Specification 3: Setoid"
description: The third post in a series on the JavaScript Fantasy Land specification.
---

**Congratulations!** You've mastered [the fundamentals of `daggy`](/2017/03/03/fantas-eel-and-specification/), nailed the [intro to type signatures](/2017/03/08/fantas-eel-and-specification-2/), and are ready to begin your journey through Fantasy Land. First stop: the **setoid**.

**A setoid** is any type with a notion of **equivalence**. You already use plenty of setoids (**integers**, **booleans**, **strings**) almost every time you use the `==` operator, so this shouldn't be too tricky. You also use things that _aren't_ setoids, like **functions**.

> This may seem weird, but how could we _reliably_ know whether two functions were equivalent? While our compiler will confidently tell us that `100 * 10` is equivalent to `1000`, it won't be brave enough to say `x => x * x` is equivalent to `x => Math.pow(x, 2)`; it's really not a trivial thing to work out!*

Now, for a type to be a _Fantasy Land-compliant_ setoid, it must have a prototype method called `equals` with the following signature:

```haskell
equals :: Setoid a => a ~> a -> Boolean
```

Nothing too scary, I hope? Just a way of finding out whether one thing equals another. Let's write some `Setoid` instances for types from [our first article](/2017/03/03/fantas-eel-and-specification/):

```javascript
// Check that each point matches
// equals :: Coord ~> Coord -> Bool
Coord.prototype.equals = function (that) {
  return this.x === that.x
      && this.y === that.y
      && this.z === that.z
}

// Check each Coord with Coord.equals
// equals :: Line ~> Line -> Bool
Line.prototype.equals = function (that) {
  return this.from.equals(that.from)
      && this.to.equals(that.to)
}

// The this' "true-ness" must match that's!
// equals :: Bool ~> Bool -> Bool
Bool.prototype.equals = function (that) {
  return this instanceof Bool.True
    === that instanceof Bool.True
}

// Check the lists' heads, then their tails
// equals :: Setoid a => [a] ~> [a] -> Bool
List.prototype.equals = function (that) {
  return this.cata({
    // Note the two different Setoid uses:
    Cons: (head, tail) =>
      head === that.head // a
        && tail.equals(that.tail), // [a]

    Nil: () => that.is(List.Nil)
  })
}
```

You get the idea, right? If we have multiple constructors, we check for the same **constructor**. If the constructor/s take/s arguments, then we probably check those as well. Of course, if we do, **the arguments must be setoids**; how else could we check that they're equivalent?

In fact, this requirement is exactly why we have the **type constraint** on `List`'s `equals` implementation: we need to be able to compare the _whole_ structure, innards and all!

Sadly, the ugly side-effect of using JavaScript is that we're going to have to mix `===` and `.equals` depending on whether we're working with _primitive_ types or not. It's a shame; in other languages, we could **override** the behaviour of `===` for custom types, but not JavaScript. You _could_ add `.equals` to the primitive values' prototypes, but this is generally considered a bad idea. _Best not fiddle with standard prototypes._

Still, these `.equals` implementations are quite pretty, right?

---

All the Fantasy Land structures come with **laws** that must be obeyed for the instance to be valid, and `Setoid` is no exception. In order to make sure your type behaves itself when used with other libraries and algorithms, there are just three things we have to remember. **In all cases**:

- `a.equals(a) === true`, which we call **reflexivity**.

- `a.equals(b) === b.equals(a)`. This is **symmetry** or **commutativity** - you can give the values either way round. Remember that operations like subtraction _aren't_ commutative, and there are other [non-commutative examples](https://www.quora.com/Is-floating-point-addition-commutative-and-associative) that may surprise you!

- If `a.equals(b)` and `b.equals(c)`, then it's always true that `a.equals(c)`: the law of **transitivity**.

We can see without too much trouble that all these would hold for the `.equals` implementations above, _as long as we respect the type signatures!_

If none of these laws are particularly surprising to you, that's a great thing! This means that you have a good **intuition** for what a `Setoid` is. Later in the series, we'll get to more complex structures, and finding an intuition will be incredibly valuable for working out how to _use_ them.

If you're now _desperate_ for an exercise, why not write an `.equals` implementation for the built-in `Array` type to make it a `Setoid`? Add it to `Array.prototype` - I won't tell - and be sure that your implementation obeys the laws above.

If you wanted to, you could also **derive** a function called `notEquals` using `Setoid`'s shiny new `.equals` method:

```javascript
// notEquals :: Setoid a => a -> a -> Bool
const notEquals = x => y => ...
```

If you're _not_ desperate for exercises, (_or you've managed to sate your burning desire **at long last**_), shall we move onto what the point of all this fuss is? If we have formal definitions of things like `Setoid` (however straightforward it may be), we can define **sensible interfaces** for working with all sorts of data. Consider this function:

```haskell
nub :: Setoid a => [a] -> [a]
```

_I think `nub` might be my favourite name of any function_. In practice, `nub` returns a copy of the given array with the duplicates removed. That's it! You might also have heard it called `uniq`. At first glance, this is easy to write in JavaScript:

```javascript
const nub = xs => xs.filter(
  (x, i) => xs.indexOf(x) === i)
```

This is _okay_, but we run into a problem: for non-primitive structures, this only works if equivalent values always inhabit the same space in memory. This, however, is not usually the case: if we try `[[]].indexOf([])`, we get back `-1`, even though we can clearly see `[]` in that array! How could we fix this? `Setoid` to the rescue!

```javascript
// indexOf :: Setoid a => [a] -> a -> Int
const indexOf = xs => x => {
  for (let i = 0; i < xs.length; i++)
    if (xs[i].equals(x)) return i

  return -1
}

// nub_ :: Setoid a => [a] -> [a]
const nub_ = xs => xs.filter(
  (x, i) => indexOf(xs)(x) === i
)
```

Now, we have a function that will work for any array of a `Setoid` type. If we know our function will be used _responsibly_ (that is, _only ever with arrays of a `Setoid` type_), we could even add an exception to make it work for primitives - exactly how [Ramda's equality](https://github.com/ramda/ramda/blob/v0.23.0/src/internal/_equals.js#L22) works! Goodness, would you _look_ at all this Polymorphism.

---

I think I most often see mention of `Setoid` (and `Eq`, as they call it in the Haskell world) among `List` and `Array` functions, which give plenty of opportunities for exercises to cement your understanding:

- Write a function to determine whether a given list's values form a **palindrome** (e.g. whether a list is equivalent to itself _reversed_). We'll need a `Setoid` instance for the inner type to make sure it's nice and general. _As a small hint, you could write a naïve solution with that `zipWith` function we mentioned earlier..._

- Use `daggy` to build a `Set` type that stores a unique set of values; you can even reuse `nub_`! You'll need methods for **adding** and **removing** elements, and the former will need a check to see whether the element already exists in the internal store (probably an array).

`Setoid` is, without a doubt, the _simplest_ structure within the Fantasy Land spec, but that makes it a really good one to start with. For most, the intuition required to understand this one will be perfectly natural, and none of the laws should come as a shock.

Don't get too cosy, though! Next time, we'll move onto a far more weird and wonderful structure: the **semigroup**. Ooer.

Until then, I hope you've enjoyed this post. Please [get in touch](https://twitter.com/am_i_tom) with any feedback and suggestions - I really want to make this series as _useful_ as possible! - and don't hesitate to ask for more examples, exercises, or explanations. Oh, and, as always:

Take care &hearts;

---

_* The important point here is that equivalence is **much deeper** than pointer equality. Just try typing `(x => x) === (x => x)` into your Node REPL._

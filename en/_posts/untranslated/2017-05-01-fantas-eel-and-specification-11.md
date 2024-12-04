---
layout: article
title: "Fantas, Eel, and Specification 11: Foldable"
description: Reducing it to the core concepts.
redirect_from: /2017/05/01/fantas-eel-and-specification-11/
tags: untranslated
---

Welcome back, Fantasists! This week has been **hectic**, so I haven't caught up the [companion repository](http://github.com/i-am-tom/fantas-eel-and-specification) as I'd hoped to. However, I should have some time to devote to it this week, so watch this space! Anyway, why don't we have some **down time** before we get onto the **really grizzly** parts of the spec? Let's take a look at `Foldable`.

Wouldn't you know it, this one comes with a **new function** to add to our repertoire, and it's one that might look a bit _familiar_ to some readers:

```haskell
reduce :: Foldable f =>
  f a ~> ((b, a) -> b, b) -> b
```

Do we already know of any `Foldable` types? I'll suggest one:

```haskell
Array.prototype.reduce ::
  [a] ~> ((b, a) -> b, b) -> b
```

Straight away, `Array` is a valid `Foldable` type. In fact, Fantasy Land's `Foldable` was _deliberately_ modelled after `Array`. Why? Because this structure **generalises** `Array.reduce`. **Bam**. With that in mind, let's look at its law:

```javascript
const toArray xs => xs.reduce(
  (acc, x) => acc.concat([x]), []
)

u.reduce(f) === toArray(u).reduce(f)
```

This is a **really** weird law because it's not very... rigorous. You're unlikely to write a `Foldable` and get this wrong, because the `reduce` in `toArray` probably works in the exact same way as the `reduce` outside. In fact, it's probably best to look at this more as a **behaviour** than a **law**. _You still have to obey it, though!_

There's a _lot_ of space for interpretation here, which isn't necessarily a good thing. **On the other hand**, it makes it really easy to give some examples!

```javascript
// reduce :: Maybe a
//        ~> ((b, a) -> b, b) -> b
Maybe.prototype.reduce =
  function (f, acc) {
    return this.cata({
      // Call the function...
      Just: x => f(acc, x),

      // ... or don't!
      Nothing: () => acc
    })
  }

// reduce :: Either e a
//        ~> ((b, a) -> b, b) -> b
Either.prototype.reduce =
  function (f, acc) {
    return this.cata({
      // Call the function...
      Right: x => f(acc, x),

      // Or don't!
      Left: _ => acc
    })
  }
```

Because `Nothing` and `Left` represent **failure**, we just return the accumulator. Otherwise, we can use our `f` function once. These examples really just highlight that you don't _need_ a structure with (potentially) multiple values in order to write a `Foldable` instance. However, it's definitely **most useful** when that's the case. For example, let's build a **binary tree**:

```javascript
// BTree a
const BTree = daggy.taggedSum('BTree', {
  // Recursion!
  // Node (BTree a) a (BTree a)
  Node: ['left', 'x', 'right'],

  // Leaf
  Leaf: []
})
```

So, `Node`s represent "branch points" of the tree with values, and `Leaf`s represent the ends of branches. Because `left` and `right` are also `BTree` instances, this gives us a recursive tree construction:

```javascript
const { Node, Leaf } = BTree

//      3
//     / \
//    1   5
//   /|   |\
//  X 2   4 X
//   /|   |\
//  X X   X X
const MyTree =
  Node(
    Node(
      Leaf,
      1,
      Node(
        Leaf,
        2,
        Leaf ) ),
    3,
    Node(
      Node(
        Leaf,
        4,
        Leaf ),
      5,
      Leaf ) )
```

_I'm too ashamed to say how long I spent drawing that tree._ Now, `Array.reduce` combines all our values together (_if your [`Semigroup`](/2017/03/13/fantas-eel-and-specification-4/) or [`Monoid`](/2017/03/21/fantas-eel-and-specification-5/) klaxon just sounded, then I'm super proud &hearts;_) from left to right, so that's probably what we want to imitate with this tree. How do we do that? With **magical recursion**:

```javascript
BTree.prototype.reduce =
  function (f, acc) {
    return this.cata({
      Node: (l, x, r) => {
        // Reduce the tree on the left...
        const left = l.reduce(f, acc)

        // Plus the middle element...
        const leftAndMiddle = f(left, x)

        // And then the right tree...
        return r.reduce(f, leftAndMiddle)
      },

      // Return what we started with!
      Leaf: () => acc
    })
  }

MyTree.reduce((x, y) => x + y, 0) // 15
```

**Woo**! We reduce the tree starting from the **left-most** element and work across. Whenever we hit a `Node`, we just **recurse** and do the same thing!

We saw at the end of the last snippet that we can find the **sum** of all the elements, and we could just as easily write `min`, `max`, `product`, or whatever. In fact, [you can do anything with `Array.reduce`](/2017/02/24/reductio-and-abstract-em/) and generalise it to all `Foldable` types immediately! Whether we then have a `Maybe`, an `Array`, or even a `BTree`, our functions will **Just Work™**!

---

`Product`? `Min`? `Max`? This really does sound like `Monoid` again, doesn't it? Well, there are **no coincidences** in Fantasy Land. Back in [the `Monoid` post](/2017/03/21/fantas-eel-and-specification-5/), we wrote the `fold` function:

```javascript
// A friendly neighbourhood monoid fold.
// fold :: Monoid m => (a -> m) -> [a] -> m
const fold = M => xs => xs.reduce(
  (acc, x) => acc.concat(M(x)),
  M.empty())
```

With our new-found `Foldable` knowledge, we now know that this type signature is **too specific**. Let's fix it:

```haskell
fold :: (Foldable f, Monoid m)
     => (a -> m) -> f a -> m
```

Yes, this function will in fact work with **any** `Foldable` structure and **any** `Monoid` - you'll never need to write `reduce` again! Get comfortable with [using `Monoid` for reductions](https://joneshf.github.io/programming/2015/12/31/Comonads-Monoids-and-Trees.html); it's definitely a good way to make your code more **declarative**, and hence more **readable**. I know you're probably _sick_ of hearing about monoids, but they really are **everywhere**!

---

It turns out that _many_ of your favourite `Functor` types have sensible implementations for `reduce`. However, there are **exceptions**:

We can't `reduce` [the `Task` type](https://github.com/folktale/data.task/) because we don't know what the inner values are going to be! It's the same with `Function`: we don't know what the return value is going to be until we give it an **argument**. Remember: **functors' inner values aren't always reachable**.

> Incidentally, if a `Functor` _does_ have an always-reachable inner value, we can call it [a `Copointed` functor](https://hackage.haskell.org/package/pointed-5/docs/Data-Copointed.html). Remember how [`Applicative`'s `of` is a function of `Pointed`](/2017/04/17/fantas-eel-and-specification-9/) functors? Think about the relationship between `Pointed` and `Copointed`. There are **no coincidences** in Fantasy Land!

---

This week, why not make a `Foldable` **Rose Tree**? Or **Set**? There are plenty of opportunities to practise here. Before we go, some of you may have noticed that you can `reduce` most things by just returning the **initial value** given to you:

```javascript
MyType.prototype.reduce = (f, acc) => acc
```

It satisfies the "law", right? This is what I mean: this law is **not a good'un**, and leaves too much room for interpretation. Still, there's no point in _moaning_: we'll see next time that `Traversable` (my **all-time favourite** part of the Fantasy Land spec!) saves the day! From now on, Fantasists, the excitement is **non-stop**.

&hearts;

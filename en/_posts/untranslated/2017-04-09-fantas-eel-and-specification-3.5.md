---
layout: article
title: "Fantas, Eel, and Specification 3.5: Ord"
description: The three-and-a-halfth post in a series on the JavaScript Fantasy Land specification.
redirect_from: /2017/04/09/fantas-eel-and-specification-3.5/
tags: untranslated
---

_Honestly, at this rate, the spec is going to grow faster than this blog series..._ We interrupt our usual schedule to introduce **Fantasy Land's newest member**: let's welcome `Ord`! _Spoiler alert: if you've been following this series, this is going to be a pretty easy one_.

`Ord` types are types with a **total** ordering. That means that, given **any** two values of a given `Ord` type, you can determine whether one be greater than the other. To do this, we actually only need **one method**. Given that all `Ord` types must also be `Setoid` types, it could actually have been _any_ of the comparison operators (`>`, `>=`, `<`, `<=`; _think about why **any of these** would have worked_), but the spec settled on `<=` (less-than-or-equal), which it refers to as `lte`:

```haskell
lte :: Ord a => a ~> a -> Boolean
```

I'm sure that, for most of you, this isn't [your first type signature](/2017/03/08/fantas-eel-and-specification-2/), so I'll leave that link for anyone who may not have seen it. It's almost identical to `Setoid`'s `equals`, though; the only difference is that, this time, we return a boolean to indicate whether `this <= that`, rather than `this == that`. Using only `lte` and `equals` (because **every `Ord` is a `Setoid`**), we can derive all the things we might want:

```javascript
// Greater than. The OPPOSITE of lte.
// gt :: Ord a => a -> a -> Boolean
const gt = function (x, y) {
  return !lte(x, y)
}

// Greater than or equal.
// gte :: Ord a => a -> a -> Boolean
const gte = function (x, y) {
  return gt(x, y) || x.equals(y)
}

// Less than. The OPPOSITE of gte!
// lt :: Ord a => a -> a -> Boolean
const lt = function (x, y) {
  return !gte(x, y)
}

// And we already have lte!
// lte :: Ord a => a -> a -> Boolean
const lte = function (x, y) {
  return x.lte(y)
}
```

_That_ is how, using `equals` and one of those four functions, we have enough to derive the other three. This is _really neat_, and `Ord` continues to please:

```javascript
// Recursive Ord definition for List!
// lte :: Ord a => [a] ~> [a] -> Boolean
List.prototype.lte = function (that) {
  return this.cata({
    Cons: (head, tail) => that.cata({
      Cons: (head_, tail_) =>
        head.equals(head_) ? tail.lte(tail_)
                           : head.lte(head_),

      Nil: () => false
    }),

    Nil: () => true
  })
}

// Just for demo - forgive me!
Number.prototype.equals =
  function (that) { return this == that }

Number.prototype.lte =
  function (that) { return this <= that }

Cons(1, Cons(2, Nil)).lte(Cons(1, Nil)) // false
Cons(1, Nil).lte(Cons(1, Cons(2, Nil))) // true
```

Oh yeah, **it composes**; were you expecting anything less? Of course, we can write `Ord` instances for container types with inner `Ord` types, just as we did for `Setoid`, `Monoid`, and so on. We just **nest** as we want. Do we want to compare `Tuple`s of `List`s of `Maybe`s of some custom type of ours? No problem! `Ord` takes care of everything, just as `Setoid` did for equivalence.

Anyway, we got a bit carried away! Let's talk about laws.

```javascript
// Given any two values of an Ord type...

a.lte(b) || b.lte(a) === true // Totality

a.lte(b) && b.lte(a)
  === a.equals(b) // Antisymmetry

a.lte(b) && b.lte(c)
  === a.lte(c) // Transitivity
```

**Totality** might seem obvious (`a <= b` or `b <= a`, surely?) when we're talking about integers, for example, but this isn't _always_ so easy. There are examples of types that only have **partial order**, which means that there are certain pairs of values that are incomparable. Because of this, they unfortunately don't make it into the `Ord` club!

> A good example is the [semilattice](https://en.wikipedia.org/wiki/Semilattice), if you're interested, but we won't spend any time discussing this further. _Feel free to [tweet me](http://twitter.com/am_i_tom) if you want to talk through it, though!_

**Antisymmetry**, at least to me, seems like a big word for something reasonably obvious. If you compare any `a` and `b` values within the type, then find `a.lte(b)` **and** `b.lte(a)`, well, they can't both be less than the other, right? The only _possible_ explanation is that `a == b`!

Finally, **transitivity**, in _practice_, says that all the values in your type could _in theory_ be arranged into a **fixed, ordered list**. No special cases! Typically, though, you'd be doing well to find an implementation that satisfies the other two laws but _not_ this one!

---

That's really all there is, in terms of theory. Significantly less frightening than [`Contravariant` functors](/2017/04/03/fantas-eel-and-specification-7/), right? It's really just a way to define, for your type, what it means for one thing to be "bigger" than another.

Want some **exercises**? Why not write some of your favourite **sorting algorithms** (like [bubble](https://en.wikipedia.org/wiki/Bubble_sort), [merge](https://en.wikipedia.org/wiki/Merge_sort), and [quicksort](https://en.wikipedia.org/wiki/Quicksort)) to work on **any `Ord`-implementing structure***? Maybe write a more **efficient** version of our [`Setoid`-using `Set` type](/2017/03/09/fantas-eel-and-specification-3/) by using an **ordered list** to hold the inner elements? There are plenty of opportunities!

> Of course, if you _don't_ want to relive your technical interview nightmares, remember that `Ord` is just as useful for ordering **search results** on a web page. The Fantasy Land structures are just a bunch of **design patterns** that are written with composition (and _discipline_!) in mind.

Regardless, I hope you enjoyed this surprise addition to the series. Normal service will resume, and we'll be discovering `Apply` and `Applicative` tomorrow, right on schedule. It's _also_ a good time to mention that I've been putting together [a collection of Fantasy Land structure examples](https://github.com/i-am-tom/fantas-eel-and-specification) to go along with this series! I have quite a lot of catching up to do, but I'll get there. I'm implementing all the examples and exercises that I mention in the articles, as well as other structures that may be interesting. _Naturally, I would be **honoured** if you wanted to contribute any examples you've found helpful, or even just add a couple comments and helpful tips to what's already there!_

Anyway, that's all from me! See you tomorrow, everyone - enjoy the rest of your weekends, and take care &hearts;

_* If you decide to do this, this is a **great** candidate for an [npm](http://npmjs.com) package. Seriously, **I will use this** - let me know when you publish!_

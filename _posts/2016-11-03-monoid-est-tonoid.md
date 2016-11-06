---
layout: post
title: Monoid Est Ton Oid
description: Writing monoids to simplify folds in Javascript.
---

_This post is written in English and JavaScript._

A while back, I read Hardy Jones' [Comonads, Monoids and Trees](https://joneshf.github.io/programming/2015/12/31/Comonads-Monoids-and-Trees.html) (it's _great_, if you haven't read it), and one passage particularly stuck with me:

> I have been noticing that whenever there is a `reduce` around, it is indicative of an abstraction somewhere. Many people call this a code smell.

I've been trying to keep this in mind when using `reduce`, and trying to capture the logic in a **monoid**. What are monoids, you ask? _Well_, reader mine, let's build one and find out...

## Motivation

Take this **fold** (basically just a `reduce` operation), for example, to find the **sum** of a list:

```javascript
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// This will produce 45.
numbers.reduce((acc, x) => acc + x, 0)
```

So, there's nothing _wrong_ with this code, but what if we need to sum other lists? There are two things that we can reuse:

- The **reduction function**, `(acc, x) => acc + x`
- The **starting value**, `0`

We'd have a different pair for the **product** `((acc, x) => acc * x, 1)`, or for finding the **maximum** value `(Math.max, -Infinity)`, or anything else. What's important is that the starting value doesn't affect the values in the list: for any `x`, we know it's always true that `0 + x = x`, `1 * x = x`, and `max(x, -Infinity) = x`. We'll call each of these values the **identity** for its operation.

Let's neaten up this concept using a data structure:

```javascript
const Sum = x => ({
  append: y => Sum(x + y.val),
  val: x
})

Sum.identity = Sum(0)
```

This structure forms the `Sum` **monoid**. We're there. Bam.

## Is That It?

Yep, that's it. We're done. There's honestly no magic to see here. A monoid is a structure that can be **append**ed to other instances of the same structure, and has an **identity** instance. The only other thing we _must_ do is make sure that the `append` method is **associative**:

```javascript
// For any x, y, and z of the same monoid...
x.append(y).append(z) === x.append(y.append(z))
```

Just use the intuition that, _"as long as the variables are still in the same left-to-right order, the grouping doesn't matter"_. This property is really useful when you come to processing _lots_ of data and you want to split the job up between several threads or nodes: split the data up into chunks, combine (`append`) all the elements in each chunk, and then combine the chunks. As long as chunk `n` is appended to the left of chunk `n + 1`, then everything will Just Work™!

Given this structure, we can now write a tiny function for dealing with it, which we'll call `fold`:

```javascript
const fold = (M, xs) =>
  xs.map(x => M(x)).reduce(
    (acc, x) => acc.append(x),
    M.identity
  )

// Surprise: it's 45!
fold(Sum, numbers).val
```

We take all the numbers, wrap them in `Sum`, and then `append` the `Sum` instances together to make one overall `Sum`! Notice that the `fold` function will also work for other monoids, such as `Product` and `Max`. Implement them if you don't believe me, or you can cheat and jump straight to the JSBin link below!

So, we now only need the `fold` method for each of our collection structures, and we can reuse these monoids wherever we want. Instead of each structure needing methods for `max`, `length`, `average`, etc, they now only need a `fold` method, and we can simply pass in the monoid that captures the operation we want to perform. Simpler code, more declarative logic, and more code reuse. _Voila_.

---

So, not the longest post, but that's all from me for today. A lot of functional concepts are much simpler than people would have you believe. If you want to have a play, here are the [examples in JSBin](https://jsbin.com/diwaxefenu/edit?js,console). There are many more examples of useful monoids: feel free to research, or try building some of your own.

This post is actually here to provide some background reading for a [PHP talk](https://github.com/i-am-tom/php-folding-talk) I'm doing next week on monoids and folds. The majority of the talk is around the folding, rather than the monoids, but check out the README for a bigger example of how this all works together.

Take care &hearts;

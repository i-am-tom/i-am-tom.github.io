---
layout: post
title: Reductio and Abstract 'em
description: More than you ever wanted to know about lists. Far, far more.
---

Oh, hey, stranger! Long time no talk. In case you're interested, I've moved house, job, and company since my last post, hence the hiatus. **Sorry!** Anyway, speaking of terrible segues, have you ever noticed that _you can write every list function with [reduceRight](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/reduceRight)_?

## _... Uh, no, you can't?_

Ok, bear with me: there are **two caveats**. For now, let's assume two functions we get for free:

```javascript
const head = ([x, ... xs]) =>  x
const cons = ( x,     xs ) => [x, ... xs]
```

Immediately, we can see that `cons` is really just a strange name for `prepend`. I'll explain _why_ we can take these for granted later, but it'll make things much easier in the mean time to go with it. Until then, I promise it's not a cop-out!

## _... Right, OK. You were saying?_

Let's start with everyone's favourite list function: `map`. What's cool about this function is that its accumulator **is another list** - we're reducing one list to another!

```javascript
const map = (f, xs) => xs.reduceRight(
  (acc, x) => cons(f(x), acc], [])
)

// [2, 3, 4]
map(x => x + 1)([1, 2, 3])
```

Pretty neat, huh? With that realisation, it's actually quite straightforward to implement everyone's second favourite list function, `filter`:

```javascript
const filter = (p, xs) => xs.reduceRight(
  (acc, x) => p(x) ? cons(x, acc)
                   :         acc,
  []
)

// [1, 2]
filter(x => x < 3)([1, 2, 3, 4])
```

**Bam!** If the condition be met, we `cons` the element. Otherwise, we just carry the accumulator through untouched. What about everyone's _third_ favourite list function: `reduce`? ... Well, that's a bit of a complicated one, so let's build up to it.

## _Fine... but what about ____?_

Name it and we'll write it! Shall we start with `append`?

```javascript
const append = (x, xs) => xs.reduceRight(
  (acc, h) => cons(h, acc), [x]
)

// [1, 2, 3, 4]
append(4)([1, 2, 3])
```

This `reduceRight` operation actually does _nothing_, but starts with a non-empty accumulator, which therefore just gets appended! With the same technique, we can write `concat`:

```javascript
const concat = (xs, ys) => xs.reduceRight(
  (acc, h) => cons(h, acc), ys
)

// [1, 2, 3, 4]
concat([1, 2])([3, 4])
```

Anyway, now we have `append`, we can write `reverse`:

```javascript
const reverse = xs => xs.reduceRight(
  (acc, x) => append(x, acc), []
)

// [3, 2, 1]
reverse([1, 2, 3])
```

This just takes each element from the end of the list and and sticks it to the end of the accumulator. Easy! Moving on, `length` is even simpler:

```javascript
const length = xs => xs.reduceRight(
  (n, _) => n + 1, 0
)

// 4
length([1, 2, 3, 4])
```

This is all fun, but these aren't _mind-bending_; chances are that you've already seen `length` written as a reduction at some point. Why don't we try something harder? Let's write `elemAt`, a function that returns the element at a given index. For example, `elemAt(2, xs)` is exactly the same as `xs[2]`. Oh yeah, that's right: **array access is a reduction**.

```javascript
const elemAt = (n, xs) => head(xs.reduce(
  ([e, n], x) => [n == 0 ? x : e, n - 1],
  [undefined, n]
))

// 3
elemAt(2, [1, 2, 3])
```

So, it's a sneaky one: we count down the index until we hit `0`, then "save" the value at that position. But **wait!** We used `reduce`, not `reduceRight`!

Well, ok, you _could_ write this function with `reduceRight`, and I'll leave that as a ([quite tricky](http://stackoverflow.com/questions/14526254/find-the-kth-element-of-a-list-using-foldr-and-function-application-explana)) exercise to the reader. However, it's _much_ easier to understand with `reduce`. Besides, if we can prove that `reduce` can be written with `reduceRight`, this isn't cheating, is it?

```javascript
const reduce = (f, acc, xs) =>
  xs.reduceRight(
    (accF, x) => z => accF(f(z, x)),
    x => x
  )(acc)
```

Serves you right for asking! The principle is that **we reduce the list to a function** to compute `reduce`. We start with `x => x`, which does nothing, and then tack on a new function for each element in the list. Let's work it through with a simple(ish) example:

```javascript
reduce((x, y) => x - y, 10, [1, 2])

  // Expand `reduce` to `reduceRight`
  == [1, 2].reduceRight(
       (g, x) => z => g(
         ((x, y) => x - y)(z, x)
       ),

       x => x
     )(10)

  // Simplify the reducer
  == [1, 2].reduceRight(
       (g, x) => z => g(z - x),
       x => x
     )(10)

  // Consume the first element
  == [1].reduceRight(
       (g, x) => z => g(z - x),
       z => (x => x)((x => x - 2)(z))
     )(10)

  // Simplify the ugly accumulator
  == [1].reduceRight(
       (g, x) => z => g(z - x),
       x => x - 2
     )(10)

  // Consume the next element
  == [].reduceRight(
       (g, x) => z => g(z - x),
       z => (x => x - 2)((x => x - 1)(z))
     )(10)

  // Simplify the ugly accumulator
  == [].reduceRight(
       (g, x) => z => g(z - x),
       z => z - 3
     )(10)

  // `reduceRight` on [] == acc
  == (z => z - 3)(10)

  // Evaluate
  == 7
```

We survived! That might take a couple of read-throughs, but the basic point is that our accumulator builds up a function that does each action in reverse. Of course, `reduce` and `reduceRight` calculate the same value for `(x, y) => x - y`, so try something like `(x, y) => [x, y]` to appreciate the difference.

Are you convinced yet? We can carry on with more examples if you- no? Well, ok. Let's move onto _why_ every list function is a form of `reduceRight`.

## A ([Strangely Familiar](/2016/10/29/peano-forte/)) List

A list can either be expressed as `[]` (**empty**) or `[x, ... xs]`, a **non-empty** list - an item _followed by another list_*. This is exactly a [linked list](https://en.wikipedia.org/wiki/Linked_list)!

At this point, we can explain why we got `cons` and `head` for free earlier: all they do is **construct** and **destruct** lists in this form. They're just ways to describe the _structure_ of our list.

## Int-`reduce`-ing Our Hero

Let's write down two equations that define exactly how `reduceRight` works:

```javascript
[].reduceRight(f, acc) = acc

[x, ... xs].reduceRight(f, acc) =
  f(xs.reduceRight(f, acc), x)
```

That's all there is to `reduceRight`. An empty list reduces to its accumulator, a non-empty list reduces to `f` of the tail's reduction and the head... The code is probably clearer than that sentence.

Now, because **reduceRight lets us set empty and non-empty behaviour**, and **has an accumulator**, we are free to change the shape of the list _entirely_. Note that we couldn't write `length` in terms of `map`, because `map` doesn't let us change the shape (length!) of a list. Similarly, we couldn't write `length` in terms of `filter`, because `filter` doesn't have an accumulator!

What `reduceRight` actually is, formally, is a **catamorphism**: a way of folding a type (in this case, a **list**) up into a value.  The theory here is simple: if you have access to all possible configurations of your structure, you can do anything you like. If you don't, you can't!

## `reduce` vs `reduceRight`?

Given that you can indeed express `reduceRight` in terms of `reduce`, it might seem odd to pick the less common one as a base operation. The answer lies in [lazy languages and infinities](https://wiki.haskell.org/Foldl_as_foldr), and there are already plenty of [lazy `reduceRight` explanations](https://www.quora.com/Haskell-programming-language-Isnt-foldr-just-foldl-applied-on-a-reversed-list) online - you don't need _my_ poor attempt!

## _So..._ `reduceRight` _can do_ anything _with lists?_

Yes! For some further reading, catamorphisms are also called **folds**, which does imply an _unfold_ (an **anamorphism** - more wonderful names!), and [Ramda's unfold function](http://ramdajs.com/docs/#unfold) can show you exactly what that does. Think about a function that produces a _range_ - that's unfolding a starting number into a list from 0 to the number! Still, we can think of that as not being a _list function_ because it's not a function on a list - it's just a function that _returns_ a list**.

**tl;dr?** When The Beatles said that all we need is _love_, they probably meant to say `reduceRight`.

---

That's all from me! I should hopefully be more regular with my updates now I'm settled. See you next time!

Take care &hearts;

_* Just as [Peano numbers](/2016/10/29/peano-forte/) were either zero (`Z`) or one greater than some other Peano number (`S Peano`)._

_** If you're a wincing mathematician, I'm sorry - this is a beginner's guide!_

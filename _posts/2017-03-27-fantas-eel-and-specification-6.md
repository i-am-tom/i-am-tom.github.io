---
layout: post
title: "Fantas, Eel, and Specification 6: Functor"
description: Six down, fifteen to go!
---

Fantasy Landers, **assemble**! We've been `concat`enating for two weeks now; are you ready for something a bit different? Well, **good news**! If you're humming, "_Oh won't you take me... to functor town?_", then this is the article for you. Today, friends, we're going to talk about **functors**.

<blockquote class="twitter-tweet" data-lang="en-gb"><p lang="en" dir="ltr">Another <a href="https://twitter.com/hashtag/functional?src=hash">#functional</a> blog post on <a href="https://twitter.com/hashtag/functors?src=hash">#functors</a> in <a href="https://twitter.com/hashtag/javascript?src=hash">#javascript</a>, including Maybe, Either, and... Function :O <a href="https://t.co/3H5T0yb35w">https://t.co/3H5T0yb35w</a></p>&mdash; Tom Harding (@am_i_tom) <a href="https://twitter.com/am_i_tom/status/815221887655546880">31 December 2016</a></blockquote> <script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

Yes, so, at the very end of last year, I wrote an article about functors that went over several examples of `Functor` types. It's a collection of examples of how these can be useful _in practice_, but it's a bit light on **intuition**. Let's right that wrong today!

I'd recommend giving the above a quick read, as this post won't spend much time going over what was said back then. <abbr title="Too long; didn't read">tl;dr</abbr>, `Functor` is just another **typeclass** (a structure just like `Semigroup` or `Monoid`) with one special method:

```haskell
-- Any functor must have a `map` method:
map :: Functor f => f a ~> (a -> b) -> f b
```

... and (_surprise!_) a couple of **laws**. For _any_ functor value `u`, the following must be true:

```javascript
// Identity
u.map(x => x) === u

// Composition:
u.map(f).map(g) === u.map(x => g(f(x)))
```

They might not be _immediately_ clear, and the definitions in the other article are a bit wordy, but have a couple reads. In _my_ head, I tend to think to myself, _a call to `map` must return an identical **outer** structure, with the **inner** value(s) transformed._

---

If this looks a bit _weird_ to you, then it's probably because `Functor` is the **first** entry we've seen in Fantasy Land that _must_ **contain** some other type.

Think about `String`. It has actually ticked all the boxes up until now - it's a `Setoid`, `Semigroup`, _and_ a `Monoid` - but we can't make it a `Functor`. This is because `String` is just, well, strings!

`Array a` has also ticked all the boxes so far, but it _is_ a `Functor`. This is because it _contains_ a value of type `a` (or, usually, several of them). Strings are just strings - you can't have a "`String` _of_ a thing" in the same way as you can have an "`Array` _of_ a thing" or a "`Maybe` _of_ a thing".

**_Functor types are containers. Not all container types are functors._** Want an example? Let's look at `Set a` - a collection of _unique_ values of some type `a`. There's a catch here, though - `a` must be a `Setoid`. Looking at the type signature for `map`, we see no `Setoid` restrictions - we could `map` our `Set a` values to some not-a-`Setoid` type `b` (like `Function`), and we'd have no way of ensuring uniqueness!

A functor **does not care** about the type it's holding. `Set`, on the other hand, _must_. Thus, `Set` can't be a `Functor`. Don't worry, though - there are plenty of [types that _are_ functors](/2016/12/31/yippee-ki-yay-other-functors/)!

---

Ok, everything has hopefully just about made sense up to here. Now's when we get a bit... **hand-wavey**. Sorry in advance. We've been over the _laws_, and we've seen some examples. What's the **intuition**, though? If all these wildly different types of things are functors, what behaviour do they all _share_?

Imagine a world _without_ functors. All we have are basic values: `Int`, `String`, `Number`, that sort of thing. No `Array`, though. No `Set`, either, as you'd _internally_ need an array of values. No nullable values _at all_ (they're not type-safe). No `Function`, even! We'd have an **extremely limited** set of tools and would probably throw our computers out the window before too long. But, when we start introducing `Functor` types:

| Type         | Capability                           |
| ------------:|:------------------------------------ |
| `a`          | Represent a value.                   |
| `Maybe a`    | Represent a **possibly null** value. |
| `Either e a` | Represent a value **or exception**.  |
| `Array a`    | Represent **a number of values**.    |
| `x -> a`     | Represent a **mapping to values**.   |
| ...          | ...                                  |

A functor is like a little "world" in which our boring, functor-less language has been _extended_ in some (hopefully useful!) way. When we put a value into one of these worlds, we say that we're **lifting** the value _into_ the functor.

**More than one extension**? What if we want to represent _a number of mappings to values_? We make an `Array` of `Function`s! What about a _mapping to a possibly null value_? We write a `Function` that maps to `Maybe`s! If we want to combine these capabilities, we simply **nest** them.

> We'll see that we're not always so lucky with composition-by-nesting when we get on to more complex structures!

We're there. **That's what a functor does**. It provides some **extended behaviour**, with total, gorgeous **type safety**. Note that our language isn't _changed_ inside a functor type - just _extended_. This is why the **functor laws** hold. Let's write a couple of little proofs:

```javascript
// For ANY functor *constructor* U:
// e.g. [x].map(f) === [f(x)]
U(x).map(f) === U(f(x))

// Read: `map` just applies the function to
// the inner value. Using only this rule,
// we win!

const id = x => x

// Identity...
U(x).map(id)

  === U(id(x))

  === U(x) // id(x) === x

// Composition...
U(x).map(g).map(f)

  === U(g(x)).map(f)

  === U(f(g(x)))

  === U(x).map(x => f(g(x)))
```

Our laws hold, everything works. If it helps your intuition, just think of `U(x).map(f) === U(f(x))` every time you run into a functor. More generally (and correctly), **`map` applies a function to the value(s) within a functor** and _nothing else_. That, friends, is all there is to it!

---

So, I'm sorry that it got a bit less _clearly_-defined towards the end. You can see it's quite difficult to define an all-encompassing intuition for functors, but I hope this has given you somewhere to start!

If you want more examples, the Haskell docs contain [loads of Functor types](https://hackage.haskell.org/package/base-4.9.1.0/docs/Data-Functor.html#control.i:Functor) for you to see! The intuition will come with time. Until then, as always, feel free to [tweet me](http://twitter.com/am_i_tom) and I'll do my best to clarify my ramblings.

Next time, we'll look at another type of functor: the **contravariant functor**. Get excited! As always, until then,

Take care &hearts;

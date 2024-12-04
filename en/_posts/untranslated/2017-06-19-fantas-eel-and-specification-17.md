---
layout: article
title: "Fantas, Eel, and Specification 17: Comonad"
description: Having lots of co-fun.
redirect_from: /2017/06/19/fantas-eel-and-specification-17/
tags: untranslated
---

**'Ello 'ello**! Remember that `Monad` thing we used to be afraid of, and how it just boiled down to a way for us to **sequence** our ideas? How `Extend` was really just `Chain` backwards? Well, today, we'll answer the question that I'm sure has plagued you _all_ week: **what _is_ a backwards `Monad`**?

First up, we should talk about the **name**. _No_, not the `monad` bit - the `co` bit. When we talk about structures like `Monad`, we sometimes talk about the idea of the **dual structure**. Now, for our purposes, we can just think of this as, "_The same, but with all the arrows backwards_".

> This is a _surprisingly_ good intuition for dual structures. Seriously.

Hey, that was our **first hint**! `Comonad` is `Monad` with "the arrows backwards". When we **boil it down**, there are really only two **interesting** things that a `Monad` can do:

```haskell
-- For any monad `m`:
of :: a -> m a
chain :: m a -> (a -> m b) -> m b
```

From this, we can derive all the other fun stuff like `join`, `map`, `ap`, and whatnot. So, let's write this all **backwards**, turning our entire types the **wrong way round**:

```haskell
-- Turn the arrows around...
coOf :: a <- m a
coChain :: m a <- (a <- m b) <- m b

-- Or, more familiarly...
-- For any Comonad `w`:
coOf :: w a -> a
coChain :: w a -> (w a -> b) -> w b
```

Well, here's the **good news**: we already know `coChain`, and we call it `extend`! That leaves us with that `coOf` function, which the [glorious Fantasy Land spec](https://github.com/fantasyland/fantasy-land) calls **`extract`**.

When I first looked at `extract`, I got a bit confused. Couldn't we do that with `Monad`? If not, what's the _point_ in a `Monad` if we can't get a value back _out_? What helped me was looking **a little closer** at `extract`:

```haskell
extract :: w a -> a
```

That function takes **any** `Comonad` and returns the value **inside**. We couldn't do that for `Maybe`, because some of our values - `Nothing` - don't have a value to return! We couldn't do it for `Array`; what if it's **empty**? We couldn't do it for `Promise`; we don't know what the value _is_ yet! It turns out that, for a _lot_ of `Monad` types, this function **isn't as easy** to write as we might think at first glance.

Let's think about `Maybe` for a second, though. Would it be a `Comonad` if we removed the `Nothing` option? Well, yes, but then it wouldn't be a `Maybe` - it would be `Identity` with a funny name!

What about `Array`? What if we made a type like this:

```javascript
//- An array with AT LEAST ONE element.
//+ data NonEmpty = NonEmpty a (Array a)
const NonEmpty = daggy.tagged(
  'NonEmpty', ['head', 'tail']
)

// Extend would function the same way as it
// did for Array in the last article...

NonEmpty.prototype.extract = function () {
  return this.head
}

// e.g.
NonEmpty(1, [2, 3, 4]).extract() // 1
```

Now we have a **type** for non-empty lists, we can **guarantee** a value to extract! This type, it transpires, forms a beautiful `Comonad`.

> A piece of good advice is to **make illegal states unrepresentable**. If we need an array somewhere in our code that **must** have at least one element, using the `NonEmpty` type gives us an API with that **guarantee**!

So, `chain` gave us sequencing with **write** access to the **output**, and `of` let us **lift** a value into the computation whenever we liked. `extend` gives us sequencing with **read** access to the **input**, and `extract` lets us **extract** a value out of the computation whenever we like!

> If you've followed the blog series up until now, [the `Comonad` laws](https://github.com/fantasyland/fantasy-land#comonad) are going to be what you've come to expect. **No new ideas**!

---

Now, before we start to assume that all `Comonad` types are just **bastardised `Monad` types**, let's look at something **very** comonadic: `Store`.

```javascript
//+ data Store p s = Store (p -> s) p
const Store = daggy.tagged(
  'Store', ['lookup', 'pointer']
)
```

The intuition here is that `lookup` represents a function to get things _out_ of a "store" of `s`-values, indexed by `p`-values. So, if we pass a `p` to the `lookup` function, we'll get out its corresponding `s`. The `pointer` value represents the "current" value. Think of this like the **read head** on an old **hard disk**.

Now, to make this type more useful, we can stick a couple of functions onto this:

```javascript
//- "Move" the current pointer.
//+ seek :: Store p s ~> p -> Store p s
Store.prototype.seek = function (p) {
  return Store(this.lookup, p)
}

//- Have a look at a particular cell.
//+ peek :: Store p s ~> p -> s
Store.prototype.peek = function (p) {
  return this.lookup(p)
}
```

And, wouldn't you know it, we can also make this a functor by [mapping over the **function**](/2017/04/15/functions-as-functors/)!

```javascript
//- Compose the functions! Yay!
Store.prototype.map = function (f) {
  const { lookup, pointer } = this

  return Store(lookup.map(f), pointer)
  // Store(p => f(lookup(p)), pointer)
}
```

Now, if we're going to make a `Comonad` of our `Store`, we first need to make it an `Extend` instance. Remember: `extend` should behave like `map`, but with **read-access to the input**. Here's where `Store` gets _really_ sneaky.

```javascript
//+ extend :: Store p s ~> (Store p s -> t)
//+                     -> Store p t
Store.prototype.extend = function (f) {
  return Store(
    p => f(Store(this.lookup, p)),
    this.pointer)
}
```

Our `lookup` function now applies `f` to a `Store` **identical** to the original, but with the focus on the **given index**! Can you see the magic yet? Let's **build something exciting**: [Conway's **Game of Life**](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life).

---

For this, we're going to use a "board" of `[[Bool]]` type to represent our "live" and "dead" cells. Something like this, perhaps:

```javascript
let start = [
  [ true,  true,  false, false ],
  [ true,  false, true,  false ],
  [ true,  false, false, true  ],
  [ true,  false, true,  false ]
]
```

If we want to look up a value in this store, we're going to need an `x` and `y` coordinate. What better choice of structure to hold two numbers than a `Pair`?

```javascript
const Game = Store(
  ({ _1: x, _2: y }) =>
    // Return the cell OR false.
    y in start && x in start[y]
      ? start[y][x]
      : false,

  // We don't care about `pointer` yet.
  Pair(0, 0))
```

Now, we need to write out some logic! The rule for the Game of Life is that, if a `false` cell has **exactly three** `true` neighbours, make it true. If a `true` cell has **two or three** `true` neighbours, keep it as true. If **neither** apply, make it `false`. We can work this out for any cell with eight sneaky `peek`s!

```javascript
// What will the current cell be next time?
//+ isSurvivor :: Store (Pair Int Int) Bool
//+            -> Bool
const isSurvivor = store => {
  const { _1: x, _2: y } = store.pointer

  // The number of `true` neighbours.
  const neighbours =
    [ Pair(x - 1, y - 1) // NW
    , Pair(x, y - 1)     // N
    , Pair(x + 1, y - 1) // NE

    , Pair(x - 1, y)     // W
    , Pair(x + 1, y)     // E

    , Pair(x - 1, y + 1) // SW
    , Pair(x, y + 1)     // S
    , Pair(x + 1, y + 1) // SE
    ]
    .map(x => store.peek(x)) // Look up!
    .filter(x => x) // Ignore false cells
    .length

  // Exercise: simplify this.
  return store.extract() // Is it true?
    ? neighbours === 2 || neighbours === 3
    : neighbours === 2
}
```

Now, _why_ did we go to all this trouble? Well, we now have a `Store (Int, Int) Bool` to `Bool` function, which is the exact shape that `extend` needs... and `extend` will (lazily!) apply this function to **every cell on the board!** By using `extend`, we now get to see the **entire board** one step into **the future**. Isn't that _magical_?

> I _strongly_ recommend you look at [the Gist for this article](https://gist.github.com/richdouglasevans/0f9a57e5a52b13e93c0c03630165ecd8) and be sure that this makes sense. `Store` is an **unfamiliar beast**.

---

Now, there are plenty of other `Comonad` types, but they're not quite as popular as `Monad` types, probably because their use isn't so **obvious**. After all, we can write our applications just using `Monad` types, so this (_unfairly_) ends up in the _advanced_ box. How **rude**!

For now, however, we'll stop here. I will come back to `Comonad` in other posts - they're my latest **obsession** - but `Store` gives a really clear idea about why these are useful. Incidentally, if you want to play the Game of Life, [the article's Gist](https://gist.github.com/richdouglasevans/0f9a57e5a52b13e93c0c03630165ecd8) has a working demo!

Next time, we'll be looking at `Bifunctor` and `Profunctor`: so simple, we're going to do both at the same time! I promise: these last two are going to be a bit of a **cool-down session**. Until then!

&hearts;

---
layout: post
title: "Fantas, Eel, and Specification 16: Extend"
description: Context-Sensitive Mapping
---

You're **still** here? That means you survived `Monad`! See? Told you it isn't that scary. It's nothing we haven't **already seen**. Well, _today_, we're going to revisit `Chain` with one _slight_ difference. As we know, `Chain` takes an `m a` to an `m b` with some help from an `a -> m b` function. It **sequences** our ideas. However, _what if I told you_... we could go **backwards**? Let's `Extend` your horizons.

Don't get too excited; the disappointment of `Contravariant` will come flooding back! We're certainly not saying that we have a magical `undo` for any `Chain`. What we _are_ saying, though, is that there are some types for which we can get from `m a` to `m b` via `m a -> b`. Instead of **finishing** in the context, we **start** in it!

Two questions probably come to mind:

- **How** is this useful?
- ... See question 1?

Well, we'll be answering **at least** one of those questions today! _Before_ that, though, let's go back to our _old_ format and **start** with the **function**:

```haskell
extend :: Extend w => w a ~> (w a -> b) -> w b
```

> Notice we're using `w` here. I kid you _not_, we use `w` because it looks like an upside-down `m`, and `m` was what we used for `Chain`. It's literally there to make the whole thing look **back-to-front** and **upside-down**. I'm told that mathematicians call this a **joke**, so do _try_ to laugh!

_As we said_, it's `Chain` going backwards. It even has the same laws backwards! Say hello, once again, to our old friend **associativity**:

```javascript
// RHS: Apply to f THEN chain g
m.chain(f).chain(g)
  === m.chain(x => f(x).chain(g))

// RHS: extend f THEN apply to g
w.extend(f).extend(g)
  === x.extend(w_ => g(w_.extend(f)))
```

> Wait, so, if `extend` has **associativity**, and if it looks a bit like a `Semigroup`... (_all together now_) **where's the `Monoid`**?!

It's just like `chain`, but backwards. **Everything is backwards**. It's really the only thing you need to remember!

<abbr title="Pretty neat, right?">?thgir ,taen ytterP</abbr>

---

So, _aside_ from it being backwards, is there anything _useful_ about `Extend`? _Or_, are we just getting a bit tired at this point? **Both**! Hopefully more the former, though...

Let's start with an old friend, [the `Pair` (or `Writer`) type](/2017/04/27/pairs-as-functors/). When we `chain`, we have _total_ control over the **output** of our function: we say what we _append_ to the **left-hand side**, and what we want the right-hand value to be. There was, however, one thing we _can't_ do: see what was already _in_ the left part!

`Pair` really gave us a wonderful way to achieve **write-only** state, but we had no way of **reading** what we'd written! Wouldn't it be **great** if we had a `map`-like function that let us take a **sneaky peek** at the left-hand side? Something like this, perhaps:

```haskell
map :: (m, a) ~> (a  -> b) -> (m, b)

-- Just like map, but we get a sneaky peek!
sneakyPeekMap :: (m, a)
              ~> ((m, a) -> b)
              -> (m, b)
```

It's really just like `map`, but we get some **context**! Now that we can, whenever we like, take a look at how the left-hand side is doing, we can feed our **hungry adventurer**:

```javascript
//- Sum represents "hunger"
const Adventurer = Pair(Sum)

//+ type User = { name :: String, isHungry :: Bool }
const exampleUser = {
  name: 'Tom',
  isHungry: false
}

// You get the idea... WorkPair again!

//+ slayDragon :: User -> Adventurer User
const slayDragon = user =>
  Adventurer(Sum(100), user)

//+ slayDragon :: User -> Adventurer User
const runFromDragon = user =>
  Adventurer(Sum(50), user)

//- Eat IF we're hungry
//+ eat :: User -> Adventurer User
const eat = user =>
  user.isHungry
  ? Adventurer(Sum(-100), {
      ... user,
      isHungry: false
    })

  : Adventurer(Sum(0),   user)

//- How could we know when we're hungry?
//- This function goes the other way...
//+ areWeHungry :: Adventurer User -> User
const areWeHungry =
  ({ _1: { value: hunger }, _2: user }) =>
    hunger > 200
      ? { ... user, isHungry: true }
      : user

// Now, we do a thing, check our hunger,
// and eat if we need to!

// WE ARE SELF-AWARE.
// SKYNET

slayDragon(exampleUser)
.sneakyPeekMap(areWeHungry).chain(eat)
// Pair(Sum(100), not hungry)

.chain(slayDragon)
.sneakyPeekMap(areWeHungry).chain(eat)
// Pair(Sum(200), not hungry)

.chain(runFromDragon)
.sneakyPeekMap(areWeHungry).chain(eat)
// Pair(Sum(150), not hungry)!
```

Just with this `sneakyPeekMap`, we can now inspect our character stats and feed that _back_ into our actions. This is _so_ neat: any time you want to update one piece of data depending on another, `sneakyPeekMap` is **exactly** what you need. Oh, and by the way, it has a much more common name: `extend`!

---

_So, can I just think of `extend` as `sneakyPeekMap`?_ I mean, you basically can; that intuition will get you a **long** way. As an homage to [Hardy Jones' functional pearl](https://joneshf.github.io/programming/2015/12/31/Comonads-Monoids-and-Trees.html), let's build a [**Rose Tree**](https://en.wikipedia.org/wiki/Rose_Tree):

```javascript
//- A root and a list of children!
//+ type RoseTree a = (a, [RoseTree a])
const RoseTree = daggy.tagged(
  'root', 'forest'
)
```

_Maybe_, you looked at that type and a little voice in the back of your mind said `Functor`. If so, **kudos**:

```javascript
RoseTree.prototype.map = function (f) {
  return RoseTree(
    f(this.root), // Transform the root...
    this.forest.map( // and other trees.
      rt => rt.map(f)))
}
```

**No problem**; transform the root node, and then _recursively_ map over all the child trees. **Bam**. _Now_, imagine if we wanted to _colour_ this tree's nodes depending on how many **children** they each have. Sounds like we'd need to take... a **sneaky peek**!

```javascript
//+ extend :: RoseTree a
//+        ~> (RoseTree a -> b)
//+        -> RoseTree b
RoseTree.prototype.extend =
  function (f) {
    return RoseTree(
      f(this),
      this.forest.map(rt =>
        rt.extend(f))
    )
  }

// Now, it's super easy to do this!
MyTree.extend(({ root, forest }) =>
  forest.length < 1
    ? { ... root, colour: 'RED' }
    : forest.length < 5
      ? { ... root, colour: 'ORANGE' }
      : { ... root, colour: 'GREEN' })
```

With our new-found **superpower**, each node gets to pretend to be the **one in charge**, and can watch over their own forests. The trees in those forests then do the same, and so on, until we `map`-with-a-sneaky-peek **the entire forest**! Again, I linked to Hardy's article above, which contains a much **deeper** dive into trees specifically; combining `RoseTree` with Hardy's ideas is enough to make your own **billion-dollar React clone**!

---

Let's cast our minds _waaay_ back to [the Setoid post](/2017/03/09/fantas-eel-and-specification-3/), when we looked at `List`. List, it turns out, is a `Functor`:

```javascript
//- Usually, if you can write something for
//- Array, you can write it for List!
List.prototype.map = function (f) {
  return this.cata({
    // Do nothing, we're done!
    Nil: () => Nil,

    // Transform head, recurse on tail
    Cons: (head, tail) =>
      Cons(f(head), tail.map(f))
  })
}

// e.g. Cons(1, Cons(2, Nil))
//      .map(x => x + 1)
// === Cons(2, Cons(3, Nil))
```

Now, for this **convoluted example**, let's imagine we have some weather data for the last few days:

```javascript
const arrayToList = xs => {
  if (!xs.length) return Nil

  const [ head, ... tail ] = this
  return Cons(head, arrayToList(tail))
}

List.prototype.toArray = function () {
  return this.cata({
    Cons: (head, tail) => ([
      head, ... tail.toArray()
    ]),

    Nil: () => []
  })
}

// Starting from today... (in celsius!)
const temperatures = arrayToList(
  [23, 19, 19, 18, 18, 20, 24])
```

What we want to do is `map` over this list to determine whether the temperature has been warmer or cooler than the day before! To do that, we'll probably need to do _something_ sneakily... any ideas?

```javascript
//+ List a ~> (List a -> b) -> List b
List.prototype.extend = function (f) {
  return this.cata({
    // Extend the list, repeat on tail.
    Cons: (head, tail) => Cons(
      f(this), tail.extend(f)
    ),

    Nil: () => Nil // We're done!
  })
}

// [YAY, YAY, YAY, YAY, BOO, BOO, ???]
temperatures
.extend(({ head, tail }) =>
  tail.length == 0 ? '???'
                   : head < tail.head
                     ? 'BOO' : 'YAY')
.toArray()
```

We only used the _head_ of the tail this time, but we could use the whole thing if we wanted! We have the entire thing available to peek sneakily.

> For example, we could use this technique for lap times to record whether they're **faster or slower** than the **average** so far! **Have a go!**

As we said, we can mimic the same behaviour for `Array` to save us all the to-and-fro with `List`:

```javascript
Array.prototype.extend = function (f) {
  if (this.length === 0) return []

  const [ _, ... tail ] = this
  return [ f(this), ... tail.extend(f) ]
}

// Now, we can use array-destructuring :)
;[23, 19, 19, 18, 18, 20, 24].extend(
  ([head, ... tail]) =>
    tail.length == 0
    ? '???'
    : head < tail[0]
      ? 'BOO' : 'YAY')
```

---

I brought these examples up for a reason, Fantasists. _Often_, `extend` isn't just `f => W.of(f(this))` for some `W` type; that's what `of` is for! `extend` is about being able to `map` while being aware of the surrounding **construct**.

Think of it like this: when we used `Chain`, we had total **write** access to the **output** _constructor_ and _values_. We could turn `Just` into `Nothing`, we could fail a `Task`, and we could even change the length of an `Array`. **Truly, we were powerful**.

With `Extend`, we get full **read** access to the **input** _constructor_ and _values_. It's the **opposite idea**.

Whereas `Chain` lets us **inform the future** of the computation, `Extend` lets us **be informed by the past**. _This is the kind of sentence that ends up on a mug, you know!_

```haskell
-- chain: `map` with write-access to output
-- extend: `map` with read-access to input

map    :: f a -> (  a ->   b) -> f b
chain  :: m a -> (  a -> m b) -> m b
extend :: w a -> (w a ->   b) -> w b
```

---

There are lots of cool examples of `Extend`, but they are often overlooked and generally considered a more "advanced" topic. After all, with `Monad`, we're free to build **anything**; why bother continuing? Well, I hope this gives you an idea of how they work and where you can find them! After all, these are all just **design patterns**: just use them when they're **appropriate**!

_So, `Semigroup` is to `Monoid` as `Chain` is to `Monad` as `Extend` is to...?_ We'll find out next time! Before we go, though, here's a very tricky challenge to keep you busy:

> With `Writer`, we needed a `Semigroup` on the left to make a `Chain` instance, but we didn't for `Extend`. `Reader` has an `Extend` instance; can you think of how we might write that?

Until then, take a look through [this article's code](https://gist.github.com/i-am-tom/71e351dd3c389a052e99324f152571d3), and take care!

&hearts;

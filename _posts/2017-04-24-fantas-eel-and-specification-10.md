---
layout: post
title: "Fantas, Eel, and Specification 10: Alt, Plus, and Alternative"
description: It's time for something a little alternative...
---

We're in **double digits**! Isn't this exciting? It also means that, by my estimations, we're **well over half way**! Before we get _too_ excited by `Profunctor` and `Comonad`, though, might I tempt you with an... `Alternative`?

Today, we're going to bundle together **three** very well-related entries in the spec, starting with `Alt`. This little typeclass has one function:

```haskell
alt :: Alt f => f a ~> f a -> f a
```

As we know, with great algebraic structure, come great **laws**:

```javascript
// Associativity
a.alt(b).alt(c) === a.alt(b.alt(c))

// Distributivity
a.alt(b).map(f) === a.map(f).alt(b.map(f))
```

The **associativity** law is _exactly_ what we saw in [the `Semigroup` post](/2017/03/13/fantas-eel-and-specification-4/) with `concat`! As we said back then, think of it as, "_Keeping left-to-right order the same, you can combine the elements however you like_".

**Distributivity** gives us another clue that we might be looking at something a bit `Semigroup`-flavoured. We can **`map` first** over the elements and then `alt` **or** **`alt` first** and then `map` over the result, and we'll end up at the **same value**. Either way, some kind of "combination" definitely seems to be going on here.

So, **what is it**? Well... it's like a **semigroup for functors**. It's a way of combining values of a functor type _without_ the requirement that the inner type be a `Semigroup`. _Why_, you ask? Well, we get a little hint from the name.

`Alt` allows us to provide some _alternative_ value as a "fallback" when the first "fails". Of course, this is particularly relevant to types with some notion of **failure**:

```javascript
Maybe.prototype.alt = function (that) {
  this.cata({
    Just: _ => this,
    Nothing: _ => that
  })
}
```

If we have a `Just` on the left, we return it. Otherwise, we **fall back** to the second value! Naturally, you can chain as many of these as you like:

```javascript
// Just(3) - note the "Nothing"s are
// usually the result of some functions.
Nothing.alt(Nothing).alt(Just(3))
```

It turns out there are **loads** of use cases for `alt`, which isn't too surprising if you look at it as a **functor-level `if/else`**. You can do [database connection failover](https://gist.github.com/i-am-tom/9651cd1e95443c4cbf3953429e988b07), [API/resource routing](https://github.com/slamdata/purescript-routing/blame/master/GUIDE.md#L96-L102), and, most magically of all, [text parsing](https://github.com/purescript/purescript/blob/master/src/Language/PureScript/Parser/Declarations.hs#L161-L169). _Those last two were in PureScript and Haskell respectively, but don't worry: in these languages, `alt` has an operator, written as `<|>`._

The key thing all these cases have in common is that you want to _try_ something with a contingency plan for _failure_. That's all there is to `Alt`!

---

If `Alt` will be our functor-level `Semigroup`, what's our **functor-level `Monoid`**? In comes `Plus`, which extends `Alt` with one more function called `zero`:

```haskell
zero :: Plus f => () -> f a
```

Looks a bit like `Monoid`'s `empty`, right? Note that there's no restriction on the `a`, so this `zero` value must work for **any type**. This one has **three laws**, but the first two will look really familiar to readers of [the `Monoid` post](/2017/03/21/fantas-eel-and-specification-5/):

```javascript
// Right identity - zero on the right
x.alt(A.zero()) === x

// Guess what this one's called?
A.zero().alt(x) === x

// The new one: annihilation
A.zero().map(f) === A.zero()
```

The left and right **identity** laws just say, "_`zero` makes no difference to the other value, regardless of which side of `alt` you put it_". **Annihilation** gives us a stronger idea of what `zero` does: **nothing**! `Plus` types _must_ be functors; for a `map` call to do _nothing_ in all cases, the type must have the ability to be **empty**, whatever that means.

Think of our `Maybe` type: what can we `map` over with _any_ function and not change the value? `Nothing`! In fact, `() => Nothing` is the **only valid** implementation of `zero` for `Maybe`.

What about `Array`? Well, `map` transforms every value in the array, so the only array that _wouldn't_ be changed is the empty one. `() => []` is the **only valid** implementation of `zero` for `Array`.

> We didn't cover `Array` as an `Alt` because it's a bit of a funny one. Back when we discussed [functors](/2017/03/27/fantas-eel-and-specification-6/), we saw that `Array` _extends_ our language to allow us to represent **several values** at once. This can be thought of as **non-determinism** if we see an `Array` as the set of **possible values**. Thus, the `alt` implementation for `Array` is the same as `concat` - all we're doing is combining the two sets of possibilities!

So, `Plus` adds to `Alt` what `Monoid` adds to `Semigroup`, and, in fact, what `Applicative` adds to `Apply`: an **identity**. Are we bored of this pattern yet? I hope not, because we're _still_ not done with it! Incidentally, we can write custom `Semigroup` and `Monoid` types to encapsulate this behaviour so we can reuse the functions we talked about in their posts:

```javascript
// The value MUST be an Alt-implementer.
const Alt = daggy.tagged('Alt', ['value'])

// Alt is a valid semigroup!
Alt.prototype.concat = function (that) {
  return Alt(this.value.alt(that.value))
}

// The value MUST be a Plus-implementer.
// And, as usual, we need a TypeRep...
const Plus = T => {
  const Plus_ = daggy.tagged('Plus', ['value'])

  // Plus is a valid semigroup...
  Plus_.prototype.concat =
    function (that) {
      return Plus(
        this.value.alt(
          that.value))
    }

  // ... and a valid monoid!
  Plus_.empty = () => Plus_(T.zero())
}
```

Monoids are **everywhere**, I tell you. Stare at something long enough and it'll start to look like a monoid.

---

The final boss level on this `Alt` quest is `Alternative`. There are **no special functions** for this one, as it is simply the name for a structure that implements both `Plus` _and_ `Applicative`. Still, I know how much you _love_ laws:

```javascript
// Distributivity
x.ap(f.alt(g)) === x.ap(f).alt(x.ap(g))

// Annihilation
x.ap(A.zero()) === A.zero()
```

**Distributivity** is exactly as the same law that we saw with `Alt` and `map` at the beginning of all this, but now for `ap`. We can either **`alt` first** and _then_ `ap` the result to `x`, **or** we can **`ap` first** to both separately, and then `alt`. Either way, we end up in the same place.

**Annihilation** is a _really_ scary word for a not-so-scary idea, if you think back to the `zero` values we discussed earlier. You couldn't apply a value to `Nothing`, right? Or an empty list of functions? The **annihilation** law defines this behaviour: if you try to do **something with nothing**, you get **nothing**. Whatever you were doing is considered a _failure_, and `zero` is returned.

You'll often hear `Alternative` types described as **monoid-shaped applicatives**, and this is a good intuition. We talked about `of` as being the **identity** of `Applicative`, but this is only at **context-level**. For an `Alternative` type, `zero` is the identity value at context- **and** value-level.

---

`Maybe`, `Array`, `Task`, `Either`: we've seen a lot of types that can very naturally implement `Alternative`. You could even make `Function` an `Alternative` if you knew the output would be of a `Plus`-implementing type. With that, you could then write a function whose body can do **extra computation** depending on the result; who needs `if/else`?

That's about all there is to it! `Alt`, `Plus`, and `Alternative` are **under-appreciated** typeclasses, particularly within functional JavaScript. Take some time to look through your code, glare at the `if/else`, `try/catch`, and `switch` blocks, and see whether they're really just `alt`s in disguise!

Next time, we'll be looking into your **new favourite** typeclasses: `Foldable` and `Traversable`. Try to contain your excitement until then!

Take care &hearts;

---
layout: article
title: "Fantas, Eel, and Specification 14: ChainRec"
description: I got 99 proble-STACK OVERFLOW
redirect_from: /2017/05/30/fantas-eel-and-specification-14/
tags: untranslated
---

**Happy Tuesday**, Fantasists! Sorry for the wait; I've been chasing around [an issue to change this entry](https://github.com/fantasyland/fantasy-land/issues/250)! No movement on that yet, so let's **soldier on**! We've seen that `chain` allows us to **sequence** our actions, which means we can now do pretty much **anything we want**! As fellow JavaScripters, this is of course the time we get cynical; it can't be _that_ simple, right? **Absolutely not**, and let's take a look at a **convoluted example** to show us why!

Have a gander at this little number, which emulates the behaviour of the UNIX `seq` command, with the help of [our old friend `Pair`](/2017/04/27/pairs-as-functors/):

```javascript
// Click the above link for a full
// explanation of this type!
const Writer = Pair(Array)

//+ seq :: Int -> Writer [Int] Int
const seq = upper => {

  //+ seq_ :: Int -> Writer [Int] Int
  const seq_ = init =>
    init >= upper

    // If we're done, stop here!
    ? Writer([init], upper)

    // If we're not...
    : Writer([init], init + 1)
      .chain(seq_) // ...chain(seq_)!

  // Kick everything off
  return seq_(1)
}

seq(5)._1 // [1, 2, 3, 4, 5]
```

Everything looks **fine** so far: `seq_` is just a **recursive** function. Until `init` exceeds `upper`, we **log** the current value and call `seq_` on the **next** integer. Pick any number and see that it works: `10`, `100`, `1000`, ... **oh**.

```
> seq(10000)._1
RangeError: Maximum call stack size exceeded
```

Now, we're supposedly using **computers**. They take people to the **moon**, control **nuclear reactors**, and get us **pictures of cats**; _surely_ it's not too big an ask to count to `10000` without exploding?

Our problem here is that, every time we `chain(seq_)`, we store the _calling_ function's local state on the **stack** until the _called_ function returns; as you can imagine, it's actually pretty expensive to save **ten thousand** of these states. When we fill up the stack and try to carry on, we cause a **stack overflow** error. _If only there were some website to help us..._

_Typically_, in our non-functional JavaScript, we get round this problem with a **loop**. It's no secret that we could write `seq` as:

```javascript
const seq = upper => {
  const acc = []

  for (let i = 1; i <= upper; i++)
    acc.push(i)

  return acc
}

seq(10000) // Bam, no trouble
```

See? **No stack overflow**; we use `acc` to store our state at each point **explicitly**, without recursion, and everything just works... so, have we been **defeated**? Do we _really_ have to choose between **prettiness** - purity, composition, etc. - and **performance**?

---

**Never**! We're **functional programmers**; we solve these problems with **abstraction**, and `ChainRec` turns out to be _exactly_ what we need. We're going to start off with a slightly different definition of this spec's function, and work towards the real one. First of all, we'll introduce a **new type**, `Step`:

```javascript
// type Step b a = Done b | Loop a
const { Loop, Done } = daggy.taggedSum({
  Done: ['b'], Loop: ['a']
})
```

We're using these two constructors to mimic the two possible states of our imperative solution: are we `Done`, or do we still need to `Loop`?

> We _could_ make this a `Functor` over `a`, but we don't need to; still, it's an **exercise** if you're looking!

With that in mind, let's define `chainRec`. Remember here that all `ChainRec` types are also `Chain` types:

```haskell
chainRec :: ChainRec m
         => (a -> m (Step b a), a)
         -> m b
```

Well, well, well. We start off with a function of type `a -> m (Step b a)`, and a value of type `a`. We end up with `m b`. I reckon the first step is probably to _call_ that function, and end up with `m (Step b a)`. When we've done that, we'll be in one of two situations:

- That `Step b a` will be a `Done b`, and we can pull out the `b` (by mapping over the `m`) and return the answer!

- That `Step b a` will be a `Loop a`, and we still don't have a `b` to make the answer. What do we do then? We **loop again**!

We `chain` our starter function to our `m a`, and repeat this whole process until we finally get a `Done` value, and we can **finish up**!

This might be a little **heavy**, so let's implement `chainRec` for our `Writer` type to clear it up:

```javascript
// We need a TypeRep for the left bit!
const Pair = T => {
  const Pair_ = daggy.tagged('_1', '_2')

  // ...

  //+ chainRec
  //+   :: Monoid m
  //+   => (a -> Pair m (Step b a), a)
  //+   -> (m, b)
  Pair_.chainRec = function (f, init) {
    // Start off "empty"
    let acc = T.empty()

    // We have to loop at least once
      , step = Loop(init)

    do {
      // Call `f` on `Loop`'s value
      const result = f(step.a)

      // Update the accumulator,
      // as well as the current value
      acc  = acc.concat(result._1)
      step = result._2
    } while (step instanceof Loop)

    // Pull out the `Done` value.
    return Pair_(acc, step.b)
  }
}
```

We store our `acc`, starting with the "empty" value for that `Monoid`, and update it with every loop. This continues until we hit a `Done`, when we make a pair with the final `acc` and the value inside the `Done`!

It might take a couple read-throughs, but see what's happened: instead of doing **recursion**, we've used `Step` to let a function _tell us_ when it _wants_ to recurse. With that extra bit of **abstraction**, we can hide a `while` loop under the hood, and no one will be any the wiser!

So, with all this talk of **accumulated results**, let's get back to that `seq` example, and see what we can do:

```javascript
//+ seqRec :: Int -> ([Int], Int)
const seqRec = upper => Writer.chainRec(
  init => Writer([init],
    init >= upper ? Done(init)
                  : Loop(init + 1)),
  0)
```

Look at the **body**: there's no recursion! We've abstracted all the recursion into `chainRec`, which can do its **sneaky optimisation**. All _we_ say in our `chainRec`-using function is whether we're `Done` or still need to `Loop` - isn't that **clearer**? What's more, it's now totally **stack-safe**!

```
> seqRec(100000)._1
[1, 2, 3, 4, 5, ...]
```

Just a tiny little extra abstraction and we **scoff** at numbers like `10000`. Why stop the momentum? Next stop: **cat pictures on the moon**.

---

Now, we haven't quite matched the spec, but you'll see why. The actual spec gives us no `Step` type, which means we end up with the following:

```haskell
chainRec :: ChainRec m
         => ((a -> c, b -> c, a) -> m c, a)
         -> m b
```

Now, I have a few problems with this definition, most of which are outlined in [the aforementioned GitHub issue](https://github.com/fantasyland/fantasy-land/issues/250), so we won't go into them too much. What we'll do _instead_ is define a function to turn our `Step`-based functions into **spec-compliant** functions. It's a little number I like to call `trainwreck`:

```javascript
//+ trainwreck
//+  :: Functor m
//+  => (a -> m (Step b a))
//+  -> ((a -> c, b -> c, a) -> m c)
const trainwreck = f =>
  (next, done, init) => f(init).map(
    step => step.cata({
      Loop: next, Done: done
    })
  )

// Or, with ES6 and polymorphic names...
const trainwreck = f => (Loop, Done, x) =>
  f(x).map(s => s.cata({ Loop, Done }))
```

With this cheeky thing, we can get the best of both worlds; we just wrap our definition of `Pair_.prototype.chainRec` in the `trainwreck` function and it's good to go! Whether you choose to implement `chainRec` on your types with the `trainwreck-Step` approach or with the spec's approach is up to you, but I think it's pretty clear that I have a **favourite**!

> Interestingly, the _spec's_ (more formal) encoding is based on the [Boehm-Berarducci](http://okmij.org/ftp/tagless-final/course/Boehm-Berarducci.html) encoding of the `Step` type; hat-tip to [Brian McKenna](https://twitter.com/puffnfresh) for this one, as I'd **never** heard of this!

---

Last and certainly not least: the **laws**. Wait, you didn't think I'd forgotten, did you? **Ha**! We'll define these with `Step` to make them a bit more **expressive**, but [the original definitions](https://github.com/fantasyland/fantasy-land#chainrec) are of course available on the spec.

```javascript
// For some ChainRec m, predicate p,
// and some M-returning d and n...
M.chainRec(
  trainwreck(
    v => p(v) ? d(v).map(Done)
              : n(v).map(Next)),
  i)

// Must behave the same as...

(function step(v) {
  return p(v) ? d(v)
              : n(v).chain(step)
}(i))
```

By now, we've seen the _actual_ difference: the second one will explode before we get anywhere _close_ to the moon. However, in _theory_ (assuming we had an **infinite stack**), these two expressions would always end up at the same point. Again, we're just asserting that `Done` and `Next` provide an **abstraction** for our recursion.

The other law, which is one of my _favourites_, is that `chainRec(f)` must produce a stack no larger than `n` times `f`'s stack usage, for some **constant** `n`. In other words, whether I'm looping once or a million times, the stack **must not keep growing**. With this wordy little law, we **ensure** stack safety.

The `ChainRec` spec is best-suited towards ideas like [Free structures](https://github.com/safareli/free) and [asynchronous looping](https://github.com/fluture-js/fluture): when we could end up with a _very_ complicated structure, `chainRec` makes sure we don't hit an unexpected ceiling.

In your day-to-day coding, it's probably not something you'll see an awful lot. In fact, it usually tends to be hidden in implementation detail, rather than being exposed to the user. Stick to the simple, **golden rule**: when `Chain` blows your stack, `ChainRec` is there to solve the problem. Every `Chain` type can implement `ChainRec`, so this will _always_ be an available option!

Whether we use it regularly or not, we now have a practical, stack-safe, and **functional** answer to the danger of `chain`ing huge computations. We can **sequence** instructions safely, build up large computations, and then **let 'em rip**.

Next time, we'll look at the **last piece of the puzzle**, and charge through some examples. Brace yourself for the _terrifying_, _incomprehensible_, and _downright impolite_ `Monad`! Trust me: it's actually **none** of those things. In fact, it's nothing new at all - **rest easy**, Fantasists!

&hearts;

As usual, feel free to play with [the post's code gist](https://gist.github.com/richdouglasevans/4c0a197c3d8312961a1c7fba557f4425) to experiment further!

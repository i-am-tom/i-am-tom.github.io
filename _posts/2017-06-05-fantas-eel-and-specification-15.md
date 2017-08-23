---
layout: post
title: "Fantas, Eel, and Specification 15: Monad"
description: DESCRIBING THE INDESCRIBABLE
---

**Today is the day**, Fantasists. We all knew it was coming, but we _hoped_ it wouldn't be so soon. Sure enough, though, **here we are**. We've battled through **weeks** of structures, and reached the dreaded `Monad`. Say your goodbyes to your loved ones, and **let's go**.

_Ahem._

**A `Monad` is a type that is both a `Chain` and an `Applicative`**. That's... well, it, really. We're done here. Next time, we'll be looking at the **new-wave wizardry** of `Extend`. Until then, take care!

&hearts;

---

... Right, so maybe we could say a _little_ more, but only if we _want_ to! Honestly, though, the above is enough to get going. We've seen a few examples of `Semigroup`-and-`Monoid`-feeling relationships, but let's focus on two in particular:

In [the `Apply` post](/2017/04/10/fantas-eel-and-specification-8/), we said that `ap` felt a bit `Semigroup`-ish. Then, in [the `Applicative` post](/2017/04/17/fantas-eel-and-specification-9/), we saw that adding `of` gave us something `Monoid`-ish.

Later, [we looked at `Chain`](/2017/05/15/fantas-eel-and-specification-13/), where `chain` gave us something like a `Semigroup`. _So_, you're asking, _where's the `Monoid`?_ Well, with a `Monad`, `of` doubles up as the `empty` to **`Chain`**'s `Semigroup`, too!

We're going to go through a pretty **mathematical** definition of `Monad` first, so don't be discouraged if it doesn't make sense on the **first few reads**. This is really just _background knowledge_ for the curious; **skip ahead** if you just want to see a **practical** example!

---

> To skip ahead, **start scrolling**!

Let's do some **mind-blowing**; it's the `Monad` post after all, right? Let's first define two composition functions, `compose` and `mcompose`:

```javascript
//- Regular `compose` - old news!
//+ compose ::      (b -> c)
//+         -> (a -> b)
//+         ->  a   ->    c
const compose = f => g => x =>
  f(g(x))

//- `chain`-sequencing `compose`, fancily
//- known as Kleisli composition - it's the
//- K in Ramda's "composeK"!
//+ mcompose :: Chain m
//+          =>        (b -> m c)
//+          -> (a -> m b)
//+          ->  a     ->    m c
const mcompose = f => g => x =>
  g(x).chain(f)
```

_I've tried to line up the types so it's a bit clearer to see **left-to-right** how this works... I hope that it helped in some way!_

`compose` says, "_Do `g`, then `f`_". `mcompose` says **the same thing**, but does it with some kind of **context** (_[little language extension bubble](/2017/03/27/fantas-eel-and-specification-6/), remember?_). That `m` could be `Maybe` in the case of two functions that may fail, or `Array` in the case of two functions that return multiple values, and so on. What's important is that, to _use_ `mcompose`, our `m` **must** be a `Chain` type.

Now, you can make something very monoid-looking with regular `compose`:

```javascript
const Compose = daggy.tagged('Compose', ['f'])

//- Remember, for semigroups:
//- concat :: Semigroup s => s -> s -> s
//- Replace s with (a -> a)...
//+ concat ::      (a -> a)
//+        -> (a -> a)
//+        ->  a   ->    a
Compose.prototype.concat =
  function (that) {
    return Compose(
      x => this(that(x))
    )
  }

//- We need something that has no effect...
//- The `id` function!
//+ empty :: (a -> a)
Compose.empty = () => Compose(x => x)
```

Mind blown yet? **Function composition is a monoid**! The `x => x` function is our `empty` (because it doesn't do anything), and composition is `concat` (because it combines two functions into a pipeline). See? **Everything is just monoids**. Monoids _all_ the way down.

> Typically, the `Compose` type is used for other things (remember [the `Traversable` post](/2017/05/08/fantas-eel-and-specification-12/)?), but we're using it here as just a nice, _clear_ name for this example.

Now, here's the **real wizardry**: can we do the same thing with `mcompose`? Well, we could certainly write a `Semigroup`:

```javascript
const MCompose = daggy.tagged('MCompose', ['f'])

//- Just as we did with Compose...
//+ concat :: Chain m
//+        =>        (a -> m a)
//+        -> (a -> m a)
//+        ->  a     ->    m a
MCompose.prototype.concat =
  function (that) {
    return MCompose(
      x => that(x).chain(this)
    )
  }
```

`concat` now just does `mcompose` instead of `compose`, as we expected. If we want an `empty`, though, it would need to be an `a -> m a` function. Well, **reader mine**, it just so happens that we've already seen that very function: from `Applicative`, the `of` function!

```javascript
//- So, we need empty :: (a -> m a)
//+ empty :: Chain m, Applicative m
//+       => (a -> m a)
MCompose.empty = () =>
  MCompose(x => M.of(x))

// Or just `MCompose(M.of)`!
```

> Note that, as with lots of interesting `Monoid` types, we'd need a `TypeRep` to build `MCompose` to know which `M` type we're using. This is written out in THE CODE GIST FIXME

To make `MCompose` a full `Monoid`, we need our `M` type to have an `of` method _and_ be `Chain`able. `Chain` for the `Semigroup`, plus `Applicative` for the `Monoid`.

Take a breath, Fantasists: I'm aware that I _might_ be alone here, but I think this is **beautiful**. No matter how clever we _think_ we're being, it's all really just `Semigroup`s and `Monoid`s at the end of the day. Under the surface, it **never** gets more **complex** than that.

Let's not get _too_ excited just yet, though; remember that there are **laws** with `empty`. Think back to [the `Monoid` post](/2017/03/21/fantas-eel-and-specification-5/): it has to satisfy **left and right identity**.

```javascript
// For any monoid x...
x
  // Right identity
  === x.concat(M.empty())

  // Left identity
  === M.empty().concat(x)


// So, for `MCompose` and some `f`...
MCompose(f)

  // Right identity
  === MCompose(f).concat(MCompose.empty())

  // Left identity
  === MCompose.empty().concat(MCompose(f))

//- In other words, `of` can't disrupt the
//- sequence held inside `mcompose`! For
//- the sake of clarity, this just means:

f.chain(M.of).chain(g) === f.chain(g)
f.chain(g).chain(M.of) === f.chain(g)
```

And there we have it: `of` **cannot disrupt the sequence**. All it can do is put a value into an **empty** context, placing it somewhere in our sequence. No **tricks**, no **magic**, no **side-effects**.

So, for your most **strict** and **correct** definition, `M` is a `Monad` if you can substitute it into our `MCompose` without breaking the `Monoid` laws. **That's it**!

---

> For those skipping ahead, **stop scrolling**!

Ok, big deal, `Monad` is to `Chain` as `Monoid` is to `Semigroup`; why is everyone getting so _excited_ about this, though? Well, remember how we said we could use `Chain` to define **execution order**?

```javascript
//+ getUserByName :: String -> Promise User
const getUserByName = name =>
  new Promise(res => /* Some AJAX */)

//+ getFriends :: User -> Promise [User]
const getFriends = user =>
  new Promise(res => /* Some more AJAX */)

// e.g. returns [every, person, ever]
getUser('Baymax').chain(getFriends)
```

With this, we can define [**entire programs** using `map` and `chain`](https://twitter.com/am_i_tom/status/850082511900332033)! We can do this because we can **sequence** our actions. What we get with `of` is the ability to _lift_ variables into that context whenever we like!

```javascript
const optimisedGetFriends = user
  user.name == "Howard Moon"
  ? Promise.of([]) // Lift into Promise
  : getFriends(user) // Promise-returner
```

We know that `getFriends` returns a `Promise`, so our speedy result needs to do the same. Luckily, we can just _lift_ our speedy result into a **pure** `Promise`, and we're **good to go**!

Although it may _seem_ improbable, we actually now have the capability to write **any** `IO` logic we might want to write:

```javascript
const Promise = require('fantasy-promises')

const rl =
  require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })

//+ prompt :: Promise String
const prompt = new Promise(
  res => question('>', res))

//- We use "Unit" to mean "undefined".
//+ speak :: String -> Promise Unit
const speak = string => new Promise(
  res => res(console.log(string)))

//- Our entire asynchronous app!
//+ MyApp :: Promise String
const MyApp =
  // Get the name...
  speak('What is your name?')
  .chain(_ => prompt)
  .chain(name =>

    // Get the age...
    speak('And what is your age?')
    .chain(_ => prompt)
    .chain(age =>

      // Do the logic...
      age > 30

      ? speak('Seriously, ' + name + '?!')
        .chain(_ => speak(
          'You don\'t look a day over '
            + (age - 10) + '!'))

      : speak('Hmm, I can believe that!'))

    // Return the name!
    .chain(_ => Promise.of(name)))

//- Our one little impurity:

// We run our program with a final
// handler for when we're all done!
MyApp.fork(name => {
  // Do some database stuff...
  // Do some beeping and booping...

  console.log('FLATTERED ' + name)
  rl.close() // Or whatever
})
```

That, _beautiful_ Fantasists, is (basically) an **entirely purely-functional** app. Let's talk about a few cool things here.

Firstly, **every step** is `chain`ed together, so we're **explicitly** giving the **order** in which stuff should happen.

Secondly, we can **nest** `chain` to get access to **previous values** in **later actions**.

Thirdly, `chain` means we can do **everything with arrow functions**. Every command is a _single-expression_ function; it's **super neat**! Try re-formatting this example on a bigger screen; all my examples are written for _mobile_, but this example can look far more readable with 80-character width!

Fourthly, following on from the _first_ point, there's **no mention** of **async** with `chain` - we specify the **order**, and `Promise.chain` does the promise-wiring **for us**! At this point, async behaviour is literally **just** an **implementation detail**.

Fifthly (_are these still words?_), `MyApp` - our whole program - **is a value**! It has a type `Promise String`, and we can use that `String`! What does _that_ mean? **We can chain programs together**!

```javascript
//+ BigApp :: Promise Unit
const BigApp =
  speak('PLAYER ONE')
  .chain(_ => MyApp)
  .chain(player1 =>

    speak('PLAYER TWO')
    .chain(_ => MyApp)
    .chain(player2 =>

      speak(player1 + ' vs ' + player2)))
```

**OMGWTF**! We took our **entire** program and used it as a **value**... **twice**! As a consequence, we can just write lots of little programs and **chain** (_compose, concat, bind, whatever you want to say_) them together into **bigger ones**! Remember, too, that `Monad`s are all also `Applicatives`...

```javascript
//+ BigApp_ :: Promise Unit
const BigApp_ =
  lift2(x => y => x + ' vs ' + y,
    speak('PLAYER ONE').chain(_ => MyApp),
    speak('PLAYER TWO').chain(_ => MyApp))
```

**Oh yeah**! Our programs are now **totally composable** `Applicative`s, just like any other value. Our **entire programs**! All a functional program _really_ does is collect some _little_ programs together with `ap` and `chain`. It really is **that neat**!

> Why do we use `fantasy-promises` instead of the built-in `Promise`? Our **functional** `Promise` doesn't execute until we call `fork` - that means we can **delay** the call until we've **defined** its behaviour. With a built-in `Promise`, things start happening immediately, which can lead to **non-determinism** and **race conditions**. This way, we maintain **full control**!

Of course, maybe the syntax is a bit _ugly_, but that's what **helper functions** are for! Also, why stop at `Promise`? This fanciness works for `Maybe`, `Array`, `Either`, `Function`, `Pair`, and **so many more**!

Keep fiddling, using those `Task`/`Promise` isomorphisms to do things  in parallel, using `Maybe` to avoid `undefined` / `null` along the way, using `Array` to return multiple choices; if you can handle all that, you're a **fully-fledged** functional aficionado!

---

You might be wondering what the _rest_ is for if we now have all the tools we'll ever need, and that's certainly a good question. The rest are **optional**; monadic functional programming doesn't **require** an understanding of `Comonad` or `Profunctor`, but nor does it require an understanding of `Alt` or `Traversable`; these are just **design patterns** to help our code to be as  **polymorphic** as possible.

As always, there's [a **Gist** for the article](https://gist.github.com/richdouglasevans/ea96fb5fc8bb55d832a8a20f8c14d4ed), so have a **play** with it! Here's a little idea for an exercise: write a **monadic** functional CLI app to play "higher or lower". You know everything you need to know; **trust me**!

&hearts;

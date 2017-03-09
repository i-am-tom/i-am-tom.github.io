---
layout: post
title: Curry On Wayward Son
description: A practical introduction to curried functions in JavaScript.
---

Currying is **so hot** right now in the functional-ish JavaScript community. If you've used libraries like [Ramda](http://ramdajs.com/), chances are you've had some exposure. Either way, let's spell it out to be safe:

Functions in languages like [Haskell](https://www.haskell.org/) or [Elm](http://elm-lang.org/) **take one input and return one output**, whether you like it or not. If we want two arguments, we write a function that _returns_ a function (because functions are also values!) and nest them:

```javascript
const add = x => y => x + y // a la ES6
```

So, to add `2` and `3`, we write `add(2)(3)`. _Currying_ a function means converting it from the usual style (`(x, y) => x + y`) to this style. With that said, we'll see later that most of our favourite implementations of `curry` functions are more like `curryish`...

## Is there a point to this?

Yes! Obviously, writing `add(2)(3)` is ugly - and we'll fix that later - but the power of this comes from the instances where you _don't_ supply all the arguments up front.

Think about it: `add(2)` returns a function that takes a value and adds `2` to it. Why do we have to give it that second number immediately? We could do all sorts of things:

```javascript
// 1, 2, 3, 4, 5 - Oooooo
[-1, 0, 1, 2, 3].map(add(2))
```

When we play with functions that don't have all their arguments yet, we call it **partial application**. In practice, what we're doing is taking a very general function (`add`) and _specialising_ it with some of its arguments.

Here's a slightly more useful (although still majorly contrived) example of how we can wrap `String.replace` to be more flexible:

```javascript
const replace = from => to => str =>
        str.replace(from, to)

const withName  = replace(/\{NAME\}/)
const withTom   = withName('Tom')
const withTrump = withName('tiny hands')

const stripVowels = replace(/[aeiou]/g)('')

withTom('Hello, {NAME}!') // Hello, Tom!
withTrump('Hello, {NAME}!') // Hello, tiny hands!

stripVowels('hello') // hll

// ['hll', 'wmbldn']
['hello', 'wimbledon'].map(stripVowels)
```

I don't know about you, but I think this is _really_ exciting: we've taken a single function and used partial application to specialise it in several exciting ways. Instead of writing a whole new replace for each function, we just partially apply some number of its arguments! **So** hot right now.

This is the inherent power of partial application: we can write very general functions, and specialise them for different purposes. This massively reduces boilerplate code, and looks super pretty.

## But it's _hideous_

Yeah, it's kinda ugly when you see a call like `replace(/a/)('e')(str)` (all those brackets touching!) rather than `replace(/a/, 'e', str)`, _but_ we don't want to be forced to supply all the arguments at once.

What we'd _really_ like is to be able to write these arguments in any flexible grouping we need:

```javascript
replace(/a/)('e')(str)
  == replace(/a/, 'e')(str)
  == replace(/a/)('e', str)
  == replace(/a/, 'e', str)
```

So, notice we haven't **uncurried** the function - we're just saying that, if we pass in more than one argument, we'd like them to be applied one at a time. To be technical, we've **sort of uncurried it a little bit**. This means we can hence write an appropriately-named function:

```javascript
const uncurryish = f => {
  if (typeof f !== 'function')
    return f // Needn't curry!

  return (... xs) => uncurryish(
    xs.reduce((f, x) => f (x), f)
  )
}
```

Maybe a bit ugly, but the gist of it is:

- Any non-function gets returned unharmed.
- Functions get wrapped in a function that takes one or more arguments, applies them one by one, then returns `uncurryish` of the result.

It's that pesky **recursion** again! If you define the `replace` and `uncurryish` functions as above, you'll see it all working. Yay!

## Wait, `uncurry`? I wanted `curry`!

Well, no, this isn't `uncurry` - it just looks a bit like it - but I see your point. When you use something like [Ramda's `curry`](http://ramdajs.com/docs/#curry), they mean `curryish`. The only real difference between `curryish` and `uncurryish` is that `curryish` starts from a "normal" function (e.g. `(x, y) => x + y`), and `uncurryish` starts from a function in this article's style. The end result is the same, although `uncurryish` has a [**much** simpler implementation](https://github.com/ramda/ramda/blob/v0.22.1/src/internal/_curryN.js)*... Whether you use one or the other is totally up to you!

---

Anyway, I hope this has shed some light. I thought it might be easier to start with `uncurry` and then bastardise it until it matched the `curry` we're used to. All you need to know is that `curry` and `uncurryish` achieve the same result: they collect up a function's arguments until they have enough to run the function, and then they return the function's results.

It's a really nifty little trick, and you can do some **incredible** refactoring with it. Of course, if anything doesn't make sense, drop me a [tweet](https://twitter.com/am_i_tom) or something, and I'll try to clear it up!

Thanks so much for reading!

Take care &hearts;

_* Not entirely fair - Ramda does some other stuff like placeholders - but it's definitely more complex because of having to track the argument "state" explicitly._

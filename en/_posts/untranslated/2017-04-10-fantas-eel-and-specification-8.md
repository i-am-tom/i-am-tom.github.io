---
layout: article
title: "Fantas, Eel, and Specification 8: Apply"
description: Moving onto the Apply declaration of the Fantasy Land specification.
redirect_from: /2017/04/10/fantas-eel-and-specification-8/
tags: untranslated
---

Aaand we're back - hello, everyone! Today, we're going to take another look at those mystical [`Functor` types](/2017/03/27/fantas-eel-and-specification-6/). We said a couple weeks ago that functors encapsulate a little world (**context**) with some sort of _language extension_. Well, what happens **when worlds collide**? Let's talk about `Apply`.

All `Apply` types are `Functor` types by requirement, so we know they're definitely "containers" for other types. The exciting new feature here is this `ap` function:

```haskell
ap :: Apply f => f a ~> f (a -> b) -> f b
--                 a ->   (a -> b) ->   b
```

If we ignore the `f`s, we get the second line, which is our basic **function application**: we _apply_ a value of type `a` to a function of type `a -> b`, and we get a  value of type `b`. _Woo!_ What's the difference with `ap`? All those bits are wrapped in the **context** of our `f` functor!

That's the, uh, "grand reveal". _Ta-da_. I'm not really sure that, in _isolation_, this particularly helps our **intuition**, though, so let's _instead_ look at `ap` within the `lift2` function:

```javascript
// Remember: `f` MUST be curried!
// lift2 :: Applicative f
//       =>  (a ->   b ->   c)
//       -> f a -> f b -> f c
const lift2 = f => a => b =>
  b.ap(a.map(f))
```

For _me_, this is **much** clearer. `lift2` lets us **combine** two **separate** wrapped values into one with a given function.

> `lift1`, if you think about it, is just `a.map(f)`. The `lift2` pattern actually works for any number of arguments; once you finish the article, why not try to write `lift3`? Or `lift4`?

_Wait, **combine**? Do I sense a_ [`Semigroup`](/2017/03/13/fantas-eel-and-specification-4/)?

Sort of! You can think of it this way: a `Semigroup` type allows us to merge **values**. An `Apply` type allows us to merge **contexts**. _Neat_, huh? Now, how could we forget the **laws**?!

```javascript
// compose :: (b -> c) -> (a -> b) -> a -> c
const compose = f => g => x => f(g(x))

// COMPOSITION LAW
x.ap(g.ap(f.map(compose))) === x.ap(g).ap(f)

// But, if we write lift3...
const lift3 =
  f => a => b => c =>
    c.ap(b.ap(a.map(f)))

// Now our law looks like this!
lift3(compose)(f)(g)(x) === x.ap(g).ap(f)

// Remember: x.map(compose(f)(g))
//       === x.map(g).map(f)
```

By introducing some little helper functions, our law seems much clearer, and a little more familiar. It says that, just as `map` could **only** apply a function to the wrapped value, `ap` can **only** apply a wrapped function to the wrapped value. **No magic tricks!**

Before we go any further, I challenge you take a moment to _try_ to build `lift2` without `ap`. Just think about _why_ we couldn't do this with a plain old `Functor`. If we tried to write `lift2`, we might end up here:

```javascript
// lift2F :: Functor f
//        => (  a ->   b ->      c)
//        ->  f a -> f b -> f (f c)
const lift2F = f => as => bs =>
  as.map(a => bs.map(b => f(a)(b)))
```

So, we can apply the inner values to our function - _hooray!_ - but look at the **type** here. We're doing a `map` inside a `map`, so we've ended up with **two levels** of our functor type! It's clear that we can't write a **generic** `lift2` to work with _any_ `Functor`, and `ap` is what's missing.

---

With all that out the way, let's look at some examples, shall we? We'll start with the [`Identity` type's `ap`](https://github.com/fantasyland/fantasy-land/blob/master/internal/id.js#L42-L44) from our beloved spec:

```javascript
const Identity = daggy.tagged('Identity', ['x'])

// map :: Identity a ~> (a -> b)
//                   -> Identity b
Identity.prototype.map = function (f) {
  return new Identity(f(this.x))
}

// ap :: Identity a ~> Identity (a -> b)
//                  -> Identity b
Identity.prototype.ap = function (b) {
  return new Identity(b.x(this.x))
}

// Identity(5)
lift2(x => y => x + y)
     (Identity(2))
     (Identity(3))
```

No frills, no magic. `Identity.ap` takes the function from `b`, the value from `this`, and returns the **wrapped-up** result. _Did you spot the similarity in **type** between `map` and `ap`, by the way_? Moving on, here's the slightly more complex implementation for `Array`:

```javascript
// Our implementation of ap.
// ap :: Array a ~> Array (a -> b) -> Array b
Array.prototype.ap = function (fs) {
  return [].concat(... fs.map(
    f => this.map(f)
  ))
}

// 3 x 0 elements
// []
[2, 3, 4].ap([])

// 3 x 1 elements
// [ '2!', '3!', '4!' ]
[2, 3, 4]
.ap([x => x + '!'])

// 3 x 2 elements
// [ '2!', '3!', '4!'
// , '2?', '3?', '4?' ]
[2, 3, 4]
.ap([ x => x + '!'
    , x => x + '?' ])
```

I've put a little note with the answers so we can see what's happening: we get **every** `a` and `b` pair. This is called the **cartesian product** of the two arrays. On top of that, when we `lift2` an `f` over two `Array` types, we're actually doing something _quite familiar_...

```javascript
return lift2(x => y => x + y)(array1)(array2)

// ... is the same as...

const result = []

for (x in array1)
  for (y in array2)
    result.push(x + y)

return result
```

We get a really pretty shorthand for **multi-dimensional loops**. Flattening a **loop within a loop** gives us every possible pair of elements, and that's what `ap` is for! If this feels weird, just **think of the types**. We have to use `Array (a -> b)` and `Array a` to get to `Array b` without violating the **composition** law; there aren't many possibilities!

---

There are loads of types with `ap` instances. Most, we'll see, implement `ap` in terms of `chain`; we'll look at the `Chain` spec in a week or two, so don't worry too much. Most of them are fairly intuitive anyway:

- `Maybe` combines **possible failures**. If either of the two `Maybe` values are `Nothing`, the result is `Nothing`.

```javascript
Just(2).ap(Just(x => -x)) // Just(-2)
Nothing.ap(Just(x => -x)) // Nothing
Just(2).ap(Nothing)       // Nothing
Nothing.ap(Nothing)       // Nothing
```

- `Either` combines **possible failures with exceptions**. If either of the two are `Left`, the result is the first `Left`.

```javascript
Right(2)    .ap(Right(x => -x)) // Right(-2)
Left('halp').ap(Right(x => -x)) // Left('halp')
Right(2)    .ap(Left('eek'))    // Left('eek')
Left('halp').ap(Left('eek'))    // Left('eek')
```


At some point, I'd like to write a follow up to [the `Functor` post](/2016/12/31/yippee-ki-yay-other-functors/) to give some more _practical_ examples, but, for now, this is hopefully understandable (_please [tweet me](http://twitter.com/am_i_tom) if I'm wrong!_). Whatever your `Functor` trickery, **`ap` is `map` with a wrapped function**. Before we go, though, I'd like to talk about _one last trick_ up `Apply`'s sleeve...

A type we _haven't_ talked about before is `Task`. This is similar to `Either` - it represents either an error **or** a value - but the difference is that `Task`'s value is the result of a possibly-**asynchronous** computation. They look a _lot_ like `Promise` types:

```javascript
const Task = require('data.task')

// Convert a fetch promise to a Task.
const getJSON = url => new Task((rej, res) =>
  fetch(url).then(res).catch(rej))
```

We can see that it holds a **function** that will eventually call a resolver. `Task`, just like `Promise`, sorts out all the async wiring for us. However, an interesting feature of `Task` is that it implements `Apply`. Let's take a look:

```javascript
const renderPage = users => posts =>
  /* Write some HTML with this data... */

// A Promise of a web page.
// page :: Task e HTML
const page =
  lift2(renderPage)
       (getJSON('/users'))
       (getJSON('/posts'))
```

Just as we'd expect: we get the two results, and **combine** them into one using `renderPage` as the "glue". _However_, we can see that `lift2`'s second and third arguments have **no dependencies** on one another. Because of this, the arguments to `lift2` can always be calculated **in parallel**. Do you hear _that_? These AJAX requests are **automatically parallelised**! Ooer!

You can see [`Task.ap`'s implementation](https://github.com/folktale/data.task/blob/master/lib/task.js#L131-L183) for an exact explanation, but isn't this _great_? We can **abstract** parallelism and never have to worry about it! When we have two parallel `Task`s and finally want to glue them back together, we just use `lift2`! Parallelism becomes an **implementation detail**. _Out of sight, out of mind_!

---

I think `Task` gives a really **strong** case for `Apply` and why it's immediately useful. When we look at `Traversable` in a few weeks, we'll come back to `ap` and see just how _powerful_ it is. Until then, don't overthink `ap` - it's just a mechanism for **combining contexts** (worlds!) together without unwrapping them.

I had originally intended to mention `of` in this post and cover the full `Applicative`. However, it's already quite a long post, so I'll write up that post some time this week! I might even throw in some bigger _practical_ examples for good measure.

If you're still with me, **hooray**! I hope that wasn't _too_ full-on. We're definitely wading in **deeper waters** now, getting to the more advanced parts of the spec. All the more reason to keep [asking questions](http://twitter.com/am_i_tom), though! I want to make this as clear as possible, so don't hesitate to get in touch.

For now until we talk about `Applicative`, though, it's goodbye from me! Keep at it, `Apply` yourself (_zing - this blog has jokes now!_), and take care &hearts;

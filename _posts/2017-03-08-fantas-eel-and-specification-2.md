---
layout: post
title: "Fantas, Eel, and Specification 2: Type Signatures"
description: The second post in a series on the JavaScript Fantasy Land specification.
---

[Greetings, traveller](https://en.wikiquote.org/wiki/Garth_Marenghi's_Darkplace#Once_Upon_A_Beginning_.5B1.1.5D). I hope you've been having a good one since I posted the [first part of this series](/2017/03/03/fantas-eel-and-specification/), and I'd have a read of that before going any further. Assuming you're up-to-date, there's _one more little thing_ I thought we should talk about before we go head-first into the spec: [**Damas–Hindley–Milner type signatures**](https://en.wikipedia.org/wiki/Hindley%E2%80%93Milner_type_system).

Don't panic.

## Intro: `Java -> Haskell`

Chances are you've seen languages with explicitly-written (**static**) types before. Things like Java, maybe:

```java
public static void main(String[] args) {}
```

This line tells us that a function, `main`, takes an array of `String` values, and returns `void` (nothing). That is the function's **type signature**. Damas-Hindley-Milner signatures are just a different way of writing types. Y'know what, let's save characters and just call them _type signatures_ from now on.

When we go through these examples, bear one thing in mind: **all** functions are curried. I've written about [currying in JavaScript](/2016/11/12/curry-on-wayward-son/) before, so take a look if you're unsure. <abbr title="too long; didn't read">tl;dr</abbr>, whereas we'd write an `add` declaration in a Java-looking language like this:

```java
public static int add(int a, int b);
//                     ^ arg  ^ arg
//             ^ return
```

We'd write its _curried_ type signature like this:

```haskell
add :: Int -> Int -> Int
--      ^  arg ^ arg
--                    ^ return
```

In English, this says that _our `add` function takes an integer `x`, and returns a function that takes an integer `y`, which returns an integer (probably `x + y`)._

> Now, yes, some of you may be wondering about **uncurried** functions in JavaScript, such as an add function like `(Int, Int) -> Int`. However, we say that this would be a _one_ argument function whose single argument is a pair (a **tuple**<sup>†</sup>). JavaScript is a bit loose with this idea, as we'll see again and again.

Let's look at `zipWith`, a slightly more complicated example. Here's a possible implementation in JavaScript:

```javascript
const zipWith = f => xs => ys => {
  const length = Math.min(
    xs.length, ys.length
  )

  const zs = Array(length)

  for (let i = 0; i < length; i++) {
    zs[i] = f(xs[i])(ys[i])
  }

  return zs
}

// Returns [ 5, 7 ]
zipWith(x => y => x + y)([1, 2])([4, 5, 6])
```

Our beautiful `zipWith` takes the values at each index of the two arrays (until the shortest one runs out), and applies them to `f`, returning an array of the results. _If it isn't clear how this function works, play around with some examples before continuing_. Let's think about types:

- The `f` function must take two arguments of two types (we'll call them `a` and `b`), and these must be the respective types of `xs`' and `ys`' array values.

- The return type of `zipWith` is an array of the return type of `f`. So, if `f` returns some type `c`, then `zipWith(f)` must return an array of `c`.

How do we write that as a type signature? Just like this:

```haskell
zipWith :: (a -> b -> c)
  -> [a] -> [b] -> [c]
```

We've used **type variables** to represent places where we can take different types (you might know this as **polymorphism**). You don't have to call them `a`, `b`, and `c` - you could just as easily call them `x`, `dog`, and `jeff` (but don't). _The only rule here is that type **variables** always start with a lowercase letter, and **concrete types** always start with an uppercase letter._

Because we could fill the `a` variable with _any_ type (as long as our `f` and `xs` agree!), we can write _one_ `zipWith` signature that works for _any_ type `a`. Neat, huh? In fact, `zipWith` is a great example of a tool that we see all over functional code _because_ its variables make it so flexible:

```javascript
// a = Int
// b = String
// c = Bool

// Returns [ true, false ]
zipWith(x => y => y.length > x)
  ([3, 5])(['Good', 'Bad'])
```

Here, our `a` is filled in with `Int`, `b` with `String`, and `c` with `Bool`. However, we could just as easily make them all `Int` and zip with `x => y => x + y`! I sure hope you can handle all this excitement. Here's one last example of a function with a type variable:

```javascript
// Filter an array by a predicate.
// filter :: (a -> Bool) -> [a] -> [a]
const filter = p => xs => xs.filter(p)
```

Our function will work for _any_ `a` as long as our `p` function knows how to turn an `a` into a `Bool`. Yay!

Notice that both `filter` and `zipWith` have an argument that happens to be a _function_. To represent it in the signature, we "nest" its (bracket-wrapped) signature into our overall one.

Phew! That's basically all there is to it. We break up each type with an `->`, so the one at the end is the return value, and all the others are the arguments. In fact, this is _all_ you need to read and write [Elm](http://elm-lang.org/) type signatures - [go write some Elm](/2016/12/11/the-orrery/)!

For _this_ series, though, we're going to have to complicate matters and introduce a couple more things...

## Type Constraints

`zipWith` and `filter` are great, because their type variables can be _any_ type. Sometimes, however, we don't have that luxury. We might have to deal with signatures like these:

```haskell
equals :: Setoid a => a -> a -> Bool
```

The `=>` is new notation. What this means is that the signature to its _right_ is valid if all the conditions to its _left_ are satisfied. In the case of `equals`, the signature `a -> a -> Bool` is valid if `a` is a `Setoid`. Don't worry about what a `Setoid` is just yet, as we'll be covering exactly what it means in the next article. For now, just think of a `Setoid` as _a type for which we can check whether two of its values are equivalent_.

Constraints are _very_ important. When we have a signature that involves a type variable with _no_ constraints, we know that the function **can't manipulate it** in any way. We know by looking at the signature `id :: a -> a` that all it _could_ ever do is return the value it has been given, because we know nothing else about `a` - it could be a number, or a function, or anything! This feeds into an idea called [parametricity](https://en.wikipedia.org/wiki/Parametric_polymorphism) that we'll come back to several times in this series.

In languages like Haskell, the compiler will make sure that the conditions on the left are satisfied at compile-time, which catches a whole host of bugs! However, for our purposes, we'll see that it's simply some _really_ handy documentation.

## OOP-lease Stop

It wouldn't be JavaScript without some bodging, would it? _Because_ JavaScript is the way it is, we tend to build our types with methods like `equals` attached to the prototype:

```javascript
// Rather than this:
equals(first)(second)

// We do this:
first.equals(second)
```

Fair enough - it's certainly neater. However, it messes with our pretty signatures because `equals` now isn't a function of two arguments: it's a _method_ of one argument **attached to** a value. Remember, though, that the argument must have the same type as the object to which `equals` is attached. In Fantasy Land, you'll see the following style used to express this:

```haskell
equals :: Setoid a => a ~> a -> Bool
```

The `~>` is the new symbol here. What this means is that `equals` is a _method_ on the thing to the left of `~>`, and the thing to the right is its signature. Back in [the previous article](/2017/03/03/fantas-eel-and-specification/), we saw a `List.prototype.toArray` method. In the Fantasy Land style, we would write the signature for this method like so:

```javascript
// toArray :: List a ~> [a]
List.prototype.toArray = function () {
  return this.cata({
    Cons: (x, acc) => [
      x, ... acc.toArray()
    ],

    Nil: () => []
  })
}
```

We're saying that a `List` of values with type `a` has a method called `toArray` that returns an array of type `a`. It might not be pretty, dear reader, but it's JavaScript. _If you want a little exercise to do, write out a type signature for `List.prototype.map`, and make sure it's as general as possible!_

## `finish :: Blog ~> Ending`

I **promise** you, that's it. That's everything you'll need to know to live out a fulfilling life as a functional programmer. Once you get used to this syntax, it's just like riding a bike with weird arrows and brackets everywhere. If this article felt a bit heavy, don't worry: just come back to it for reference if you have questions later on in the series.

Regardless, get ready. No more distractions. Next stop: **Fantasy Land**.

Take care &hearts;

---

_* An important point here is that equivalence is **much deeper** than pointer equality. Just try typing `(x => x) === (x => x)` into your Node REPL; for functions to be a valid setoid, this should return `true`._

_<sup>†</sup> Pronounced "toople", regardless of which side of the pond you inhabit. Weird, right?_

---
layout: post
title: "Dependable Types 1: Full-STλC Development"
description: Part one of the adventures in Idris.
---

**Hello again!** Been a while, right? Sorry for being AWOL the best part of six
months; I got my _dream job_ writing **Haskell** and **PureScript** with some
brilliant minds over at [Habito](https://www.habito.com), and I've had a lot to
learn! Anyway, one such mind is [Liam](https://www.github.com/LiamGoodacre),
(who'll be a familiar face to anyone getting stuck in with PureScript), and we
have been spending our lunch times on various little projects. So, I thought
it'd be cool to share one of these projects with you!

> _**Spoiler**: the project we'll be going through is up on GitHub, and you can
> [download the code for this series](https://github.com/i-am-tom/LICK) if you
> want to play about with it. Head over to [the Idris
> site](https://www.idris-lang.org/) if you need any help getting set up._

This "series" is probably going to end up as four-or-five posts, easing into
GADTs, dependent types, and beyond, so **buckle up**! Before we get into that,
though, let's make sure we're all on the **same page**, and have a quick
refresher on the lambda calculus. _If you're already familiar with the lambda
calculus (untyped and simply-typed), this post isn't going to be super
interesting for you, but I'll hopefully see you later on!_

## The Untyped Lambda Calculus

The lambda calculus is a [Turing-complete
language](https://en.wikipedia.org/wiki/Turing_completeness) made up of only
**3** constructs: **variables**, **abstractions**, and **applications**. First,
a cheat sheet:

| --- | --- | --- | --- |
| Concept | λ | Haskell | JavaScript |
| --- | --- | --- | --- |
| Variable | `x` | `x` | `x` |
| Abstraction | `λx. M` | `\x -> M` | `x => M` |
| Application | `M N` | `M N` | `M(N)` |

That's it! I've included the examples in Haskell and JavaScript syntax, too, so
hopefully one of those is familiar to you. Let's go through these in a little
more detail:

- **Application**. Given some expression `M` that evaluates to a function, and
  some expression `N` that evaluates to a value, apply `N` to `M` to get some
  result.

- **Abstraction**. We can define a function that takes an argument, `x`, and
  returns the result of running `M`. `M` can be an expression that refers to
  `x`, just as functions in any other language can use the value we provide.

- **Variable**. This is how we refer to variables introduced in abstractions.
  We can't talk about variables that haven't been introduced (think of these as
  **undefined variables** in other languages), so every variable must refer to
  an argument supplied in an abstraction.

Hopefully, that made some sense. Just in case, though, let's run through a few
examples of some functions written using our calculus.

### `id`

| --- | --- |
| λ | `λx.x` |
| Haskell | `\x -> x` |
| JavaScript | `x => x` |

Probably the simplest program we could write, `id` just takes the argument we
give it and hands it back to us. We have an abstraction, `λx.__`, with a
variable reference, `x`, inside.

### `const`

| --- | --- |
| λ | `λx.(λy.x)` or just `λx.λy.x` |
| Haskell | `\x -> \y -> x` |
| JavaScript | `x => y => x` |

Here, we take two arguments, and just return the first one (effectively
ignoring the second). Nothing too complicated, and still looks a lot like the
languages we're familiar with. Notice that, when we want multiple arguments, we
**nest abstractions** and get the arguments once at a time.

### `flip`

| --- | --- |
| λ | `λf.λy.λx.fxy` |
| Haskell | `\f -> \y -> \x -> f x y` |
| JavaScript | `f => y => x => f (x) (y)` |

This time, we take a function and two arguments, but apply the arguments in the
opposite order. More **nesting**, but still hopefully not doing anything too
unfamiliar!

---

Hopefully, this gives us some idea about how this language works, and how we'd
use these three constructs together to build up programs. There's one last
thing I wanted to talk about in this post, though: **De Bruijn Indices**.

Our syntax is great and all, but there is room for error. We could give two
abstraction parameters the **same name**, which would add confusion, especially
when we come to **substitution** in later posts. Ideally, we want a way to
refer to abstraction parameters **unambiguously**, and that's where our man
[Nicolaas](https://en.wikipedia.org/wiki/Nicolaas_Govert_de_Bruijn) comes in.
In every abstraction, a new variable is introduced. De Bruijn indices count the
number of nested abstractions between a variable's **introduction** and its
**use**.

Let's start with `id`, which is `λx.x`. This variable is used immediately
inside the abstraction that introduces it, so we can rewrite this as `λ1`. We
read this as, _"Return the variable introduced in the latest abstraction"_.

What about `const`? Well, with `λx.λy.x`, `x` is again the variable in use, but
this time, there is a new variable introduced between the `x` and its original
mention. Because of this, we use `2` to mean, _"The variable from the
last-but-one abstraction"_, and hence rewrite `const` as `λλ2`.

As a last example, we can rewrite `flip` as `λλλ312`. This is because we apply
the **last-but-two variable**, `f`, to the **last variable**, `x`, and then
apply the result to the **last-but-one** variable, `y`.

_Confusing_, right? Don't worry: I promise **there's a point** to this. When we
come to building the **data type** for lambda calculus expressions, using a
form of De Bruijn indices will make it much easier for us to **guarantee
correctness**.  It's all _very_ exciting. If you want a little exercise to try
out, see if you can encode the following with De Bruijn indices:

> `λf.λl.λr.λx.f(lx)(rx)`

It's a bit of a tricky one, but hopefully manageable. If you're curious, this
function is called [`on` in Haskell's
`Data.Function`](https://hackage.haskell.org/package/base-4.10.1.0/docs/Data-Function.html#v:on),
and is useful for all sorts of things!

---

## All Together Now

This has been a bit of a whirlwind tour of lambda calculus, so I hope I haven't
frightened anyone off. To be honest with you, it feels rather odd to be writing
again! Anyway, there are **plenty** of resources for learning more if you're
interested, but I'll shine a special spotlight on Steven Syrek's [Lambda
Calculus for People Who Can't Be Bothered to Learn
It](https://www.youtube.com/watch?v=c_ReqkiyCXo), which will take you from
first principles right up to [the purest evil you've ever seen in
JavaScript](https://github.com/sjsyrek/presentations/blob/master/lambda-calculus/lambda.js).

One last note: the Idris project we'll be going through is an implementation of
the **simply-typed lambda calculus**. What's the difference between that and
what we've already seen? Simply that the variables, applications, and
abstractions **all have types** (like `Int` and `Int -> Int` - that sort of
thing). In practice, this is the same thing as any other programming language
with a simple type system, and we'll track these through our program to make
sure that non-functions don't end up being used as functions, or to avoid
**invalid parameter** usage.

Anyway, that's all for now! It's been lovely to talk to you again, and I hope
I'll be seeing you some time next week. Until then, take care &hearts;

---
layout: article
title: "Dependable Types 2: Correctness by Construction"
description: "Building types that can't be wrong."
redirect_from: /2018/01/27/dependable-types-2/
tags: untranslated
---

Part two already, is it? Well, I suppose it's about time to write some code!
[Last time](/2018/01/09/dependable-types/), we covered the constructions of the
**lambda calculus**, as well as **De Bruijn indices**. Today, we're going to
cover basically the same thing, but encoding everything we learnt in **Idris**!
If you're not familiar with Idris or dependently-typed programming, things are
going to start getting... _weird_.

---

As you may remember, the ultimate goal is to represent the simply-typed lambda
calculus. With that in mind, we should probably define some **simple types**:

```haskell
data ProgramType
  = PFunction ProgramType ProgramType
  | PInt
```

So, for now, we only have two types: **functions** (from one type to another),
and **integers**. _If you want to add more simple types, it's as easy as you
think!_

Now that's sorted, let's have a go at building **expressions** with an
**abstract data type**.

## First try: ADTs

```haskell
data Expression
  = Variable Int
  | Abstraction ProgramType Expression
  | Application Expression Expression
```

Just as the last article did, we're saying there are essentially only three
types of expressions:

- **Variables**, which we can reference by **De Bruijn index** (if
  zero-indexed, this is essentially _how many variables have been introduced
  **since** the one I care about?)_

- **Abstractions**, which introduce a **new** variable with a given type that
  can be referenced within the given body.

- **Applications**, which take the value on the right, and apply it to the
  function on the left.

This is a **perfectly sensible** way to represent the calculus, and feel free
to write it an interpreter - we'll certainly be writing one later in the
series! I'd imagine you'll have a type signature like this:

```haskell
interpret : Expression -> Maybe Expression
```

So, that's... _fine_... but that `Maybe` is kind of ugly, right? Why does it
need to be there? If you've had some experience with Haskell-like languages
before, you've probably already had a suspicion or two:

- How do we know the index in every `Variable` is valid? What if it's higher
  than the **outermost** variable's index? What if it's _negative_?!

- How do we _know_ the left expression in `Application` is a **function**? How
  do we know that its input **type** matches the right expression's type?

The more you stare at it, the more holes you can see, and that `Maybe` looks
more and more inevitable. Today, friends, we'll ask whether we could do...
_better_.

## Second try: _Generalised_ ADTs.

Here's where we officially break from Elm and PureScript. _Still not from
Haskell, providing you have the `GADTs` and `DataKinds` extensions enabled_.
Within Idris, we can have greater control of our data type using a clever
notion called **GADTs**. We don't have enough time in this post to explain them
in depth, so let's just say that they give us more control over the
**construction** of our type's values. If that means nothing to you, don't
worry! Here's an example of the above ADT rewritten as a _GADT_:

```haskell
data Expression : Type where
  Variable
     : Int
    -> Expression

  Abstraction
     : ProgramType
    -> Expression
    -> Expression

  Application
     : Expression
    -> Expression
```

Great. So far, we've just got a more long-winded way of doing the same thing.
**What's the big deal**? Well, let's have a go at solving that **type
mismatch** issue: Let's **index** our type by a **ProgramType**.

```haskell
data Expression : ProgramType -> Type where
  Abstraction
     : (paramType : ProgramType)
    -> Expression bodyType
    -> Expression (PFunction paramType bodyType)

  Application
     : Expression (PFunction input output)
    -> Expression input
    -> Expression output

  Variable : ... -- More on this later...
```

Here's where things get **truly magical**. In the first line, we say that
`Expression` is a type constructor that takes a `ProgramType` (just like
`Array` is a type constructor that takes a `Type` - `Array Int`, `Array
String`, and so on). This means, whenever we mention an `Expression`, we also
mention its **type** - now, we can be sure that `Application`'s components have
the right types!

This is going to look _really_ weird to Haskell-like language users.
`ProgramType` is the data type we defined earlier, and now we're using it
**inside a type**! This is what makes Idris, and _dependent types_, special: we use **the same
language** to talk about **types** and **values**. We'll see later that we can
even **pull things out of a type** to use as values... _and vice versa_.

We can pat ourselves on the back: we have solved the type mismatch issue.
However, you'll notice I've tiptoed around `Variable`. Our issue was that we
would need to bounds check the `Int`; how are we going to fix that?

## A small digression: `Elem`

Idris has a lovely little type called `Elem` that is written like this:

```haskell
data Elem : a -> List a -> Type where
  Here  : Elem x (x :: xs)
  There : Elem x xs -> Elem x (y :: xs)
```

Let's break it down. `Elem` is a type indexed by two things: a **value** of
some type `a`, and a **list of values** of type `a`. `Here` says, _the first
thing in the list is the value_ (`::` is how we write `cons` in Idris: `x ::
xs` is a list where `x` is the item at the front, and `xs` is the rest of the
items). `There` says, _it isn't the first thing, but it **is** in the list_.
Here are a few examples:

```haskell
valid : Elem 1 [1, 2, 3]
valid = Here

alsoValid : Elem "az" ["oo", "ar", "az"]
alsoValid = There (There Here)

invalid : Elem 0 [1, 2, 3] -- Type error!

alsoInvalid : Elem 0 [1, 0]
alsoInvalid = Here -- Should be There Here!
```

What we have is a **type-level** way of proving that something exists within a
list. All well and good, but how does this _help_ us?

## Third time lucky: doubly-indexed GADTs

Here's where we solve all our problems. Firstly, let's talk about
**variables**. Every time we use `Abstraction`, we introduce a new variable
with a given type into the "context" of our expression. How do you suppose we
can keep track of the **list of variables** and their types, though?

```haskell
Context : Type
Context = List ProgramType
```

... Well, that was straightforward. Really sorry if that was a little
underwhelming. Because we're just describing **expressions**, we don't need to
store values at all - just knowing the types of the variables that are in
context (think of this as "scope") is enough to know whether our expression is
valid!

> _As a little aside, this is one of the things I found a bit **weird** about
> Idris: because types and values use the same language, we can declare **type
> aliases** just as we declare values. We even give them **type signatures**!_

Here comes the big reveal. This is the bit that **blew my mind** (which, I can
tell you, was very distressing and inconvenient for poor
[Liam](https://www.github.com/LiamGoodacre), who had just written it). As well
as indexing our expressions by their **type**, we can also index them by the
**context** they exist in:

```haskell
data Expression
   : (ctx : Context)
  -> (ptype : ProgramType)
  -> Type where

  Abstraction
     : (param : ProgramType)
    -> (body  : Expression (param :: ctx) ptype)
    -> Expression ctx (PFunction param ptype)

  Application
     : (func : Expression ctx (PFunction i o))
    -> (arg  : Expression ctx i)
    -> Expression ctx o

  Variable -- One more minute...
```

> _For the benefit of mobile users, these names have been abbreviated to stop
> line wrapping. If you would prefer a more verbose format, [the code for this
> post](https://github.com/i-am-tom/LICK/blob/master/src/LICK/Expr.idr) uses
> long-hand names._

**Wow**! This is where we start to see the power of Idris. We now start by
saying that `Expression` is a type indexed by a `Context` and a `ProgramType`,
_but_ we also give that `Context` a name - `ctx` - so we can use it later!

An `Abstraction` is made up of some `ProgramType` to represent the type of the
input, and an `Expression` of some type to represent the output. What's _new_
here, however, is that `body`'s context must be the same as the output, but
with a new variable introduced which **matches** the given **parameter type**!
We are saying, _"within an `Abstraction` body, there is one more variable
available: the parameter"_. Because the output type _doesn't_ contain that
extra variable, we are completely encapsulating it within the body expression.
We are saying that _in the type_. I can't tell you how **excited** this makes
me.

`Application` is actually... pretty much the same as it was before. All our
`Context` is saying here is that they must exist within the _same_ context,
which is... well, what you'd expect. The point here is that we're still
_carrying_ the context in the type so we can use it for `Abstraction` and
`Variable`! Speaking of `Variable`... where _is_ it?

```haskell
Variable
   : (ref : Elem ptype ctx)
  -> Expression ctx ptype
```

This, for me, is the most **beautiful** part of all. Now, instead of taking a
_number_ to represent a De Bruijn index, we take an `Elem`. We can see that
this maps quite happily:

| --- | --- |
| De Bruijn | `Elem` |
| -- :|: -- |
| 1 | `Here` |
| 2 | `There Here` |
| 3 | `There (There Here)` |
| 4 | `There (There (There Here))` |

... Well, you get the picture. The _point_ is that, in order to construct a
`Variable` expression, we have to _prove_ that the variable is **in the
context**:

```haskell
good : Expression [] (PFunction PInt PInt)
good = Abstraction PInt (Variable Here)
```

This is the **identity** function for `PInt`: create a function abstraction
with a `PInt`-type parameter, and then return the last-introduced variable!
What if we tried to write this:

```haskell
bad : Expression [] (PFunction PInt PInt)
bad = Abstraction PInt (Variable (There Here))
```

Now, we're saying, _"Get me the last-but-one-introduced variable"_, but our
context is **empty** - this variable **doesn't exist**! Just when we think all
hope is lost, up pops a compiler error:

```
When checking right hand side of second with expected type
        Expression [] (PFunction PInt PInt)

When checking argument later to constructor Data.List.There:
        Type mismatch between
                Elem x (x :: xs) (Type of Here)
        and
                Elem PInt [] (Expected type)

        Specifically:
                Type mismatch between
                        PInt :: xs
                and
                        []
```

This is an **actual compiler error** telling us exactly that: the context was
empty, but we've tried to use a proof that `PInt` is in there! Because Idris
_wants_ to see `Elem PInt (x :: xs)`, but actually sees `Elem PInt []`, it
knows that there has been a problem. We are now in a situation where we
**cannot** write **invalid expressions** if we want our code to compile.
Because we've indexed our type by both the **program type** and **context** of
the expression, and used a **GADT** to constrain them, we know that they will
always be what we expect! We can now write what we've always wanted to write:

```haskell
eval : Expression -> Expression
```

_... but we'll save that for next time!_

---

This has been... a **lot of information**. A lot of information **very
quickly**, but hopefully not _too_ quickly. In any case, I'm sorry if this one
takes **a couple readthroughs**. Idris is a very different beast to Elm,
PureScript, and even Haskell: the ways that you can interact between types and
values are strange and unfamiliar, but we're starting to see _why_ this
newfound power is helpful. With the aid of indexed types and GADTs, we can
produce types that simply **don't** allow for **invalid values**. We have, with
these features, made **illegal states unrepresentable**.  This is also what we
call **correctness by construction**: _if I can build a value of type
`Expression`, it must **be valid**_.

If I've rushed through anything, or something seems suspicious, don't hesitate
to [send me a tweet](https://www.twitter.com/am_i_tom) or leave an issue on
[this website's
repository](https://www.github.com/i-am-tom/i-am-tom.github.io)! As always,
there is [code for this article](https://www.github.com/i-am-tom/LICK), all of
which can be found within `Expr.idr` and `ProgramType.idr`, and I encourage you
to play around with it!

Otherwise, have fun, and I'll see you next time!

Take care &hearts;

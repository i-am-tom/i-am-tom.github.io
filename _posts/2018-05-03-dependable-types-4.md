---
layout: post
title: "Dependable Types 4: Terms Are Types Are Terms"
description: "Terms are just types we haven't promoted yet."
---

Hello again! Sorry for the wait; it has been a very busy few months, but we're
back for the **final part** of [the series](/dependable-types): **evaluation**!
Once we have our program written, how do we _use_ it? How do we give it input
and, from that, compute output? Today, we're going to try perhaps a more
unusual approach: converting our `Expression` to an actual **Idris function**.
To do _that_, we're going to need some real dependently-typed **magic**.

---

The first thing we're going to have to do is convert our `ProgramType` into an
actual Idris `Type`. This is a beautifully **simple-looking** function that is
almost **unthinkable** in most other languages:

```haskell
ProgramTypeToType : ProgramType -> Type

ProgramTypeToType (PFunction x y)
   = ProgramTypeToType x
  -> ProgramTypeToType y

ProgramTypeToType PInt = Int
```

Give me a `ProgramType`, and I'll give you a `Type`. Neat, right? Now we know
we can convert a type, we can convert our entire **context** to a **vector** of
its types:

```haskell
ContextTypes
   : (context : Context)
  -> Vect (length context) Type

ContextTypes []
  = []

ContextTypes (x :: xs)
   = ProgramTypeToType x
  :: ContextTypes xs
```

Yet another function with that **dependently-typed magic** we're slowly
starting to take for granted. Given a context, this produces a vector whose
length matches that context, and whose elements are `Type`s. Let that sink in...

When we actually run the program, all the types in our context will also have
**values**... but how do we store a list of potentially **different types**?
Enter the `HVect`:

```haskell
data HVect : Vect k Type -> Type where
  Nil : HVect []
  (::) : t -> HVect ts -> HVect (t :: ts)
```

If this is a bit _confusing_, don't dwell on it: the important thing is that
`HVect` is indexed by **a vector** of the types of its inhabitants. This means
that a list like `[3, 2.0, "hello"]` has type `HVect [Integer, Double, String]`
and all will be well. It's super neat.

What this means is that we can store the **values** of our context in... (_drum
roll, please_):

```haskell
HVect (ContextTypes context)
```

This *blew* my poor little mind. We use `ContextTypes` to figure out the _type_
of our `context`, and then use `HVect` to store values of those types. At this
point, we're basically back to `List`, and we can go about our business as
before. In fact, we can even reuse our `Elem` references:

```haskell
get
   : Elem programType context
  -> HVect (ContextTypes context)
  -> ProgramTypeToType programType

get Here (head :: _)
  = head

get (There later) (_ :: tail)
  = get later tail
```

By now, this should feel pretty comfortable: if the value is `Here`, we get the
head, and if the value is `There`, we continue to walk the list. Because the
`Elem` points to an element of `context`, and our `HVect` is the same length as
`context`, we can be certain that this isn't going to cause us runtime issues,
and there isn't a `Maybe` in sight. **Magnifique**.

Finally, we get to the **big reveal**. The thing to which we've been building
since the beginning. This function evaluates our little DSL into an **actual
Idris value**. We've turned data into program, and all the types are
**dependent** on the shape of that data.

```haskell
eval
   : {context : Context}
  -> HVect (ContextTypes context)
  -> Expression context programType
  -> ProgramTypeToType programType

-- Reference => Idris value
eval context (Variable reference)
  = get reference context

-- Abstraction => Idris function
eval context (Abstraction parameter body)
  = \x => eval (x :: context) body

-- Application => Idris application
eval context (Application f x)
  = eval context f (eval context x)
```

... It's... underwhelming, right? We went to all this trouble, and we end up
with a **tiny** evaluation function. Why? Well, because it really isn't doing
anything very special: we _know_ our expression is valid, and we _know_ the
expected types of all its values when we convert to Idris, so we have **total
type safety**. Nothing _could_ go wrong because we've checked it all at compile
time. In some cases, we literally **proved** it.

If you take away the type signature, this is pretty much as in-depth as `eval`
would be in any **untyped** language. When we see a variable, get it. When we
see a function, make a function. When we see an application, apply the value to
the function. In the end, all our hard work has paid off **beautifully**, and
everything starts to look a bit... **JavaScripty**.

---

Of course, we're professional software engineers, so let's write some
**tests**!

```haskell
Apply2
  : Expression context
      (PFunction
        (PFunction a a)
        (PFunction a a))

Apply2 {a}
  = Abstraction
      (PFunction a a)
      (Abstraction a
        (Application
          (Variable (There Here))
          (Variable Here)))
```

Of course, with explicit constructor names, everything looks a little bit ugly,
but we can think of `Apply2` as `\f x -> f x`, or, if you're more comfortable
with the Lambda notation, `λf.λx.fx`.

Now, if everything's working, applying `\x -> x + 1` and `5` to this should
yield `6`, correct? Well, let's *prove* it:

```haskell
Eg0
  : eval {context = []} []
         (Apply2 {a = PInt})
         (+ 1) 5
  = 6

Eg0
  = Refl
```

There it is: another `Refl`. If you don't believe that this could work, clone
[the GitHub repository](https://github.com/i-am-tom/LICK) and try changing the
result to `7`. Just as before, it's **a type error**. Failed unit tests are a
type error. I can't express how _exciting_ I find this.

For a victory lap, let's try a slightly more _interesting_ test. Here, we're
going to specify that this expression exists within a **non-empty** context of
two values, `3` and `\x -> x + 1`. That being the case, we _should_ be able to
reference those values that we've passed in as context, and produce a result of
`4`. Are we feeling lucky?

```haskell
Eg1 : eval
  {context = [PInt, PFunction PInt PInt]}
  [3, (+1)]
  (Application
    (Variable (There Here))
    (Variable Here))

  = 4

Eg1
  = Refl
```

We certainly should: everything **just works**. We have turned our **data**
into a **program**, and then used it to produce **typed** input and output **at
runtime**.

---

Idris is, inarguably, an **amazing** language. When you first start thinking
about problems in terms of `map`, `reduce`, and `filter`, or when you finally
understand how `Monad` works, these things **change the way you code**. I
highly - _highly_ - recommend that you buy Edwin Brady's book, [Type-Driven
Development with
Idris](https://www.manning.com/books/type-driven-development-with-idris), and
see what all the fuss is about. I can guarantee that you won't be disappointed.

Take care &hearts;

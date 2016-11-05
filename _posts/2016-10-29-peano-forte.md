---
layout: post
title: Peano's Forte
description: A little bit of an intro to recursion and induction with the help of Giuseppe Peano.
---

A hundred-ish years ago, long before Pokémon and the [Slap Chop](https://www.youtube.com/watch?v=rUbWjIKxrrs), there lived a clever one named [Giuseppe Peano](https://en.wikipedia.org/wiki/Giuseppe_Peano), who came up with a neat way to describe the natural numbers (`0, 1, 2, 3, ...`):

- The first one is `0`, which we'll write as `Z`.

- The number after any `x` is its **successor**, `S x`.

Using these two rules, we can write every number in the series:

| -------- | ------------- |
| Friendly | Peano         |
| --------:|:------------- |
|      `0` | `Z`           |
|      `1` | `S Z`         |
|      `2` | `S (S Z)`     |
|      `3` | `S (S (S Z))` |
|  `. . .` | `. . .`       |
| -------- | ------------- |

Maybe it's not the prettiest, but I think it's pretty cool. A number is either `Z` or the `S` of another number, which is either `Z` or the `S` of another number, which is... well, you get the picture! We call this a **recursive definition**.

Because of this, we can define functions on the Peano numbers using recursion, too! Here's a function for testing equivalence:

|   A   |   B   |  A == B  |
| ----- | ----- | -------- |
|  `Z`  |  `Z`  | `true`   |
| `S x` |  `Z`  | `false`  |
|  `Z`  | `S y` | `false`  |
| `S x` | `S y` | `x == y` |

Rule **3** might seem like a duplicate of **2**, but we have to define both in case the order of arguments matters (e.g. with subtraction, `2 - 3` is not the same as `3 - 2`).

Rule **4** is the magical recursive bit: if `x` and `y` are still successors, we run rule **4** again, and we keep doing that until one of the other three conditions is met. We can write out the process for determining `2 == 3` with our Peano numbers:

```haskell
(S (S Z)) == (S (S (S Z)))
  => (S Z) == (S (S Z)) -- By rule 4
  => Z == (S Z)         -- By rule 4
  => false              -- By rule 2
```

Loads of brackets, but it's hopefully clear enough to see what's going on: for as long as both of the arguments are successors, we remove one `S` at each step until one `Z`. If the other reaches `Z` at the same time, then the two numbers are equal! Ooer.

Defining addition is also fairly straightforward:

|   A   |   B   |      A + B      |
| ----- | ----- | --------------- |
|  `Z`  |  `Z`  | `Z`             |
| `S x` |  `Z`  | `S x`           |
|  `Z`  | `S y` | `S y`           |
| `S x` | `S y` | `S (S (x + y))` |

Rules **1**, **2**, and **3** define our _base cases_: adding `Z` to any value produces that same value. Rule **4**, of course, is where we define our recursion. Let's look at an example with `3 + 2`. We'll use square brackets to make things clearer, but just think of them as regular brackets:

```haskell
(S (S (S Z))) + (S (S Z))
  => S (S [(S (S Z)) + (S Z)]) -- By rule 3
  => S (S (S (S [(S Z) + Z]))) -- By rule 3
  => S (S (S (S (S Z))))       -- By rule 1
```

And there you have it! One more example that's worth mentioning before we go is how to convert our Peano numbers back into the integers that we know and love:

|   A   |    toInt A    |
| -----:|:------------- |
|  `Z`  | `0`           |
| `S x` | `1 + toInt x` |

We only need one argument for this, so the function is super straightforward. Yay! Here's the function working with `3`:

```haskell
toInt (S (S (S Z)))
  => 1 + toInt (S (S Z)) -- By rule 2
  => 1 + 1 + toInt (S Z) -- By rule 2
  => 1 + 1 + 1 + toInt Z -- By rule 2
  => 1 + 1 + 1 + 0       -- By rule 1
  => 3                   -- By addition
```

---

Ok, so this maybe isn't the sexiest concept, but we've covered some important stuff:

- We can use **recursion** to write simple definitions of functions that can just call themselves to deal with each "step" of the problem.

- We can use **induction** to show that, if a function works for `Z` (or some other base case) and `S x`, it can work for _any_ Peano number!

- Running a function is just substituting one thing for another! Functions shouldn't _do_ anything - they should just swap an input for an output.

That's all from me today! If you want to play around with the concepts, you can use this [try.purescript.org gist](http://try.purescript.org/?gist=d2be4384a7b4cc6283be5097df12c63c) to play with the code. Otherwise, I hope this was at least a little interesting, and I'll talk to you soon!

Take care &hearts;

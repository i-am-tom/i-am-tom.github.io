---
title: Programming with Kittens, Cookies, and Paperclips
---

A few weekends ago, [my friend Uri][uri-github] took part in
a game jam. Being the spectacular friend that I am, I offered to keep him
company for part of this, so I got on a train and headed for his town. On the
way, though, I had an idea: why don't I make a game too? There are two reasons
why the obvious answer to this question is "don't": I have no idea how to build
2D or 3D games with any of the usual game engines, and I don't have time to
learn or roll my own. Things were looking bleak, but then I had an epiphany:
there is one genre of game that isn't expected to look flashy, and has a series
of very clear "stopping points" if I run out of time.

## What are idle games?

Idle games fascinate me. I'm not sure there's another genre of game as simple
yet compelling: I can waste tens of hours on checking in on the status of my
imaginary empire. In short, the unique mechanic of idle games is that time
progresses whether you're actively playing or not. While you go about your day,
[your kittens][kittens game] are farming, [your grandmas][cookie clicker] are
baking, and [your drones][paperclip factory] are fighting in intergalactic
wars. When you check back in, you'll see what has happened in the meantime:
maybe you have more money, or maybe all your followers have starved. In any
case, you make some adjustments, and log off again.

The core of this genre is understanding how your resources are being produced
and consumed. For example, if I have $100,000 to pay my staff their wages,
but my statistics tell me that I'm burning $500 per second, then I ought to do
something before I go to bed! To help with this, it's very common for idle
games to give you some way to see the _rate of change_ for your quantities of
each resource.

## The Elm Architecture

The essence of idle games is reasonably well-defined, so I'm unfortunately
destined to try to generalise it. Fans of UI programming may be familiar with
The Elm Architecture in one form or another, which (in basic terms) defines an
application like this:

{% gist c05f206ef35179f5ad7e13006ba6228d TEA.hs %}

We start with a given initial `state`. When an `event` comes into the system (a
mouse click, page scroll, or anything else), we call `update` to update the
`state` accordingly. This new `state` is passed to `render`, and this gives us
our `output`. A naïve implementation for our purposes would see the `Event`
type containing a `Tick` variant that updates the world. After a time away, we
can just trigger the appropriate number of `Tick` events without the wait.

To illustrate the problem here, let's imagine our tick speed is only once per
second, and we leave for an hour. When we come back, we trigger 3600 tick
events, and the TEA loop begins to work through them. Setting aside
intermediate renders, we now have to perform the most complex function in our
application thousands of times before the user can continue.

Most[^factory-idle] idle games' answer to this problem is to employ a heuristic: rather
than actually simulating every moment in time, we multiply the rate of change
of each resource _at the moment you paused_ by the time away. If your money is
about to run out and you hire a thousand extra workers before logging off, you
can of course abuse this heuristic to your advantage, but it's good enough to
keep the games fun and performant.

So, to approach this problem, we need a way of describing a rate of change per
tick such that we can "multiply" this type by the number of ticks that have
passed while we were away. Nestled in the `monoid-extras` package in
`Data.Monoid.Action` is [the `Action` class][monoid action], which (after
some slight modification and variable renaming) looks pretty promising:

{% gist c05f206ef35179f5ad7e13006ba6228d Action.hs %}

Here, we model state changes as a monoidal type, which allows us to use
`stimes` to create repeat actions when we've been idle, or single actions for
each tick while we're playing. Armed with this class, we can return to our
original architecture:

{% gist c05f206ef35179f5ad7e13006ba6228d Incremental.hs %}

At this point, there's a component I'd like to revisit: the display to show the
user the rate of change of the various resources. If the `Change` type
describes the state change that will be performed in the next tick, then the
rate of change display is just a renderer for the `Change` type, and we can
simply include it as an extra parameter to `render`!

This does raise a question, though: must we define the `Change` type manually?

## Change structures

I know that what I want to do with this `tick` function amounts to computing
the derivative of a `time -> state` function: at any given moment in time, I
want to compute the rate at which my state changes with respect to time. In
these terms, it starts to sound rather mechanical: there really ought to be a
way of computing the change type automatically.

After some rummaging, I discovered [A Theory of Changes for Higher-Order
Languages: Incrementalizing λ-Calculi by Static Differentiation][change paper]
via [an archived project by Phil Freeman][purescript-incremental]. The paper
contributes a way to compute program derivatives for expressions in the
simply-typed lambda calculus using a class to which they refer as a _change
structure_. We can view this class as a subclass of `Action`:

{% gist c05f206ef35179f5ad7e13006ba6228d Change.hs %}

With this class, we can act on a value with a change to produce a new value,
and we can compute the change that describes the _difference_ between two
values. We've also said that each type has a specific associated change type. A
nice and friendly example of a `Change` type is `Int`, whoses changes can be
described by (a monoidal version of) itself:

{% gist c05f206ef35179f5ad7e13006ba6228d Change_Int.hs %}

In general, I've found it very helpful to conceptualise these operations as
being plus and minus. For some types, it may be nice to define something more
domain-specific, but there really ought to be a mechanical way to derive some
sort of change type for all abstract data types...

## Generic deriving

A convenient way to derive a class for any given Haskell ADT is to provide an
implementation for any `Generic` type. Doing so means we only have six cases to
handle: `M1`, `V1`, `(:+:)`, `U1`, `(:*:)`, and `K1`.

{% gist c05f206ef35179f5ad7e13006ba6228d GChange.hs %}

We'll start with `V1` and `U1`. `V1` represents a type with no constructors: a
type isomorphic to `Void`. As these types have no inhabitants, they can't
really "change", and thus every change is a no-op. `U1` represents a
constructor with no fields - a _unital_ constructor. Despite having one more
inhabitant than `V1`, `U1` shares its change structure: whether we have zero
values or one, there's no change that isn't a no-op.

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeV1U1.hs %}

`M1` and `K1` are also not too exciting: when we encounter metadata in the form
of an `M1` type, we can just ignore it, as it has no impact on the change type.
When we reach a `K1`, we have found a field within our type, and thus we need
to make sure it is a `Change` type so that we can keep recursing.

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeK1M1.hs %}

Products are nice and straightforward: if we want to describe a change to a
product, we describe the change to each side:

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeProduct.hs %}

Finally, the tricky one: we might think that `GDelta (x :+: y)` is simply
`GDelta x :+: GDelta y`. However, we've missed something: how do we describe a
change from one side of the sum to the other? For example, how do we describe a
change from `Left 1` to `Right True`? Also, how do we make it a `Monoid`?

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeSumEN.hs %}

With that, we have all the instances we need to derive a `Change` instance
generically for any ADT whose fields are all themselves `Change` instances!

The change types may not be the prettiest or most user-friendly, but there's
surprisingly little work left to do here: a la [`higgledy`][higgledy], we could
benefit from [`generic-lens`][generic-lens] and get an awfully long way:

{% gist c05f206ef35179f5ad7e13006ba6228d GenericDelta.hs %}

Rather than make this post any longer, I'll leave filling in the gaps, as well
as the design of an API for dealing with sum types, as an exercise to the
reader.

## Returning to the architecture

{% gist c05f206ef35179f5ad7e13006ba6228d Final.hs %}

Not a lot has changed here, except that `Delta state` replaces `Change` and
saves us a type parameter. However, let's remember that we no longer need to
define `Change` ourselves: in the library, most interesting types have
[automatically derived instances][generic instances], saving us from worrying
about making implementation errors.

Another subtle benefit here lies in the fact that `Change x` implies that
`Delta x` will always be a `Monoid`. This makes `tick` a much easier function
to implement: we can write a series of functions that each compute the change
for one field within the state, and then `mconcat` them together (as `Delta x`
implies `r -> Delta x`). This gives us a much more convenient architecture for
building these complex games in a tidy and manageable way.

{% gist c05f206ef35179f5ad7e13006ba6228d State.hs %}

## Conclusions and further work

In the few hours I had, I actually managed to get pretty far: my game had
various resources that affected each other, and the beginnings of a functional
game loop. Of course, the game's architecture wasn't this well thought out
during the jam; I was just hammering keys as quickly as I could. However, I
always think it's worth keeping a list of passing thoughts as you work on
something under pressure. I ended up learning a lot of things that I'd never
have seen were it not for the jam, and had I tried to explore them in the
moment, I'd have failed to finish the game and probably not learnt anywhere
near as much.

At this point, I'm quite happy with the way everything turned out here. Of
course, it's far from perfect, and there's definitely more that can be done.
Originally, I'd planned to embrace even more of the incremental programming
literature and build an application like this:

{% gist c05f206ef35179f5ad7e13006ba6228d Future.hs %}

In this world, events are `state -> Delta state` functions, and `tick` is just
the result of differentiating the `simulate` function. Perhaps this would be a
fun idea to push a little bit, but I managed to find an architecture I quite
liked without going that far.

An interesting follow-up, I think, would be to explore this architecture and
see if we can use some of the literature[^function-derivatives] to lower the
cost of calculating function derivatives. It would also be interesting to look
into how we can make `simulate` a pleasant function to write: in this
architecture, we've lost our friendly `Monoid` instance for state changes, and
we're back to dealing with something much less conveniently abstract.

In any case, I think this is a good place to stop. Thanks so much for reading,
and I'll see you next time!

[^factory-idle]: A fun exception to the rule is [Factory Idle][factory idle],
    which does _not_ continue to run while you're away, but you instead accrue
    points that allow you to run the game at 2x speed.

[^function-derivatives]: The paper that prompted this post solved this by using
    GHC plugins. [Conal Elliot solved this in a different way][compiling to
    categories], though good user experience still relies on using GHC plugins.
    I might give this a go when the feeling takes me.

[change paper]: https://arxiv.org/abs/1312.0658
[compiling to categories]: http://conal.net/papers/compiling-to-categories/
[cookie clicker]: https://orteil.dashnet.org/cookieclicker/
[factory idle]: https://factoryidle.com/
[generic implementation]: https://github.com/i-am-tom/haskell/blob/main/incremental/source/Data/Change.hs#L107
[generic instances]: https://github.com/i-am-tom/haskell/blob/main/incremental/source/Data/Change.hs#L80-L90
[generic-lens]: https://github.com/kcsongor/generic-lens/
[higgledy]: https://github.com/i-am-tom/higgledy
[kittens game]: https://kittensgame.com/
[monoid action]: https://hackage.haskell.org/package/monoid-extras/docs/Data-Monoid-Action.html
[paperclip factory]: https://www.decisionproblem.com/paperclips/index2.html
[purescript-incremental]: https://github.com/paf31/purescript-incremental
[uri-github]: https://github.com/Uriyeah55

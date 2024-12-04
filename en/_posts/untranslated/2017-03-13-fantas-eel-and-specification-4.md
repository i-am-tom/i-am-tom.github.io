---
layout: article
title: "Fantas, Eel, and Specification 4: Semigroup"
description: Installment NUMBER 4.
redirect_from: /2017/03/13/fantas-eel-and-specification-4/
tags: untranslated
---

Today, after a moment of thanks to all those following this series (seriously, _thank you_ &hearts;), we can move onto a question that has occupied human thought for aeons: how do we generalise the process of combining (or [mooshmashing](https://twitter.com/drboolean/status/700436888390217728)) things together? With **semigroups**, of course!

Now, just as with [`Setoid`](/2017/03/09/fantas-eel-and-specification-3/), we'll get methods and laws out the way now so that we can move on to fun things. Luckily, there's only one of each! A valid `Semigroup` must have a `concat` method with the following signature:

```haskell
concat :: Semigroup a => a ~> a -> a
```

_A `Semigroup`'s `concat` method must take another value of the same type, and return a third value of the same type._ The only law we have to worry about here is **associativity**:

```javascript
a.concat(b).concat(c)
  === a.concat(b.concat(c))
```

In other words, as long as the left-to-right order is maintained, we can put the brackets wherever we like. Just take a moment to think about how much **freedom** we have with this structure! As stated earlier, `Semigroup` types are designed to be mooshmashed together. How the mooshmashing works is _entirely_ up to you.

Let's start with a look at **strings**. By chance, JavaScript's `String` type is _already_ a Fantasy Land-compliant semigroup!

```javascript
// 'hello, world!'
'hello'.concat(', world!')

// This operation is associative, too!
'hello'.concat(', ').concat('world!')
'hello'.concat(', '.concat('world!'))
```

We take two strings, and `concat` them to make another string. Along those lines, you might also notice that **arrays are already valid semigroups**, too!

```javascript
[1, 2].concat([3, 4]) // [1, 2, 3, 4]

// Aaand it's associative!
[1].concat([2, 3]).concat([4])
[1].concat([2, 3].concat([4]))
```

Notice, as well, that we don't put any **constraints** on the array's inner type - we don't need to care _what_ is in the array!

For `String` and `Array`, it's pretty obvious what the `concat` implementation would be, probably because it's `concat`enation. How, though, do we `concat` numbers? `+`? `*`? `max`?

The answer is that **it's up to you** - we can pick any of these as they would all satisfy the laws. This is the **freedom of semigroups**. In actual fact, it would even be a valid `concat` implementation for strings if they were concatenated with `x + " MITTENS " + y` - there really is a _lot_ we can do with semigroups (but **always check the laws**).

For the sake of clarity, we tend to create **separate semigroup types** to encapsulate these ideas. We'll start with a nice, easy one: `Sum`.

```javascript
const Sum = daggy.tagged('Sum', ['val'])

Sum.prototype.concat = function (that) {
  return Sum(this.val + that.val)
}

Sum(2).concat(Sum(3)).val // 5
```

**That's it**. No hidden magic, no nothing. It's so wonderfully simple; why not write `Product` (multiplication), `Max`, and `Min` types as an exercise? I can promise you that it won't take long!

We're not only restricted to numbers, either. There are two intuitive `Semigroup` instances for booleans:

```javascript
Any.prototype.concat = function (that) {
  return Any(this.val || that.val)
}

All.prototype.concat = function (that) {
  return All(this.val && that.val)
}
```

`Any` will hold `true` if _any_ concatenated values be `true`, and `All` will hold `true` if _all_ concatenated values be `true`.

There are also a few others that don't care what the inner type is, such as `First` and `Last`. Super simple, and we'll see a use for these later:

```javascript
// Return the a value in a.concat(b)
First.prototype.concat = function (that) {
  return this
}

// Return the b value in a.concat(b)
Last.prototype.concat = function (that) {
  return that
}
```

> We'll also see loads more use cases for these types defined so far when we get on to **monoids** in the next article*.

We could even define a [`Set` semigroup](http://hackage.haskell.org/package/containers-0.5.10.1/docs/src/Data-Set-Internal.html#union), where concatenation is **set union** (or **intersection**!), and the elements of its inner list are unique. If you want to have a go at building such a type, notice that `Set a` could only be a `Semigroup` if `a` were a `Setoid` (because you need to check for duplicates) - _all these algebraic structures are connected_! **Spooky**.

More generally, this is one of many examples of a `Semigroup` instance with **constraints**. It's much more common, however, for the constraints to be that inner types _also be semigroups_.

Let's imagine we have a pair structure, which just holds two values of type `a` and `b` respectively. How do we make the _pair_ a semigroup? Well, if we wanted to `concat` it with another pair of types `a` and `b`, the obvious solution would be to `concat` the two `a` values and the two `b`, and return a pair of the results. To do that, `a` and `b` need to be semigroups:

```javascript
const Tuple = daggy.tagged('Tuple', ['a', 'b'])

// concat :: (Semigroup a, Semigroup b) =>
//   Tuple a b ~> Tuple a b -> Tuple a b
Tuple.prototype.concat = function (that) {
  return Tuple(this.a.concat(that.a),
              this.b.concat(that.b))
}

// Returns Tuple(Sum(3), Any(true))
Tuple(Sum(1), Any(false))
    .concat(Tuple(Sum(2), Any(true)))
```

We can see here that the `Tuple` type is only a semigroup when its component parts are semigroups. This is a clever pattern: one (or both) of those component semigroups could be _another_ pair of other semigroups, and they could **nest** as deep as we need! You can also extend this idea to any fixed groups of elements:

```javascript
const Tuple3 = daggy.tagged(
  'Tuple3', ['a', 'b', 'c']
)

const Tuple4 = daggy.tagged(
  'Tuple4', ['a', 'b', 'c', 'd']
)

// Tuple5, Tuple6, etc...
// Is `concat` obvious for these?
```

I'm pretty sure you can work out how the `Tuple`'s `concat` method can be rewritten for _any number of fields_! Anyway, let's not waste time writing `concat` for `Tuple20`. Instead, let's talk about a _practical_ application of this idea: **customer record merging**.

I'm sure they're the three words you wanted to hear! Let's imagine you're building some system in which you store customer records that look like this:

```javascript
const Customer = daggy.tagged('Customer', [
  'name',             // String
  'favouriteThings',  // [String]
  'registrationDate', // Int -- since epoch
  'hasMadePurchase'   // Bool
])
```

For whatever reason - I worked with [the NHS](http://www.nhs.uk/pages/home.aspx), and reasons were _bountiful_) - you might end up with duplicate records for the same person. In this instance, you'd want to write a `concat` function to make use of our shiny new `Semigroup` machinery:

```javascript
Customer.prototype.concat =
  function (that) {
    return Customer(
      this.name,

      // A `Set` type would be good here.
      this.favouriteThings
        .concat(that.favouriteThings),

      Math.min(
        this.registrationDate,
        that.registrationDate
      ),

      this.hasMadePurchase
        || that.hasMadePurchase
    )
  }
```

Well, it _is_ a semigroup, but... it's pretty **ugly**, right? Firstly, we're tied to **one** particular merge strategy. Secondly, all these properties' strategies look... _familiar_...

What we'd _really_ like to do is define independent merge strategies, probably using semigroups, to which we can delegate the work. _That way_, we could even have several **different strategies** for merging, depending on the situation!

To do that, we'll need to translate `Customer` into some structure that can hold the same information (or, in fancy terms, _something **isomorphic** to our `Customer` structure_).

We've actually already defined one such structure: the `Tuple4`! We're holding exactly four values, so we can translate to and from this structure without trouble. Our "merge strategy" is therefore just a way of converting our `Customer` object to and from a `Tuple4` of `Semigroup` types:

```javascript
const myStrategy = {
  // to :: Customer
  //    -> Tuple4 (First String)
  //              [String]
  //              (Min Int)
  //              (Any Bool)
  to: customer => Tuple4(
    First(customer.name),

    // Arrays are semigroups already!
    // We could use Set, though.
    customer.favouriteThings,

    Min(customer.registrationDate),

    Any(customer.hasMadePurchase)
  ),

  // from :: Tuple4 (First String)
  //                [String]
  //                (Min Int)
  //                (Any Bool)
  //      -> Customer
  from: ({ a, b, c, d }) =>
    Customer(a.val, b, c.val, d.val)
}
```

Our `to` field converts a `Customer` into a `Tuple4` (with the properties wrapped in `Semigroup` types), and our `from` field converts back. The **type** of the intermediate structure might look a bit frightening, but...

_Who cares_? The important thing is that **it's a semigroup**, and, if we have a semigroup, we can write a _gorgeous_ function for merging values:

```javascript
// merge :: Semigroup m
//       => { to   :: a -> m
//          , from :: m -> a }
//       -> a -> a -> a
const merge = strategy => (x, y) =>
  strategy.from(
    strategy.to(x)
      .concat(strategy.to(y))
  )
```

Look at that signature. Given any two values of a type (not necessarily a `Semigroup` type!), if we can give a strategy (isomorphism!) for converting them to and from a given Semigroup, we can merge them!

What if we want to merge **more than two** customers? Well, instead of writing hundreds of functions, let's just do a `reduce` on a list to merge them into a given _starter customer_:

```javascript
const mergeMany = strategy => initial =>
  customers => customers.reduce(
    merge(strategy), initial
  )
```

Gets me all flustered, it does. We can actually make this _even prettier_ with a little more structure that we'll discuss in the next article on **monoids**, but I think this is a good enough example for now.

After all, we've taken our problem, separated our concerns, and produced some abstract functions that we could apply to _other_ types - not just `Customer`! - regardless of how complex they might be. **It's semigroups all the way down**.

---

We've seen that semigroups have our back any time we want to _merge_, _mooshmash_, or _combine_ (whatever word gives you the best **intuition**!) several data into one. We've also seen how flexible they can be - everything from `First` to `Pair` was a law-obiding `Semigroup` type.

Yet, just as we'll see with all the other Fantasy Land magic, the interface is _exactly_ what we needed to create some really powerful functions. If you're not convinced, [here's a Gist of the above example](https://gist.github.com/richdouglasevans/e89b1798820ada6480b6f439d5aca5f2) to play with.

Next time, we'll look at a very common extension to the idea of semigroups. If you can't wait until then, I actually wrote [a blog post on monoids](/2016/11/03/monoid-est-tonoid/) a while back that should help you get a feel before next week.

Finally, another **thank you** to everyone following along. The feedback has been _great_, and I've had plenty of questions. Please please _please_ send any my way, via [my Twitter](http://twitter.com/am_i_tom) or [my GitHub](http://github.com/i-am-tom), and I'll do what I can to help out.

Keep mooshmashing, and take care &hearts;

---

_* I've given [a lightning talk on monoids](https://www.youtube.com/watch?v=Sn8uTpySGWA) in the past, but it's a PHP talk by a younger Tom, so it's all a bit painful to watch, I'm afraid!_

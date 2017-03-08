---
layout: post
title: "Fantas, Eel, and Specification 1: Daggy"
description: The first post in a series on the JavaScript Fantasy Land specification.
---

Hello again, the Internet! As a functional programming zealot* and JavaScript developer<sup>†</sup>, I spend a **lot** of my time raving about their crossover. In this series, we'll look at the [Fantasy Land](https://github.com/fantasyland/fantasy-land) spec in its entirety, and go through examples of how we can use the typeclasses within it. However, before we go any further, we need to talk about [`daggy`](https://github.com/fantasyland/daggy).

Daggy is a _tiny_ library for creating **sum types** for functional programs. Don't worry about what that means too much for now, and focus on the two functions that the library exports: `tagged` and `taggedSum`.

## `daggy.tagged(... fields)`

This is a very simple method for creating types with one constructor. In other words, think of it as a way to store your very rigid (probably model) data:

```javascript
//- A coordinate in 3D space.
//+ Coord :: (Int, Int, Int) -> Coord
const Coord = daggy.tagged('x', 'y', 'z')

//- A line between two coordinates.
//+ Line :: (Coord, Coord) -> Line
const Line = daggy.tagged('from', 'to')
```

The resulting structures are pretty intuitive:

```javascript
// We can add methods...
Coord.prototype.translate =
  function (x, y, z) {
    // Named properties!
    return Coord(
      this.x + x,
      this.y + y,
      this.z + z
    )
  }

// Auto-fills the named properties
const origin = Coord(0, 0, 0)

const myLine = Line(
  origin,
  origin.translate(2, 4, 6)
)
```

This is nothing scary if you've used the JavaScript object system before: all the `tagged` function really does is give us a function to fill the given named properties on an object. **That's it**. A tiny little utility for creating constructors with named properties.

## `daggy.taggedSum(constructors)`

Now for the interesting one. Think about the boolean type: it has two values, `True` and `False`. In order to represent a structure like `Bool`, we need to make a type with multiple constructors (what we call a **sum type**):

```javascript
const Bool = daggy.taggedSum({
  True: [], False: []
})
```

We call the different forms of our type its **type constructors**: in this case, they're `True` and `False`, and neither has any arguments. How about we take our code from the `tagged` example and build up a more complicated type?

```javascript
const Shape = daggy.taggedSum({
  // Square :: (Coord, Coord) -> Shape
  Square: ['topleft', 'bottomright'],

  // Circle :: (Coord, Number) -> Shape
  Circle: ['centre', 'radius']
})
```

Unlike the boolean values, our constructors here have values. They take _different_ values depending on which constructor we use, but we know that `Square` and `Circle` are definitely both constructors of the `Shape` type. How does this help us?

```javascript
Shape.prototype.translate =
  function (x, y, z) {
    return this.cata({
      Square: (topleft, bottomright) =>
        Shape.Square(
          topleft.translate(x, y, z),
          bottomright.translate(x, y, z)
        ),

      Circle: (centre, radius) =>
        Shape.Circle(
          centre.translate(x, y, z),
          radius
        )
    })
  }

Square(Coord(2, 2, 0), Coord(3, 3, 0))
.translate(3, 3, 3)
// Square(Coord(5, 5, 3), Coord(6, 6, 3))

Circle(Coord(1, 2, 3), 8)
.translate(6, 5, 4)
// Circle(Coord(7, 7, 7), 8)
```

Just as before, we are attaching methods to the `Shape` prototype. However, `Shape` isn't a _constructor_, it's a _type_: `Shape.Square` and `Shape.Circle` are the constructors.

This means that, when we write a method, we have to write something that will work for _all_ forms of the `Shape` type, and `this.cata` is Daggy's killer feature. _By the way, `cata` is short for [catamorphism](/2017/02/24/reductio-and-abstract-em/)!_

All we do is pass a `{ constructor: handler }` object to the `cata` function, and the appropriate one will be called when the method is invoked. As we can see above, we now have a `translate` method that will work for both types of `Shape`!

We could even attach methods to our `Bool` type:

```javascript
const { True, False } = Bool

// Flip the value of the Boolean.
Bool.prototype.invert = function () {
  return this.cata({
    False: () => True,
    True: () => False
  })
}

// Shorthand for Bool.prototype.cata?
Bool.prototype.thenElse =
  function (then, or) {
    return this.cata({
      True: then,
      False: or
    })
  }
```

As you can see, for constructors with no arguments, we use handlers with no arguments. Note, too, that different constructors of the same sum type can have **completely different numbers and types of arguments**. This will be _really_ important when we come to examples of the Fantasy Land structures.

This is all there is to `taggedSum`: it lets us build **types with multiple constructors**, and conveniently write methods for them.

## `List` but not least...

As a final example of `taggedSum` (because I _hope_ `tagged` is nice and straightforward), here's a linked list and a couple of useful functions:

```javascript
const List = daggy.taggedSum({
  Cons: ['head', 'tail'], Nil: []
})

List.prototype.map = function (f) {
  return this.cata({
    Cons: (head, tail) => List.Cons(
      f(head), tail.map(f)
    ),

    Nil: () => List.Nil
  })
}

// A "static" method for convenience.
List.from = function (xs) {
  return xs.reduceRight(
    (acc, x) => List.Cons(x, acc),
    List.Nil
  )
}

// And a conversion back for convenience!
List.prototype.toArray = function () {
  return this.cata({
    Cons: (x, acc) => [
      x, ... acc.toArray()
    ],

    Nil: () => []
  })
}

// [3, 4, 5]
console.log(
  List.from([1, 2, 3])
  .map(x => x + 2)
  .toArray())
```

Sure enough, we can build a list with two constructors, `Cons` and `Nil` (as we did with `[x, ... xs]` and `[]` in [my last post](/2017/02/24/reductio-and-abstract-em/)), and every list object will have a corresponding array object<sup>‡</sup>. For example, `[1, 2, 3]` becomes `Cons(1, Cons(2, Cons(3, Nil)))`, so it's pretty obvious to see how _any_ list can be translated!

---

That's _everything_ you need to know about `daggy` to understand Fantasy Land! If you want to cement your understanding, why not try to add a couple more array functions to the `List` type like `filter` or `reduce`?

Otherwise, we have one more thing to talk about before we get involved in the structures: [type signatures](/2017/03/08/fantas-eel-and-specification-2/)!

Until then, take care! &hearts;

---

_* My (verbatim) introduction by [Dan](https://twitter.com/MrDanack) to members of the PHP core team._

_<sup>†</sup> Even if only by a technicality._

_<sup>‡</sup> We call this an **isomorphism**!_

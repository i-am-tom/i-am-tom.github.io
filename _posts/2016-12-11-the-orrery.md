---
layout: post
title: The Orrery
description: A little solar system visualisation with Elm.

custom_css: /gallery/elm-orrery/style.css
custom_js: /gallery/elm-orrery/script.js
---

Hello! Sorry for taking so long to write another post. I've been really quite busy looking for a new place to live and a new office to work in, you see.

Anyway, instead of adding _another_ post in my introductory theme, I thought I'd show you how this **Orrery** works! It's written in Elm, which isn't supported by GitHub's highlighter _yet_, so I've modified it a little (_my excuse for why the code blocks look a bit naff_).

<div id="orrery"></div>
<script>
  Elm.Main.embed(
    document
      .getElementById(
        'orrery'
      )
  )
</script>

Anyway, I hope it's useful to someone - we'll talk about Elm's successes and my failings, and everything should hopefully be clear enough. If anything doesn't make sense, though, feel free to [send me a Tweet](http://www.twitter.com/am_i_tom) and I'll do my best to clarify!

## Preamble

```haskell
module Main exposing (..)

import AnimationFrame
import Html
import Http
import Json.Decode as Decode
import Svg
import Svg.Attributes exposing (..)
import Time exposing (inMinutes, Time)
```

This project uses a few dependencies. To anyone who's written any amount of Elm before, the only stranger is `AnimationFrame`, from the `elm-lang/animation-frame` package. This lets us subscribe to the browser's RAF API. Everything else should be fairly obvious: `Html` / `Svg` for our view, `Http` / `Json.Decode` for the AJAX request, and `Time` for our orbit.

```haskell
main =
    Html.program
        { init          = init
        , subscriptions = \_ -> AnimationFrame.times Tick
        , update        = update
        , view          = view
        }
```

We can't use the `beginnerProgram` because of the need for both subscriptions _and_ commands, so we opt for the next easiest thing. _Perhaps_ against convention, I tend to put one-line declarations (e.g. `subscriptions`) directly in the `Html.program` call - it looks prettier to me... _Sorry, Evan!_

## The Model

```haskell
type alias System =
    { colour : String
    , orbit  : Float
    , radius : Float
    , speed  : Float
    , moons  : Moons
    }
```

The model for this visualisation is **recursive**: a system is a body and its _moons_, all of which are systems themselves. However, this means we have an **infinitely-nesting** type, so we have to use sidestep this with a new `type Moons` to get a solid alias.

```haskell
type Moons
    = Moons (List System)
```

Of course, aside from a little extra destructuring, this doesn't change the capability of the type _at all_.

```haskell
type alias Model =
    { time   : Time
    , system : Maybe System
    }
```

The model is then just the current `Time` (from our subscription) and _maybe_ a `System`. If the AJAX response hasn't come back yet, or an error occurred during the lifecycle, our `System` is `Nothing`, and we can show something other than an empty sky.

```haskell
init =
    ( { time = 0, system = Nothing }
    , Http.send Register
        << Http.get "./test.json"
        <| planetify
    )
```

The initial command is the AJAX request: when this completes, the model will hold the returned JSON **or lack thereof**. I think this whole `Cmd` approach is really neat: our IO actions end up handled in _exactly_ the same way as our user interactions.

## JSON

```haskell
planetify : Decode.Decoder System
planetify =
    Decode.map5 System
        (Decode.field "colour" Decode.string)
        (Decode.field "orbit"  Decode.float )
        (Decode.field "radius" Decode.float )
        (Decode.field "speed"  Decode.float )
        (Decode.field "moons" << Decode.map Moons
                              << Decode.lazy
                              <| \_ -> Decode.list planetify)
```

When we get the AJAX response, we need to map it into a **data type**: in our case, the `System` type. In Elm, we do this with a `Json.Decoder`. Here, we use a decoder that can recursively deconstruct the JSON to match our type. It also validates our JSON response at the same time!

We need to use the `Decode.map` and `Decode.lazy` functions to avoid that pesky infinite type: the `Moons` type will be populated by a second map that occurs _lazily_.

## Update

```haskell
type Msg
    = Tick Time
    | Register (Result Http.Error System)
```

There are really only two things that happen in this visualisation: the `Time` updates (for the next animation frame), and the AJAX response _correctly or otherwise_.

```haskell
update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Tick time ->
            ( { model | time = time }, Cmd.none )

        Register result ->
            ( { model | system = Result.toMaybe result }
            , Cmd.none
            )
```

Consequently, the handlers for these two cases are _very_ simple. Any `Time` update simply updates the model, and any server `Result` is recorded. As mentioned before, I have converted the `Result` to `Maybe` so I can encode _the response has not yet been received_ in the same way as _the request failed_ and _the response is invalid_. Don't be fooled: this is pure laziness on my part.

## View Ordering

```haskell
type alias Coordinate =
    ( Float, Float )
```

A coordinate is represented as `( x, y )`. If I weren't going for brevity, some operations would be helpful (e.g. `add`).

```haskell
type Renderable
    = Orbit
        { x      : Float
        , y      : Float
        , radius : Float
        }

    | Planet
        { x      : Float
        , y      : Float
        , radius : Float
        , colour : String
        }
```

In the first iteration of this code, there was no ordering on the `Svg` elements. This looked odd when satellites didn't go _behind_ a parent body (e.g. when the moon's orbit is at the "back" of the diagram), so I picked a configuration where this didn't happen. A few weeks later, however, I felt ashamed of myself, and fixed it.

So, now, we generate inspectable (thus easily orderable) records, and convert them to `SVG` later on. I think this turns out quite neatly, though it's perhaps the result of staring for too long at `Free` structures and interpreters.

```haskell
ordering : Renderable -> Float
ordering object =
    case object of
        Planet { y } -> y
        _            -> negate 1 / 0
```

For now, we just put `Orbit` rings right at the back. This looks a bit odd at times, and I think a better solution would be to split up the `ellipse` into several arcs, (to order around other `Svg`s), but that's one for another time.

---

Converting a `Renderable` to an `Svg` is very straightforward, as all the required information is stored within the `Renderable` type already. An easy modification to this app would be to allow user-defined _camera tilt_ (i.e. configurable `skew`), and it could simply be passed in as a parameter here.

It's perhaps worth pointing out that my `<<` and `<|` usage is a direct mapping from Haskell's `.` and `$`. The `<<` could quite easily be replaced with another `<|` of course, but it's just not the way I'm used to doing things! _Old dogs, new tricks..._

```haskell
renderables : Coordinate -> Time -> System -> List Renderable
renderables ( cx, cy ) time { orbit, colour, radius, speed, moons } =
    let
        ( cx_, cy_ ) =
            fromPolar (orbit, speed * inMinutes time)
                |> \( x, y ) -> ( cx + x, cy + 0.4 * y )

        ring =
            Orbit { x      = cx
                  , y      = cy
                  , radius = orbit
                  }

        planet =
            Planet { x      = cx_
                   , y      = cy_
                   , radius = radius
                   , colour = colour
                   }

        subrenderer =
            renderables ( cx_, cy_ ) time

        children =
            case moons of
                Moons ms ->
                    List.concatMap subrenderer ms
    in
        ring :: planet :: children
```

## View Construction

```haskell
toSvg : Renderable -> Svg.Svg Msg
toSvg renderable =
    case renderable of
        Orbit { x, y, radius } ->
            Svg.ellipse [ cx <| toString x
                        , cy <| toString y
                        , rx <| toString radius
                        , ry << toString <| 0.4 * radius
                        ] []

        Planet { x, y, radius, colour } ->
            Svg.circle [ cx    <| toString x
                       , cy    <| toString y
                       , r     <| toString radius
                       , style <| "fill:" ++ colour
                       ] []
```

See where those `Coordinate` functions would be useful?

I'll say now that **I don't like this function**: there's a pretty obvious optimisation to be made here. What I would _really_ like is a type of `Coordinate -> System -> List (Time -> Renderable)`, or even a result like `Time -> List Renderable`: in other words, we'd end up with a list of bodies positioned with respect to each _recursive_ orbit via _composed_ functions.

I haven't looked enough into Elm's compiler to know for certain, but I would imagine that this could be compiled efficiently if we ended up with `let .. in \time ->` as our general form. As `time` is the only important variable here, we could pre-build all this at the time of JSON receipt, and cut down on the calculations needed at run-time. It's just a thought, really.

For small-ish `System` cases, this works fine, but I'm not really a huge fan of the _good enough_ mentality, and I'm **certain** this function has room for improvement. It certainly shouldn't need to know the `skew` value to build view-independent coordinates.

```haskell
view : Model -> Html.Html Msg
view { time, system } =
    let
        container =
            Svg.svg [ viewBox "0 0 600 240"
                    , width "600px"
                    ]
    in
        case system of
            Nothing ->
                Html.div [] [ Html.text "What a quiet night..." ]

            Just data ->
                container << List.map toSvg
                          << List.sortBy ordering
                          << renderables ( 300.0, 120.0 ) time
                          <| data
```

Finally, we have the **view** function: the entry point for all the rendering process. This is nice and easy to understand, I hope: we can display some cursory error to the user for when AJAX fails, and otherwise kick off the animation.

Of course, I'd love to get `skew` into the `Model` so that it can be configured (and then passed to the rest of the view logic at render-time). Ooer.

That gets us to the end of the file! **All** the code for the top visualisation (that isn't just imported library code) is here: it really is that simple. If you want to see it more clearly, there is [a Gist of all the code](https://gist.github.com/i-am-tom/229afcf287bf870ac76b5a909cdcfb81) to be found here.

_Elm is wonderful. Try it._

Take care &hearts;

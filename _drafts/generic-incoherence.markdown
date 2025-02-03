---
title: Profundamente Incoherente y Genérico
---

_Puedes ver el código de este artículo en el [gist][gist], que implementa todas
las siguientes técnicas._

La biblioteca [`higgledy`][higgledy] originalmente era un proyecto internal
para un trabajo anterior. La empresa vendió las hipotecas, y puedes imaginar
que hay un montón de burocracia. Los usarios pasan la mayoría de su tiempo en
el sitio web rellenando un gran formulario que requiere tanta información
personal y financial. Por eso, desarrollamos todo para apoyar que un usario
necesite varios días sin ningún orden específico mientras coger la información
relevante.

Por esto, aunque al final podremos poblar un tipo para representar una
solicitud de hipoteca, tenemos que gestionar muchos datos parciales hasta
entonces. Averiguar una solución era el pasatiempo favorita del equipo de
inginería, y nosotros pasamos tantas horas en varias ideas, que resultó en
muchos proyectos interesantes[^bag].

## Tipos de Especie Superior

Una opción posible sería usar tipos de especie superior (_higher-kinded data_,
o _HKD_), una idea que descubrí originalmente en [un artículo de Sandy
Maguire][reasonably-polymorphic]. En breve, asociamos un tipo de un constructor
de tipo, y envolver cada argumento con este constructor:

```haskell
type UserF :: (Type -> Type) -> Type
data UserF f
  = User
      { name      :: f String
      , age       :: f Int
      , likesDogs :: f Bool
      }

type PartialUser :: Type
type PartialUser = UserF Maybe

type UserValidation :: Type
type UserValidation = UserF (Either String)

type User :: Type
type User = UserF Identity
```

Podemos cambiar el tipo `f` para obtener muchas variaciones interesantes del
mismo tipo. La biblioteca de [`barbies`][barbies], desarrollado de otro colega
de la misma empresa, proporciona muchas herramientas utiles para manipular los
HKDs:

```haskell
-- Imprime cada error en la pantalla.
reportErrors :: UserValidation -> IO ()
reportErrors = bfoldMap (either putStrLn mempty)

-- Se convierte `UserF (Either String)` a `UserF Maybe`.
ignoreErrors :: UserValidation -> PartialUser
ignoreErrors = bmap (either (const Nothing) Just)
```

El tema más interesante para mi es la idea de HKDs anidadas:

```haskell
type ApplicationF :: (Type -> Type) -> Type
data ApplicationF f
  = ApplicationF
      { userDetails  :: UserF f
      , workHistory  :: WorkF f
      , isRemortgage :: f Bool
      }
```

La magia de los HKDs y `barbies` es que podemos anidar sin problema: aún
podemos usar todas las clases de `barbies` y tener parcialidad cuando queramos
través del tipo.

## HKDs Genéricos

Este método sirve bastante bien, pero los tipos son incómodos, especialmente
cuando `f` es `Identity`: en este caso, quiero ignorar la construcción y
centrarme en el contenido. Además, las derivaciones de las instancias comunes
(`Eq`, `Ord`, y `Show`) son mucho más dificiles (porque `f` determinará la
implementación) y no se pueden estar derivadas automáticamente. Hay varias
estrátegias para resolver estes problemas, pero la mía es la que al final se
convertió en `higgledy`: por qué no defino el tipo sin mención de `f`, y luego
usar otro tipo para inyectarlo?


```haskell
type User :: Type
data User
  = User
      { name      :: String
      , age       :: Int
      , likesDogs :: Bool
      }
  deriving (Generic, Show)

type PartialUser :: Type
type PartialUser = HKD User Maybe
```

[`HKD`][hkd-type] contiene una versión modificada de la representación
`Generic` del tipo, en la que todas las hojas son envolvidas con el `f`. Luego,
usamos bibliotecas como [`generic-lens`][generic-lens] para proporcionar una
API para que podamos accessar y modificar estas hojas. Hoy en día, podríamos
usar extensiones como `OverloadedRecordUpdate` y la estructura internal de
`HKD` sería invisible.

## El problema

Si estás pensando en la anidación que he mencionado antes, y como funciona con
`HKD`, has encontrado el gran problema con esta idea: `higgledy` determina la
forma genérica automáticamente, así que no podemos contarle cuales hojas
deberían ser `HKD` o no. Si incluyéramos las limitaciones de la biblioteca,
haría dos condiciones con las que quería determinar que una hoja debería ser un
`HKD`:

* Tiene una representación `Generic`, que `higgledy` necesita para construir la
  representación internal.

* Tiene un tipo que si queremos un `HKD` anido. `String` es un buen ejemplo de
  un tipo `Generic` que probablemente no queremos que sea un `HKD`. Por eso,
  necesitamos la capacidad decir los que queremos ignorar.

[Generic deriving of generic traversals][csongor-paper] es un artículo
increíble por varias razones que explicaré en artículos siguientes, pero un
concepto importante cuando lo leía fue el concepto de "tipos interesantes":
cuando creamos o recorremos un tipo `Generic`, tenemos una lista de tipos que
consideramos las "hojas" y en los que no vamos a recorrer más. Vamos a
justificar este artículo diciendo que esta lista crecería rapidamente: tipos de
la moneda, rangos de números, y identificadores válidos son unas de las clases
de tipos que necesitarían llevar en este caso.

Luego tuve una idea: por qué no recorremos todos los tipos _a menos que_
existen en una lista de "tipos aburridos"? Esperamos que esta lista crezca más
lentamente porque la mayoria de estes tipos (por ejemplo la moneda, rangos) no
hacen falta las instancias `Generic`, pero aún así, los pocos que necesitan una
instancia se puede añadir a la lista y los vamos a ignorar. Suena bien, pero
tenemos un problema inmediato: cómo vamos a saber si un tipo es una instancia
de `Generic`?

## Estamos atascados

Detectar si un tipo es `Generic` debería ser imposible. No deberíamos poder
escribir una función cuya ejecución cambia depende de la existencia de esta
instancia, y una solución siempre se ha necesitado una extensión (como
[`constraints-emerge`][constraints-emerge], por ejemplo). Sin embargo, gracias
al milagro de incoherencia, [Adam Gundry][adam-gundry] descubrió cómo [detectar
instancias de `Generic`][generic-discrimination] sin extensiones, con unos
trucos raros.

Podemos pensar en las familias de los tipos como funciones entre los tipos,
pero hay unas diferencias importantes. Lo mas relevante para nosotros es que
las familias de los tipos no tienen que ser total: no tenemos que escribir
ecuaciones para todos las entradas posibles[^closed-kinds]. Claro, deberíamos
pensar en lo que pasaría cuando usamos una entrada para la que la familia no
tiene una ecuación. Por ejemplo, `GHC.Generics.Rep` es una familia que se
asigna una representación genérica a un tipo:

```
ghci> :k! Rep Bool
Rep Bool :: * -> *
= M1
    D
    (MetaData "Bool" "GHC.Types" "ghc-prim" False)
    (M1 C (MetaCons "False" PrefixI False) U1
     :+: M1 C (MetaCons "True" PrefixI False) U1)
```

Aplicamos la función `Rep` al valor `Bool` y tenemos la representación genérica
de `Bool`. En cambio, cuando aplicamos `Rep` a `Int` - un tipo que no tiene una
representación genérica - la respuesta no parece muy útil:

```
ghci> :k! Rep Int
Rep Int :: * -> *
= Rep Int
```

GHC no tiene ni idea como se asigna una representacíon a `Int`, y por eso nos
da su entrada. Describimos esta situación como "atascada" (_stuck_ en inglés):
GHC no nos puede ofrecer nada más útil. Podemos aplicar otras funciones a
valores atascados para crear valores atascados más grandes, pero hasta que
sepamos una respuesta a `Rep Int`, estamos... bueno, atascados.

Tenemos un tema difícil: no podemos interrogar un valor atascado sin crear un
nuevo valor atascado. En realidad, [debería ser imposible detectar si un valor
está atascado][stuck-errors]: intentamos hacer una decisión con un valor
atascado, y ya tenemos una decisión atascada... pero queda una opción.

Podemos resolver la cabeza de una instancia con un valor atascado:

```haskell
type IsGeneric :: (Type -> Type) -> Constraint
class IsGeneric rep where isGeneric :: Bool

instance IsGeneric (M1 D m x) where
  isGeneric = True

instance {-# INCOHERENT #-} IsGeneric x where
  isGeneric = False

ghci> isGeneric @(Rep Bool) -- True
ghci> isGeneric @(Rep Int) -- False
```

Para entender lo que está pasando aquí, tenemos que saber el proceso internal
de GHC: cuando tenemos dos instancias validas, y una de las dos es
`INCOHERENT`, GHC automáticamente elige el otro. En otras palabras, solamente
eligimos una instancia `INCOHERENT` cuando no hay otra opción disponible. 

Cuando aplicamos `IsGeneric` al valor `Rep Bool`, GHC puede calcular que `Rep
Bool` es `M1 D (MetaData ...) ...`, que coincide con las dos instancias. Sin
embargo, una instancia es `INCOHERENT` así que usamos la otra, y `isGeneric` es
verdad entonces.

No obstante, cuando aplicamos `IsGeneric` a `Rep Int`, tenemos un valor
atascado. En este caso, no tenemos ni idea si el resultado coincidiría con `M1
D m x`, y resulta que solo tenemos una instancia: la instancia en la que
`isGeneric` es falso. La combinación terrible de los valores atascados y las
instances incoherentes nos da un método muy feo para diferenciar entre los
tipos `Generic` y los otros.

## Tipos atascados como entradas

Ahora puede que podemos determinar si un tipo es `Generic`, pero aún no hemos
resuelto el problema: necesitamos decir que, si el tipo es `Generic`, debería
envuelto en `HKD`, sino en `f`. Cuando tengo un problema así, inmediatemente
pienso en las dependencias funcionales[^associated-type-family]:

```haskell
type Leaf :: (Type -> Type) -> (Type -> Type) -> Type -> Constraint
class Leaf f rep leaf output | f rep leaf -> output

instance Leaf f (M1 D m x) l (HKD l f)
instance {-# INCOHERENT #-} Leaf f x l (f l)
```

Sería perfecto, pero no lo podemos hacer: GHC no puede saber que los tipos
entrados determinan los salidos. Se podrían ser determinados, pero GHC no sabe
como se determinan, y en lugar de intentar, se queja que tenemos instancias
superpuestas, y por eso no podemos declarar esta dependencia.
Desafortunadamente, parece que las dos ideas no funcionarán, y tendremos que
malusar el compilador una vez más.

Hace casi diez años, Chris Done publicó un artículo de un [truco para
escribiendo instancias][constraint-trick], y después de unos años, yo lo
entendí. No podré explicar el truco dentro de un párrafo, entonces asumiré que
has lo leído y saltaré hasta la conclusión: cuando estamos eligiendo una
instancia, no se pueden unificar ningunos tipos, pero las restricciones de la
instancia elegida si pueden. En otras palabras:

```haskell
type C :: Type -> Type -> Constraint
class C x y where f :: x -> y

instance C () () where f = id
instance x ~ Bool => C Bool x where f = id
```

```
ghci> :t f ()
f () :: C () y => y

ghci> :t f True
f True :: Bool
```

`C () ()` es una instancia que elegimos solamente cuando _sabemos_ que los dos
tipos son `()`. Por eso, el tipo do `f ()` no es necesariamente `()` - quizás
hay otras instancias más tarde? - así que tenemos que especificar el tipo do
`y` para eligir esta instancia, y no nos ayuda entonces.

Por otra parte, `C Bool x` es una instancia que elegimos tan pronto como
sepamos que el primer tipo es `Bool`, independientemente del segundo. Por lo
tanto, cuando escribimos `f True`, GHC siempre puede eligir esta instancia.
Cuando ha elegido la instancia, tenemos una restricción nueva: `x ~ Bool`. GHC
resuelve esta restricción, y aprende que `f True` tenga tipo `Bool`, y por
consiguiente no tenemos la misma ambiguidad.

Lo que nos interesa es que, aunque C no tiene una dependencia `x -> y`, `ghci`
nos dice que el tipo ya es determinado! Con el mismo truco, podemos escribir
codigo cuyo tipo cambia depende de la presencia de una instancia de `Generic`
siempre que el tipo del salido es determinado por las restricciones, en lugar
de la cabeza de la instancia:

```haskell
type IsGeneric :: (Type -> Type) -> Type -> Constraint
class IsGeneric rep x where problem :: x

instance o ~ () => IsGeneric (f x) o where
  problem = ()

instance {-# INCOHERENT #-} (o ~ String, Typeable x)
    => IsGeneric x o where
  problem = show (typeRep @x) ++ " no tiene una representación generica!"

examples :: IO ()
examples = do
  print (problem @(Rep Bool)) -- ()
  print (problem @(Rep Int)) -- "Int no tiene una representación genérica!"
```

## Para volver

Con nuestros nuevos trucos, podemos volver al problema de `higgledy`. La
mayoria del código no es tan interesante: atraversamos la representación
genérica del tipo, y cuando encontramos las hojas, usamos los trucos para
decidir si debería ser envuelto con `f` o convertido a un `HKD` también. Dado
que no estamos permitidos usar familias de los tipos, el tipo de `HKD` tiene
que complicarse un poquito:

```haskell
type HKD :: Type -> (Type -> Type) -> Type
data HKD x f where
  HKD :: forall o x f. GHKD (Rep x) f o => o Void -> HKD x f
```

_He omitido las referencias a "los tipos interesantes" para dejar claro, pero
puedes consultar con el gist si quieres un ejemplo._

Ahora, una restricción determina la representación internal de `HKD`, y
quieremos que ese tipo este escondido, así tenemos que llevar un diccionario de
`GHKD` _dentro_ del tipo. Al final, necesitamos que `HKD` es compatible con las
otras bibliotecas (`barbies`, `generic-lens`, etc), y por eso... tendremos que
trabajar con un `HKD` genericalmente.

## Deriving `Generic` for undetermined types

El problema inmediatamente es que `Generic` es una clase con una familia de los
tipos (`Rep`), y como hemos dicho muchas veces antes, no podemos hacer nada con
esas familias. Por lo que yo sé, no hay nada que podemos hacer para negar esta
limitación. No obstante, podríamos evitar el problema con un nuevo truco:

```haskell
type RepWrapper :: (Type -> Type) -> Type
newtype RepWrapper o = RepWrapper { unRepWrap :: o Void }

instance (Contravariant o, Functor o)
    => Generic (RepWrapper o) where
  type Rep (RepWrapper o) = o

  from (RepWrapper o) = phantom o
  to = RepWrapper . phantom
```

Esto no es un tipo interesante: contiene una representación genérica, y _su_
representación genérica es lo que esta llevando; en efecto, es un `newtype`
transparente. Pero con este tipo, podemos resolver todos nuestros otros
problemas con `Generic` convertiendo nuestro `HKD` en el tipo de `Wrapped`:

```haskell
repWrapper :: forall xs p x f. GHKD xs (Rep x) f p => Iso' (RepWrapper p) (HKD xs x f)
repWrapper = L.iso (HKD . unRepWrap) \(HKD x) ->
  RepWrapper (unsafeCoerce @(_ Void) @(p Void) x)

type HasField' t f o s a
    = ( GHKD Uninteresting (Rep s) f o
      , G.HasField' t (RepWrapper o) a
      )

field :: forall t x f i o r. HasField' t f o x r => Lens' (HKD_ x f) r
field = L.from (repWrapper @Uninteresting @o) . G.field' @t
```

Claro, hay un montón de variables, pero esto es gracias a la abstracción. Tan
pronto como sepas el valor de `x`, la situación simplifica mucho, y al final,
tenemos aprovechar la recompensa por nuestras esfuerzas[^unsafe-coerce]:

```haskell
-- Found type wildcard ‘_’ standing for ‘f [Char]’
eg1 :: Applicative f => HKD_ User f -> _
eg1 u = u ^. field @"userName"

-- Found type wildcard ‘_’ standing for ‘HKD_ Pet f’
eg2 :: Applicative f => HKD_ User f -> _
eg2 u = u ^. field @"userPet"
```

Por fin, estamos aquí. Tenemos una versión funcional de `higgledy` que permite
`HKD`s anidadas, mientras apoyando todas las bibliotecas externales que exigen
una instance de `Generic`. Además, tenemos la inferencia de los tipos que hemos
demostrado aquí. Creo que ya estamos!

## Una reseña

Me fui de este trabajo y las colegas increibles que inspieron esta biblioteca.
Estos dias, el insuperable [Jonathan King][jonathan king] cuida el proyecto, y
está mucho más confiable que yo con estas cosas. A pesar de esto,
frecuentemente pienso en esta biblioteca y varias opciones para mejorarla,
entonces he disfrutado de esta investigación mucho.

Ahora, es importante preguntar si vale la pena todo este trabajo. Aún mas
importante es preguntar si los usarios sufrieran por este cambio. Yo diría que
sí: los detalles son tan invisibles fuera de la biblioteca como los de la
implementación actual, y es mucho mas flexible. No hemos hablado mucho de los
tipos aburridos, pero en el [gist][gist] puedes encontrar el `xs` de estos
tipos en todas partes. Seguro que hay una alternativa mas ordenado, pero me
preocupará ese problema en un otro artículo.

En cualquier caso, gracias por leer, y siempre puedes dejarme una pregunta en
[el repositorio][site]. Hasta el próximo!

[^associated-type-family]: Familias asociadas también son una opción, pero
    tienen el mismo problema como las dependencias funcionales.

[^bag]: [`generic-lens`][generic-lens] de Csongor Kiss es probablemente
    lo mas conocido, aunque no es el unico. Sospecho que hablaré de otros en el
    futuro.

[^higgledy-barbies]: Claro, puedes usar `higgledy` con `barbies`, pero hay
    restricciones inmediatemente.

[^fundep-issue]: se puede ver el problema si abres el [gist de este
    artículo][gist] y añades una dependencia funcional para `GSOP` y `SOP`.

[^closed-kinds]: De hecho, es peor todavía, porque no podríamos crear familias
    totales si quisieramos: [no hay especiecs cerrados][closed-kinds].

[^unsafe-coerce]: ¿Por qué no menciono el `unsafeCoerce`? Si `GHKD` tuviera una
    dependencia funcional para determinar la representación de nuestro HKD, los
    dos tipos unificarían. Sin embargo, ya hemos decho que no podemos tener
    esta dependencia, así que necesitamos que GHC confie en nosotros.

[barbies]: https://hackage.haskell.org/package/barbies
[closed-kinds]: https://gist.github.com/ekmett/ac881f3dba3f89ec03f8fdb1d8bf0a40
[constraint-trick]: https://chrisdone.com/posts/haskell-constraint-trick
[constraints-emerge]: https://github.com/isovector/constraints-emerge
[csongor-paper]: https://dl.acm.org/doi/10.1145/3236780
[generic-discrimination]: https://gist.github.com/adamgundry/37e29ca9c8a30e3d94f61b0ee11d67a8
[generic-lens]: https://github.com/kcsongor/generic-lens
[higgledy]: https://github.com/i-am-tom/higgledy
[hkd-type]: https://github.com/i-am-tom/higgledy/blob/8d0d87e63919de3c8be4a45915ae33e2f89f2d0f/src/Data/Generic/HKD/Types.hs#L84
[jonathan king]: https://github.com/jonathanlking
[gist]: https://gist.github.com/i-am-tom/b8c7288f661ca11a8ac7f2012dd63f31
[reasonably-polymorphic]: https://reasonablypolymorphic.com/blog/higher-kinded-data
[site]: https://github.com/i-am-tom/i-am-tom.github.io/issues
[strategic-deriving]: https://www.youtube.com/watch?v=U0j9iIKOj40
[stuck-errors]: https://blog.csongor.co.uk/report-stuck-families/
[adam-gundry]: https://github.com/adamgundry

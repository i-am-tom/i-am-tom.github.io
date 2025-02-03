---
title: Profundamente Incoherente y Genérico
---

*Puedes ver el código de este artículo, que implementa todas las técnicas mencionadas, en el [gist](https://gist.github.com/i-am-tom/b8c7288f661ca11a8ac7f2012dd63f31).*

La biblioteca [`higgledy`](https://github.com/i-am-tom/higgledy) originalmente era un proyecto interno para un trabajo anterior. La empresa vendía hipotecas, y como puedes imaginar, generaba un montón de burocracia. Los usuarios pasaban la mayoría de su tiempo en el sitio web rellenando un gran formulario que requería mucha información personal y financiera. Por eso, desarrollamos todo asumiendo que un usuario necesitaría varios días para completarlo sin ningún orden en particular mientras recopilaba la información relevante.

Aunque al final podremos poblar un tipo para representar una solicitud de hipoteca, tenemos que gestionar muchos datos parciales hasta entonces. Encontrar una solución a este problema era el pasatiempo favorita del equipo de ingeniería, y nosotros dedicamos tantas horas a varias ideas distintas, que resultó en muchos proyectos interesantes[^1].

## Tipos de Especie Superior

Una opción posible sería usar tipos de especie superior (*higher-kinded data*, o *HKD*), una idea que descubrí originalmente en [un artículo de Sandy Maguire](https://reasonablypolymorphic.com/blog/higher-kinded-data). En pocas palabras, indexamos un tipo con un constructor de tipo, y envolvemos cada argumento con este constructor:

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

Podemos cambiar el tipo `f` para obtener muchas variaciones interesantes del mismo tipo. La biblioteca de [`barbies`](https://hackage.haskell.org/package/barbies), desarrollada por otro colega de la misma empresa, proporciona muchas herramientas útiles para manipular los HKDs:

```haskell
-- Imprime cada error en la pantalla.
reportErrors :: UserValidation -> IO ()
reportErrors = bfoldMap (either putStrLn mempty)

-- Convierte `UserF (Either String)` a `UserF Maybe`.
ignoreErrors :: UserValidation -> PartialUser
ignoreErrors = bmap (either (const Nothing) Just)
```

El tema que me resulta más interesante es la idea de HKDs anidadas:

```haskell
type ApplicationF :: (Type -> Type) -> Type
data ApplicationF f
  = ApplicationF
      { userDetails  :: UserF f
      , workHistory  :: WorkF f
      , isRemortgage :: f Bool
      }
```

La magia de los HKDs y `barbies` reside en que podemos anidar sin problema: podemos usar todas las clases de `barbies` y tener parcialidad cuando queramos traversar del tipo.

## HKDs Genéricos

Este método funciona bastante bien, pero los tipos son incómodos, especialmente cuando `f` es `Identity`: en este caso, quiero ignorar la construcción y centrarme en el contenido. Además, las derivaciones de las instancias comunes (`Eq`, `Ord`, y `Show`) son mucho más difíciles (porque `f` determinará la implementación) y no se pueden derivar automáticamente. Hay varias estrategias para resolver estos problemas, pero la mía es la que al final se convirtió en `higgledy`: ¿Por qué no defino el tipo sin mención de `f`, y luego uso otro tipo para inyectar?

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

[`HKD`](https://github.com/i-am-tom/higgledy/blob/8d0d87e63919de3c8be4a45915ae33e2f89f2d0f/src/Data/Generic/HKD/Types.hs#L84) contiene una versión modificada de la representación `Generic` del tipo, en la que todas las hojas son envueltas con el `f`. Luego, usamos bibliotecas como [`generic-lens`](https://github.com/kcsongor/generic-lens) para proporcionar una API con la que podamos acceder y modificar estas hojas. Hoy en día, podríamos usar extensiones como `OverloadedRecordUpdate` y la estructura interna de `HKD` sería invisible.

## El problema

Si estás pensando en la anidación que he mencionado antes, y cómo funciona con `HKD`, has encontrado el principal problema de esta idea: `higgledy` determina la forma genérica automáticamente, así que no podemos definir qué hojas deberían ser `HKD` o no. Si consideramos las limitaciones de la biblioteca, hay dos requisitos para determinar si una hoja debe ser un `HKD`:

* Tiene una representación `Generic`, que `higgledy` necesita para construir la representación interna.  
    
* Tiene un tipo que sí queremos como `HKD` anidado. `String` es un buen ejemplo de un tipo `Generic` que probablemente no queremos que sea un `HKD`. Por eso, necesitamos la capacidad de ignorar estos tipos.

[Generic deriving of generic traversals](https://dl.acm.org/doi/10.1145/3236780) es un artículo increíble por varias razones que explicaré en artículos siguientes, pero un concepto importante que se me ocurrió al leerlo fue el de "tipos interesantes": cuando creamos o recorremos un tipo `Generic`, tenemos una lista de tipos que consideramos las "hojas" y en los que no vamos a recorrer más. Vamos a justificar este artículo diciendo que esta lista crecería rápidamente: tipos de divisa, rangos de números, e identificadores válidos son algunas de las clases de tipos que necesitaríamos añadir a la lista de “tipos interesantes”.

Luego tuve otra idea: ¿Por qué no recorremos *todos* los tipos a excepción de aquellos definidos en una lista de "tipos aburridos"? La premisa es que esta lista crecerá más lentamente ya que la mayoría de estos tipos (por ejemplo divisas, rangos) no necesitan las instancias `Generic`, pero aún así, los pocos que necesitan una instancia se puede añadir a esta lista que vamos a ignorar. Suena bien, pero tenemos un problema inmediato: ¿Cómo vamos a saber si un tipo es una instancia de `Generic`?

## Estamos atascados

Detectar si un tipo es `Generic` debería ser imposible. No deberíamos poder escribir una función cuya ejecución cambie dependiendo de la existencia de una instancia `Generic`, y abordar este problema siempre ha necesitado una extensión (como [`constraints-emerge`](https://github.com/isovector/constraints-emerge), por ejemplo). Sin embargo, gracias al milagro de la incoherencia, [Adam Gundry](https://github.com/adamgundry) descubrió cómo [detectar instancias de `Generic`](https://gist.github.com/adamgundry/37e29ca9c8a30e3d94f61b0ee11d67a8) sin extensiones, usando el lado oscuro de GHC.

Podemos pensar en las familias de los tipos como funciones entre los tipos, pero hay diferencias importantes. Lo más relevante para nosotros es que las familias de los tipos no tienen que ser totales: no tenemos que escribir ecuaciones para todas las entradas posibles[^2]. Obviamente, deberíamos pensar en lo que pasaría cuando usemos una entrada para la que la familia no tiene una ecuación. Por ejemplo, `GHC.Generics.Rep` es una familia que asigna una representación genérica a un tipo:

```
ghci> :k! Rep Bool
Rep Bool :: * -> *
= M1
    D
    (MetaData "Bool" "GHC.Types" "ghc-prim" False)
    (M1 C (MetaCons "False" PrefixI False) U1
     :+: M1 C (MetaCons "True" PrefixI False) U1)
```

Aplicamos la función `Rep` al valor `Bool` y tenemos la representación genérica de `Bool`. En cambio, cuando aplicamos `Rep` a `Int` \- un tipo que no tiene una representación genérica \- la respuesta no parece muy útil:

```
ghci> :k! Rep Int
Rep Int :: * -> *
= Rep Int
```

GHC no tiene ni idea como se asigna una representación a `Int`, y por eso nos da su entrada. Describimos esta situación como "atascada" (*stuck* en inglés): GHC no nos puede ofrecer nada que sea más útil. Podemos aplicar otras funciones a valores atascados para crear valores atascados más grandes, pero hasta que sepamos qué es exactamente `Rep Int`, estamos... bueno, atascados.

Tenemos un dilema: no podemos interrogar un valor atascado sin crear un nuevo valor atascado. En realidad, [debería ser imposible detectar si un valor está atascado](https://blog.csongor.co.uk/report-stuck-families/): si intentamos hacer una decisión con un valor atascado, obtenemos una nueva decisión atascada... pero queda una opción.

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

Para entender lo que está pasando aquí, tenemos que saber el proceso interno de GHC: cuando tenemos dos instancias válidas, y una de las dos es `INCOHERENT`, GHC automáticamente elige la otra. En otras palabras, solamente elegimos una instancia `INCOHERENT` cuando no hay otra opción disponible.

Cuando aplicamos `IsGeneric` al valor `Rep Bool`, GHC puede calcular que `Rep Bool` es `M1 D (MetaData ...) ...`, que coincide con las dos instancias. Sin embargo, una instancia es `INCOHERENT` así que usamos la otra, y `isGeneric` es verdadero.

No obstante, cuando aplicamos `IsGeneric` a `Rep Int`, tenemos un valor atascado. En este caso, no tenemos ni idea de si el resultado coincidirá con `M1 D m x`, y resulta que solo tenemos una instancia: la instancia en la que `isGeneric` es falso. La combinación terrible de los valores atascados y las instancias incoherentes nos da un método muy sucio para diferenciar entre los tipos `Generic` y los que no lo son.

## Tipos atascados como entradas

A pesar de que ahora nos sea posible determinar si un tipo es `Generic`, aún no hemos resuelto el problema: necesitamos poder decir que, si el tipo es `Generic`, debería estar envuelto en `HKD`, y de lo contrario en `f`. Cuando tengo un problema así, inmediatamente pienso en las dependencias funcionales[^3]:

```haskell
type Leaf :: (Type -> Type) -> (Type -> Type) -> Type -> Constraint
class Leaf f rep leaf output | f rep leaf -> output

instance Leaf f (M1 D m x) l (HKD l f)
instance {-# INCOHERENT #-} Leaf f x l (f l)
```

Esto sería perfecto, pero nuestro truco de detección "*genérica*” tiene un punto débil: en lo que concierne a GHC, los tipos de entrada no determinan los de salida. Se podrían determinar, pero GHC no sabe cómo se determinan, y en lugar de intentarlo, se queja de que tenemos instancias superpuestas, y por eso no podemos declarar esta dependencia. Desafortunadamente, parece que ninguna de las dos ideas funcionarán, y tendremos que pasarnos al lado oscuro del compilador una vez más.

Hace casi diez años, Chris Done publicó un artículo sobre un [truco para escribir instancias](https://chrisdone.com/posts/haskell-constraint-trick), y después de unos años, finalmente lo entendí. Como no puedo explicar el truco en un solo párrafo, asumiré que has lo leído y pasaré directamente a la conclusión: cuando estamos eligiendo una instancia, no se pueden unificar tipos, pero sí las restricciones de la instancia elegida. En otras palabras:

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

`C () ()` es una instancia que sólo se aplicará cuando se sepa que los dos tipos son `()`. Por eso, el tipo de `f ()` no es necesariamente `()` \- quizás hay otras instancias más abajo? \- así que tenemos que especificar el tipo de `y` para poder aplicar esta instancia, y por lo tanto no nos ayuda en nada.

Por otra parte, `C Bool x` es una instancia que elegimos tan pronto como sepamos que el primer tipo es `Bool`, independientemente del segundo. Así que al escribir `True`, GHC siempre puede elegir esta instancia. Cuando ha elegido la instancia, tenemos una restricción nueva: `x ~ Bool`. GHC resuelve esta restricción, y aprende que `f True` tenga tipo `Bool`, y por consiguiente no tenemos la misma ambigüedad.

Lo que nos interesa es que, aunque C no tiene una dependencia `x -> y`, ¡`ghci`  nos dice que el tipo ya se ha determinado\!. Usando este mismo truco, podemos escribir código cuyo tipo cambie dependiendo de la presencia de una instancia de `Generic` siempre y cuando el tipo de salida sea determinado por las restricciones, y no por la cabeza de la instancia:

```haskell
type IsGeneric :: (Type -> Type) -> Type -> Constraint
class IsGeneric rep x where problem :: x

instance o ~ () => IsGeneric (f x) o where
  problem = ()

instance {-# INCOHERENT #-} (o ~ String, Typeable x)
    => IsGeneric x o where
  problem = show (typeRep @x) ++ " no tiene una representación genérica!"

examples :: IO ()
examples = do
  print (problem @(Rep Bool)) -- ()
  print (problem @(Rep Int)) -- `Int` no tiene una representación genérica!
```

## Volviendo a nuestro problema

Con nuestros nuevos trucos, podemos volver al problema de `higgledy`. La mayoría del código no es tan interesante: vamos atravesando la representación genérica del tipo, y cuando encontramos las hojas, usamos los trucos para decidir si debería ser envuelto con `f` o convertido a un `HKD` también. Dado que no nos está permitido usar familias de los tipos, el tipo de `HKD` tiene que complicarse un poquito:

```haskell
type HKD :: Type -> (Type -> Type) -> Type
data HKD x f where
  HKD :: forall o x f. GHKD (Rep x) f o => o Void -> HKD x f
```

*He omitido las referencias a "los tipos interesantes" para dejarlo más claro, pero si quieres un ejemplo puedes consultarlo en el gist.*

Ahora bien, una restricción determina la representación interna de `HKD`, y queremos que ese tipo esté escondido, así que tenemos que incluir un diccionario de `GHKD` *dentro* del tipo. Ahora solo queda que `HKD` sea compatible con las otras bibliotecas (`barbies`, `generic-lens`, etc), y por eso... tendremos que trabajar con un `HKD` genéricamente.

## Cómo se deriva `Generic` para tipos indeterminados

El problema inmediato es que `Generic` es una clase con una familia de tipos (`Rep`), y como hemos dicho muchas veces antes, no podemos hacer nada con esas familias. Por lo que yo sé, no hay solución para negar esta limitación. No obstante, el problema es evitable a través de un nuevo truco:

```haskell
type RepWrapper :: (Type -> Type) -> Type
newtype RepWrapper o = RepWrapper { unRepWrap :: o Void }

instance (Contravariant o, Functor o)
    => Generic (RepWrapper o) where
  type Rep (RepWrapper o) = o

  from (RepWrapper o) = phantom o
  to = RepWrapper . phantom
```

Esto no es un tipo interesante: contiene una representación genérica, y *su* representación genérica está definida por lo que está conteniendo. En esencia, parece simplemente un `newtype` transparente, pero con este tipo podemos resolver todos nuestros otros problemas con `Generic`, convirtiendo nuestro `HKD` en el tipo de `Wrapped`:

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

Es cierto que hay un montón de variables, pero esto se debe solo a que estamos tratando con términos abstractos. Tan pronto como sepas el valor de `x`, la situación se simplifica mucho, y finalmente podremos disfrutar de la recompensa a nuestros esfuerzos[^4]:

```haskell
-- Found type wildcard ‘_’ standing for ‘f [Char]’
eg1 :: Applicative f => HKD_ User f -> _
eg1 u = u ^. field @"userName"

-- Found type wildcard ‘_’ standing for ‘HKD_ Pet f’
eg2 :: Applicative f => HKD_ User f -> _
eg2 u = u ^. field @"userPet"
```

Por fin, hemos alcanzado nuestra meta. Tenemos una versión funcional de `higgledy` que permite `HKD`s anidadas y es compatible con todas las bibliotecas externas que exigen una instancia de `Generic`. Además, tenemos la inferencia de los tipos que hemos demostrado aquí. Creo que ya estamos\!

## Una reseña

Ya ha pasado bastante tiempo desde que dejé este trabajo y los increíbles colegas que inspiraron esta biblioteca. Estos días, el insuperable [Jonathan King](https://github.com/jonathanlking) cuida el proyecto, y se puede confiar en él mucho más que en mí con estas cosas. Aun así, pienso frecuentemente en esta biblioteca y cómo mejorarla. Sin duda he disfrutado mucho de este experimento.

Es importante preguntarse si vale la pena todo este trabajo. Yo diría que sí: los detalles son tan invisibles fuera de la biblioteca como los de la implementación actual, y la biblioteca es mucho más flexible. No hemos hablado mucho de los tipos aburridos, pero en el [gist](https://gist.github.com/i-am-tom/b8c7288f661ca11a8ac7f2012dd63f31) puedes encontrar el `xs` de estos tipos en todas partes. Seguro que hay una alternativa más ordenada, pero ya me encargaré ese problema en otro artículo.

En cualquier caso, gracias por leer, y siempre puedes dejarme una pregunta en [el repositorio](https://github.com/i-am-tom/i-am-tom.github.io/issues). ¡Hasta la próxima\!

[^1]: [`generic-lens`](https://github.com/kcsongor/generic-lens) de Csongor Kiss es probablemente el más conocido, aunque no es el único. Sospecho que hablaré de otros en el futuro.

[^2]: De hecho, es peor todavía, porque no podríamos crear familias totales si quisiéramos: [no hay especies cerrados](https://gist.github.com/ekmett/ac881f3dba3f89ec03f8fdb1d8bf0a40).

[^3]: Familias asociadas también son una opción, pero tienen el mismo problema que las dependencias funcionales.

[^4]: ¿Por qué no menciono el `unsafeCoerce`? Si `GHKD` tuviera una dependencia funcional para determinar la representación de nuestro HKD, los dos tipos se unificarían. Sin embargo, ya hemos dicho que no podemos tener esta dependencia, así que necesitamos que GHC confíe en nosotros.

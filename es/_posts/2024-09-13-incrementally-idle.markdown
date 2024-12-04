---
title: Programando con Michis, Galletas, y Clips de Papel
---

Hace unas semanas [mi colega Uri][uri-github] participó en un jam de
videojuegos: un evento en el que tienes que desarrollar un videojuego entero en
un finde. Siendo un muy buen amigo, le ofrecí acompañarle en la jam durante una
tarde, y me monté en un tren a su pueblo. En el camino tuve una idea: ¿Por qué
no hago yo un juego también?

Inmediatamente se me ocurrieron dos respuestas posibles. La primera, que
obviamente es una mala idea: no tengo ni idea de cómo podría desarrollar
videojuegos 2D (o 3D) con ninguna biblioteca típica para estos casos; y la
segunda, que me llevaría más de un fin de semana escribir la mía propia. Estaba
pensando en rendirme cuando tuve una epifanía: hay un género de videojuegos que
no necesita tener gráficos impresionantes, y que se puede desarrollar por
fases, de forma que es fácil añadir más contenido o terminar el desarrollo si
no hay más tiempo, sin sacrificar el que sea un juego completo.

## ¿Qué es un videojuego inactivo?

Los juegos inactivos, o idle games, me fascinan mucho. No se me ocurre ningún
otro género de juego tan simple pero tan cautivador: puedo pasarme horas
gestionando mi imperio imaginario. Resumiendo, la mecánica que les hace únicos
es que el tiempo progresa independientemente de que estés jugando o no.
Mientras tú vives tu vida, [tus gatitos][kittens game] están cultivando el
huerto, [tus abuelitas][cookie clicker] están horneando, y [tus
drones][paperclip factory] están
combatiendo en guerras intergalácticas. Cuando vuelvas a mirar, verás lo que ha
pasado mientras tanto: puede ser que tengas más dinero, o que todos tus
súbditos hayan muerto de inanición. En cualquier caso: entras, llevas a cabo
unas cuantas tareas, y vuelves a tu vida.

La clave para hacer un buen juego de este género es entender la rapidez con la
que se generan y consumen los diferentes recursos. Por ejemplo, si como jugador
tengo $100.000 para pagar a mi personal, pero mis estadísticas me dicen que
estoy gastando $500 por segundo, debería hacer algo antes de irme a la cama o
amaneceré en bancarrota! Para ayudar con este problema, es muy común como
desarrollador proporcionar al jugador con una vista explícita de las diferentes
_tasas_ de generación o consumo.

## La Arquitectura de Elm

La esencia de los juegos inactivos es bastante clara, así que puedo y debo
intentar generalizar, desafortunadamente para tí (te toca leer más). Si has
trabajado con proyectos front-end, quizás ya conoces La Arquitectura de Elm
(_TEA: The Elm Architecture_). En términos simples, describe una aplicación
así:

{% gist c05f206ef35179f5ad7e13006ba6228d TEA.hs %}

Empezamos con un estado inicial. Cuando un evento viene al sistema (un clic del
ratón, un desplazamiento de página, o cualquier otra cosa), ejecutamos la
función `update` para crear el nuevo estado después de la acción. Luego, usamos
`render` para generar un output, normalmente algo como HTML, que se renderiza
en la pantalla. Una implementación ingenua tal vez usaría un tipo de evento que
contiene una variante para representar un tic de reloj, y `update` usaría esta
variante para actualizar el mundo. Después de que un jugador pase un tiempo
fuera de la aplicación, solo sería necesario ejecutar el número pertinente de
tics al volver a entrar para ponerse al día, sin que haya que esperar.

Para ilustrar el problema aquí, imagínate que disparamos un tic por segundo, y
salimos durante una hora. Cuando volvamos, tendremos que hacer 3.600 tics, y
por eso tendremos que ejecutar `update` 3.600 veces. Incluso si no renderizamos
la nueva pantalla tras cada tic, aún tenemos que ejecutar `update`, la acción
más complicada en nuestra app, miles de veces antes de que el usuario pueda
continuar.

La mayoría[^factory-idle] de los juegos inactivos aborda este problema con una
heurística: en lugar de simular cada instante, podemos multiplicar la tasa de
cambio de cada recurso _en el momento de salir del juego_ por el número de tics
transcurridos afuera. Claro que puedes abusar de esta heurística: por ejemplo
si estás a punto de quedarte sin dinero, y contratas mil trabajadores más antes
de salir (pero aun no tienes que pagar su salario) recibirás todo las ganancias
de su trabajo sin haber tenido que pagar nada en ese tiempo, pero aun así este
sistema suele ser suficientemente bueno para mantener la diversión y también el
rendimiento.

Para resolver este problema, necesitamos una forma de describir la tasa del
cambio por tic para que podamos "multiplicar" este tipo de dato por el número
de tics que ha pasado mientras estábamos fuera. En la biblioteca
`monoid-extras` se encuentra la clase `Action`, que (después de unos cambios) a
mi me parece que sería útil:

{% gist c05f206ef35179f5ad7e13006ba6228d Action.hs %}

Aquí, describimos cambios del estado con un tipo monoidal, que nos proporciona
la capacidad de usar la función `stimes` para repetir una acción muchas veces
después de estar inactivo, o una vez por tic mientras estamos jugando. Con esta
clase, podemos volver a nuestra arquitectura original:

{% gist c05f206ef35179f5ad7e13006ba6228d Incremental.hs %}

En este punto, hay un componente de la especificación original que me gustaría
revisar: la vista que muestra a los usuarios las tasas del cambio de sus
recursos. Si el tipo `Change` describe el cambio del estado que va a ser
ejecutado durante el próximo tic, la vista simplemente es un renderizador del
tipo `Change`, y lo podemos proporcionar a `render`.

Pero esto plantea una pregunta: ¿Debemos definir el tipo `Change` manualmente?

## Las estructuras de cambios

Yo sé que lo que quiero hacer con `tick` es solo calcular la derivada de una
función de tiempo para obtener el estado: en cualquier momento, quiero calcular
la tasa a la que mi estado cambia con respecto al tiempo. A mí me suena
bastante repetitivo: así que tiene que haber una manera de derivar estos tipos
automáticamente.

Después de una larga búsqueda, descubrí [A Theory of Changes for Higher-Order
Languages: Incrementalizing λ-Calculi by Static Differentiation][change paper]
a través de [un proyecto archivado de Phil Freeman][purescript-incremental]. El
papel presenta una manera de calcular derivadas de expresiones del cálculo
lambda simplemente tipado con una clase que los autores llaman _estructura de
cambio_ (change structure). La podemos definir como una subclase de `Action`:

{% gist c05f206ef35179f5ad7e13006ba6228d Change.hs %}

Con esta clase, podemos actuar sobre un valor con un cambio para crear un valor
nuevo, y podemos calcular el cambio que describe la diferencia entre los dos.
Además, cada tipo de valor tiene asociado un tipo de cambio específico. Un
ejemplo simple es `Int`, cuyos cambios pueden ser descritos por (una versión
monoidal de) su propio tipo.

{% gist c05f206ef35179f5ad7e13006ba6228d Change_Int.hs %}

En general, me ha parecido muy útil conceptualizar esas operaciones como _más_
y _menos_. Para algunos tipos, puede ser útil definir algo más específico al
problema a resolver, pero en cualquier caso tendría que haber una manera de
derivar tipos de cambios para todos los tipos de datos algebraicos (TDA).

## Derivación generica

Una opción conveniente de derivar una clase para todos los TDAs es proporcionar
una implementación para cualquier tipo `Generic`. En este caso, solamente
tenemos que manejar seis instancias: `M1`, `V1`, `(:+:)`, `U1`, `(:*:)`, y
`K1`.

{% gist c05f206ef35179f5ad7e13006ba6228d GChange.hs %}

Vamos a empezar con `V1` y `U1`. `V1` representa un tipo sin constructores: un
tipo que es isomorfo a `Void`. Como estos tipos no tienen habitantes (valores
posibles), no pueden "cambiar" en un sentido real, y por eso un "cambio" no
hace nada. `U1` representa un constructor sin argumentos: un constructor
_unitario_. A pesar de tener un habitante más que `V1` (es decir, un único
valor), `U1` comparte su estructura de cambio: ya tengamos cero valores o uno
solo, un "cambio" entre ellos no cambia nada.

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeV1U1.hs %}

Por otra parte, ni `M1` ni `K1` son tan emocionantes: cuando encontramos
metadatos de la forma de `M1`, podemos ignorarlos, porque no va a influir el
tipo de cambio. Cuando encontramos un `K1`, hemos encontrado un argumento
dentro de nuestro tipo, y entonces tenemos que asegurar que es un tipo de
`Change` para que podamos seguir.

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeK1M1.hs %}

Los productos son simples: si queremos describir un cambio a un producto,
tenemos que describir los cambios de los lados:

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeProduct.hs %}

Finalmente, tenemos el caso más complicado. Podríamos adivinar que un cambio de
`x :+: y` es un cambio de `x` _o_ un cambio de `y`, pero estaríamos perdiendo
algo: ¿Cómo se describe un cambio del lado? Por ejemplo, ¿Cómo se describe un
cambio de `Left 1` a `Right True`? Más aún ¿Cómo lo hacemos un monoide?

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeSumES.hs %}

Con esto, tenemos todas las instancias que necesitamos para derivar `Change`
genéricamente para todos los TDAs cuyos argumentos son tipos de `Change`
también!

Estos tipos pueden no ser muy agradables, pero podríamos mejorar la situación
con poco esfuerzo: de manera similar a [`higgledy`][higgledy], podríamos
aprovechar [`generic-lens`][generic-lens] para hacer la mayoría:

{% gist c05f206ef35179f5ad7e13006ba6228d GenericDeltaES.hs %}

En lugar de hacer más largo este artículo, te dejaré que rellenes los huecos y
diseñes una interfaz para trabajar con tipos de suma.

## Volvemos a nuestra arquitectura

{% gist c05f206ef35179f5ad7e13006ba6228d Final.hs %}

No ha cambiado mucho, excepto que ahora `Delta state` reemplaza `change` y
necesitamos una variable de tipo menos. Sin embargo, recuerda que no tenemos
que definir `Change` manualmente: en la biblioteca, la mayoría de los tipos
interesantes tienen [instancias derivadas][generic instances], que evitan que
cometamos errores en sus implementaciones.

Un beneficio más sutil es que `Change x` implica que `Delta x` siempre va a ser
un monoide. Por eso, `tick` es una función mucho más fácil de definir: podemos
definir una serie de funciones que calculen el cambio para cada argumento
dentro del estado, y luego podemos usar `mconcat` para construir la función
entera (porque `Delta x` también implicaría que `r -> Delta x` es un monoide).
Ahora tenemos una arquitectura mucho más conveniente para construir videojuegos
de una manera más ordenada y manejable.

{% gist c05f206ef35179f5ad7e13006ba6228d State.hs %}

## Conclusiones y trabajo adicional

En pocas horas, conseguí hacer bastante: tras la jam mi videojuego tenía varios
recursos que se influyen entre sí y los comienzos de una arquitectura
funcional. Por supuesto, la arquitectura del juego durante la jam no era tan
estructurada como esto, ya que estaba tecleando lo más rápido que podía. Aún
así, pienso que siempre vale la pena mantener una lista de tus ideas pasajeras
mientras trabajas en algo bajo presión. Por un lado, aprendí muchas cosas en
las que no habría pensado sin la presión de la jam, pero por otro lado, si
hubiera intentado explorar esos temas con profundidad en el momento, no habría
acabado un juego mínimamente funcional. Profundizando más en estos temas tras
la jam, he tenido la oportunidad de explorar y aprender mucho más.

Hasta ahora, estoy bastante feliz con el resultado. Obviamente no es perfecto y
hay más cosas que me gustaría hacer. Originalmente había planeado acercarme
mucho más a los ideales de computación incremental, y diseñar una aplicación
más de este estilo:

{% gist c05f206ef35179f5ad7e13006ba6228d Future.hs %}

En este mundo, los eventos son funciones `state -> Delta state`, y un tic es
simplemente la derivada de `simulate`. Tal vez podría haber sido una idea
divertida por explorar, pero en cualquier caso encontré una arquitectura que me
gustó sin requerir tanto esfuerzo.

Otra idea interesante, yo creo, sería explorar esta arquitectura, y ver si
podríamos usar la literatura[^function-derivatives] para reducir el coste de
calcular las derivadas. También sería interesante pensar en hacer `simulate`
más cómoda de escribir: en esta arquitectura, ya no es un monoide, y hemos
vuelto a algo menos convenientemente abstracto.

De todos modos, creo que es mejor dejarlo aquí. Muchas gracias por leer, y
hasta la próxima!

[^factory-idle]: Una excepción interesante a la regla es [Factory Idle][factory
    idle], que _no_ continúa durante el tiempo fuera. En vez, acumulas puntos
    durante este tiempo que puedes gastar para duplicar la tasa de tics por un
    rato.

[^function-derivatives]: El artículo que inspiró este blog usó un plug-in de
    GHC. [Conal Elliot usó otra solución][compiling to categories], aunque para
    tener una experiencia buena para los desarrolladores, todavía necesita unos
    plug-ins. Cuando tenga ganas, quizás probaré también a jugar con plug-ins.

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

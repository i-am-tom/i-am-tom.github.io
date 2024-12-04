## Programando con Michis, Galletas, y Clips de Papel

Hace unas semanas, Uri, un amigo mio, participó en un jam de videojuegos: un evento en el que tienes que desarrollar un videojuego en entero en un finde. Siendo un amigo buenísimo, le ofrecí acompañarle durante una tarde, entonces tomé un tren hacia su pueblo. Sin embargo, en el camino, tenía una idea: ¿por qué no hago un juego también?

Hay dos razones por qué la respuesta, obviamente, es que esta es una mala idea: no tengo ni idea como se desarrollar los videojuegos 2D o 3D con ninguna biblioteca normal, y llevaría más que un finde escribir mi propia. Estaba empezando a pensar en rendirme, hasta que tuve una epifanía: hay un género de videojuego que no se espera que sea impresionante visualmente, y que tiene muchos puntos en los que podría parar si no tuviera el tiempo.

### ¿Qué es un videojuego inactivo?

Los inactivos, o *idle games*, me fascinan tanto. No puedo pensar en otro género de juego tan simple pero tan cautivante: puedo pasar horas comprobando mi imperio imaginario. En breve, la mecánica que hacen único es que el tiempo progresa independientemente de que estés jugando o no. Mientras vives tu vida, tus michis están cultivando, tus abuelos están horneando, y tus drones están peleando en guerras intergalácticas. Cuando compruebes de nuevo, verás lo que ha pasado mientras tanto: puede ser que tienes más dinero, o igualmente todos tus seguidores podrían haber muerto de hambre. En cualquier caso, haces unas tareas, y vuelves a tu vida.

El núcleo de este género es entender cómo tus recursos están fabricados y usados. Por ejemplo, si tengo $100.000 para pagar a mi personal, pero mis estadísticas me dicen que estoy gastando $500 por segundo, debería hacer algo antes de acostarse! Para ayudar con este problema, es muy común proporcionar una vista de la tasa de cambia de los cantidades de cada tus recursos.

### La Arquitectura de Elm

La esencia de los inactivos es bastante clara, así que debo intentar generalizar, desafortunadamente. Si has trabajado con proyectos front-end, quizás ya conoces La Arquitectura de Elm (o *The Elm Architecture*, o *TEA*). En términos simples, describe una aplicación así:

*** CODE ***

Empezamos con un estado inicial. Cuando un evento viene al sistema (un clic del ratón, un desplazamiento de página, o cualquier más), ejecutamos la función **update** para crear el nuevo estado después de la acción. Luego, usamos **render** para generar un **output**, normalmente algo como HTML, que rendimos en la pantalla. Una implementación ingenua tal vez usaría un tipo de evento que contiene una variante que representaría un tictac, y **update** usaría esta variante para actualizar el mundo. Después de tiempo fuera, solo tenemos que disparar el número relevante de los tictacs sin esperar para ponernos al día.

Para ilustrar el problema aquí, imagínate que disparamos un tictac por segundo, y salimos durante una hora. Cuando volvamos, tendremos que hacer 3.600 tictacs, y por eso tendremos que ejecutar **update** 3.600 veces. Incluso si no rendimos la nueva pantalla entre todos los tictacs, aún tenemos que hacer la acción más complicada en nuestra app miles de veces antes de que el usuario pueda continuar.

La mayoria[^1] de los inactivos aborda este problema con un heurístico: en lugar de simulando cada momento, podemos multiplicar la tasa de cambio de cada recurso *cuando sales* por el número de tictacs durante el tiempo afuera. Si estás a punto de quedarte sin dinero, y contratas mil más trabajadores antes de salir, claro que puedes abusar de este heurístico, pero es suficientemente bueno para mantener la diversión y la performancia también.

Entonces, para implementar una solución, necesitamos una forma de describir la tasa del cambio por tictac para que podamos “multiplicar” este tipo de dato por el número de tictacs que ha pasado mientras estábamos afuera. En la biblioteca **monoid-extras** hay la clase **Action**, que (después de unos cambios) a mi me parece que sería útil:

*** CODE ***

Aquí, describimos cambios del estado con un tipo monoidal, que nos proporciona la capacidad usar la función **stimes** para repetir una acción muchas veces después de estar inactivo, o una vez por tictac mientras estamos jugando. Con esta clase, podemos volver a nuestra arquitectura original:

*** CODE ***

En este punto, hay un componente de la especificación original que me gustaría revisar: la vista que muestra a los usuarios las tasas del cambio de sus recursos. Si el tipo **Change** describe el cambio del estado que va a ser ejecutado durante la próxima tictac, la vista simplemente es un renderizador del tipo **Change**, y lo podemos proporcionar a **render**.

… Pero esto plantea una pregunta: ¿debemos definir el tipo **Change** manualmente?

### Las estructuras de cambios

Yo se que lo que quiero hacer con **tick** es solo calcular la derivativa de una función del tiempo al estado: en cualquier momento, quiero calcular la tasa a la que mi estado cambia con respecto al tiempo. A mi, me suena bastante mecánica: hay que haber una manera de derivar estos tipos automáticamente.

Después de una larga búsqueda, descubrí **A Theory of Changes for Higher-Order Languages: Incrementalizing λ-Calculi by Static Differentiation** via un proyecto archivado de Phil Freeman. El papel contribuye una manera de calcular derivativas de expresiones del cálculo lambda simplemente tipado con una clase que a los autores se llama una estructura de cambio (*change structure*). La podemos definir como un subclase de **Action**:

*** CODE ***

Con esta clase, podemos actuar en un valor con un cambio para crear un nuevo, y podemos calcular el cambio que describe la diferencia entre los dos. Además, cada tipo tiene un tipo asociado de cambio específico. Un ejemplo simple es **Int**, cuyos cambios puede ser describido con (una versión monoidal de) sí mismo:

*** CODE ***

En general, me ha parecido muy útil conceptualizar esas operaciones como más y menos. En el caso de unos tipos, puede ser más útil definir algo más dominio específico, pero en cualquier caso, habría que haber una manera de derivar tipos de cambios para todos los tipos de datos algebraicos (TDA).

### Derivación generica

Una opción conveniente para derivar una clase para todos los TDAs es proporcionar una implementación para cualquier **Generic** tipo. En este caso, solamente tenemos que manejar seis casos: **M1**, **V1**, **(:+:)**, **U1**, **(:*:)**, y **K1**.

*** CODE ***

Vamos a empezar con **V1** y **U1**. **V1** representa un tipo sin constructores: un tipo que es isomorfo a **Void**. Como estos tipos no tienen habitantes, no pueden “cambiar” en un sentido real, y por eso cada “cambio” no hace nada. **U1** representa un constructor sin argumentos: un constructor unitario. A pesar de tener uno más habitante que **V1**, **U1** comparte su estructura de cambio: ya sea que tengamos cero valores o uno, o hay un “cambio” que cambiaría algo.

*** CODE ***

Por otra parte, no **M1** ni **K1** son tan emocionantes: cuando encontramos metadatos de la forma de **M1**, podemos ignorarlos, porque no va a influir el tipo de cambio. Cuando encontramos un **K1**, hemos encontrado un argumento dentro nuestro tipo, y entonces tenemos que asegurar que es un tipo de **Change** para que podamos seguir.

*** CODE ***

Los productos son simples: si queremos describir un cambio a un producto, tenemos que describir los cambios de los lados:

*** CODE ***

Finalmente, tenemos el caso más complicado. Podríamos adivinar que un cambio de **x :+: y** es un cambio de x o un cambio de y, pero estaríamos perdiendo algo: como se describe un cambio del lado? Por ejemplo, ¿cómo se describe un cambio de **Left 1** a **Right True**? Más allá, ¿cómo lo hacemos un monoide?

*** CODE ****

- Estos casos no deberían pasar. Los estados no coinciden: no podemos quedarnos a la derecha si ya estamos a la izquierda, entonces no hacemos nada para mantener la totalidad de la función.

Con eso, tenemos todos las instancias que necesitamos para derivar **Change** genéricamente para todos los TDAs cuyos argumentos son tipos de **Change** también!

Estos tipos pueden no ser tan agradables, pero podríamos mejorar la situación con poco esfuerzo: de manera similar a **higgledy**, podríamos aprovechar **generic-lens** para hacer la mayoría:

*** CODE ***
- Necesitará algún tipo de instancia **Generic**…  
- Aplicar intereses

En lugar de hacer más largo este artículo, te dejaré que rellenes los huecos y diseñes una interfaz para trabajar con tipos de suma.

### Volvemos a nuestra arquitectura

No ha cambiado mucho, excepto que ahora **Delta state** reemplaza **change** y necesitamos un variable de tipo menos. Sin embargo, recuerda que no tenemos que definir **Change** manualmente: en la biblioteca, la mayoría de los tipos interesantes tienen instancias derivadas, que evitan que cometamos errores en sus implementaciones.

Un beneficio más sutil es que **Change x** implica que **Delta x** siempre va a ser un monoide. Por eso, **tick** es una función mucho más fácil para definir: podemos definir una serie de funciones que calculan el cambio para cada argumento dentro del estado, y luego podemos usar **mconcat** para construir la función entera (porque **Delta x** también implicaría que **r -> Delta x** es un monoide). Ahora tenemos una arquitectura mucho más conveniente para construir videojuegos en una manera más ordenada y manejable.

### Conclusiones y trabajo adicional

Con pocas horas, conseguí hacer bastante: mi videojuego tenía varios recursos que se afectan entre sí, y los comienzos de una arquitectura funcional. Claro, la arquitectura del juego durante el jam no estaba tan pensada: estaba tecleando tan rápido que podía. Aún así, siempre pienso que vale la pena mantener una lista de tus pensamientos pasajeros mientras trabajas en algo con presión. Al final, aprendí muchas cosas que no habría aprendido sin el jam, y si hubiera intentado explorar esos temas en el momento, no habría aprendido tanto y, probablemente, no habría acabado alguna forma de juego.

En este punto, estoy bastante feliz con el resultado. Claro, no es perfecto, y por supuesto hay más cosas que me gustaría hacer. Originalmente, había planificado abrazar mucho más de los ideales de computación incremental, y diseñar una aplicación más así:

*** CODE ***

En este mundo, los eventos son funciones **state -> Delta state**, y un tictac es simplemente la derivación de **simulate**. Tal vez podría ser una idea divertida para explorar, pero en fin encontré una arquitectura que me gustó sin haciendo tanto.

Una otra idea interesante, yo creo, sería explorar esta arquitectura, y ver si podríamos usar la literatura[^2] para reducir el costo de calcular las derivaciones. También sería interesante pensar en hacer **simulate** más cómodo para escribir: en esta arquitectura, ya no es un monoide, y hemos vuelto a algo menos convenientemente abstracto.

De todos modos, creo que vamos a acabar aquí. Muchas gracias por leer, y nos vemos la próxima vez!  

[^1]:  Una excepción interesante a la regla es Factory Idle, que no continua durante tiempo fuera. En cambio, acumulas puntos durante este tiempo que puedes gastar para duplicar la tasa de tictacs por un rato.

[^2]:  El papel que inspiró este artículo usó un complemento de GHC. Conal Elliot tenía otra solución, aunque para tener una experiencia buena para los desarrolladores, todavía necesita unos complementos. Cuando tenga ganas, quizás probaré jugando con complementos también.

---
title: Programant amb gatets, galetes i clips
---

Fa uns caps de setmana, [el meu amic Uri][uri-github] va participar en una game
jam. Sent l’amic espectacular que sóc, em vaig oferir a fer-li companyia durant
una part d’aquest esdeveniment, així que vaig agafar un tren i em vaig dirigir
al seu poble. Pel camí, però, vaig tenir una idea: per què no faig un joc
també? Hi ha dues raons per les quals la resposta òbvia a aquesta pregunta és
"no": no tinc ni idea de com construir jocs 2D o 3D amb cap dels motors de jocs
habituals, i no tinc temps per aprendre o crear el meu propi motor. Les coses
no pintaven bé, però després vaig tenir una epifania: hi ha un gènere de joc
que no s’espera que sigui espectacular visualment i que té una sèrie de "punts
d'aturada" molt clars si se m’acaba el temps.

## Què són els jocs idle?

Els jocs idle em fascinen. No estic segur que hi hagi un altre gènere de jocs
tan senzill però captivador: puc perdre desenes d’hores comprovant l’estat del
meu imperi imaginari. En resum, la mecànica única dels jocs idle és que el
temps avança tant si jugues activament com si no. Mentre segueixes amb el teu
dia, [els teus gatets][kittens game] estan treballant la terra, [les teves
àvies][cookie clicker] estan coent galetes, i [els teus drons][paperclip
factory] estan lluitant en guerres interestel·lars. Quan tornes a connectar-te,
veus què ha passat mentrestant: potser tens més diners o potser tots els teus
seguidors s’han mort de gana. En qualsevol cas, fas alguns ajustos i et
desconnectes de nou.

El nucli d’aquest gènere consisteix a entendre com es produeixen i es
consumeixen els teus recursos. Per exemple, si tinc 100.000 $ per pagar els
sous dels meus treballadors, però les meves estadístiques em diuen que estic
cremant 500 $ per segon, hauria de fer alguna cosa abans d’anar-me’n a dormir!
Per ajudar en això, és molt comú que els jocs idle et donin una manera de veure
la velocitat de canvi de cadascun dels teus recursos.

## L'Arquitectura Elm

L’essència dels jocs idle està raonablement ben definida, així que,
lamentablement, estic destinat a intentar generalitzar-la. Els aficionats a la
programació d’interfícies d’usuari poden estar familiaritzats amb
l’Arquitectura Elm (TEA) en una forma o una altra, que (en termes bàsics)
defineix una aplicació així:

{% gist c05f206ef35179f5ad7e13006ba6228d TEA.hs %}

Comencem amb un `state` inicial donat. Quan entra un `event` al sistema (un
clic de ratolí, un desplaçament de pàgina o qualsevol altra cosa), cridem la
funció `update` per actualitzar l'estat corresponentment. Aquest nou estat es
passa a `render`, i això ens dóna la nostra `output`. Una implementació simple
per a les nostres finalitats veuria que el tipus `Event` conté una variant de
`Tick` de rellotge que actualitza el món. Després d’un temps fora, només cal
activar el nombre adequat d’esdeveniments de `Tick` sense esperar.

Per il·lustrar el problema, imaginem que la nostra velocitat de tic és només un
cop per segon, i ens n’anem durant una hora. Quan tornem, activem 3.600
esdeveniments `Tick`, i el bucle TEA comença a treballar-hi. Deixant de banda
les representacions intermèdies, ara hem de fer la funció més complexa de la
nostra aplicació milers de vegades abans que l’usuari pugui continuar.

La resposta de la majoria[^factory-idle] dels jocs idle a aquest problema és utilitzar una
heurística: en lloc de simular realment cada moment en el temps, multipliquem
la velocitat de canvi de cada recurs en el moment en què ens vam aturar pel
temps que hem estat fora. Si els teus diners estan a punt d’acabar-se i
contractes mil treballadors addicionals abans de desconnectar-te, evidentment
pots abusar d’aquesta heurística al teu avantatge, però és suficient per
mantenir els jocs divertits i eficients.

Per abordar aquest problema, necessitem una manera de descriure una velocitat
de canvi per tic de manera que puguem "multiplicar" aquest tipus pel nombre de
tics que han passat mentre estàvem fora. Dins el paquet `monoid-extras` al
`Data.Monoid.Action` hi ha [la classe `Action`][monoid action], que (després d’una lleugera
modificació i canvis de variables) sembla força prometedora:

{% gist c05f206ef35179f5ad7e13006ba6228d Action.hs %}

Aquí, modelitzem els canvis d'estat com un tipus monoidal, que ens permet
utilitzar `stimes` per crear accions repetides quan hem estat inactius, o
accions individuals per a cada tic mentre juguem. Amb aquesta classe, podem
tornar a la nostra arquitectura original:

{% gist c05f206ef35179f5ad7e13006ba6228d Incremental.hs %}

Arribats a aquest punt, hi ha un component que m’agradaria revisar: la
visualització per mostrar a l’usuari la velocitat de canvi dels diferents
recursos. Si el tipus `Change` descriu el canvi d’estat que es realitzarà en el
següent tic, llavors la visualització de la velocitat de canvi és simplement un
renderitzador per al tipus `Change`, i només cal incloure-la com a paràmetre
extra a `render`!

Això planteja una pregunta, però: hem de definir el tipus `Change` manualment?

## Estructures de Canvi

Sé que el que vull fer amb aquesta funció de tick és calcular la derivada d’una
funció `time -> state`: en qualsevol moment donat, vull calcular la velocitat a
la qual el meu estat canvia respecte al temps. En aquests termes, comença a
sonar força mecànic: realment hauria d'haver-hi una manera de calcular el tipus
Change automàticament.

Després de buscar, vaig descobrir [A Theory of Changes for Higher-Order
Languages: Incrementalizing λ-Calculi by Static Differentiation][change paper]
a través d'[un projecte arxivat per Phil Freeman][purescript-incremental].
L'article contribueix a una manera de calcular derivades de programes per a
expressions en el càlcul lambda tipat simple, utilitzant una classe que
anomenen _estructura de canvi_. Podem veure aquesta classe com una subclasse
d'`Action`:

{% gist c05f206ef35179f5ad7e13006ba6228d Change.hs %}

Amb aquesta classe, podem actuar sobre un valor amb un canvi per produir un nou
valor, i podem calcular el canvi que descriu la diferència entre dos valors.
També hem dit que cada tipus té un tipus de canvi específic associat. Un
exemple agradable i fàcil de `Change` és `Int`, els canvis del qual es poden
descriure amb una versió monoidal d’ell mateix:

{% gist c05f206ef35179f5ad7e13006ba6228d Change_Int.hs %}

En general, he trobat molt útil conceptualitzar aquestes operacions com a sumes
i restes. Per a alguns tipus, pot ser útil definir alguna cosa més específica
per al domini, però realment hauria d’haver-hi una manera mecànica de derivar
un tipus de canvi per a tots els tipus de dades algebraiques.

## Derivació genèrica

Una manera convenient de derivar una classe per a qualsevol tipus algebraic de
Haskell és proporcionar una implementació per a qualsevol tipus `Generic`.
Fer-ho significa que només tenim sis casos a manejar: `M1`, `V1`, `(:+:)`,
`U1`, `(:*:)` i `K1`.

{% gist c05f206ef35179f5ad7e13006ba6228d GChange.hs %}

Començarem amb `V1` i `U1`. `V1` representa un tipus sense constructors: un
tipus isomorf a `Void`. Com que aquests tipus no tenen habitants, no poden
realment "canviar", i per tant cada canvi és una no-operació. `U1` representa
un constructor sense camps, un constructor unitari. Tot i tenir un habitant més
que `V1`, `U1` comparteix la seva estructura de canvi: tant si tenim zero
valors com si en tenim un, no hi ha cap canvi que no sigui una no-operació.

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeV1U1.hs %}

`M1` i `K1` tampoc són gaire emocionants: quan trobem metadades en forma d’un
tipus `M1`, només les podem ignorar, ja que no tenen impacte en el tipus de
canvi. Quan arribem a un `K1`, hem trobat un camp dins del nostre tipus, i per
tant, hem d’assegurar-nos que sigui un tipus `Change` per continuar
recursivament.

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeK1M1.hs %}

Els productes són senzills: si volem descriure un canvi en un producte,
descrivim el canvi de cada costat:

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeProduct.hs %}

Finalment, el complicat: podríem pensar que `GDelta (x :+: y)` és simplement
`GDelta x :+: GDelta y`. Tanmateix, ens falta una cosa: com descrivim un canvi
d’un costat de la suma a l’altre? Per exemple, com descrivim un canvi de
`Left 1` a `Right True`? A més, com fem que sigui un `Monoid`?

{% gist c05f206ef35179f5ad7e13006ba6228d GChangeSumCA.hs %}

Amb això, tenim totes les instàncies que necessitem per derivar una instància
de `Change` genericament per a qualsevol tipus algebraic els camps del qual
siguin tots instàncies de `Change`!

Els tipus de canvi potser no són els més bonics ni fàcils d’usar, però queda
sorprenentment poca feina per fer aquí: a l’estil de [`higgledy`][higgledy],
podríem beneficiar-nos de [`generic-lens`][generic-lens] i avançar molt.

{% gist c05f206ef35179f5ad7e13006ba6228d GenericDelta.hs %}

En lloc de fer aquesta entrada més llarga, deixaré omplir els buits, així com
el disseny d’una API per tractar tipus sumatoris, com a exercici per al lector.

## Tornant a l'arquitectura

{% gist c05f206ef35179f5ad7e13006ba6228d Final.hs %}

No ha canviat gaire aquí, excepte que Delta state substitueix `Change` i ens
estalvia un paràmetre de tipus. No obstant això, recordem que ja no necessitem
definir `Change` nosaltres mateixos: a la biblioteca, la majoria de tipus
interessants tenen [instàncies derivades automàticament][generic instances],
cosa que ens estalvia preocupar-nos per cometre errors d’implementació. Un
altre benefici subtil aquí és que `Change x` implica que `Delta x` serà sempre
un `Monoid`. Això fa que la funció `tick` sigui molt més fàcil d’implementar:
podem escriure una sèrie de funcions que cadascuna calculi el canvi per a un
camp dins de l'estat, i després les podem mconcat junts (ja que `Delta x`
implica `r -> Delta x`). Això ens dóna una arquitectura molt més convenient per
construir aquests jocs complexos de manera ordenada i manejable.

{% gist c05f206ef35179f5ad7e13006ba6228d State.hs %}

## Conclusions i feina futura

En les poques hores que vaig tenir, en realitat vaig aconseguir arribar força
lluny: el meu joc tenia diversos recursos que s’afectaven entre ells i els
inicis d’un bucle de joc funcional. És clar, l’arquitectura del joc no estava
tan ben pensada durant la jam; només estava apretant tecles tan ràpid com
podia. Tanmateix, sempre crec que val la pena mantenir una llista de pensaments
que passen mentre treballes en alguna cosa sota pressió. Vaig acabar aprenent
moltes coses que mai hauria vist si no hagués estat per la jam, i si hagués
intentat explorar-les en el moment, no hauria acabat el joc i probablement no
hauria après ni la meitat.

En aquest punt, estic força content amb com ha sortit tot. És clar, està lluny
de ser perfecte, i definitivament hi ha més coses que es poden fer.
Originalment, havia planejat abraçar encara més la literatura sobre programació
incremental i construir una aplicació així:

{% gist c05f206ef35179f5ad7e13006ba6228d Future.hs %}

En aquest món, els esdeveniments són funcions `state -> Delta state`, i `tick`
és simplement el resultat de diferenciar la funció `simulate`. Potser seria una
idea divertida de desenvolupar una mica més, però vaig aconseguir trobar una
arquitectura que m’agradava sense arribar tan lluny.

Un seguiment interessant, crec, seria explorar aquesta arquitectura i veure si
podem utilitzar part de la literatura[^function-derivatives] per reduir el cost
de calcular derivades de funcions. També seria interessant veure com podem fer
que `simulate` sigui una funció agradable d’escriure: en aquesta arquitectura,
hem perdut la nostra instància de `Monoid` per als canvis d’estat, i tornem a
tractar amb alguna cosa molt menys abstracta i convenient. En qualsevol cas,
crec que aquest és un bon lloc per parar. Moltes gràcies per llegir, i ens
veiem la pròxima vegada!

[^factory-idle]: Una excepció divertida a la norma és [Factory Idle][factory
    idle], que no continua funcionant mentre estàs fora, però en canvi acumules
    punts que et permeten córrer el joc a x2 de velocitat.

[^function-derivatives]: L'article que va motivar aquesta publicació ho va
    resoldre utilitzant plugins de GHC. [Conal Elliot ho va resoldre d'una
    manera diferent][compiling to categories], però una bona experiència
    d'usuari encara depèn de l'ús de plugins de GHC. Potser ho provaré quan en
    tingui ganes.

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

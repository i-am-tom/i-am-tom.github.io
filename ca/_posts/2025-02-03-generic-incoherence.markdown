---
title: Profundament Incoherent i Genèric
---

*Pots veure el codi d’aquest article, que implementa totes les tècniques mecionades, en el [gist](https://gist.github.com/i-am-tom/b8c7288f661ca11a8ac7f2012dd63f31).*

Originalment la biblioteca [`higgledy`](https://github.com/i-am-tom/higgledy) era un projecte intern per a una feina anterior. L’empresa venia hipoteques i, com pots imaginar, generava molta burocràcia. Els usuaris passaven la majoria del temps omplint un gran gormularia que requeria molta informació personal i financera. Per això vam desenvolupar tot assumint que un usuari necessaria diversos dies per completar-lo sense cap ordre particular mentre recopilar la informació rellevant.

Encara que al final podem omplir un tipus per a representar una sol·licitud d’hipoteca, hem de gestionar moltes dades parcials fins llavors. Trobar una solució a aquest problema era el passatemps preferit de l’equip d’enginyers i nosaltres vam dedicar moltes hores a idees diferents que van resultar en projectes interessants[^1].

## Tipus d’Espècie Superior

Una opció possible seria utilitzar tipus d’espècie superior (*higher-kinded data*, o *HKD*), una idea que vaig descubrir originalment en [un article de Sandy Maguire](https://reasonablypolymorphic.com/blog/higher-kinded-data). En poques paraules, indexem un tipus amb un constructor de tipus i emboliquem cada argument amb aquest constructor:

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

Podem canviar el tipus `f` per a obtenir moltes variacions interessants del mateix tipus. La biblioteca de [`barbies`](https://hackage.haskell.org/package/barbies), desenvolupada per un altre company de la mateixa empresa, proporciona moltes eines útiles per a manipular els HKDs:

```haskell
-- Imprimeix cada error per pantalla.
reportErrors :: UserValidation -> IO ()
reportErrors = bfoldMap (either putStrLn mempty)

-- Converteix `UserF (Either String)` a `UserF Maybe`.
ignoreErrors :: UserValidation -> PartialUser
ignoreErrors = bmap (either (const Nothing) Just)
```

El tema que em resulta més interessant és la idea de HKDs anidades:

```haskell
type ApplicationF :: (Type -> Type) -> Type
data ApplicationF f
  = ApplicationF
      { userDetails  :: UserF f
      , workHistory  :: WorkF f
      , isRemortgage :: f Bool
      }
```

La màgia dels HKDs i `barbies` resideix en que podem anidar sense problema: podem utilitzar totes les classes de `barbies` i tener parcialitat quan volguem traversar del tipus.

## HKDs Genèrics

Aquest mètode funciona bastant bé, però els tipus són incòmodes, especialment quan `f` és `Identity`: en aquest cas, vull ignorar la construcció i centrar-me en el contingut. A més, les derivacions de les instàncies comuns (`Eq`, `Ord`, i `Show`) són molt més difícils (perquè `f` determinarà la implementació) i no es poden derivar automàticament. Hi ha diferents estratègies per a resoldre aquests problemes, però la meva és la que es va convertir en `higgledy`: Per què no defineixo el tipus sense mencionar `f` i després utilitzo un altre diferent per a injectar?

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

[`HKD`](https://github.com/i-am-tom/higgledy/blob/8d0d87e63919de3c8be4a45915ae33e2f89f2d0f/src/Data/Generic/HKD/Types.hs#L84) conté una versió modificada de la representació `Generic` del tipus en la que totes les fulles són embolicades amb `f`. Després utilitzem biblioteques com [`generic-lens`](https://github.com/kcsongor/generic-lens) per a proporcionar una API amb la que poguem accedir i modificar aquestes fulles. Avui en dia podríem utiltizar extensions com `OverloadedRecordUpdate` i l’estructura interna de `HKD` seria invisible.

## El problema

Si estàs pensant en l’anidació que he mencionat abans i com funciona amb `HKD` hauràs vist el problema principal de la idea: `higgledy` determina la forma genèrica automàticament, així que no podrem definir les fulles que haurien de ser `HKD` o no. Si considerem les limitacions de la biblioteca, hi ha dos requisitos per a determinar si una fulla ha de ser un `HKD`:

* Té una representació `Generic`, que `higgledy` necessita per a construir la representació interna.  
    
* Té un tipus que sí volem com a `HKD` anidat. `String` és un bon exemple d’un tipus `Generic` que probablement no volem que sigui un `HKD`. Per això necessitem la capacitat d’ignorar aquests tipus.

[Generic deriving of generic traversals](https://dl.acm.org/doi/10.1145/3236780) és un article increíble per diferents motius que explicaré en futurs articles, però un concepte important que se’m va acudir al llegir-lo va ser el de “tipus interessants”: quan creem o recorrem un tipus `Generic`, tenim una llista de tipus que considerem les “fulles” i que no recorrerem més. Anem a justificar aquest article dient que la llista creixeria ràpidament: tipus de divida, rangs de números e identificadors vàlids són algunes de les classes de tipus que necessitaríem afegir a la llista de “tipus interessants”.  
Després vaig tenir una altra idea: per què no recorrem *tots* els tipus menys aquells definits en una llista de “tipus avorrits”? La premisa és que aquesta llista creixerà més lentament ja que la majoria dels tipus (per exemple, divises, rangs) no necessiten les instàncies `Generic`, però, tot i així els pocs que necessiten una instància es poden afegir a aquesta llista que ignorarem. Sona bé, però tenim un problema immediat: Com podem saber si un tipus és una instància de `Generic`?

## Estem encallats

Detectar si un tipus és `Generic` hauria de ser impossible. No hauríem de poder escriure una funció la execució de la qual canvii depenent de l’existència d’una instància `Generic` i abordar aquest problema sempre ha necessitat una extensió (com [`constraints-emerge`](https://github.com/isovector/constraints-emerge), per exemple). Tot i així, gràcies al miracle de la incoherència, [Adam Gundry](https://github.com/adamgundry) va descobrir com [detectar instàncies de `Generic`](https://gist.github.com/adamgundry/37e29ca9c8a30e3d94f61b0ee11d67a8) sense extensions utilizant el costat fosc de GHC.

Podem pensar en les famílies dels tipus de funcions com funcions entre els tipus, però hi ha diferències importants. El més rellevant per a nosaltres és que les famílies dels tipus no han de ser totals: no hem d’escriure equacions per a totes les entrades possibles[^2]. Òbviament, hauríem de pensar en el que passaria quan utilitzem una entrada per a una família sense equació. Per exemple, `GHC.Generics.Rep` és una família que assigna una representació genèrica a un tipus:

```
ghci> :k! Rep Bool
Rep Bool :: * -> *
= M1
    D
    (MetaData "Bool" "GHC.Types" "ghc-prim" False)
    (M1 C (MetaCons "False" PrefixI False) U1
     :+: M1 C (MetaCons "True" PrefixI False) U1)
```

Apliquem la funció `Rep` al valor `Bool` i tenim la representació genèrica de `Bool`. En canvi, quan apliquem `Rep` a `Int` \- un tipus que no té una representació genèrica \- la resposta no sembla molt útil:

```
ghci> :k! Rep Int
Rep Int :: * -> *
= Rep Int
```

GHC no té ni idea de com s’assigna una representació a `Int`, i per això ens dona la seva entrada. Descrivim aquesta situació com a “encallada” (*stuck* en anglès): GHC no ens pot oferir res que sigui més útil. Podem aplicar altres funcions a valors encallats per a crear valors encallats més grans, però fins que no sapiguem què és exactament `Rep Int`, estem... doncs encallats.

Tenim un dilema: no podem interrogar un valor encallat sense crear un nou valor encallat. En realitat, [hauria de ser impossible detectar si un valor està encallat](https://blog.csongor.co.uk/report-stuck-families/): si intentem prendre una decisió amb un valor encallat obtindrem una nova decisió encallada… però queda una opció.

Podem resoldre el cap d’una instància amb un valor encallat:

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

Per a entendre el que està passant aquí hem de saber el procés intern de GHC: quan tenim dos instàncies vàlides i una de les dues és `INCOHERENT`, GHC automàticament escull l’altra. En altres paraules, només escollim una instància `INCOHERENT` quan no hi ha una altra opció disponible.

Quan apliquem `IsGeneric` al valor `Rep Bool`, GHC pot calcular que `Rep Bool` és `M1 D (MetaData ...) ...`, que coincideix amb les dues instàncies. Tot i així, una instància és `INCOHERENT` per tant utilitzem la altra i `isGeneric` és vertader.

No obstant, quan apliquem `IsGeneric` a `Rep Int`, tenim un valor encallat. En aquest cas, no tenim ni idea de si el resultat coincidrà amb `M1 D m x`, i resulta que només tenim una inst\`pancaia: la instància en la que `isGeneric` és fals. La combinació terrible dels valors encallats i les instàncies incoherents ens dona un mètode molt brut per a diferenciar entre els tipus `Generic` i els que no ho són.

## Tipus encallats com a entrades

Malñgrat que ara ens sigui possible determinar si un tipus és `Generic`, encara no hem resolt el problema: necessitem poder dir que, si el tipus és `Generic`, hauria d’estar embolicat en `HKD`, i, en el cas contrari, de `f`. Quan tinc un problema així immediatament penso en les dependències funcionals[^3]:

```haskell
type Leaf :: (Type -> Type) -> (Type -> Type) -> Type -> Constraint
class Leaf f rep leaf output | f rep leaf -> output

instance Leaf f (M1 D m x) l (HKD l f)
instance {-# INCOHERENT #-} Leaf f x l (f l)
```

Això seria perfecte, però el nostre truc de detecció "genèrica” té un punt dèbil: en el que refereix a GHC, els tipus d’entrada no determinen els de sortida. Es podrien determinar, però GHC no sap com es determinen i en comptes d’intentar-ho, es queixa de que tenim instàncies superposades i per això no podem declarar aquesta dependència. Desafortunadament sembla que cap de les dues idees funcionaràn i que hauriem de passar-nos al costat fosc del compilador un cop més.

Fa quasi deu anys Chris Done va publicar un article sobre [un truc per a escriure instàncies](https://chrisdone.com/posts/haskell-constraint-trick/) i passats uns anys finalment el vaig entendre. Com que no puc explicar el truc en un sol paràgraf, assumiré que l’has llegit i passaré directament a la conclusió: uan estem escollint una instància no es poden unificar els tipus, però sí les restriccions de la instància escollida. En altres paraules:

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

`C () ()` és una instància que nomes s’aplicarà quan es sapiga que els dos tipus són `()`. Per això, el tipus `f ()` no és necessariàment `()` \- potser hi ha més instàncies per sota? \- així que hem d’especificar el tipus de `y` per a poder aplicar aquesta instància i per tant no ens ajuda en res.

Per altra banda, `C Bool x` és una instància que escollim tant aviat com sapiguem que el primer tipus és `Bool`, independentement del segon. Així que al escriure `True`, GHC sempre pot escollir aquesta instància. Quan ha escollit la instància, tenim una restricció nova:  `x ~ Bool`. GHC resol aquesta restricció i aprèn que `f True` tingui tipus `Bool`, i, per conseqüent, no tenim la mateixa ambigüetat

El que ens interessa és que, encara que C no té una dependència `x -> y`, `ghci`  ens dius que el tipus ja s’ha determinat\! Utilitzant el mateix truc, podem escriure codi el tipus del qual canvii en relació a la presència d’una instància de `Generic` sempre i quant el tipus de sortida estigui determinat per les restriccions i no pel cap de la instància:

```haskell
type IsGeneric :: (Type -> Type) -> Type -> Constraint
class IsGeneric rep x where problem :: x

instance o ~ () => IsGeneric (f x) o where
  problem = ()

instance {-# INCOHERENT #-} (o ~ String, Typeable x)
    => IsGeneric x o where
  problem = show (typeRep @x) ++ " no té una representació genèrica!"

examples :: IO ()
examples = do
  print (problem @(Rep Bool)) -- ()
  print (problem @(Rep Int)) -- "Int no té una representació genèrica!"
```

## Tornant al nostre problema

Amb aquests nous trucs podem tornar al problema de `higgledy`. La majoria del codi no és tant interessant: anem atravessant la representació genèrica del tipus i, quan trobem les fulles, utilitzem els trucs per a decidir si hauria de ser embolicat amb `f` o convertit a un `HKD` també. Donat que no ens està permès utilitzar famílies de tipus, el tipus de `HKD` ha de complicar-se una mica:

```haskell
type HKD :: Type -> (Type -> Type) -> Type
data HKD x f where
  HKD :: forall o x f. GHKD (Rep x) f o => o Void -> HKD x f
```

*He omitit les referències als "tipus interessants" per a eixar-ho més clar, però si vols un exemple el pots consultar al gist.*

Ara bé, una restricció determina la representació interna de `HKD`, i volem que aquest tipus estigui amagat, aixó que haurem d’incluir un diccionari `GHKD` *dins* del tipus. Ara només queda que `HKD` sigui compatible amb les altres biblioteques (`barbies`, `generic-lens`, etc), i per   això... haurem de treballar amb un `HKD` genèricament..

## Cóm es deriva `Generic` per a tipus indeterminats

El problema immediat és que `Generic` és una classe amb una família de tipus (`Rep`) i, com hem dit moltes vegades anteriorment, no podem fer res amb elles. Fins on sé, no hi ha una solució per a sortejar aquesta limitació. No obstant, el problema és evitable mitjançant un nou truc:

```haskell
type RepWrapper :: (Type -> Type) -> Type
newtype RepWrapper o = RepWrapper { unRepWrap :: o Void }

instance (Contravariant o, Functor o)
    => Generic (RepWrapper o) where
  type Rep (RepWrapper o) = o

  from (RepWrapper o) = phantom o
  to = RepWrapper . phantom
```

Aquest no és un tipus interessant: conté una representació genèric contiene una representación genérica, y *su* representación genérica está definida por lo que está conteniendo. En esencia, parece simplemente un `newtype` transparente, pero con este tipo podem resolver todos nuestros otros problemas con `Generic`, convirtiendo nuestro `HKD` en el tipo de `Wrapped`:

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

Per fi, hem assolit el nostre objectiu. Tenim una versió funcional de `higgledy` que permet `HKD`s anidats i que és compatible amb totes les biblioteques externes que exigeixen una instància de `Generic`. També tenim la inferència dels tipus que hem demostrar aquí. Crec que ja estem\!

## Una ressenya

Ha passat força temps desde que vaig deixar aquesta feina i els increíbles companys que han inspirat aquesta biblioteca. Aquests dies l’insuperable [Jonathan King](https://github.com/jonathanlking) cuida el projecte i es pot confiar en ell molt més que amb mi en aquestes coses. Tot i així penso sovint en aquesta biblioteca i en com millorar-la. No hi ha dubte de que he gaudit molt d’aquest experiment.

Es important preguntar-se si val la pena tota aquesta feina. Jo diria que sí: els detalls són tant invisibles fora de la biblioteca com els de la implementació actual i la biblioteca és ara molt més flexible. No hem parlat molt dels tipus avorrits, però en el [gist](https://gist.github.com/i-am-tom/b8c7288f661ca11a8ac7f2012dd63f31) pots trobar el `xs` d’aquests tipus a tot arreu. Segur que hi ha una alternativa més ordenada, però ja m’encarregaré d’aquest problema en un altre article.

De totes maneres, gràcies per llegir-me. Em pots deixar qualsevol preguntar en [el repositori](https://github.com/i-am-tom/i-am-tom.github.io/issues). Fins la propera\!

[^1]: [`generic-lens`](https://github.com/kcsongor/generic-lens) de Csongor Kiss és probablemente el més conegut, encara que no l’únic. Sospito que parlaré d’altres en un futur.

[^2]: De fet, és pitjor encara perquè no podríem crear famílies totals si volguéssim: n[o hi ha espècies tancades](https://gist.github.com/ekmett/ac881f3dba3f89ec03f8fdb1d8bf0a40).

[^3]: Famílies associades també són una opció, però tenen el mateix problema que les dependències funcionals.

[^4]: ¿Per què no menciono `unsafeCoerce`? Si `GHKD` tingués una dependència funcional per a determinar la representació del nostre KHD, els dos tipus s’unificarien. Tot i això ja hem dit que no podrem tenir aquesta dependència, aixó que necessitem que GHC confii en nosaltres

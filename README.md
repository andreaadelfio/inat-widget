# iNaturalist Widget (custom)

Widget JavaScript/CSS standalone per mostrare osservazioni iNaturalist.

## File

- `inat-widget-custom.js`: loader, fetch API e rendering.
- `inat-widget-custom.css`: stili widget.
- `test-widget.html`: playground per test veloci.

## Uso base

```html
<link rel="stylesheet" href="./inat-widget-custom.css">
<script defer src="./inat-widget-custom.js"></script>

<div
  data-inat-widget
  data-inat-source="andreaadelfio"
  data-inat-source-type="user"
  data-inat-theme="light"
  data-inat-limit="10"
></div>
```

## Comportamento responsive

- Esiste una sola modalita.
- Il widget e sempre "extended", ma diventa automaticamente piu compatto quando lo schermo si restringe.
- Schermo piu stretto:
  - tile piu piccole
  - piu colonne nella griglia
  - gap ridotto

## Attributi principali

| Attributo | Default | Valori |
|---|---|---|
| `data-inat-widget` | - | abilita widget |
| `data-inat-source` | - | username/id/URL in base al source type |
| `data-inat-source-type` | `user` | `user`, `project`, `place`, `taxon`, `observation` |
| `data-inat-theme` | `light` | `light`, `dark`, `transparent-light`, `transparent-dark` |
| `data-inat-photo-size` | `auto` | `auto`, `square`, `small`, `medium`, `large` |
| `data-inat-limit` | `10` | intero `1..50` |
| `data-inat-order-by` | `observed_on` | stringa API iNaturalist |
| `data-inat-order` | `desc` | `asc`, `desc` |
| `data-inat-title` | `View my observations` | stringa |
| `data-inat-show-title` | `true` | boolean |
| `data-inat-show-stats` | `false` | boolean |
| `data-inat-cache` | `true` | boolean |
| `data-inat-lazy` | `true` | boolean |
| `data-inat-lazy-root-margin` | `300px 0px` | stringa CSS `rootMargin` |
| `data-inat-padding` | `14` | intero `0..50` |
| `data-inat-radius` | `14` | intero `0..50` |

Nota su `data-inat-photo-size`:
- controlla la compattezza del layout (dimensione tile/colonne).
- il widget scarica automaticamente una variante foto leggermente piu grande per mantenere nitidezza.

Nota su `data-inat-show-stats`:
- se impostato a `true`, mostra due box riepilogativi con:
  - totale osservazioni
  - totale specie osservate
- i box vengono renderizzati nell'header del widget.

Nota su cache:
- il widget usa `sessionStorage` per cache durante la sessione (tab aperta) di prima pagina osservazioni e totale specie.
- di default la cache e attiva (`data-inat-cache="true"`).
- puoi disattivarla con `data-inat-cache="false"`.

Nota su lazy init:
- di default il fetch parte quando il widget entra in viewport (`data-inat-lazy="true"`).
- puoi disattivarlo con `data-inat-lazy="false"`.
- `data-inat-lazy-root-margin` controlla l'anticipo del preload (es. `300px 0px`).

## Filtri opzionali

- `data-inat-taxon`
- `data-inat-quality` oppure `data-inat-quality-grade`
- `data-inat-date`
- `data-inat-date-from`
- `data-inat-date-to`

## Playground

Apri `test-widget.html` per provare:
- larghezza preview mobile/tablet/laptop
- photo size e altri parametri

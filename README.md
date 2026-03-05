# iNaturalist Widget (custom)

Widget JavaScript/CSS standalone per mostrare osservazioni iNaturalist tramite attributi `data-*` su un `div`.

## File

- `inat-widget-custom.js`: loader e renderer del widget.
- `inat-widget-custom.css`: stili del widget.

## Uso base

```html
<link rel="stylesheet" href="./inat-widget-custom.css">
<script defer src="./inat-widget-custom.js"></script>

<div
  data-inat-widget
  data-inat-source="andreaadelfio"
  data-inat-source-type="user"
  data-inat-limit="12"
  data-inat-layout="grid"
  data-inat-theme="light"
></div>
```

## Valori da mettere nel `div`

Il widget legge gli attributi `data-*` in camelCase interno. Esempio: `data-inat-source` -> `inatSource`.

### Attributi obbligatori

- `data-inat-widget`: abilita il widget su quel `div`.
- `data-inat-source`: sorgente principale (utente/id/URL in base a `data-inat-source-type`).

### Attributi opzionali

| Attributo | Default | Valori possibili | Note |
|---|---|---|---|
| `data-inat-source-type` | `user` | `user`, `project`, `place`, `taxon`, `observation` | Tipo sorgente usato per la query API. |
| `data-inat-limit` | `10` | intero `1..50` | Numero massimo osservazioni. |
| `data-inat-order` | `desc` | `asc`, `desc` | Ordinamento crescente/decrescente. |
| `data-inat-order-by` | `observed_on` | stringa libera (passata all'API iNat) | Campo su cui ordinare. |
| `data-inat-layout` | `grid` | `grid`, `list`, `cards` | Layout del widget. |
| `data-inat-theme` | `light` | `light`, `dark`, `transparent-light`, `transparent-dark` | Tema grafico. |
| `data-inat-title` | `View my observations on` | stringa | Testo header (se titolo visibile). |
| `data-inat-user-icon` | auto/fallback | URL immagine | Override avatar header. |
| `data-inat-taxon` | vuoto | id taxon (stringa/numero) | Filtro taxon aggiuntivo (ignorato se `source-type=taxon`). |
| `data-inat-quality` | vuoto | es. `research`, `needs_id`, `casual`, `any` | Filtro quality grade. |
| `data-inat-quality-grade` | vuoto | come sopra | Alias di `data-inat-quality`. |
| `data-inat-date` | vuoto | data (es. `2025-07-15`) | Filtra giorno esatto (`on`); ha priorita su range. |
| `data-inat-date-from` | vuoto | data (es. `2025-01-01`) | Inizio range (`d1`). |
| `data-inat-date-to` | vuoto | data (es. `2025-12-31`) | Fine range (`d2`). |
| `data-inat-show-title` | `true` | boolean | Mostra/nasconde testo titolo in header. |
| `data-inat-show-location` | `true` | boolean | Mostra location (layout `cards`). |
| `data-inat-show-grade` | `false` | boolean | Mostra quality grade (`list`/`cards`). |
| `data-inat-show-notes` | `false` | boolean | Mostra note osservazione (`cards`). |
| `data-inat-compact` | `false` | boolean | Modalita compatta (usata in `grid`). |
| `data-inat-radius` | `12` | intero `0..50` | Border radius contenitore/card. |
| `data-inat-padding` | `16` | intero `0..50` | Padding interno contenitore. |
| `data-inat-photo-size` | `auto` | `auto`, `square`, `small`, `medium`, `large` | Controlla risoluzione foto e densita grid: `small`/`square` aumentano le colonne e riducono i tile; `auto` usa `small` su mobile (`<=760px`) e `medium` su desktop/laptop. |

## Come impostare `data-inat-source`

- `data-inat-source-type="user"`: username iNaturalist (es. `andreaadelfio`).
- `data-inat-source-type="project"`: `project_id`.
- `data-inat-source-type="place"`: `place_id`.
- `data-inat-source-type="taxon"`: `taxon_id`.
- `data-inat-source-type="observation"`: ID osservazione o URL tipo `https://www.inaturalist.org/observations/123456`.

## Parsing boolean

Per gli attributi boolean, questi valori vengono interpretati come `false`:

- `false`
- `0`
- `no`

Qualsiasi altro valore non vuoto viene interpretato come `true`.

## Esempio completo

```html
<div
  data-inat-widget
  data-inat-source="andreaadelfio"
  data-inat-source-type="user"
  data-inat-limit="8"
  data-inat-order="desc"
  data-inat-order-by="observed_on"
  data-inat-layout="cards"
  data-inat-theme="transparent-light"
  data-inat-title="Le mie osservazioni su"
  data-inat-quality="research"
  data-inat-date-from="2025-01-01"
  data-inat-date-to="2025-12-31"
  data-inat-show-grade="true"
  data-inat-show-notes="true"
  data-inat-radius="14"
  data-inat-padding="18"
></div>
```

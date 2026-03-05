# iNaturalist Widget Bundle

This folder contains all iNaturalist widget assets separated from the main site styles/scripts.

## Files

- `inat-widget-custom.js`: dynamic widget loader and renderer (`data-inat-widget` API).
- `inat-widget-custom.css`: styles for the custom dynamic widget.
- `inat-widget-legacy.css`: styles for the legacy iNaturalist embed used in `index.html`.

## Current usage in this site

- `docs/photography.html` uses:
  - `inat-widget-custom.css`
  - `inat-widget-custom.js`
- `index.html` uses:
  - `inat-widget-legacy.css`

## Extraction to a separate repository

Copy this whole folder as-is, then wire the HTML pages to the same relative paths.

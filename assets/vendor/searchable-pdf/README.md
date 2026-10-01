# Searchable PDF assets

`fontkit.umd.min.js` is prepared from `@pdf-lib/fontkit` 1.1.1 under the MIT license. `NotoSansKR-400.js` contains the Noto Sans KR font bytes from `@fontsource/noto-sans-kr` 5.3.0 as base64 so the tool can load them through the existing same-origin `script-src` policy while retaining `connect-src 'none'`. Noto Sans KR is licensed under the SIL Open Font License 1.1. All assets are pinned, integrity checked, served from the same origin, and never fetched at runtime from a CDN.

The Korean font is embedded as a subset in generated PDFs. Updating either dependency requires running `npm run prepare:ocr` and reviewing the generated manifest.

# Tesseract OCR runtime

Secure Tools serves these files from its own origin. They are generated from the exact packages in `package-lock.json` by `npm run prepare:ocr`; `npm run prepare:ocr -- --check` verifies that the committed runtime files still match the installed packages.

| Component | Version/source | Deployed files | License |
| --- | --- | --- | --- |
| Tesseract.js | `tesseract.js@7.0.0` | `engine/tesseract.min.js`, `worker/worker.min.js` | Apache-2.0 |
| Tesseract.js Core | `tesseract.js-core@7.0.0` | complete `core/tesseract-core*` browser runtime set | Apache-2.0 |
| English model | `@tesseract.js-data/eng@1.0.0`, `4.0.0_best_int` | `lang/eng.traineddata.gz` | Apache-2.0 upstream data; npm package metadata declares MIT |
| Korean model | `@tesseract.js-data/kor@1.0.0`, `4.0.0_best_int` | `lang/kor.traineddata.gz` | Apache-2.0 upstream data; npm package metadata declares MIT |

The language files are the integerized LSTM-only models used by Tesseract.js for its default LSTM engine. Their upstream is the `naptha/tessdata` distribution, derived from the Tesseract project data. The upstream tessdata repository publishes the data under Apache-2.0; the npm wrapper packages declare MIT in their package metadata. The shared Apache-2.0 text is retained in `licenses/Apache-2.0.txt`.

`manifest.json` records the deployed file sizes and SHA-256 values. No file in this directory checks for updates or provides a CDN fallback.

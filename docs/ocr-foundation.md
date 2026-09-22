# Local OCR foundation

## Scope and privacy

Sprint 16A provides reusable image OCR infrastructure without publishing an Image → Text tool. It accepts the same signature-validated PNG, JPEG, and WebP formats as the existing image pipeline and rasterizes them through the shared orientation-aware decoder before recognition. PDF rendering, searchable PDF output, camera capture, batch UI, OCR history, cloud OCR, and text post-processing are outside this foundation.

**User images and OCR output remain in the browser and are not sent to an OCR server.**

The adapter does not persist source images, decoded pixels, filenames, recognized text, or history. A source reference lives only for the active call. The oriented temporary PNG and decoded image are released after recognition or failure. Tesseract.js may cache the static language-model bytes in IndexedDB under its default write cache policy; those files contain no user information.

## Pinned same-origin assets

The lockfile pins:

- `tesseract.js@7.0.0`;
- `tesseract.js-core@7.0.0`;
- `@tesseract.js-data/eng@1.0.0`;
- `@tesseract.js-data/kor@1.0.0`.

`npm run prepare:ocr` copies the browser engine, worker, the complete browser core runtime set, and the English/Korean `4.0.0_best_int` data into `assets/vendor/tesseract/`. The generated manifest records byte lengths and SHA-256 values. `npm run build` is a non-mutating verification that every prepared file still matches the exact installed package.

Production URLs are:

- engine: `/assets/vendor/tesseract/engine/tesseract.min.js`;
- worker: `/assets/vendor/tesseract/worker/worker.min.js`;
- core directory: `/assets/vendor/tesseract/core/`;
- English: `/assets/vendor/tesseract/lang/eng.traineddata.gz`;
- Korean: `/assets/vendor/tesseract/lang/kor.traineddata.gz`.

The service always passes explicit `workerPath`, `corePath`, and `langPath` values. `corePath` is the directory, so Tesseract.js can choose the scalar, SIMD, or relaxed-SIMD LSTM runtime. `workerBlobURL: false` creates a direct same-origin worker. Missing local assets produce a controlled initialization failure; the application has no CDN or external-service retry.

## Service behavior

`tools/shared/ocr.js` supports `eng`, `kor`, and `eng+kor` internally. UI code should present localized language names rather than these engine identifiers.

One service instance reuses a ready worker while the selected language stays the same. Changing the language terminates that worker and creates a replacement. Recognition failure discards the worker so the next request starts cleanly. `dispose()` is idempotent and terminates the owned worker.

Progress callbacks receive only project-owned stages: `loading-engine`, `loading-language`, `initializing`, `recognizing`, and `complete`. Numeric upstream progress is clamped to `0..1`; missing progress remains `null`. Raw logger objects are never exposed, and callbacks are cleared after each operation.

Tesseract.js does not expose safe per-job cancellation. During recognition, an abort terminates and discards the worker before the promise rejects with `OCR_CANCELLED`; later work creates a new worker. An abort during initialization is observed as soon as the library yields the worker handle, which is then terminated before cancellation returns. This avoids reporting cancellation while an owned worker continues running.

## CSP and verification

The unlinked browser smoke page at `tests/browser/ocr-smoke.html` runs the real browser bundle, direct worker, WASM core, and English model under the same strict meta CSP used by production pages. It passed in Chromium with the existing `script-src 'self'`, inherited `worker-src 'self'`, and `connect-src 'none'` policy, without CSP or console errors. No production CSP was changed.

Run the repeatable browser check with `npm run smoke:ocr:browser`, then open the printed localhost URL and require a visible `PASS` result. The page rejects any third-party resource entry it observes. The automated Node smoke test performs real English recognition using local core and trained data; unit tests cover path configuration, language mapping, progress, orientation cleanup, reuse, language replacement, initialization/recognition failures, cancellation, disposal, and stale callbacks.

## Adding a language

To add a language later:

1. pin its `@tesseract.js-data/<code>` package in `package.json` and refresh the lockfile;
2. add its `4.0.0_best_int/<code>.traineddata.gz` copy rule to `scripts/prepare-ocr-assets.mjs`;
3. add the engine code to the service allowlist and localized display strings to the future UI;
4. regenerate assets and update provenance, integrity, unit, and real-recognition coverage;
5. verify the browser smoke path still makes only same-origin runtime requests.

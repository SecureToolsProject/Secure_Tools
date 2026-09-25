# Local OCR foundation

## Scope and privacy

Sprint 16A provides the reusable OCR infrastructure. Sprint 16B publishes it as a single-image Image → Text tool in the v2.1.0 development cycle. It accepts the same signature-validated PNG, JPEG, and WebP formats as the existing image pipeline and rasterizes them through the shared orientation-aware decoder before recognition. PDF rendering, searchable PDF output, camera capture, batch UI, OCR history, cloud OCR, and automatic text post-processing remain outside this scope.

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

Browser HTTP cache and Tesseract.js model caching may allow a previously loaded workflow to run while disconnected. Secure Tools does not install a service worker and does not guarantee that application, worker, core, or model assets are available offline. A fresh or partially cached browser can therefore fail with the localized initialization error. There is no cloud fallback.

## Service behavior

`tools/shared/ocr.js` supports `eng`, `kor`, and `eng+kor` internally. UI code should present localized language names rather than these engine identifiers.

One service instance reuses a ready worker while the selected language stays the same. Changing the language terminates that worker and creates a replacement. Recognition failure discards the worker so the next request starts cleanly. `dispose()` is idempotent and terminates the owned worker.

Progress callbacks receive only project-owned stages: `loading-engine`, `loading-language`, `initializing`, `recognizing`, and `complete`. Numeric upstream progress is clamped to `0..1`; missing progress remains `null`. The Image → Text page renders missing numeric progress as indeterminate instead of inventing a percentage. Raw logger objects are never exposed, and callbacks are cleared after each operation.

Tesseract.js does not expose safe per-job cancellation. During recognition, an abort terminates and discards the worker before the promise rejects with `OCR_CANCELLED`; later work creates a new worker. An abort during initialization is observed as soon as the library yields the worker handle, which is then terminated before cancellation returns. This avoids reporting cancellation while an owned worker continues running.

The public controller adds a monotonically increasing request identity around the service. Only the current source, language, and recognition request may update progress or results. Replacing or removing a source, changing language, cancelling, or leaving the page invalidates earlier callbacks. The six visible phases are `empty`, `ready`, `recognizing`, `success`, `error`, and `cancelled`.

## CSP and verification

The browser smoke page at `tests/browser/ocr-smoke.html` runs the real browser bundle, direct worker, WASM core, and English model under the same strict meta CSP used by production pages. The public route uses the same runtime paths and unchanged production CSP. Browser QA also exercises the actual Image → Text selection, recognition, edit, copy/download, replace, remove, and cancellation paths.

Run the repeatable browser check with `npm run smoke:ocr:browser`, then open the printed localhost URL and require a visible `PASS` result. The page rejects any third-party resource entry it observes. The automated Node smoke test performs real English, Korean, and combined recognition using local core and trained data; unit tests cover path configuration, language mapping, progress, orientation cleanup, reuse, language replacement, initialization/recognition failures, cancellation, disposal, and stale callbacks.

## Adding a language

To add a language later:

1. pin its `@tesseract.js-data/<code>` package in `package.json` and refresh the lockfile;
2. add its `4.0.0_best_int/<code>.traineddata.gz` copy rule to `scripts/prepare-ocr-assets.mjs`;
3. add the engine code to the service allowlist and localized display strings to the future UI;
4. regenerate assets and update provenance, integrity, unit, and real-recognition coverage;
5. verify the browser smoke path still makes only same-origin runtime requests.

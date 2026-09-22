# Production dependencies

Secure Tools pins production libraries as same-origin static files under `assets/vendor/`. Runtime pages do not install packages, use a CDN, or automatically check for updates.

| Dependency | Version | Purpose | License | Detailed record |
| --- | ---: | --- | --- | --- |
| jsPDF | 4.2.1 | Images to PDF generation | MIT | [Vendor README](../assets/vendor/jspdf/README.md) |
| pdf-lib | 1.17.1 | PDF inspection, document-info cleaning, page copying, merge, split, and organization | MIT | [Vendor README](../assets/vendor/pdf-lib/README.md) |
| JSZip | 3.10.1 | Local multi-file Image and PDF archives | MIT license choice | [Vendor README](../assets/vendor/jszip/README.md) |
| PDF.js (`pdfjs-dist`) | 6.2.108 | PDF Organizer thumbnails and PDF to Images rendering | Apache-2.0 | [Vendor README](../assets/vendor/pdfjs/README.md) |
| secure-metadata | 0.1.1 | JPEG, PNG, and WebP metadata inspection, cleaning, and verification | MIT | [Vendor README](../assets/vendor/secure-metadata/README.md) |
| Tesseract.js | 7.0.0 | Browser OCR orchestration and worker | Apache-2.0 | [Vendor README](../assets/vendor/tesseract/README.md) |
| Tesseract.js Core | 7.0.0 | Browser WASM OCR runtime variants | Apache-2.0 | [Vendor README](../assets/vendor/tesseract/README.md) |
| English/Korean trained data | 1.0.0 npm packages, `4.0.0_best_int` data | LSTM language models | Apache-2.0 upstream data; npm metadata declares MIT | [Vendor README](../assets/vendor/tesseract/README.md) |

## Vendoring and integrity

Each vendor directory contains the deployed runtime files plus its license and package/provenance metadata. The vendor README is the human-readable source of truth for upstream artifacts and exact runtime hashes. `tests/release-gate.test.mjs` verifies the approved file inventory, versions, metadata, licenses, and runtime SHA-256 values.

The summary table intentionally does not duplicate every artifact hash. Keeping exact values beside the bytes they validate reduces drift while preserving a navigable inventory here.

OCR is the one dependency family with a preparation step because it combines a browser bundle, worker, the complete resolved core runtime set, and selected language packages. `npm ci --ignore-scripts` installs the lockfile exactly. `npm run prepare:ocr` copies those inputs into `assets/vendor/tesseract/` and writes their SHA-256 manifest; `npm run build` checks the committed production assets against the installed packages without changing them.

## secure-metadata integration

The current runtime is `secure-metadata v0.1.1`, release commit `cdcd138e48d30618b6d76f7c6538cd43ad660b53`. Its browser artifact is `secure-metadata-0.1.1.browser.js` with SHA-256 `4bfcc9e0e484db12192e46f076c19cf69cd36c496c7cfbb5a71c1057cbcccba1`.

The browser and package artifacts were verified against the published `SHA256SUMS` manifest and GitHub asset digests. The deployed browser bytes match the build inside the release package. Secure Tools imports that artifact only from its own origin; replacement requires a new explicit provenance and integrity review.

The supported privacy and preservation behavior is documented separately in [Image Metadata privacy and verification](./image-metadata-privacy.md).

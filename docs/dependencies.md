# Production dependencies

Secure Tools pins production libraries as same-origin static files under `assets/vendor/`. Runtime pages do not install packages, use a CDN, or automatically check for updates.

| Dependency | Version | Purpose | License | Detailed record |
| --- | ---: | --- | --- | --- |
| jsPDF | 4.2.1 | Images to PDF generation | MIT | [Vendor README](../assets/vendor/jspdf/README.md) |
| pdf-lib | 1.17.1 | PDF inspection, document-info cleaning, page copying, merge, split, and organization | MIT | [Vendor README](../assets/vendor/pdf-lib/README.md) |
| JSZip | 3.10.1 | Local multi-file Image and PDF archives | MIT license choice | [Vendor README](../assets/vendor/jszip/README.md) |
| PDF.js (`pdfjs-dist`) | 6.2.108 | PDF Organizer thumbnails and PDF to Images rendering | Apache-2.0 | [Vendor README](../assets/vendor/pdfjs/README.md) |
| secure-metadata | 0.1.1 | JPEG, PNG, and WebP metadata inspection, cleaning, and verification | MIT | [Vendor README](../assets/vendor/secure-metadata/README.md) |

## Vendoring and integrity

Each vendor directory contains the deployed runtime files plus its license and package/provenance metadata. The vendor README is the human-readable source of truth for upstream artifacts and exact runtime hashes. `tests/release-gate.test.mjs` verifies the approved file inventory, versions, metadata, licenses, and runtime SHA-256 values.

The summary table intentionally does not duplicate every artifact hash. Keeping exact values beside the bytes they validate reduces drift while preserving a navigable inventory here.

## secure-metadata integration

The current runtime is `secure-metadata v0.1.1`, release commit `cdcd138e48d30618b6d76f7c6538cd43ad660b53`. Its browser artifact is `secure-metadata-0.1.1.browser.js` with SHA-256 `4bfcc9e0e484db12192e46f076c19cf69cd36c496c7cfbb5a71c1057cbcccba1`.

The browser and package artifacts were verified against the published `SHA256SUMS` manifest and GitHub asset digests. The deployed browser bytes match the build inside the release package. Secure Tools imports that artifact only from its own origin; replacement requires a new explicit provenance and integrity review.

The supported privacy and preservation behavior is documented separately in [Image Metadata privacy and verification](./image-metadata-privacy.md).

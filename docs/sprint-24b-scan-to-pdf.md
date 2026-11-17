# Sprint 24B — Scanner to PDF

## Implementation and dependency

The working tree was clean. PR #141 was inspected and remained open at `f33acada5e0406fdb3d20a9e938ce62556c6acec`. This feature branch (`feat/v2.4-scan-to-pdf`) starts from that exact head, preserving its commits without modifying or merging #141. The requested PR base is v2.4: until #141 merges, its prerequisite commits appear in the comparison. Review the 24B-specific range from the recorded parent head; merge #141 through a separately authorized review first. No production branch, release tag or deployment is changed by this task.

`tools/scan/document/pdf.ts` adapts the existing Images to PDF `createPdfBlob` writer and vendored jsPDF. It snapshots ordered source Files and their actual per-page modes, decodes with the existing EXIF-aware helper, and calls the shared scan rasterizer at full source resolution. It never exports a preview URL or a 1,000px thumbnail. Lossless PNG embedding preserves the deterministic document threshold; grayscale and original modes are also represented in the exported pixels. The existing A4/automatic-orientation/10-mm-margin contain-fit convention is reused without new paper controls or dependencies.

The shared composition function now supports optional AbortSignal, asynchronous image conversion and a PNG format override while retaining its original JPEG defaults for Images to PDF. The shared scan rasterizer exposes source-resolution rendering and processes non-original modes in 64-row strips, reusing the same deterministic pixel function as previews. The preview entry point retains its 1,000px bound and owns bitmap cleanup.

The scanner UI adds Create PDF, progress/status, keyboard-accessible Cancel, retry through Create PDF, actual PDF.js canvas preview with previous/next navigation, and native PDF download. PDF.js is the existing local renderer; there is no iframe/object, CSP exception, document upload or new service. Input addition, page order/removal, appearance application, clear/reset and page exit invalidate generated output and destroy preview resources. The output Blob remains only while its matching page state is current; download URLs use the existing delayed revocation helper.

## Limits and lifecycle

- Existing admission: 20 pages, 200 MiB source total, 50 MiB per source; shared decode dimensions/pixel bounds remain intact.
- Export: at most 12,000,000 decoded pixels per image and 24,000,000 total; cumulative encoded page images and final PDF are limited to 64 MiB. Larger inputs remain previewable but export reports a recoverable limit error; no silent quality reduction is performed.
- One export writer runs at a time, including superseded jobs. A generation guard suppresses old progress/results even if a native writer ignores abort. Scanner preview work remains serialized separately; an input change can briefly overlap one native export operation and one preview decode, rather than accumulating export writers.
- Bitmaps close in composition `finally`; raster canvases shrink to 1×1 on success/error/cancel. Strip processing yields to input and checks cancellation. PDF preview buffers are bounded to 900px on the longest edge and reset after rendering. PDF.js loading/rendering tasks and workers are destroyed on invalidation/reset. Only the output Blob and the active renderer's document buffers remain for preview/download.
- Native decode, canvas encoding, synchronous jsPDF image embedding and final serialization cannot be interrupted mid-call. Cancellation is checked around those calls and between strips/pages, and prevents output publication. This is cancellation by invalidation during an uninterruptible native call, not a claim of hard process termination.

## Validation

- `npm run typecheck`, `npm run compile:ts`, `npm run build`: passed locally; 20 canonical routes / 17 redirects; pinned assets unchanged.
- `node tests/scanner-pdf.test.mjs`: passed. Real jsPDF output reloads with pdf-lib; state/order/mode snapshots, portrait/landscape geometry, pixel/page/byte budgets, source-resolution strip rasterization, mid-strip cancellation, bitmap/canvas cleanup, serialized rapid replacement, stale results, errors and retry are covered.
- `node tests/scanner.test.mjs`, `node tests/image-to-pdf.test.mjs`, `node tests/i18n-quality.test.mjs`, `node tests/typescript-foundation.test.mjs`, `node tests/verify-browser-export-artifacts.mjs`: passed. Existing JPEG composition remains compatible; all six locale key sets are checked.
- `npm test`: functional/regression tests passed through artifact checks locally; HTTP security hardening rejects AdGuard's injected CSP mutations. The strict policy was not relaxed. The remaining retained export artifact check was also run independently and passed.
- `node tests/browser/scanner-pdf.mjs`: real Chromium completed ten PDF-result viewport cases (en/ko × 320×568, 390×844, 844×390, 768×1024, 1280×900). Two native four-page PDF downloads were parsed and rendered. Embedded images retained 1,200×2,000 / 2,000×1,200 dimensions while queue previews were 600×1,000 / 1,000×600; EXIF orientation=6 exported 30×60. Rendered sample RGB values were `[92,92,92]` (Grayscale), `[220,40,20]` (Original), `[0,0,0]` (Document), with the exact reordered portrait/landscape sequence. Preview navigation, cancellation, rapid mutation, fault-injected writer error/retry, mode invalidation, over-budget rejection, one download per click, URL revocation and worker teardown are exercised.
- Browser screenshots were visually inspected. Local strict CSP/network checks detect host-injected `local.adguard.org` requests; document POST/mutation requests were absent. Clean hosted CI runs the same strict scanner-PDF gate alongside original scanner, existing PDF/Image/OCR, responsive/accessibility, security-header and artifact gates. The final hosted run links/status are recorded in the PR to avoid making local interference appear to pass.

Physical mobile devices, Firefox and Edge were not tested locally. The Chromium results are browser automation and visual review, not a claim of physical-device QA. Output contains raster document pages; OCR/searchable text is not added.

## 24C follow-ups

Reuse the existing OCR service for optional scanner text recognition, including English/Korean/combined selection, progress, cancellation, worker reuse, retry and normalized geometry. Keep ordinary PDF creation independent of OCR. Searchable-PDF adapter work remains 24D; neither existing OCR initialization nor searchable-PDF writer should be duplicated.

## Changed paths (24B only, relative to the #141 head)

- `.github/workflows/ci.yml`
- `CHANGELOG.md`
- `README.md`
- `docs/architecture.md`
- `docs/sprint-24b-scan-to-pdf.md`
- `docs/tool-status.md`
- `js/locales/document-scanner.js`
- `scripts/stage-typescript-test-dependencies.mjs`
- `scripts/typescript-modules.mjs`
- `tests/browser/scanner-pdf.mjs`
- `tests/i18n-quality.test.mjs`
- `tests/run-all.mjs`
- `tests/scanner-pdf.test.mjs`
- `tests/typescript-foundation.test.mjs`
- `tools/pdf/images-to-pdf/pdf.d.ts`
- `tools/pdf/images-to-pdf/pdf.js`
- `tools/scan/document/app.js`
- `tools/scan/document/index.html`
- `tools/scan/document/pdf.ts`
- `tools/scan/document/result.js`
- `tools/scan/document/tool.css`
- `tools/shared/scan.ts`

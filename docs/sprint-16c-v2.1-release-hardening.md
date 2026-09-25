# Sprint 16C v2.1.0 release hardening

Date: 2026-09-23

Candidate: `v2.1` at `74d152a5b79a82abb38ca86d60b3b1b313041dce`

Production baseline: `main` at `4bc9fb5835d72b1512662d7ca80f2505ba08be00`

## Baseline and automated checks

- The baseline working tree was clean, `v2.1` matched `origin/v2.1`, and no open issue or pull request affected the candidate.
- Sprint 16A, Sprint 16B, the development-safety workflow, and branch-policy CI guard were present.
- A clean `npm ci --ignore-scripts` installed the exact lockfile with zero reported vulnerabilities.
- `npm run build`, `npm test`, `node tests/ocr-smoke.test.mjs`, and `git diff --check` passed before hardening.
- The real runtime smoke now recognizes English, Korean, and combined Korean/English fixtures through the pinned local runtime.
- The full suite covers every PDF and Image workflow, both metadata tools, direct routes, localization parity, CSP, SEO/canonical metadata, sitemap, deployment resources, object-URL cleanup, save behavior, and branch policy.

## OCR runtime, assets, and privacy

- Pinned packages remain `tesseract.js@7.0.0`, `tesseract.js-core@7.0.0`, and English/Korean data packages at `1.0.0`.
- Explicit worker, core, and language paths resolve under `/assets/vendor/tesseract/`; `workerBlobURL: false` keeps the worker same-origin. No CDN or OCR API fallback is present.
- The prepared inventory contains the engine, worker, both trained-data files, and all 18 scalar/SIMD/relaxed-SIMD core files. Manifest byte lengths and SHA-256 values match every deployed asset, with no duplicate or extra runtime copy.
- The complete committed OCR vendor tree is 49,961,571 bytes. Core variants total 45,244,609 bytes; English data is 2,952,873 bytes; Korean data is 1,572,336 bytes; worker files total 111,773 bytes; engine files total 63,110 bytes.
- Image → Text loads its OCR engine and modules only on its own route. Representative non-OCR pages do not reference the Tesseract runtime.
- Source images, filenames, decoded pixels, recognized text, and history are held only for the active in-memory workflow. Secure Tools does not persist them. Tesseract.js may cache static language-model bytes in IndexedDB; those dependency bytes contain no user content.

## Chromium browser QA

QA used the repository static server and the production Image → Text page under its unchanged production CSP.

- A clean-origin first run selected a real PNG, began combined recognition, cancelled during initialization, reported the localized cancelled state, and retried successfully.
- Combined OCR returned `한글 HELLO`. The result remained editable; clipboard copy preserved mixed Korean/English text; TXT download reported the expected source-derived filename.
- Replacing the source with a 3000 × 2000 PNG and recognizing eight text lines completed correctly. The page did not permanently freeze or lose its source/result state. This constrained browser run took about 14 minutes, so large-image latency remains device-dependent and cancellation is the practical escape path.
- The browser smoke page returned `PASS: HELLO` and would fail on any third-party resource entry. The production workflow produced no console or CSP warning.
- With the local server stopped after prior loading, Chromium reloaded the cached page and completed combined OCR from cached static runtime/model assets. This is observed cache behavior, not a full offline guarantee; a fresh browser without required cached assets cannot rely on offline OCR and receives the existing localized initialization failure.
- No hidden cloud fallback, user upload, analytics, telemetry, or third-party OCR request exists.

## Locale, theme, responsive, and accessibility QA

- English, Korean, Japanese, Spanish, German, and French each rendered the localized Image → Text heading with zero raw translation keys. Automated parity covers all 817 keys, placeholders, metadata, controls, errors, status text, and accessibility labels.
- System, Light, and Dark selected distinct resolved theme values without changing workflow state.
- At 375 × 812 the document width stayed within the viewport and the picker, recognition action, and result textarea remained visible and usable. The tablet check at 768 pixels also had no horizontal overflow.
- The browser accessibility tree exposed the file picker, language selector, result editor, cancel/retry, copy, and download controls with names in the active locale. Unit/static checks cover live status, busy/disabled state, logical native controls, visible focus rules, and reduced-motion rules.

## Existing-tool and discovery regression

- Direct Chromium navigation loaded Images → PDF, PDF Merge, PDF Split, PDF Organizer, PDF → Images, PDF Metadata, Image Converter, Resize, Compress, and Image Metadata with their file controls and localized headings.
- Automated workflow tests exercise actual processing, cancellation/error paths, signature validation, output generation, and metadata verification for those tools.
- Image → Text has one canonical route, localized title/description metadata, Open Graph metadata, sitemap membership, and Image-category discovery. No duplicate canonical route was found.

## Findings

| Severity | Finding | Status |
| --- | --- | --- |
| MEDIUM | Architecture documentation still described four Image tools and called OCR non-public after Sprint 16B. | Fixed: inventory and public OCR ownership now match the implementation. |
| LOW | The real runtime smoke covered English only, leaving Korean and combined model execution to unit/browser evidence. | Fixed: deterministic Korean/English fixture now exercises `kor` and `eng+kor`. |
| LOW | A 3000 × 2000 OCR run took about 14 minutes in the constrained Chromium QA profile. | Open limitation: operation completed correctly; progress/cancel remain available and latency depends on image and device. No arbitrary file limit was introduced. |

No BLOCKER or HIGH issue was found. No CSP or dependency change was required.

## Release readiness

**GO.** The v2.1 candidate has no remaining release blocker and is ready for a separate release-promotion pull request into `main`. This hardening Sprint does not create that PR, a tag, or a GitHub Release.

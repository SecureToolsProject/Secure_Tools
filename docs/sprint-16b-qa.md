# Sprint 16B Image → Text QA

Date: 2026-09-23  
Development cycle: v2.1.0  
Route: `/tools/image/to-text/`

## Automated evidence

- `npm run build`: pinned OCR assets match the installed packages and lockfile.
- `npm test`: syntax, state-machine, stale-callback, localization, route, CSP, privacy, responsive-contract, and regression suites pass.
- `node tests/ocr-smoke.test.mjs`: real local English OCR passes with the pinned core and language data.
- The browser smoke page completes real English OCR through the same direct worker, WASM core, and language-model paths and reports `PASS: HELLO`.

## Chromium browser QA

Completed in the Chromium-based Codex in-app browser against the repository’s local static server.

- Selected a production PNG through the actual public Image → Text file input and confirmed an orientation-normalized preview, source name, type, and size.
- Ran real English OCR through the production page and received editable recognized text.
- Edited the result to mixed English/Korean text, copied it successfully, and triggered the UTF-8 `.txt` download path with the source-derived filename.
- Cancelled combined English + Korean recognition while language data was loading, confirmed the explicit cancelled state, then retried successfully.
- Confirmed replacing language or starting a new request clears the earlier result; automated delayed-callback tests cover completion, cancellation, source replacement, and language-change races.
- Confirmed the empty state hides the source card, result panel, progress element, and cancel action. This caught and fixed a CSS `hidden`-attribute regression during QA.
- Switched through English, Korean, Japanese, Spanish, German, and French and confirmed the localized heading, controls, status text, document language, and page metadata update without reload.
- Reloaded with Korean selected and confirmed the preferred OCR default is English + Korean. Reloaded with Japanese selected and confirmed the preferred default returns to English.
- Switched through System, Light, and Dark themes. Confirmed resolved theme values and readable styled surfaces.
- Checked a 375 × 812 viewport: the page remained styled, the tool stacked responsively, and document width matched viewport width without horizontal page overflow.
- Confirmed no browser console warnings or errors in the final styled pass. The real OCR smoke recorded no third-party resource request.

PDF OCR and searchable PDF output remain deferred. This QA does not create a release or tag.

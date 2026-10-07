# PDF OCR foundation

The PDF OCR foundation is a shared, strict TypeScript pipeline used by PDF to Text and its Searchable PDF output. Layout-aware callers receive line text, confidence, raster dimensions, the inverse PDF.js viewport transform, and an existing-text signal from the same OCR pass.

## Pipeline

`tools/shared/pdf-ocr.ts` loads a local PDF with the existing same-origin PDF.js renderer, renders each selected page to a white-background PNG canvas, and passes that page image to the existing Tesseract OCR service. Text-only callers keep the ordered `{ pageNumber, text }` contract; layout-aware callers opt into line boxes and page geometry. The pipeline preserves English, Korean, and English + Korean recognition only.

Pages are processed sequentially with one OCR service. A render scale of `2` corresponds to approximately 144 pixels per PDF inch and balances OCR detail with browser memory. The existing 16,384-pixel dimension and 50-megapixel canvas safeguards remain in force. Documents with 25 or more pages surface a `largeDocument` signal rather than receiving an arbitrary hard rejection.

## Lifecycle and progress

Progress reports document loading, page rendering, real OCR stages, completed pages, and overall progress derived from actual OCR values. Unknown OCR progress remains indeterminate. Callers may select every page or an explicit ordered list of one-based page numbers.

Cancellation destroys the active PDF renderer and forwards an abort signal to OCR. Generation checks prevent late progress and page results after cancellation or source replacement. Every page proxy is cleaned, every canvas is reset to 1 × 1, the renderer is destroyed after each job, and OCR disposal terminates its worker. No page image, text, or PDF is uploaded, and no object URL is required.

The PDF to Text route uses the layout-aware contract for both editable TXT output and Searchable PDF generation. This avoids a second OCR run while keeping older text-only callers compatible.

## Verification

Unit tests cover page selection, page numbering, layout data, viewport inversion, all three OCR language contracts, progress, invalid input, retry, cancellation during rendering and recognition, source replacement, stale callbacks, large-document signaling, and resource cleanup. The internal browser harness performs real one-page PDF rendering and English OCR, real multi-page and larger-page rendering, cancellation timing, and same-origin request checks. Existing OCR smoke continues to execute real English, Korean, and combined recognition.

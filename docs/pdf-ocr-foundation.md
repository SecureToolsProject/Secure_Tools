# PDF OCR foundation

The PDF OCR foundation is a shared, strict TypeScript pipeline for future PDF-to-text and Searchable PDF workflows. It is not currently exposed as a public tool route. Searchable PDF generation remains a separate Sprint.

## Pipeline

`tools/shared/pdf-ocr.ts` loads a local PDF with the existing same-origin PDF.js renderer, renders each selected page to a white-background PNG canvas, passes that page image to the existing Tesseract OCR service, and returns an ordered array of `{ pageNumber, text }` results. The pipeline preserves English, Korean, and English + Korean recognition only.

Pages are processed sequentially with one OCR service. A render scale of `2` corresponds to approximately 144 pixels per PDF inch and balances OCR detail with browser memory. The existing 16,384-pixel dimension and 50-megapixel canvas safeguards remain in force. Documents with 25 or more pages surface a `largeDocument` signal rather than receiving an arbitrary hard rejection.

## Lifecycle and progress

Progress reports document loading, page rendering, real OCR stages, completed pages, and overall progress derived from actual OCR values. Unknown OCR progress remains indeterminate. Callers may select every page or an explicit ordered list of one-based page numbers.

Cancellation destroys the active PDF renderer and forwards an abort signal to OCR. Generation checks prevent late progress and page results after cancellation or source replacement. Every page proxy is cleaned, every canvas is reset to 1 × 1, the renderer is destroyed after each job, and OCR disposal terminates its worker. No page image, text, or PDF is uploaded, and no object URL is required.

The core exposes review-ready page boundaries but no searchable PDF, positioned text layer, geometry mapping, or PDF output. A future public UI can add range parsing, review, copy, and TXT export around these typed contracts without changing the local processing boundary.

## Verification

Unit tests cover page selection, page numbering, all three OCR language contracts, progress, invalid input, retry, cancellation during rendering and recognition, source replacement, stale callbacks, large-document signaling, and resource cleanup. The internal browser harness performs real one-page PDF rendering and English OCR, real multi-page and larger-page rendering, cancellation timing, and same-origin request checks. Existing OCR smoke continues to execute real English, Korean, and combined recognition.

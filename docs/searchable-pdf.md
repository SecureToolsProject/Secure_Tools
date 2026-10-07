# Searchable PDF output

Searchable PDF is integrated into `/pdf/to-text/` so page selection, English/Korean language choice, progress, cancellation, and the existing local OCR pass are shared. It adds no route, redirect, category entry, upload, telemetry, or network service.

The OCR service requests Tesseract line boxes and confidence values together with text. No confidence threshold is applied: low-confidence text is retained rather than silently discarded. PDF.js supplies the rendered viewport transform; one inverse affine transform maps raster coordinates back to PDF coordinates for 0°, 90°, 180°, 270°, CropBox offsets, and the fixed 2× render scale.

The writer loads and saves the original document with the repository's pdf-lib 1.17.1. It appends opacity-zero text using a subsetted local Noto Sans KR font, leaving original page content and page order in place. Pages with meaningful existing selectable text skip the added OCR layer, and pages outside the selected OCR set remain unchanged. The original visible page is never replaced with a raster image.

Noto Sans KR comes from `@fontsource/noto-sans-kr` 5.3.0 under the SIL Open Font License 1.1. The font and `@pdf-lib/fontkit` 1.1.1 runtime are pinned, integrity checked, and served from the same origin. There is no runtime CDN request.

pdf-lib preserves ordinary page content, page geometry, metadata, links, annotations, and forms while adding content streams. Complex PDFs can contain implementation-specific structures such as signatures, dynamic forms, optional content, or unusual outlines; the application does not promise bit-for-bit preservation or continued signature validity after modification. Password-protected PDFs remain unsupported.

Cancellation is checked before and between pages and before/after serialization. pdf-lib serialization itself is synchronous and cannot be interrupted mid-save; a generation guard prevents a cancelled or superseded result from downloading after serialization returns.

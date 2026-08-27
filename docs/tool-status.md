# Tool status and scope

## Current surface

| Category | Tool or surface | Status | Formats / scope |
| --- | --- | --- | --- |
| PDF | [Images to PDF](../tools/pdf/images-to-pdf/) | Production | JPEG, PNG, WebP → PDF |
| PDF | [PDF Merge](../tools/pdf/merge/) | Production | Ordered PDF page copying |
| PDF | [PDF Split](../tools/pdf/split/) | Production | Ranges, every page, fixed intervals |
| PDF | [PDF Organizer](../tools/pdf/organize/) | Production | Preview, reorder, rotate, remove, export |
| PDF | [PDF to Images](../tools/pdf/to-images/) | Production | PDF pages → PNG, JPEG, WebP |
| PDF | [PDF Metadata Inspector & Cleaner](../tools/pdf/metadata/) | Production | Eight supported document-info fields |
| Image | [Image Converter](../tools/image/converter/) | Production | JPEG, PNG, WebP conversion |
| Image | [Image Resize](../tools/image/resize/) | Production | Pixel or percentage batch resize |
| Image | [Image Compressor](../tools/image/compress/) | Production | JPEG/WebP quality and PNG re-encoding |
| Image | [Image Metadata Inspector & Cleaner](../tools/image/metadata/) | Production | Supported JPEG, PNG, WebP metadata |
| Privacy | [Privacy hub](../tools/privacy/) | Production hub | Navigation to Image and PDF metadata tools |
| Scan/OCR | Category surface | Planned | No production processing tool |
| Media | Category surface | Planned | No production processing tool |

“Production” means linked and covered by the current repository validation. “Planned” cards are non-interactive. Secure Tools may later link separately deployed companion applications, but no Companion status or integration exists on the live site today.

## Shared Image boundaries

Image admission validates signatures before decoding. Image Converter, Resize, Compressor, and Images to PDF share a 50 MiB per-file limit, 100-file queue limit, 500 MiB aggregate queue limit, 16,384-pixel per-dimension limit, and 50-megapixel per-image decoded limit. Converter, Resize, and Compressor also enforce a 200-megapixel aggregate work limit appropriate to their output path.

Queues remain available after recoverable validation, decode, encode, archive, save, or cancellation failures. Unicode output bases are limited to 120 characters and 180 UTF-8 bytes, with deterministic collision suffixes. Multi-output workflows use the same-origin JSZip runtime and predictable ZIP names.

## Image tools

### Image Converter

Converts signature-validated JPEG, PNG, and WebP batches sequentially through browser decode, Canvas, and encode APIs. Explicit browser orientation handling renders normally displayed camera images in their intended orientation. JPEG and WebP expose lossy quality; PNG does not. PNG/WebP preserve alpha while JPEG flattens transparency onto white. Canvas re-encoding strips EXIF and other embedded image metadata but is not presented as configurable metadata cleaning. One output saves directly; multiple outputs use `converted_images.zip`.

### Image Resize

Supports pixel bounding dimensions and percentage scaling, preserves aspect ratio by default, permits an automatic dimension, and disables enlargement by default. Original/JPEG/PNG/WebP output follows the same transparency and quality rules as Converter. Outputs use `_resized` names; batches use `resized_images.zip`. A 200-megapixel aggregate output-work limit applies.

### Image Compressor

Preserves oriented pixel dimensions while re-encoding in Original/JPEG/PNG/WebP format. JPEG and WebP use an explicit quality setting; PNG is re-encoded without a misleading lossy-quality control. Results report original size, output size, signed byte difference, and percentage change, including increases. Outputs use `_compressed` names and `compressed_images.zip`. The tool does not resize, crop, target a byte size, or edit metadata selectively.

### Image Metadata Inspector & Cleaner

Accepts one JPEG, PNG, or WebP file and uses the pinned `secure-metadata v0.1.1` browser artifact without decoding or re-encoding pixels. It separates decoded fields from opaque detected containers and presents partial inspection as non-exhaustive. Privacy Clean and Customize operate only on supported metadata classes; verification must pass before output is saved. Valid unambiguous JPEG EXIF Orientation and ICC color information are preserved according to policy. Full guarantees and exclusions are in [Image Metadata privacy and verification](./image-metadata-privacy.md).

## PDF tools

### Images to PDF

Maintains a duplicate-preserving ordered image queue, validates image signatures, prepares sources sequentially, and uses jsPDF for page geometry and output. Preview and download object URLs are revoked. Mixed batches retain valid files and report rejected sources.

### PDF Merge

Accepts the PDF MIME type directly and uses `.pdf` only when the browser supplies no MIME type. It validates local PDFs, permits duplicates, and copies pages in queue order with pdf-lib instead of rasterizing them. Malformed, unsupported, encrypted, and password-protected inputs fail clearly; password entry and decryption are not implemented. Source files are read in generation order rather than retained as duplicate buffers.

### PDF Split

Extract mode preserves explicit page order and duplicate references. Every-page and fixed-interval modes generate sequential outputs, including a final remainder group. Pages are copied without rasterization. Output names use the shared sanitizer and sortable zero-padded page numbers. One output saves directly; multiple outputs are collected into one local ZIP.

### PDF Organizer

PDF.js renders bounded 200 CSS-pixel thumbnails with at most two concurrent tasks. Users can reorder, rotate, and remove pages; export uses `pdf-lib.copyPages` and page rotation metadata rather than thumbnail canvases, preserving original page content and dimensions. Clearing or replacing a source cancels render tasks and releases the document, worker, canvases, and retained references.

### PDF to Images

All-pages and selected-pages modes render through same-origin PDF.js. Selection preserves explicit order and duplicates. PNG is lossless; JPEG/WebP expose bounded quality. Scale is limited to 1×, 1.5×, 2×, or 3×, with 16,384-pixel and 50-megapixel page limits and at most two concurrent renders. One page saves directly; multiple pages use a ZIP archive.

### PDF Metadata Inspector & Cleaner

Inspects Title, Author, Subject, Keywords, Creator, Producer, Creation Date, and Modification Date from the standard document-info dictionary. Values remain raw in application state while the UI localizes dates, safely surfaces null characters, and limits each displayed value to 2,000 characters. Privacy Clean removes all present supported fields; Customize targets the same class-level fields. The output is reloaded and checked for requested removal plus page-count, dimension, and rotation preservation before save. This does not claim complete XMP, attachment, annotation, hidden-content, or structural sanitization.

## Deferred directions

Broader PDF modification, compression, encryption, XMP/structural sanitization, Scan/OCR, Media, and offline/PWA work remain deferred. Separately deployed companion applications are an architectural possibility, not a current product status or integration.

## Related guarantees

- [Privacy model](./privacy-model.md) defines local processing, network behavior, storage, and bounded claims.
- [Dependencies](./dependencies.md) records the pinned production runtime inventory.
- [v2 promotion QA](./v2-release-qa.md) preserves automated and manual evidence for this production surface.

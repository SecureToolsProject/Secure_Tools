# Secure Tools

Secure Tools is a privacy-first suite of browser utilities for everyday PDF and image work. Production tools process file contents on the user's device instead of sending them to an upload service.

The project is a static, category-first web application with no account requirement, backend, database, analytics, advertising, or telemetry.

## Core principles

- Process supported file contents locally with browser APIs and same-origin libraries.
- Make bounded, tool-specific privacy claims instead of promising complete anonymity or sanitization.
- Keep production processing free of file uploads, analytics, telemetry, remote codecs, and runtime CDNs.
- Vendor audited runtime dependencies on the Secure Tools origin where practical.
- Preserve clear resource limits, failure handling, keyboard access, responsive layouts, and six-language support.
- Keep source and Network-panel behavior inspectable.

See the [privacy model](./docs/privacy-model.md) for exact guarantees and boundaries.

## Available tools

### PDF

- [Images to PDF](./tools/pdf/images-to-pdf/) — arrange JPEG, PNG, and WebP images and save one PDF.
- [PDF Merge](./tools/pdf/merge/) — combine validated PDFs without rasterizing pages.
- [PDF Split](./tools/pdf/split/) — extract ranges or produce per-page and fixed-interval archives.
- [PDF Organizer](./tools/pdf/organize/) — preview, reorder, rotate, remove, and export pages.
- [PDF to Images](./tools/pdf/to-images/) — render pages to PNG, JPEG, or WebP.
- [PDF Metadata Inspector & Cleaner](./tools/pdf/metadata/) — inspect and remove supported document-info fields.

### Image

- [Image Converter](./tools/image/converter/) — convert JPEG, PNG, and WebP batches.
- [Image Resize](./tools/image/resize/) — resize batches by pixels or percentage.
- [Image Compressor](./tools/image/compress/) — quality-compress images and compare byte results.
- [Image Metadata Inspector & Cleaner](./tools/image/metadata/) — inspect supported metadata and save a verified cleaned copy without pixel re-encoding.

### Privacy

The [Privacy hub](./tools/privacy/) links to the specialized Image and PDF metadata tools. It is a cross-category navigation surface, not a generic sanitizer. Scan/OCR and Media remain planned.

Detailed formats, limits, and behavior are listed in [tool status](./docs/tool-status.md).

## Interface

Secure Tools includes English, Korean, Japanese, Spanish, German, and French interface catalogs. Theme choices are Light, Dark, and System. Language and theme preferences are the only application values stored in `localStorage`.

## Local development

Serve the repository over HTTP so ES Modules load correctly:

```bash
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Do not use a `file://` URL.

Run the complete validation suite with:

```bash
node tests/run-all.mjs
```

## Documentation

The [documentation index](./docs/README.md) links to the maintained sources of truth for:

- architecture and delivery;
- privacy, local processing, and network boundaries;
- production dependencies and vendoring;
- production and planned tool status;
- release QA evidence;
- UX, accessibility, localization, and format-specific privacy audits.

Release history is recorded in the [changelog](./CHANGELOG.md). The current v2.0.0 line remains in pre-release observation.

## Repository and license

Source: [SecureToolsProject/Secure_Tools](https://github.com/SecureToolsProject/Secure_Tools)

See [LICENSE](./LICENSE). Vendored third-party code retains its own license beside each dependency.

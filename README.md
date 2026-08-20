# Secure Tools

Secure Tools is a privacy-first web hub for everyday file utilities. Production tools process file contents locally in the browser instead of uploading them to a server.

Sprint 4 adds a minimal Pull Request/main CI gate and the third production PDF tool, PDF Split. The category-first architecture remains the stable navigation layer.

## Available tools

- [Images to PDF](./tools/pdf/images-to-pdf/) — arrange JPEG, PNG, and WebP images and save them as one PDF.
- [Merge PDF](./tools/pdf/merge/) — validate, order, and combine PDF pages without rasterizing them.
- [Split PDF](./tools/pdf/split/) — extract ordered page ranges or create predictable per-page and fixed-interval archives.

The homepage and category hubs clearly distinguish production tools from planned work.

## Privacy principles

- File contents are processed on the user's device by production tools.
- Basic utilities do not require an account.
- The web hub includes no analytics, behavioral tracking, advertising, or tracking pixels.
- Theme and language preferences are the only values stored in `localStorage`.
- First-party tool code does not call `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon`.
- Privacy claims can be checked through source inspection and the browser Network panel.
- External links such as GitHub are governed by the destination service's policies.

## Architecture

The hub is a static site built with semantic HTML, CSS, and Vanilla JavaScript ES Modules. It has no framework, build step, backend, database, authentication, runtime API, or required package installation.

```text
.
├── index.html
├── 404.html
├── about/
├── privacy/
├── css/
│   ├── base.css
│   ├── components.css
│   ├── pages.css
│   ├── categories.css
│   └── secondary.css
├── js/
│   ├── config.js
│   ├── i18n.js
│   ├── main.js
│   ├── theme.js
│   └── locales/
│       ├── en.js
│       └── ko.js
├── tools/
│   ├── shared/
│   │   ├── file.js
│   │   ├── pdf.js
│   │   └── save.js
│   ├── pdf/
│   │   ├── index.html
│   │   ├── images-to-pdf/
│   │   ├── merge/
│   │   └── split/
│   ├── image/
│   ├── privacy/
│   ├── scan/
│   ├── media/
│   └── image-to-pdf/
│       └── index.html
├── assets/vendor/
│   ├── jszip/
│   ├── jspdf/
│   └── pdf-lib/
└── tests/
    ├── ci-foundation.test.mjs
    ├── image-to-pdf.test.mjs
    ├── pdf-merge-and-categories.test.mjs
    ├── pdf-split.test.mjs
    └── run-all.mjs
```

`js/main.js` initializes shared theme and internationalization behavior. `js/theme.js` owns Light, Dark, and System selection, OS color-scheme observation, and persistence. `js/i18n.js` detects English or Korean, applies `data-i18n` bindings without reloading, updates metadata and `<html lang>`, and persists manual selection. Repository links are centralized in `js/config.js`.

The category hubs are:

- `/tools/pdf/`
- `/tools/image/`
- `/tools/privacy/`
- `/tools/scan/`
- `/tools/media/`

Categories are the stable navigation layer. Individual utilities can be added beneath them without turning the homepage into an unstructured tool list. Planned utilities remain visible only when clearly marked as unavailable.

`/tools/image-to-pdf/` is a lightweight static migration page with a meta refresh and visible fallback link to `/tools/pdf/images-to-pdf/`. It does not use JavaScript to redirect.

## Images to PDF

Images to PDF is available at `/tools/pdf/images-to-pdf/`.

- `app.js` manages picker/drop input, duplicate-preserving queue state, ordering, removal, settings, progress, and save behavior.
- `image.js` validates and decodes JPEG, PNG, and WebP using browser-local APIs.
- `pdf.js` owns page geometry, image placement, sequential preparation, and jsPDF generation.
- Preview object URLs and temporary download URLs are revoked when no longer needed.
- File admission validates JPEG, PNG, and WebP signatures before browser decoding; a supported signature may override a misleading MIME type or extension.
- Individual files are limited to 50 MiB, queues to 100 files and 500 MiB, image dimensions to 16,384 pixels per side, and decoded images to 50,000,000 pixels.
- Mixed batches keep valid files and report each rejected filename with a localized reason.

Images are decoded and converted sequentially so the tool does not keep every full decoded image in memory at once.

## PDF Merge

PDF Merge is available at `/tools/pdf/merge/`.

- PDF MIME type is accepted directly; `.pdf` is used only as a fallback when the browser supplies no MIME type.
- Files are checked locally and the queue displays filename, size, and page count.
- Duplicate files are allowed and remain in the chosen order.
- Pages are copied with `pdf-lib`, preserving their PDF page content, dimensions, and orientation instead of rasterizing them.
- Source files are read in queue order during generation rather than retaining duplicate `ArrayBuffer` copies.
- Single-file, multi-file, multi-page, mixed-size, and repeated merges use the same path.
- Malformed, unsupported, encrypted, and password-protected files receive clear errors. Password entry and decryption are intentionally not implemented.
- The File System Access save picker is used when available; other browsers receive a local Blob download.

Shared filename, file-size, ordering, save-picker, and download behavior lives in `tools/shared/`.

## PDF Split

PDF Split is available at `/tools/pdf/split/` and accepts one source PDF at a time.

- Extract mode accepts individual pages and ascending ranges, preserves the explicit order, and intentionally preserves duplicate page references.
- Every-page mode creates one PDF per source page.
- Fixed-interval mode creates sequential groups and includes any remainder in the final file.
- `pdf-lib` copies original PDF pages without rasterizing them, preserving page dimensions and selectable/vector content.
- Multi-file modes generate outputs sequentially and add each `Uint8Array` to one local JSZip archive. They do not use base64 or trigger uncontrolled individual downloads.
- Output names use the shared sanitizer and sortable zero-padded page numbers.
- The source is read once during generation. Output documents are created one group at a time; the finished archive necessarily retains its entries until the ZIP Blob is produced.
- Unsupported, malformed, encrypted, and password-protected documents fail without attempting to bypass protection.
- English/Korean copy, shared theme controls, keyboard-labelled controls, live status, honest progress phases, and reduced-motion foundations are reused from the site architecture.

A single extracted PDF uses the existing save-picker/download fallback. Multi-output modes save one predictable ZIP archive.

## PDF Organizer

PDF Organizer is available at `/tools/pdf/organize/` for one local source PDF at a time.

- An explicit page model tracks original page identity, current order, absolute rotation, and removal state independently of the DOM.
- PDF.js renders bounded 200 CSS-pixel thumbnails with at most two concurrent render tasks. Its same-origin module and worker run with optional network-fetched assets and WASM disabled.
- Pointer dragging and semantic move-earlier/move-later buttons provide equivalent ordering paths.
- Rotation uses normalized 0/90/180/270-degree state. Reset recreates the original order, rotations, and page set without rereading the source.
- Export uses `pdf-lib.copyPages` and page rotation metadata; it never uses thumbnail canvases, so original vector content, selectable text, embedded images, and page dimensions remain intact.
- Replacing or clearing a source cancels render tasks, destroys the PDF.js document/worker, clears thumbnail canvases, and releases retained source references.

The original source file is never modified. The File System Access save picker is used when available, with the shared Blob-download fallback elsewhere.

## Local processing dependencies

All processing libraries are pinned and served as same-origin static files. Production pages do not load a CDN.

### jsPDF

- Version: `4.2.1`
- Purpose: Images to PDF generation
- Package: `jspdf@4.2.1` from npm
- License: MIT
- Details: [assets/vendor/jspdf/README.md](./assets/vendor/jspdf/README.md)

### pdf-lib

- Version: `1.17.1`
- Purpose: PDF inspection, page copying, and merge output
- Package: `pdf-lib@1.17.1` from npm
- License: MIT
- Details and hashes: [assets/vendor/pdf-lib/README.md](./assets/vendor/pdf-lib/README.md)

### JSZip

- Version: `3.10.1`
- Purpose: local multi-file PDF Split archives
- Package: `jszip@3.10.1` from npm
- License choice: MIT
- Details and hashes: [assets/vendor/jszip/README.md](./assets/vendor/jszip/README.md)

### PDF.js

- Version: `6.2.108`
- Purpose: local PDF Organizer page-thumbnail rendering
- Package: `pdfjs-dist@6.2.108` from npm
- License: Apache-2.0
- Main module and worker: same-origin files under `assets/vendor/pdfjs/`
- Details and hashes: [assets/vendor/pdfjs/README.md](./assets/vendor/pdfjs/README.md)

Each dependency keeps its license and package metadata beside the vendored browser build.

## Local development

Serve the repository over HTTP so ES Modules load correctly:

```bash
## Production security controls

Secure Tools remains a static, local-processing application. Production pages enforce a meta-delivered Content Security Policy with `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self' blob: data:`, `connect-src 'none'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'self'`, and `form-action 'self'`. No `unsafe-inline` or `unsafe-eval` exception is used.

The early theme bootstrap and GitHub Pages 404 base-path bootstrap are same-origin files under `js/`; production HTML contains no inline script or style blocks. Blob and data image sources are allowed only for local image previews and image/PDF preparation. Normal user navigation to GitHub links is not a network API connection and remains available.

Images to PDF uses layered validation:

1. pre-decode file and queue resource limits;
2. JPEG, PNG, or WebP magic-byte recognition from a 12-byte local slice;
3. browser decoding; and
4. post-decode dimension and pixel-count checks before canvas conversion.

The obsolete `image2pdf_proto.html` prototype was removed from the deployed tree; Git history preserves it. `tests/security-hardening.test.mjs` verifies the pinned dependency, limits and boundaries, signatures and spoofing cases, safe filename DOM sinks, CSP coverage, inline-code absence, prototype removal, and absence of first-party runtime network APIs.

python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Do not use a `file://` URL.

Run the complete local and CI validation entry point with:

```bash
node tests/run-all.mjs
```

It checks JavaScript syntax and runs Images to PDF, PDF Merge, PDF Split, PDF Organizer, category route, i18n, static resource, privacy/network, security-hardening, ZIP, and CI workflow regression coverage. All PDF fixtures are generated deterministically during tests; CI never processes real user files.

## Continuous integration

`.github/workflows/ci.yml` runs on every Pull Request and every push to `main`. The single validation job uses Node.js 24 to:

- check the changed commit range for whitespace errors;
- syntax-check first-party JavaScript and test modules; and
- run `node tests/run-all.mjs`.

CI adds no deployment, telemetry, package installation, or backend. Production remains a static site.

## Development workflow

Secure Tools uses lightweight trunk-based development:

1. Update clean local `main` with `git pull --ff-only origin main`.
2. Create a short-lived `feature/`, `fix/`, `refactor/`, or `docs/` branch.
3. Commit logical stages with the Secure Tools emoji-tag convention.
4. Run tests, `git diff --check`, route/resource checks, and applicable privacy/accessibility QA.
5. Push the short-lived branch, open a pull request, and use a normal merge commit after checks pass.
6. Sync `main`, verify it matches `origin/main`, and delete the completed local and remote branch.

Do not force-push or rewrite shared `main` history.

## GitHub Pages deployment

1. Push the integrated `main` branch to GitHub.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` and the repository root (`/`).
5. Save and wait for GitHub Pages to publish the static files.

Relative links keep the site compatible with the `/Secure_Tools/` project subpath, local development, and a root-hosted custom domain. The checked-in `404.html` supports GitHub Pages fallback behavior.

## Network dependencies

Production routes load only same-origin HTML, CSS, JavaScript, and vendored libraries. They make no analytics, font, file-upload, embed, or API requests. GitHub is contacted only after a user follows a source link.

The historical prototype is absent from the deployed tree. External URLs in documentation, licenses, and source links are informational or user-initiated; no production processing dependency is fetched remotely.
## Deferred work

- PDF rotate, compression, and encryption tools
- Image conversion, compression, and resizing
- Metadata inspection and cleaning
- Scan/OCR and media tools
- Offline/PWA support

## License

See [LICENSE](./LICENSE). Vendored third-party code retains its own license alongside each dependency.

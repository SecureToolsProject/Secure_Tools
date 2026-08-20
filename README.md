# Secure Tools

Secure Tools is a privacy-first web hub for everyday file utilities. Production tools process file contents locally in the browser instead of uploading them to a server.

Sprint 3 introduces category-first navigation and a second production tool, PDF Merge. Images to PDF now lives under the PDF category, with a static migration page at its former URL.

## Available tools

- [Images to PDF](./tools/pdf/images-to-pdf/) — arrange JPEG, PNG, and WebP images and save them as one PDF.
- [Merge PDF](./tools/pdf/merge/) — validate, order, and combine PDF pages without rasterizing them.

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
│   │   └── save.js
│   ├── pdf/
│   │   ├── index.html
│   │   ├── images-to-pdf/
│   │   └── merge/
│   ├── image/
│   ├── privacy/
│   ├── scan/
│   ├── media/
│   └── image-to-pdf/
│       └── index.html
├── assets/vendor/
│   ├── jspdf/
│   └── pdf-lib/
└── tests/
    ├── image-to-pdf.test.mjs
    └── pdf-merge-and-categories.test.mjs
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

## Local PDF dependencies

Both PDF libraries are pinned and served as same-origin static files. Production pages do not load a CDN.

### jsPDF

- Version: `2.5.2`
- Purpose: Images to PDF generation
- Package: `jspdf@2.5.2` from npm
- License: MIT
- Details: [assets/vendor/jspdf/README.md](./assets/vendor/jspdf/README.md)

### pdf-lib

- Version: `1.17.1`
- Purpose: PDF inspection, page copying, and merge output
- Package: `pdf-lib@1.17.1` from npm
- License: MIT
- Details and hashes: [assets/vendor/pdf-lib/README.md](./assets/vendor/pdf-lib/README.md)

Each dependency keeps its license and package metadata beside the vendored browser build.

## Local development

Serve the repository over HTTP so ES Modules load correctly:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Do not use a `file://` URL.

Run the regression suites with:

```bash
node tests/image-to-pdf.test.mjs
node tests/pdf-merge-and-categories.test.mjs
```

The second suite exercises real `pdf-lib` output, ordering, duplicates, mixed page sizes, a 48-page batch, invalid/encrypted paths, filename and queue utilities, English/Korean coverage, route resources, the legacy migration page, and first-party network APIs.

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

The unlinked `image2pdf_proto.html` remains a historical reference and is not production code. It still contains external and injected prototype markup; production routes neither load nor copy those dependencies.

## Deferred work

- PDF split, rotate, compression, and encryption tools
- Image conversion, compression, and resizing
- Metadata inspection and cleaning
- Scan/OCR and media tools
- Offline/PWA support
- Eventual removal or archival of the unlinked prototype

## License

See [LICENSE](./LICENSE). Vendored third-party code retains its own license alongside each dependency.

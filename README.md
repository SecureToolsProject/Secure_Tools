# Secure Tools

Secure Tools is a privacy-first web hub for everyday file utilities. Supported files are processed locally in the browser instead of being uploaded to a server.

Sprint 1 established the static web hub, shared design system, theme and internationalization foundations, privacy explanation, and supporting pages. Sprint 2 adds the first production tool: Images to PDF.

## Privacy principles

- File contents are processed on the user's device by supported tools.
- Basic utilities do not require an account.
- The web hub includes no analytics, behavioral tracking, advertising, or tracking pixels.
- Theme and language preferences are the only values stored in `localStorage`.
- Privacy claims are intended to be verifiable through source inspection and the browser Network panel.
- External links such as GitHub are governed by the destination service's policies.

## Architecture

The web hub is a static site built with semantic HTML, readable CSS, and Vanilla JavaScript ES Modules. It has no framework, package installation, build step, backend, database, authentication, or runtime API integration.

```text
.
├── index.html
├── 404.html
├── about/
│   └── index.html
├── privacy/
│   └── index.html
├── css/
│   ├── base.css
│   ├── components.css
│   ├── pages.css
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
│   └── image-to-pdf/
│       ├── index.html
│       ├── app.js
│       ├── image.js
│       ├── pdf.js
│       └── tool.css
├── assets/
│   └── vendor/
│       └── jspdf/
│           ├── jspdf.umd.min.js
│           ├── LICENSE.txt
│           ├── package.json
│           └── README.md
└── tests/
    └── image-to-pdf.test.mjs
```

`js/main.js` initializes page-wide behavior. `js/theme.js` owns Light, Dark, and System theme selection, OS color-scheme observation, and preference persistence. `js/i18n.js` detects English or Korean, applies `data-i18n` bindings without reloading, updates metadata and `<html lang>`, and persists manual language selection. Translation content remains separate in `js/locales/` so tool pages reuse the same system.

The repository URL is centralized in `js/config.js` for source links.

## Images to PDF

The production tool is available at `/tools/image-to-pdf/`.

- `index.html` provides the semantic workflow and reuses the global header, footer, theme, and language controls.
- `app.js` manages selection, drag and drop, the image queue, keyboard ordering/removal, settings, status messages, saving, and object URL cleanup.
- `image.js` validates and decodes JPEG, PNG, and WebP files with browser-local APIs. It prefers `createImageBitmap` and falls back to `HTMLImageElement` decoding through a temporary object URL.
- `pdf.js` owns filename sanitization, page geometry, image placement, sequential image preparation, and PDF generation.
- `tool.css` supplies the responsive production interface while inheriting the shared design tokens.

Images are decoded and converted one at a time during generation. Preview object URLs are revoked when an image is removed, when the queue is cleared, after saving when cleanup is enabled, and when the page is unloaded. Temporary PDF download URLs are also revoked.

Useful prototype behavior retained in production includes picker and drop input, mixed images, previews, ordering, removal, A4/Letter/image-sized pages, automatic orientation, contain/fill modes, margins, JPEG quality, filename handling, optional automatic download, save-picker support, and cleanup after saving.

## Local PDF dependency

Secure Tools vendors the browser UMD build of jsPDF `2.5.2` under `assets/vendor/jspdf/`.

- Source package: `jspdf@2.5.2` from npm
- npm tarball SHA-1: `3c35bb1063ee3ad9428e6353852b0d685d1f923a`
- License: MIT
- Runtime delivery: same-origin static file

See [the vendored dependency notes](./assets/vendor/jspdf/README.md) and [license](./assets/vendor/jspdf/LICENSE.txt). The dependency is pinned and no CDN is used by the production tool.

## Local development

Serve the repository over HTTP so browser ES Modules load correctly. From the project root, run:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Do not open the pages directly with a `file://` URL.

No dependency installation or build command is required. Run the Images to PDF regression checks with:

```bash
node tests/image-to-pdf.test.mjs
```

## GitHub Pages deployment

1. Push the repository to GitHub when the release is ready.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the deployment branch and the repository root (`/`).
5. Save and wait for GitHub Pages to publish the static files.

The checked-in `404.html` supports project Pages under `/Secure_Tools/` and root-hosted local or custom-domain deployments. Relative links keep the site compatible with the project subpath.

## Network dependencies

The production web hub and Images to PDF tool load only same-origin HTML, CSS, JavaScript, and the vendored PDF library. They make no analytics, font, image-processing, file-upload, embed, or API requests. GitHub is contacted only after a user follows a source link.

The original `image2pdf_proto.html` remains temporarily as an unlinked historical reference. It is not production code and still contains a jsDelivr script plus injected `local.adguard.org` markup. Production does not load or copy either dependency.

## Deferred to later sprints

- PDF merge and split tools
- Image conversion, compression, and resizing
- Metadata inspection and cleaning
- OCR and encryption
- Offline/PWA support
- Eventual removal or archival of the unlinked prototype

## License

See [LICENSE](./LICENSE). Vendored third-party code retains its own license alongside the dependency.

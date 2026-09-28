# Architecture

## Application model

Secure Tools is a static application built with semantic HTML, CSS, and Vanilla JavaScript ES Modules. It has no framework, Vite configuration, backend, database, authentication service, or runtime API. The build stages deployable files in `dist/`; a pinned npm preparation step reproduces and verifies the vendored OCR runtime without creating a server-side production dependency.

Production routes load application code and pinned libraries from the same origin. File-processing workflows run through browser APIs and in-memory data. The [privacy model](./privacy-model.md) defines the limits of that statement.

## Information architecture

The homepage points to stable category hubs instead of maintaining a flat list of every utility:

- PDF: six production tools;
- Image: five production tools, including Image → Text OCR;
- Privacy: a cross-category hub for the two metadata tools;
- Scan/OCR and Media: planned, non-interactive surfaces.

Each production tool has a canonical route at `/<category>/<tool>/`. The `tools/` directory remains the source-code organization, while `scripts/site-routes.mjs` maps its pages into the root-level public namespace. Every previously public `/tools/*` path has a one-hop 308 redirect to its canonical destination. The Privacy policy and metadata-tool hub share `/privacy/` because stripping the old prefix would otherwise collide with the existing policy route.

```text
.
├── index.html, 404.html
├── about/, privacy/
├── css/                     shared design and page styles
├── js/                      theme, i18n, configuration, locale catalogs
├── tools/
│   ├── shared/              input, validation, output, save, PDF, and UI foundations
│   ├── pdf/                 PDF hub and production tools
│   ├── image/               Image hub and production tools
│   ├── privacy/             source template retained for route-history checks
│   ├── scan/, media/        planned category pages
│   └── image-to-pdf/        retired client-side migration source
├── scripts/site-routes.mjs  canonical pages and legacy redirect manifest
├── dist/                    generated deployment artifact (ignored)
├── assets/vendor/           pinned same-origin runtime libraries
├── docs/                    technical, privacy, and audit records
└── tests/                   static and functional validation
```

The current production inventory and tool-specific behavior live in [tool status](./tool-status.md).

## Shared browser foundations

- `js/main.js` initializes shared theme and internationalization behavior.
- `js/theme.js` owns Light, Dark, and System selection, OS preference observation, and persistence.
- `js/i18n.js` resolves six supported languages, applies translations without reload, updates document metadata and `<html lang>`, and preserves tool state when language changes.
- `js/config.js` centralizes repository links.
- `tools/shared/` owns common file admission, signature validation, image/PDF helpers, queue conventions, local save behavior, and shared tool presentation.
- `tools/shared/ocr.js` owns language selection, same-origin OCR paths, normalized progress, orientation-aware image preparation, worker reuse, cancellation, and disposal for the public Image → Text workflow.
- The File System Access API is used when available; a revoking Blob-download fallback serves other browsers.

Tool implementations retain specialized models when their workflows differ. Organizer uses a page grid and PDF rendering lifecycle; Metadata tools use bounded inspection models and fail-closed output verification. Shared UI does not erase these tool-specific guarantees.

## Dependencies and processing

Runtime libraries are checked into `assets/vendor/` with their package metadata, license, upstream provenance, and integrity information. Production does not install packages or fetch CDN code. See [dependencies](./dependencies.md).

Image conversion, resizing, and compression use browser decode, Canvas, and encode APIs. PDF manipulation uses pinned PDF libraries; PDF rendering uses a same-origin PDF.js module and worker with optional remote assets disabled. Metadata cleaning uses format-specific paths documented in [tool status](./tool-status.md) and [Image Metadata privacy](./image-metadata-privacy.md).

## Development and delivery

Serving the generated `dist/` tree requires only an HTTP server. Reproducing OCR assets and running the full CI checks requires Node.js 24 and the exact lockfile. `npm run build` verifies prepared OCR assets and stages the site, `npm test` runs the static and unit suite, and `node tests/ocr-smoke.test.mjs` performs real English, Korean, and combined recognition.

`.github/workflows/ci.yml` validates pull requests and pushes to `main` using Node.js 24. It installs the lockfile only to reproduce and verify OCR assets, then checks commit-range whitespace, JavaScript syntax, unit coverage, and real local OCR without adding deployment behavior.

Development uses short-lived branches and normal merge commits. Shared `main` history is not force-pushed or rewritten. GitHub Pages can publish `main` from the repository root; relative links support both the `/Secure_Tools/` project path and root-hosted deployments.

## Ecosystem direction

Secure Tools may evolve as both:

- a host for lightweight built-in browser tools; and
- a discovery hub for separately deployed companion applications that need different runtime or resource models.

This is a direction, not a current integration contract. There is no companion registry, external-application schema, plugin framework, service discovery mechanism, or v3 navigation implementation in the present architecture.

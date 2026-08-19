# Secure Tools

Secure Tools is a privacy-first web hub for everyday file utilities. Its core design principle is simple: supported files should be processed locally in the browser instead of being uploaded to a server.

Sprint 1 establishes the public landing page, shared design system, theme and internationalization foundations, privacy explanation, project overview, and GitHub Pages-compatible error page. New file-processing implementations are intentionally outside this sprint.

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
├── assets/
│   ├── icons/
│   └── images/
└── tools/
```

`js/main.js` initializes page-wide behavior. `js/theme.js` owns Light, Dark, and System theme selection, OS color-scheme observation, and preference persistence. `js/i18n.js` detects English or Korean, applies `data-i18n` bindings without reloading, updates metadata and `<html lang>`, and persists manual language selection. Translation content remains separate in `js/locales/` so future tool pages can reuse it.

The repository URL is centralized in `js/config.js` for source links.

## Local development

Serve the repository over HTTP so browser ES Modules load correctly. From the project root, run:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Do not open the pages directly with a `file://` URL.

No dependency installation or build command is required.

## GitHub Pages deployment

1. Push the repository to GitHub when the release is ready.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the deployment branch and the repository root (`/`).
5. Save and wait for GitHub Pages to publish the static files.

The checked-in `404.html` supports project Pages under `/Secure_Tools/` and root-hosted local or custom-domain deployments. Relative links throughout the other pages keep the site compatible with the project subpath.

## Network dependencies

The Sprint 1 web hub loads only same-origin HTML, CSS, and JavaScript. It makes no analytics, font, image, embed, or API requests. GitHub is contacted only after a user follows a source link.

The pre-existing `image2pdf_proto.html` is preserved as prior user work and was not implemented or modified in Sprint 1. That standalone prototype currently loads jsPDF from jsDelivr, so it has a third-party library request even though file contents are processed locally. Removing that CDN dependency and bringing the prototype into the production architecture is future tool work.

## Deferred to later sprints

- Production Images-to-PDF processing
- PDF merge and split tools
- Image conversion, compression, and resizing
- Metadata inspection and cleaning
- OCR and encryption
- Offline/PWA support
- Removal or replacement of the prototype's external library dependency

## License

See [LICENSE](./LICENSE).

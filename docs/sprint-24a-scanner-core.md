# Sprint 24A — Document Scanner Core

## Implementation

The v2.4 development scanner is `/scan/document/`. It accepts signature-validated JPEG, PNG and WebP from the native multi-file picker, drop and paste. Pages can be moved with semantic keyboard-accessible buttons, removed, or cleared. All six existing locales are supported. Original, Grayscale and Document modes operate locally; Document uses a deterministic threshold of 160, with no corner detection or perspective correction.

Previews retain aspect ratio and EXIF normalization through `decodeImage`. Each preview is at most 1,000 pixels on its longest edge. Source File references remain unchanged; decoded bitmaps and canvas backing stores are released after processing. Preview URLs are revoked on replacement, removal, clear and page exit. The queue admits at most 20 pages / 200 MiB total, plus existing 50-MiB-file / 50-megapixel / 16,384-pixel decoder limits. Oversized or broken inputs produce recoverable messages, while valid files in the batch remain available.

Adding another batch cancels publication from the previous batch. Clear and cancellation invalidate in-flight results. Cancelling appearance changes retains completed pages with their actual mode labels; Apply to all pages is the retry mechanism. Native decoding/encoding cannot be interrupted mid-call, but resources are released and stale results cannot enter the queue.

## Branch policy

Production `main` and tag v2.3.0 were inspected at `2eb8e865e32558bfd031cd65c85d5d0fea64f5c7`; no v2.4 branch existed. v2.4 was bootstrapped from that production commit. The prerequisite policy migration is an independent Config commit in the scanner feature branch, covering AGENTS, workflow documentation, CI/security triggers, Dependabot targets and policy tests. It remains reviewable in the v2.4 PR; neither integration nor production was merged. Existing v2.3 maintenance PRs were not changed.

## Verification

- `npm run typecheck`: passed.
- `npm run compile:ts`: passed.
- `node tests/scanner.test.mjs`: passed (state/order, all modes, invalid inputs, limits, stale completion, orientation contract, resource cleanup).
- `npm run build`: passed; 20 canonical pages, 17 existing redirects, pinned OCR/font asset checks unchanged.
- `npm test`: local functional/regression tests passed through release artifact checks; the HTTP hardening gate failed because host AdGuard rewrites CSP. The strict expected policy was preserved. Clean hosted CI is required for the full result.
- `node tests/browser/scanner.mjs`: completed 30 viewport/locale functional cases (320×568, 390×844, 844×390, 768×1024, 1280×900; en/ko/ja/es/de/fr), actual JPEG/PNG/WebP inputs, EXIF orientation=6 JPEG, grayscale pixels, Document mode, keyboard ordering/focus, removal/clear, drop/paste, two 12-megapixel photos, stale clear, URL cleanup. The local privacy gate failed on injected `local.adguard.org` traffic/CSP mutations; it was not waived. The same strict test is included in hosted CI.
- Browser screenshots were visually inspected at Korean 320px and English desktop widths. Physical mobile, Firefox and Edge were not exercised locally.

No upload, telemetry, document persistence, new dependency or global CSP change was added. Host-injected traffic is recorded separately from app behavior; a clean privacy pass must come from hosted CI. Local diagnostic output and screenshots are in ignored `.ts-build/scanner-qa/`; the hosted failure artifact retains the same directory.

## Follow-ups

24B: compose the ordered original source images with shared PDF tooling, applying the chosen per-page appearance at export resolution; add output preview/download, export budgets, cancellation and cleanup. Do not export thumbnail pixels. 24C: adapt the existing shared OCR worker service. 24D: adapt existing OCR geometry/searchable-PDF capabilities. No PDF export, OCR controls, searchable-PDF rewrite, library replacement, production deployment, release tag or merge is included here.

## Changed files

- `.github/dependabot.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/security-monitoring.yml`
- `AGENTS.md`
- `CHANGELOG.md`
- `README.md`
- `docs/architecture.md`
- `docs/development-workflow.md`
- `docs/sprint-24a-scanner-core.md`
- `docs/tool-status.md`
- `js/i18n.js`
- `js/locales/document-scanner.js`
- `scripts/site-routes.mjs`
- `scripts/typescript-modules.mjs`
- `scripts/validate-branch-policy.mjs`
- `sitemap.xml`
- `tests/action-pins.test.mjs`
- `tests/branch-policy.test.mjs`
- `tests/browser/scanner.mjs`
- `tests/category-availability.test.mjs`
- `tests/ci-foundation.test.mjs`
- `tests/i18n-quality.test.mjs`
- `tests/pdf-to-text.test.mjs`
- `tests/release-hardening-http.test.mjs`
- `tests/run-all.mjs`
- `tests/scanner.test.mjs`
- `tests/security-monitoring.test.mjs`
- `tests/seo-foundation.test.mjs`
- `tests/typescript-foundation.test.mjs`
- `tests/url-namespace.test.mjs`
- `tools/scan/document/app.js`
- `tools/scan/document/index.html`
- `tools/scan/document/state.ts`
- `tools/scan/document/tool.css`
- `tools/scan/index.html`
- `tools/shared/image.d.ts`
- `tools/shared/scan.ts`
- `tsconfig.build.json`
- `tsconfig.json`

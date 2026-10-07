# Reproducible production verification

Run `npm ci --ignore-scripts`, `npx playwright install --with-deps chromium`, then
`npm run test:production` with `PRODUCTION_ORIGIN` and `IMMUTABLE_ORIGIN` set to
the canonical and deployment-specific HTTPS origins. Node 24 is required.

Use the **Production smoke** workflow's manual dispatch inputs for release
signoff. The initial infrastructure PR has a narrowly scoped bootstrap trigger;
ordinary development commits do not run this live-production suite. The immutable
URL belongs in dispatch inputs, not in reusable test logic. The bootstrap workflow
default identifies the incident deployment; replace it with dispatch inputs after
merging. The required authoritative signoff run executes on GitHub-hosted Ubuntu.

Each run launches packaged Chromium headlessly with extensions disabled and uses
new nonpersistent contexts with empty cookies/storage, service workers blocked,
native downloads enabled, request listeners and Chromium initiator records.
It never uses the user's interactive profile. Canonical and immutable locale and
release asset checks run together. Real visible OCR/export/cancel controls are
used; no export helper is called. PDF source replacement while busy uses the
public drop handler. The Image UI disables replacement while busy, so cancellation
of A precedes selection of B; completing A and then selecting B also verifies old
results disappear. Native download events establish exact counts and bytes.

The two-page PDF has distinct English and mixed Korean/English raster pages.
Its native TXT boundaries and selected Page 2 output are asserted exactly.
Native searchable downloads are parsed with PDF.js and reloaded with pdf-lib;
per-page extracted text and source/output rendered pixel hashes must match.
The existing-text fixture verifies text occurs exactly once on each page and
that original visible content survives. Long synthetic sources cover OCR and
searchable-writer cancellation, retry and A-to-B supersession.

All input fixtures are generated from repository synthetic pixels or test text;
no user documents, credentials or private OCR contents enter diagnostics. Success
results appear in the Actions job summary. Only failures upload diagnostic JSON,
screenshots, trace and synthetic native artifacts; retention is seven days.
Local output lives under ignored `.ts-build/production-smoke`.

Any third-party site runtime request, including Cloudflare Web Analytics/Insights,
fails signoff. Platform injection is not an exemption to the project's
no-analytics/no-telemetry promise. Console/page/HTTP errors and CSP violations
also fail. Diagnose failed gates and record NO-GO; do not automatically patch
product code or alter Cloudflare configuration. Close Issue #107 and delete the
merged recovery branches only after the final hosted run passes all gates.

The explicit main-target branch exception applies only to
`test/production-verification` from incident baseline
`43979e818468e34511cd6f1e30edfaa7648b0475`, with test/workflow/docs and narrowly
scoped policy files allowed. Production dependencies and existing package scripts
must remain unchanged. Ordinary `test/* → main` PRs remain rejected.

API references: [Playwright downloads](https://playwright.dev/docs/downloads),
[network inspection](https://playwright.dev/docs/network), and
[isolated contexts](https://playwright.dev/docs/api/class-browsercontext).

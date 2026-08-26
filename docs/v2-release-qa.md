# v2 Promotion QA

This is the live promotion gate for the Secure Tools `v2` integration branch. It separates reproducible automated evidence from interactive browser evidence. `BLOCKED` and `NOT RUN` never mean `PASS`.

## Decision

**READY EXCEPT MANUAL QA** as of 2026-08-26, conditional on the Sprint 17 pull-request CI gate passing before merge.

- Automated local gate: **PASS** — `git diff --check` and `node tests/run-all.mjs` completed successfully on Windows with Node.js 24.
- Static privacy, network, CSP, resource, dependency, route, localization, save-path, responsive-contract, and accessibility checks: **PASS**.
- Interactive browser gate: **BLOCKED** before navigation by the Codex Windows sandbox ACL failure documented below.
- Promotion to `main`, release tagging, release publication, and deployment: **NOT RUN** and outside Sprint 17 scope.

The v2 branch must not be promoted until a human completes the open browser matrix and records evidence. Any failed automated or CI check, privacy regression, unexplained runtime request, corrupt output, inaccessible primary path, or failed save is a release blocker.

## Sprint 17 audit disposition

| Tracking issue | Area | Result | Disposition |
| --- | --- | --- | --- |
| #37 | Production and planned surface | PASS | Ten production tools are linked across PDF and Image; Privacy is a bounded navigation hub; Scan/OCR and Media remain visibly planned and non-interactive. |
| #38 | Vendored dependency provenance and static resources | PASS WITH VISIBILITY LIMIT | Versions, package metadata, licenses, provenance notes, runtime inventory, and SHA-256 gates are present. Official npm latest versions match the four npm artifacts. Dependabot alert access is disabled for the repository, so no alert result is claimed. |
| #39 | Privacy and network invariants | PASS | Production CSP uses `connect-src 'none'`; first-party processing code is statically checked against runtime request APIs and remote execution assets. Claims were narrowed to file contents and production tools. |
| #40 | Save failure and resource boundaries | PASS | Shared save fallback, cancellation, write-failure propagation, queue preservation, file/queue/pixel/work limits, and the metadata library's defensive input ceiling are covered by automated tests. |
| #41 | v2 promotion QA matrix | PASS | This document defines automated, CI, browser, promotion, and defect boundaries. |
| #42 | Interactive browser retry | BLOCKED | The bounded retry failed before browser connection; no visual or interaction result is inferred. |
| #43 | Release documentation and promotion status | PASS | README, changelog, historical v1 QA context, and this live v2 gate are aligned. |

## Production inventory and automated evidence

| Production tool | Route | Functional and failure contracts | Privacy/network/resource contracts | Browser |
| --- | --- | --- | --- | --- |
| Images to PDF | `/tools/pdf/images-to-pdf/` | PASS | PASS | BLOCKED |
| Merge PDF | `/tools/pdf/merge/` | PASS | PASS | BLOCKED |
| Split PDF | `/tools/pdf/split/` | PASS | PASS | BLOCKED |
| Organize PDF | `/tools/pdf/organize/` | PASS | PASS | BLOCKED |
| PDF to Images | `/tools/pdf/to-images/` | PASS | PASS | BLOCKED |
| PDF Metadata Inspector & Cleaner | `/tools/pdf/metadata/` | PASS | PASS | BLOCKED |
| Image Converter | `/tools/image/converter/` | PASS | PASS | BLOCKED |
| Image Resize | `/tools/image/resize/` | PASS | PASS | BLOCKED |
| Image Compressor | `/tools/image/compress/` | PASS | PASS | BLOCKED |
| Image Metadata Inspector & Cleaner | `/tools/image/metadata/` | PASS | PASS | BLOCKED |

Automated contracts cover supported and rejected inputs, deterministic naming, duplicate handling, repeated operations, cancellation, recoverable failures, save-path behavior, metadata verification, corrupt/encrypted inputs where applicable, queue and workload limits, object URL cleanup, and the same-origin resource model. They do not substitute for visual rendering, browser-native file picker behavior, downloaded-file inspection, or assistive-technology review.

## Static routes and shared surfaces

| Surface | Automated | Browser |
| --- | --- | --- |
| Homepage | PASS | BLOCKED |
| PDF category | PASS | BLOCKED |
| Image category | PASS | BLOCKED |
| Privacy category | PASS | BLOCKED |
| Scan/OCR planned category | PASS | BLOCKED |
| Media planned category | PASS | BLOCKED |
| Privacy page | PASS | BLOCKED |
| About page | PASS | BLOCKED |
| 404 page | PASS | BLOCKED |
| Legacy `/tools/image-to-pdf/` redirect | PASS | BLOCKED |

## Dependency and repository audit

Audited on 2026-08-26 against repository records and official npm registry metadata.

| Dependency | Vendored version | Official npm latest | License/inventory/hash gate |
| --- | ---: | ---: | --- |
| jsPDF | 4.2.1 | 4.2.1 | PASS |
| pdf-lib | 1.17.1 | 1.17.1 | PASS |
| JSZip | 3.10.1 | 3.10.1 | PASS |
| PDF.js (`pdfjs-dist`) | 6.2.108 | 6.2.108 | PASS |
| secure-metadata | 0.1.0 immutable GitHub release artifact | Not an npm runtime dependency | PASS |

- The v1.0.0 GitHub release is published; v1.0.0-rc.1 remains marked as a prerelease.
- `main` and `v2` returned “Branch not protected” from the GitHub branch-protection API. This is a repository-governance risk, not a change authorized by Sprint 17.
- GitHub returned `403 Dependabot alerts are disabled for this repository`; vulnerability-alert visibility is therefore **NOT AVAILABLE**, not `PASS`.
- No dependency, vendor byte, license, framework, package manager, build system, or runtime resource was added or upgraded.

## Automated command evidence

| Command or gate | Result |
| --- | --- |
| `git diff --check` | PASS |
| `node tests/run-all.mjs` | PASS |
| Production route and relative-resource checks | PASS |
| Six-locale parity, placeholders, metadata, dynamic state, and accessible-name checks | PASS |
| CSP, runtime-network, remote-font, vendor provenance, and runtime-hash checks | PASS |
| Shared input, queue, source, status, cancellation, save, and recovery checks | PASS |
| Per-tool file, queue, dimension, pixel, render, and aggregate-work boundaries | PASS |
| Pull-request CI | REQUIRED BEFORE MERGE |
| Sprint 18 Metadata source cards, decoded-first disclosure, safe customization, and fail-closed verification contracts | PASS |

The Node runner reports `MODULE_TYPELESS_PACKAGE_JSON` warnings because a parent user-level package file does not declare a module type. The static repository intentionally has no package manager or build configuration; all tests execute successfully.

## Interactive browser attempt

Attempted on 2026-08-26 using a temporary server bound to `127.0.0.1:4173` and the required in-app browser integration. The browser control runtime exited before a browser connection or page navigation with:

```text
windows sandbox failed: helper_unknown_error: apply deny-read ACLs
```

Result: **BLOCKED**. Browser family/version, viewport rendering, keyboard operation, file picker behavior, output downloads, and Network-panel observations are **NOT RUN**. The temporary local server was stopped after the failed attempt. No standalone browser automation result or visual pass is claimed.

## Manual browser matrix

Use current stable Chromium, Firefox, and Safari/WebKit where available. Serve the repository over HTTP, use synthetic non-sensitive fixtures, disable the Network-panel cache, and clear stored language/theme preferences before detection tests.

For `/`, every production tool, all five category hubs, `/privacy/`, `/about/`, and `404.html`:

- [ ] Check 320, 360, 390, 768, 1024, and 1440 CSS px with no body overflow, clipping, overlap, or inaccessible controls.
- [ ] Check English, Korean, Japanese, Spanish, German, and French; confirm visible text, document metadata, `<html lang>`, and localized accessible names update without losing tool state.
- [ ] Check Light, Dark, and System; change the OS preference while System is active and verify explicit Light/Dark remain stable.
- [ ] Complete each primary workflow by keyboard, including file selection, queue/source controls, settings, primary actions, cancellation where available, and save/download fallback.
- [ ] Confirm focus indicators, logical focus order, semantic landmarks, live status updates, progress names, and reduced-motion behavior.
- [ ] Inspect the Network panel while adding and processing files; confirm no file-content upload and no unexpected runtime request.
- [ ] Inspect saved outputs for correct type, name, ordering, dimensions/pages, transparency behavior, and openability.
- [ ] Exercise corrupt, unsupported, oversized, encrypted/password-protected, cancellation, save-cancellation, and repeated-operation paths applicable to each tool.
- [ ] For both metadata tools, confirm the source card, remove/reset focus path, decoded-first summary, native details disclosure, and keyboard-accessible Customize controls across all six locales. Confirm partial/opaque wording remains bounded, default Privacy Clean and custom cleaning match the documented supported scope, verification failure prevents saving, and the source remains retryable.
- [ ] Confirm Privacy links route only to the two production metadata tools and Scan/OCR and Media cards remain non-interactive planned content.

## Recording manual evidence

Record date, tester, OS, browser/version, route, viewport, locale, theme, fixture description, result, downloaded-output checks, Network-panel result, and defect link. Screenshots may support a result but do not replace keyboard, save, output, or network verification.

After all manual rows pass and no release blocker remains, update the decision to **READY FOR PROMOTION** in a dedicated reviewed change. Until then, the authoritative result remains **READY EXCEPT MANUAL QA**.

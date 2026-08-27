# v2 Promotion QA

This is the preserved promotion record for the Secure Tools v2.0.0 pre-release line. It separates reproducible automated evidence from interactive browser evidence. `BLOCKED` and `NOT RUN` never mean `PASS`.

## Decision

**PROMOTED** on 2026-08-27 after the recorded gate reached **READY FOR PROMOTION**. PR #60 merged the approved `v2` tree to `main` as commit `1d1d4a6bf055eb98f6902139c2dd4de1339b8840`; `v2.0.0-rc.1` was subsequently published as a pre-release.

- Automated local gate: **PASS** — `git diff --check` and `node tests/run-all.mjs` completed successfully on Windows with Node.js 24.
- Static privacy, network, CSP, resource, dependency, route, localization, save-path, responsive-contract, and accessibility checks: **PASS**.
- Automated / in-environment browser QA: **BLOCKED** before navigation by the local Chrome-control runtime failures documented below.
- Manual local Chrome QA: **PASS** — the user completed the release-required interactive checks in Chrome 151.0.7922.174 (Official Build, 64-bit).
- Metadata Orientation regression: **RESOLVED / PASS** — the user manually verified the corrected Orientation=6 JPEG behavior after the secure-metadata v0.1.1 integration.
- Promotion to `main`: **PASS** — PR #60 used a normal merge commit and preserved the validated v2 history.
- Pre-release publication: **PUBLISHED** — `v2.0.0-rc.1`; no stable v2.0.0 release is claimed by this record.

No unresolved release blocker remained at promotion. The branch-protection and Dependabot visibility observations below remain historical repository-hardening concerns; the existing release policy did not define them as promotion blockers. This document is version-specific evidence, not the active gate for future development.

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

| Production tool | Route | Functional and failure contracts | Privacy/network/resource contracts | Manual Chrome |
| --- | --- | --- | --- | --- |
| Images to PDF | `/tools/pdf/images-to-pdf/` | PASS | PASS | PASS (manual smoke) |
| Merge PDF | `/tools/pdf/merge/` | PASS | PASS | PASS (manual smoke) |
| Split PDF | `/tools/pdf/split/` | PASS | PASS | PASS (manual smoke) |
| Organize PDF | `/tools/pdf/organize/` | PASS | PASS | PASS (manual smoke) |
| PDF to Images | `/tools/pdf/to-images/` | PASS | PASS | PASS (manual smoke) |
| PDF Metadata Inspector & Cleaner | `/tools/pdf/metadata/` | PASS | PASS | PASS (manual workflow) |
| Image Converter | `/tools/image/converter/` | PASS | PASS | PASS (manual workflow) |
| Image Resize | `/tools/image/resize/` | PASS | PASS | PASS (manual workflow) |
| Image Compressor | `/tools/image/compress/` | PASS | PASS | PASS (manual workflow) |
| Image Metadata Inspector & Cleaner | `/tools/image/metadata/` | PASS | PASS | PASS (manual workflow) |

Automated contracts cover supported and rejected inputs, deterministic naming, duplicate handling, repeated operations, cancellation, recoverable failures, save-path behavior, metadata verification, corrupt/encrypted inputs where applicable, queue and workload limits, object URL cleanup, and the same-origin resource model. They do not substitute for visual rendering, browser-native file picker behavior, downloaded-file inspection, or assistive-technology review.

## Static routes and shared surfaces

| Surface | Automated | Manual Chrome |
| --- | --- | --- |
| Homepage | PASS | PASS (manual smoke) |
| PDF category | PASS | PASS (manual smoke) |
| Image category | PASS | PASS (manual smoke) |
| Privacy category | PASS | PASS (manual smoke) |
| Scan/OCR planned category | PASS | PASS (manual smoke) |
| Media planned category | PASS | PASS (manual smoke) |
| Privacy page | PASS | PASS (manual smoke) |
| About page | PASS | PASS (manual smoke) |
| 404 page | PASS | PASS (manual smoke) |
| Legacy `/tools/image-to-pdf/` redirect | PASS | PASS (manual smoke) |

## Dependency and repository audit

Audited on 2026-08-27 against repository records, immutable GitHub Release assets, and official npm registry metadata.

| Dependency | Vendored version | Official npm latest | License/inventory/hash gate |
| --- | ---: | ---: | --- |
| jsPDF | 4.2.1 | 4.2.1 | PASS |
| pdf-lib | 1.17.1 | 1.17.1 | PASS |
| JSZip | 3.10.1 | 3.10.1 | PASS |
| PDF.js (`pdfjs-dist`) | 6.2.108 | 6.2.108 | PASS |
| secure-metadata | 0.1.1 immutable GitHub release artifact | Not an npm runtime dependency | PASS |

- The v1.0.0 GitHub release is published; v1.0.0-rc.1 remains marked as a prerelease.
- The v2.0.0-rc.1 GitHub pre-release was published after the promotion evidence in this document passed; no stable v2.0.0 publication is claimed here.
- `main` and `v2` returned “Branch not protected” from the GitHub branch-protection API. This is a repository-governance risk, not a change authorized by Sprint 17.
- GitHub returned `403 Dependabot alerts are disabled for this repository`; vulnerability-alert visibility is therefore **NOT AVAILABLE**, not `PASS`.
- secure-metadata alone was upgraded from 0.1.0 to the verified 0.1.1 browser Release artifact. No framework, package manager, build system, runtime dependency, CDN, or remote processing resource was added.

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
| Metadata hotfix pull-request and `v2` push CI | PASS |
| Sprint 18 Metadata source cards, decoded-first disclosure, safe customization, and fail-closed verification contracts | PASS |
| secure-metadata v0.1.1 provenance, Orientation 3/6/8 preservation, privacy-EXIF/GPS removal, unchanged JPEG scan bytes, bounded summaries, and action-panel contracts | PASS |

The Node runner reports `MODULE_TYPELESS_PACKAGE_JSON` warnings because a parent user-level package file does not declare a module type. The static repository intentionally has no package manager or build configuration; all tests execute successfully.

## Interactive browser attempt

Attempted on 2026-08-26 using a temporary server bound to `127.0.0.1:4173` and the required in-app browser integration. The browser control runtime exited before a browser connection or page navigation with:

```text
windows sandbox failed: helper_unknown_error: apply deny-read ACLs
```

Result: **BLOCKED**. Browser family/version, viewport rendering, keyboard operation, file picker behavior, output downloads, and Network-panel observations are **NOT RUN**. The temporary local server was stopped after the failed attempt. No standalone browser automation result or visual pass is claimed.

## Metadata Orientation hotfix Chrome attempt

Attempted twice on 2026-08-27 against a temporary server at `127.0.0.1:4173` using the requested real Chrome connection and synthetic Orientation=6 JPEG, PNG, WebP, and PDF fixtures. Chrome control failed before connection or navigation with:

```text
failed to write kernel assets: The system cannot find the path specified. (os error 3)
```

Result: **BLOCKED**. Original-versus-cleaned visual orientation, interactive toolbar layout, responsive rendering, keyboard-only operation, browser-native save/cancel/failure paths, and Network-panel observations are **NOT RUN**. Automated Orientation tests and static UX contracts remain PASS but are not presented as manual Chrome evidence. The temporary server and all synthetic fixtures were removed.

## Manual local Chrome QA

The user completed real local-browser release QA on 2026-08-27 in Chrome 151.0.7922.174 (Official Build, 64-bit). This evidence is separate from the blocked automated browser-control attempts above.

| Reported area | Result |
| --- | --- |
| General smoke test | PASS |
| Image tools | PASS |
| Image and PDF Metadata tools | PASS |
| Light and Dark themes | PASS |
| Internationalization | PASS |
| Responsive layout | PASS |
| Keyboard-only interaction | PASS |
| Save, cancel, and failure behavior | PASS |
| Network panel | PASS — local/blob behavior only; no file-processing upload request was observed |

The Metadata workflows manually covered Privacy Clean, Customize/custom cleaning, metadata removal, source/action UX, and the decoded summary/details flow. The triggering JPEG carried EXIF Orientation=6. Before the dependency patch, removing the complete EXIF APP1 segment could discard rendering-critical Orientation and make the cleaned image display rotated. With secure-metadata v0.1.1, one valid unambiguous IFD0 Orientation value from 1 through 8 is preserved, other targeted EXIF/GPS metadata is removed, and pixel data is neither decoded nor re-encoded. The user manually verified the corrected behavior, so the Orientation blocker is **RESOLVED / PASS**.

The evidence above records only the test areas and outcomes explicitly reported by the user; it does not invent unreported sub-test detail. Release-required interactive checks are complete, while the historical automated browser attempts remain **BLOCKED**.

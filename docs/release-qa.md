# v1.0.0 Release QA

This document is the release-candidate gate for Secure Tools v1.0.0. It records completed automated evidence separately from manual browser sign-off. An unchecked item is pending, not implicitly passed.

## Current decision

- Automated release gate: passed on 2026-08-20 with `node tests/run-all.mjs` and `git diff --check`.
- Source-level privacy, security, dependency, license, route, resource, localization, responsive-contract, and accessibility audits: passed.
- Manual browser matrix: pending.
- v1.0.0 tag and GitHub release: not created by Sprint 11.

The Sprint is eligible for integration after CI passes, but publication of the v1.0.0 tag/release remains blocked until a human completes the manual matrix below. This manual gate does not invalidate the automated Sprint result.

## Automated release evidence

| Area | Result | Evidence |
| --- | --- | --- |
| Six production PDF tools | Pass | Functional, repeated-operation, corrupt/encrypted input, boundary, naming, cancellation, and output tests |
| Routes and resources | Pass | Production-route, relative-resource, legacy redirect, and category-navigation tests |
| Privacy and network | Pass | No first-party runtime `fetch`, XHR, WebSocket, EventSource, or beacon APIs; `connect-src 'none'` |
| CSP and code loading | Pass | Same-origin scripts/styles/workers; no inline code, `unsafe-inline`, `unsafe-eval`, runtime CDN, or remote worker fallback |
| Accessibility contracts | Pass | Semantic controls, labels, status regions, keyboard alternatives, focus/reduced-motion, and responsive source checks |
| Localization | Pass | Catalog parity, placeholders, detection, persistence, metadata, dynamic state, and long-copy checks for six languages |
| Save behavior | Pass | File System Access options/order, unsupported-browser fallback, Blob URL revocation, and write-failure propagation |
| CI configuration | Pass | Pull request and `main` triggers, Node.js 24, least-privilege permissions, whitespace gate, and authoritative test command |

The local Node runner emits `MODULE_TYPELESS_PACKAGE_JSON` warnings because a parent user-level `package.json` does not declare a module type. All modules and tests execute successfully; the warning is outside this static repository and is not a release blocker.

## Dependency and license audit

The approved inventory contains one version of each runtime dependency and no additional vendor directory. Full package provenance and SHA-256 values remain beside each build in its linked vendor README; `tests/release-gate.test.mjs` verifies the exact file inventory, metadata, and runtime hashes.

| Dependency | Version | Purpose | Project license choice | Audit result |
| --- | --- | --- | --- | --- |
| [jsPDF](../assets/vendor/jspdf/README.md) | 4.2.1 | Images to PDF | MIT | Pass |
| [pdf-lib](../assets/vendor/pdf-lib/README.md) | 1.17.1 | PDF inspection, cleaning, copying, merge, split, and organization | MIT | Pass |
| [JSZip](../assets/vendor/jszip/README.md) | 3.10.1 | Local split and image ZIP archives | MIT from the package's MIT/GPL option | Pass |
| [PDF.js](../assets/vendor/pdfjs/README.md) | 6.2.108 | Local rendering for Organizer and PDF to Images | Apache-2.0 | Pass |

## Defect classification

A blocker is any reproducible data-loss/corruption issue, broken primary workflow, unexplained network request, privacy-claim violation, inaccessible keyboard path, unusable supported viewport/locale/theme combination, failed save/download, missing license, integrity mismatch, or failing automated/CI check. Fix and retest before release.

A non-blocker is a cosmetic issue that does not hide content, change meaning, block interaction, reduce privacy, or impair supported accessibility. Record it with the route, browser, viewport, locale, theme, reproduction steps, screenshot, and follow-up owner. Ambiguous findings are blockers until triaged.

## Manual browser prerequisites

Use current stable Chromium, Firefox, and Safari/WebKit where available. Serve the repository over HTTP, start from cleared site preferences when testing detection, use synthetic non-sensitive fixtures, keep DevTools Network open with cache disabled, and verify that processing causes no request beyond same-origin static resources already loaded by navigation.

A bounded in-app browser attempt on 2026-08-20 failed before browser connection or page rendering because the Windows sandbox helper could not apply its read ACLs. It produced no visual evidence. No alternative automated browser result is claimed, and every item below remains pending for human sign-off.

## Viewports and global chrome

At each width, check the homepage, every category route, every production tool route, Privacy, About, and the 404 page. Confirm no horizontal page overflow, overlap, clipping, inaccessible navigation, truncated controls, or obscured focus indicators.

- [ ] 320 CSS px
- [ ] 360 CSS px
- [ ] 390 CSS px
- [ ] 768 CSS px
- [ ] 1024 CSS px
- [ ] 1280 CSS px or wider

## Locale and theme matrix

For each row, test Light, Dark, and System. Confirm correct `<html lang>`, translated title/metadata/controls/status copy, preserved tool state after switching, readable contrast, stable header layout, and no clipped long labels.

| Locale | Representative width | Light | Dark | System |
| --- | ---: | :---: | :---: | :---: |
| English (`en`) | 390 px | [ ] | [ ] | [ ] |
| 한국어 (`ko`) | 360 px | [ ] | [ ] | [ ] |
| 日本語 (`ja`) | 360 px | [ ] | [ ] | [ ] |
| Español (`es`) | 390 px | [ ] | [ ] | [ ] |
| Deutsch (`de`) | 320 px | [ ] | [ ] | [ ] |
| Français (`fr`) | 320 px | [ ] | [ ] | [ ] |

Repeat at least one desktop width for every locale and theme. For System, change the OS preference while the page is open and confirm that System follows it while explicit Light/Dark selections do not.

## High-priority interaction checklist

- [ ] Header controls remain operable with German and French at 320 px and Korean and Japanese at 360 px.
- [ ] Homepage category navigation matches the intended category-first information architecture; no retired Ready/tool-grid section returns.
- [ ] Native file selection and drag-and-drop both work; canceling a picker does not alter an existing queue.
- [ ] Queue cards support long filenames, duplicate handling, removal, clearing, and keyboard reordering without layout loss.
- [ ] Images to PDF preserves order and options, rejects invalid/oversized images clearly, and recovers after generation/save failure.
- [ ] Merge PDF handles multiple files, duplicates, reordering, encrypted/corrupt rejection, repeated merges, and saving.
- [ ] Split PDF handles range/per-page/interval modes, deterministic filenames, ZIP saving, repeated runs, and validation errors.
- [ ] PDF Organizer populated state supports preview loading, pointer and button reordering, rotation, removal, reset, export, and source replacement.
- [ ] PDF to Images supports format/scale/quality changes, ordered preview/output, progress, cancellation/source replacement, single download, and ZIP download.
- [ ] Metadata populated state safely displays long and multilingual values, distinguishes missing fields, supports selected/all removal, verifies output, and supports repeated cleaning.
- [ ] Empty, corrupt, encrypted/password-protected, zero-byte, spoofed, oversized, and unsupported inputs produce localized recoverable errors.
- [ ] File System Access saving works where supported; canceling is harmless; Blob-download fallback works elsewhere and repeated downloads remain usable.
- [ ] Keyboard-only navigation reaches every action in a logical order with visible focus; status/error changes are announced without unexpected focus movement.
- [ ] Reduced-motion preference removes nonessential motion, zoom at 200% remains usable, and high-contrast/forced-colors inspection reveals no hidden state.
- [ ] Network inspection shows no file upload, analytics, remote font, CDN, API, or remote worker request during every processing workflow.

## Sign-off

Record browser/OS versions, completed boxes, defects and classifications, retest evidence, reviewer, and date here before creating the v1.0.0 tag or GitHub release.

- Reviewer: pending
- Date: pending
- Blocking defects: pending
- Non-blocking follow-ups: pending
- Final manual decision: pending

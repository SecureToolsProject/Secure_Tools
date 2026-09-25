# Secure Tools documentation

The root [README](../README.md) introduces Secure Tools. This directory owns detailed design, operational, privacy, and audit information.

## Current documentation

| Document | Responsibility |
| --- | --- |
| [Architecture](./architecture.md) | Static application structure, shared browser foundations, delivery, and future ecosystem direction |
| [Development workflow](./development-workflow.md) | Production, integration, Sprint, release, hotfix, merge-authority, and branch-cleanup rules |
| [Privacy model](./privacy-model.md) | Local-processing and network boundaries, storage, security controls, and bounded privacy claims |
| [Dependencies](./dependencies.md) | Production runtime inventory, versions, vendoring, licenses, and integrity ownership |
| [Local OCR foundation](./ocr-foundation.md) | Self-hosted Tesseract assets, languages, lifecycle, cancellation, caching, and privacy guarantees |
| [Sprint 16B Image → Text QA](./sprint-16b-qa.md) | Automated and Chromium browser evidence for the v2.1.0 Image → Text workflow |
| [Sprint 16C v2.1.0 release hardening](./sprint-16c-v2.1-release-hardening.md) | Release-candidate regression, OCR, privacy, browser, performance, and readiness evidence |
| [v2.1.0 release notes draft](./v2.1.0-release-notes-draft.md) | Unpublished release-note copy for the later promotion and release task |
| [Tool status](./tool-status.md) | Production and planned surfaces, supported formats, behavior, and resource boundaries |
| [Search discovery and metadata](./seo.md) | Canonical routes, crawler files, metadata policy, maintenance, and submission steps |
| [Cloudflare Pages migration bridge](./cloudflare-pages-bridge.md) | H3.2/H3.3 provenance plus the prepared H3.5 hostname-specific indexing, activation, validation, and rollback contracts |
| [Image Metadata privacy](./image-metadata-privacy.md) | Format-specific inspection, cleaning, preservation, and verification semantics |
| [UX consistency audit](./ux-consistency-audit.md) | Shared interaction, accessibility, responsive, theme, and historical browser-QA findings |
| [i18n copy review](./i18n-copy-review.md) | Localization coverage and editorial review record |

## Release evidence

- [v1.0.0 release QA](./release-qa.md) is a historical Sprint 11 release-candidate snapshot. Its unchecked items remain historical and are not current requirements.
- [v2 promotion QA](./v2-release-qa.md) preserves the automated, manual Chrome, Orientation-regression, and promotion evidence for the v2.0.0 pre-release line.
- The root [changelog](../CHANGELOG.md) records release and change history; it is not a technical specification.

Detailed artifact hashes and upstream provenance remain beside each dependency under [`assets/vendor/`](../assets/vendor/), where automated release gates verify them.

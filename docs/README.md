# Secure Tools documentation

The root [README](../README.md) introduces Secure Tools. This directory owns detailed design, operational, privacy, and audit information.

## Current documentation

| Document | Responsibility |
| --- | --- |
| [Architecture](./architecture.md) | Static application structure, shared browser foundations, delivery, and future ecosystem direction |
| [Privacy model](./privacy-model.md) | Local-processing and network boundaries, storage, security controls, and bounded privacy claims |
| [Dependencies](./dependencies.md) | Production runtime inventory, versions, vendoring, licenses, and integrity ownership |
| [Tool status](./tool-status.md) | Production and planned surfaces, supported formats, behavior, and resource boundaries |
| [Search discovery and metadata](./seo.md) | Canonical routes, crawler files, metadata policy, maintenance, and submission steps |
| [Cloudflare Pages migration bridge](./cloudflare-pages-bridge.md) | H3.2 Direct Upload provenance, indexing isolation, activation prerequisites, validation, and removal |
| [Image Metadata privacy](./image-metadata-privacy.md) | Format-specific inspection, cleaning, preservation, and verification semantics |
| [UX consistency audit](./ux-consistency-audit.md) | Shared interaction, accessibility, responsive, theme, and historical browser-QA findings |
| [i18n copy review](./i18n-copy-review.md) | Localization coverage and editorial review record |

## Release evidence

- [v1.0.0 release QA](./release-qa.md) is a historical Sprint 11 release-candidate snapshot. Its unchecked items remain historical and are not current requirements.
- [v2 promotion QA](./v2-release-qa.md) preserves the automated, manual Chrome, Orientation-regression, and promotion evidence for the v2.0.0 pre-release line.
- The root [changelog](../CHANGELOG.md) records release and change history; it is not a technical specification.

Detailed artifact hashes and upstream provenance remain beside each dependency under [`assets/vendor/`](../assets/vendor/), where automated release gates verify them.

# Changelog

## Unreleased

### Added

- Started the v2 cycle with a production Image category and local Image Converter.
- Added Image Resize with pixel and percentage modes, aspect-ratio preservation, optional enlargement, Original/JPEG/PNG/WebP output, and local batch ZIP saving.
- Added Image Compressor with Original/JPEG/PNG/WebP output, truthful format-specific quality behavior, unchanged dimensions, and local batch ZIP saving.
- Added the single-file Image Metadata Inspector & Cleaner for JPEG, PNG, and WebP with honest partial/opaque reporting, authoritative Privacy Clean, ICC preservation, and fail-closed verification before save.
- Pinned the immutable `secure-metadata v0.1.0` browser Release artifact as a same-origin dependency with exact provenance and SHA-256 release-gate coverage.
- Added per-file and aggregate compression metrics that distinguish byte savings from larger generated results.
- Added per-image output dimension/pixel checks and a 200-megapixel aggregate resize-output workload limit.
- Added JPEG, PNG, and WebP input/output, lossy quality controls for JPEG/WebP, deterministic white JPEG transparency, metadata-stripping canvas re-encoding, collision-safe Unicode names, and ZIP batch output.
- Added per-file, queue, dimension, decoded-pixel, and 200-megapixel aggregate-work protections with recoverable errors.

### Changed

- Removed the standalone planned Rotate PDF card; page rotation remains available as part of PDF Organizer.
- Moved shared browser image validation and decoding into `tools/shared/image.js` for PDF and Image tools.
- Promoted Privacy from generic planned placeholders to a production navigation hub for the existing Image and PDF metadata tools, with distinct supported-scope copy in all six locales.
- Repaired the Image category’s semantic tool list so all four available cards remain within the same list.

## 1.0.0

Secure Tools v1.0.0 was published on 2026-08-24 after the Sprint 11 release-candidate hardening and manual release process.

### PDF tools

- Convert ordered JPEG, PNG, and WebP images into a PDF.
- Merge, split, organize, and export PDFs locally without rasterizing source pages.
- Convert PDF pages into PNG, JPEG, or WebP files and predictable ZIP archives.
- Inspect supported document-info metadata and save a verified cleaned copy.

### Privacy

- Process file contents locally in the browser with no upload service, accounts, analytics, advertising, or tracking pixels.
- Keep theme and language preferences as the only application values stored in `localStorage`.
- Serve processing libraries, locale catalogs, fonts, modules, and workers from the same origin.

### Accessibility

- Provide semantic controls, keyboard-operable queues and page ordering, visible focus treatment, live status messaging, and reduced-motion foundations.
- Preserve native file-input paths alongside drag-and-drop interactions.

### Localization

- Provide complete English, Korean, Japanese, Spanish, German, and French interface catalogs.
- Detect supported browser languages, persist manual selection, and update document language and metadata without resetting tool state.

### Security

- Enforce a restrictive Content Security Policy with no inline code, runtime CDN, remote API, or evaluation exception.
- Validate supported file signatures and apply queue, file-size, image-dimension, decoded-pixel, render, and metadata-display limits.
- Pin four audited browser dependencies with package metadata, licenses, upstream provenance, and runtime hashes in the repository.

### Reliability

- Cover corrupt, encrypted, empty, spoofed, boundary-size, repeated-operation, deterministic-naming, cancellation, and save-error paths.
- Use a shared File System Access save path when supported and a revoking Blob-download fallback elsewhere.
- Run syntax, functional, route/resource, privacy/network, security, localization, responsive-contract, accessibility, CI, dependency-integrity, and save-path checks through one test command.

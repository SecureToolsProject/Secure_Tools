# Changelog

## 1.0.0

This section describes the planned v1.0.0 release candidate. The Git tag and GitHub release are intentionally separate release-manager actions and are not created by Sprint 11.

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

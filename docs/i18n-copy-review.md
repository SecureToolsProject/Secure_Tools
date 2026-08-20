# Internationalization copy review

This record describes the structured source-level copy review completed for Sprint 9. Automated tests verify structure and interpolation safety; they do not attempt to grade prose quality.

## Catalog controls

- [x] Every catalog contains the same 525 leaf keys as English.
- [x] Every interpolation placeholder matches the English source key.
- [x] No catalog contains `TODO`, `TRANSLATE`, `TBD`, or `[English]` draft markers.
- [x] Production HTML references resolve to catalog keys.
- [x] Titles, descriptions, Open Graph text, accessibility labels, errors, status text, progress text, counts, and metadata fields remain represented.

## Korean review

All 525 Korean production strings were inspected by namespace against their English meaning and their binding context. The review covered:

- [x] Global navigation, theme, language, and shared privacy controls
- [x] Homepage hero, directory, principles, verification, and source sections
- [x] About page
- [x] Privacy page
- [x] PDF category hub
- [x] Images to PDF
- [x] Merge PDF
- [x] Split PDF
- [x] Organize PDF
- [x] PDF to Images
- [x] PDF Metadata Inspector & Cleaner
- [x] Image, Privacy, Scan/OCR, and Media category hubs
- [x] Errors and recovery guidance
- [x] Status, progress, file, page, and field counts
- [x] Buttons, tooltips, and accessibility labels

The rewrite favors concise action labels, natural `~합니다` explanatory prose, and direct descriptions of local processing. It removes literal English structures such as references to a file “leaving” a device. Privacy statements still distinguish supported document-info cleaning from complete forensic sanitization. In particular, the metadata action is `지원 항목 모두 제거`, not a claim that every possible metadata structure is removed.

## Japanese, Spanish, German, and French review

The new catalogs received a structured source review for:

- [x] Obvious grammar and punctuation defects
- [x] Accidental English fallback text outside recognized product and technical names
- [x] Consistent names for PDF, image, privacy, source, theme, and action concepts
- [x] Concise buttons and status text
- [x] Accurate local-processing, no-upload, and limited-cleaning claims
- [x] Interpolation placeholders and count meaning
- [x] Overlong literal translations, with German and French treated as layout stress cases

Recognized names such as Secure Tools, PDF, JPEG, PNG, WebP, ZIP, and GitHub remain unchanged where appropriate. Spanish uses neutral phrasing that generally avoids country-specific second-person forms. Japanese uses compact modern UI wording. German and French prefer established short interface terms where the full literal construction would be unnecessarily long.

Initial drafts for these four catalogs were machine-assisted during development, then stored as static source files and reviewed for the categories above. No translation service is present in production, and no runtime request is made. This review is not professional native-speaker certification; further native editorial review may refine nuance before or after v1.0.0 without changing the locale architecture.

## Layout and behavior review

- [x] Native language names are used without flag-only identification.
- [x] The shared selector contains exactly `en`, `ko`, `ja`, `es`, `de`, and `fr` on every production page.
- [x] Korean uses phrase-preserving line breaks and Japanese uses strict line-breaking behavior.
- [x] Latin, Hangul, and Japanese system-font fallbacks are present; no remote font was added.
- [x] Flex and grid children that carry localized text can shrink, and the header wraps before controls collide.
- [x] Narrow-screen controls stack without truncating critical action text.
- [x] Changing languages re-renders dynamic tools without clearing their application state.
- [x] The selected language persists and overrides browser detection.
- [x] `<html lang>` and localized metadata update on every language change.

Visual browser coverage is reported separately in the Sprint completion record because local automation availability is environment-dependent.

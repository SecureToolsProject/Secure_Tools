# Privacy and local-processing model

## What local processing means

For supported production workflows, Secure Tools reads and transforms file contents in the browser on the user's device. It does not send those contents to an application upload service. The site requires no account and includes no analytics, advertising, behavioral telemetry, or tracking pixels.

This guarantee applies to documented production tools and supported formats. It is not a claim that every browser extension, operating system component, external destination, unsupported file structure, or future companion application has the same behavior.

## Network boundary

Production pages load HTML, CSS, JavaScript, and vendored libraries from the Secure Tools origin. First-party processing code does not use `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or `sendBeacon` for file processing. It does not load runtime codecs, workers, fonts, translations, or libraries from a CDN.

Production Content Security Policy uses `connect-src 'none'` and restricts scripts, styles, frames, objects, base URLs, and form actions to the documented static model. User navigation to an external source link is a deliberate browser navigation governed by the destination's policy, not a processing request.

Blob URLs and data URLs are browser-local references used for previews, prepared images, and downloads. The application revokes temporary object URLs when they are no longer needed.

## Storage and source handling

Theme and language preferences are the only application values stored in `localStorage`. Source files and outputs are not placed in application cloud storage. Tools retain in-memory source state only as needed for the active workflow and release object URLs, rendering tasks, models, or byte references when sources are cleared or replaced.

Save operations use the browser's File System Access picker where available and a local Blob-download fallback elsewhere. Cancellation and write failures do not silently convert into successful saves.

## Input and resource boundaries

Tools validate supported signatures and apply bounded file, queue, dimension, pixel, page, render, metadata-display, and aggregate-work limits appropriate to each workflow. These controls reduce accidental memory and workload pressure; they are not malware scanning or a guarantee that arbitrary hostile files are safe.

The exact production surface and shared image limits are recorded in [tool status](./tool-status.md). Automated tests cover spoofed signatures, corrupt and protected inputs where applicable, runtime network invariants, dependency integrity, safe DOM sinks, save paths, and resource boundaries.

## Bounded privacy claims

Secure Tools does not claim that a file is “100% private,” completely anonymous, universally sanitized, or free of all hidden information.

- Canvas-based Image Converter, Resize, and Compressor create new pixel encodings and do not preserve EXIF metadata, but they are not configurable forensic metadata cleaners.
- Image Metadata reports only structures supported by the pinned parser. Partial or opaque results remain explicitly non-exhaustive; unknown structures are not guessed away.
- PDF Metadata removes and verifies the eight supported document-info fields. It does not claim complete XMP, attachment, annotation, hidden-content, or structural sanitization.
- Images to PDF and PDF page-copying tools preserve or transform content according to their documented workflow; they are not privacy cleaners.

Format-specific Image Metadata semantics—including decoded versus opaque data, EXIF Orientation and ICC preservation, unknown structures, and fail-closed verification—live in [Image Metadata privacy and verification](./image-metadata-privacy.md).

## Verification

Privacy behavior is inspectable through source code, Content Security Policy, the browser Network panel, vendored dependency records, and automated tests. Release-specific automated and manual results are retained in the [documentation index](./README.md#release-evidence).

# Image Metadata privacy and verification

The Image Metadata Inspector & Cleaner at `/tools/image/metadata/` processes one signature-validated JPEG, PNG, or WebP file in browser memory. The application enforces its existing 50 MiB per-image limit before reading the full file. It does not upload the image, decode pixels, use Canvas, resize, convert, or re-encode it.

Inspection reports only structures supported by `secure-metadata v0.1.1`. Decoded values and opaque detected containers are presented differently. A `metadata-partial` result is a successful but non-exhaustive inspection; it is not evidence that every possible metadata structure was decoded. “No supported metadata detected” does not mean that the image contains no metadata or hidden information.

Privacy Clean uses the library’s exported `DEFAULT_CLEANING_POLICY` directly. It removes supported privacy-related EXIF, XMP, IPTC, comments, ordinary PNG text metadata, and standalone timestamps while preserving ICC color profiles. For JPEG, one unambiguous valid EXIF Orientation value from 1–8 is retained as rendering information; ambiguous, duplicate, malformed, conflicting, or out-of-range Orientation is removed instead of guessed. Unknown structures are not guessed away. The original source bytes remain unchanged, and pixels are never decoded or re-encoded.

Customize exposes only the same supported metadata classes that apply to the detected JPEG, PNG, or WebP format. The user may choose which classes to remove and whether to preserve ICC, but cannot edit individual values or target unknown structures. Verification expectations are derived from that explicit policy, so only requested removals are required to be absent and intentionally preserved supported classes may remain.

The produced bytes are passed to `verifyMetadata` before any write or download. Every returned policy check must pass, the verification result must be valid, and inspection of the result must not be partial or truncated. Otherwise the operation fails closed and no output bytes are saved. This verifies only the metadata categories targeted by the supported policy; it does not establish anonymity, complete privacy, provenance, pixel privacy, steganography detection, or malware safety.

## Pinned dependency

- Library: `secure-metadata`
- Version/tag: `v0.1.1`
- Release commit: `cdcd138e48d30618b6d76f7c6538cd43ad660b53`
- Browser artifact: `secure-metadata-0.1.1.browser.js`
- SHA-256: `4bfcc9e0e484db12192e46f076c19cf69cd36c496c7cfbb5a71c1057cbcccba1`
- License: MIT
- Runtime dependencies: 0

The immutable GitHub Release artifact was verified against its published checksum manifest and is served from `assets/vendor/secure-metadata/`. Secure Tools does not install or load the npm package at runtime, use a CDN, contact GitHub for processing, or check automatically for updates. Replacement requires a new explicit provenance and hash review.

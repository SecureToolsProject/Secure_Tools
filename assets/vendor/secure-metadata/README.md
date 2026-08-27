# secure-metadata

This directory contains the approved same-origin browser runtime used by Image Metadata Inspector & Cleaner.

## Provenance

- Library: `secure-metadata`
- Version: `0.1.1`
- Source repository: `SecureToolsProject/Secure_Metadata`
- Release tag: `v0.1.1`
- Release commit: `cdcd138e48d30618b6d76f7c6538cd43ad660b53`
- Browser artifact: `secure-metadata-0.1.1.browser.js`
- Browser artifact SHA-256: `4bfcc9e0e484db12192e46f076c19cf69cd36c496c7cfbb5a71c1057cbcccba1`
- Package artifact: `secure-metadata-0.1.1.tgz`
- Package artifact SHA-256: `4ecaedeeac12ddda1821afb93f0b9f9adc2323b38c7f865ad9b026550fd4305d`
- License: MIT
- Runtime dependencies: 0

## Integrity and runtime use

The browser and package artifacts were downloaded from the immutable GitHub `v0.1.1` Release and checked locally against the published `SHA256SUMS` manifest and GitHub asset digests. The browser bytes are unchanged and match the browser build inside the published package: they were not rebuilt, minified, reformatted, concatenated, or stripped. `LICENSE` and `package.json` were taken from that published package.

Secure Tools imports the browser artifact only through `tools/image/metadata/metadata.js`. Production pages do not load secure-metadata from npm, a CDN, GitHub, or another runtime origin. Updates require a new explicit provenance and hash review.

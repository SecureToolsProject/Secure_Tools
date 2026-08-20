# PDF.js 6.2.108

This directory vendors the browser display-layer build of [Mozilla PDF.js](https://github.com/mozilla/pdf.js) for same-origin page thumbnail rendering.

- Package: `pdfjs-dist`
- Version: `6.2.108`
- Source artifact: npm package `pdfjs-dist@6.2.108`
- npm tarball: https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.2.108.tgz
- npm integrity: `sha512-YxFb+SQcodN2rnX9Tn3dHYlqfb7NjlzzfONPpJd+AKoKtUjEdevTfbC07d5TcczzOK6261auRkP/M8OBHs9vFQ==`
- npm tarball SHA-1: `1e0ce0f4b3a034f953dbbe2334ab01fbddf0eb30`
- npm tarball SHA-256: `b3e68d5cda70551a90b3f771419d379e20fc788ce056fa32de73608e01df47f4`
- Main module: `pdf.min.mjs`
- Main module SHA-256: `e0be3863c23c8af2305b16548febd58e7f8874a460253317d7771cddbc1c0f6d`
- Worker module: `pdf.worker.min.mjs`
- Worker SHA-256: `0613f41490dd6aaceed7a93fbbd38c85e6d6aa60474b6588c6e7709cfbe18cb3`
- License: Apache-2.0; see `LICENSE`

Only the display-layer module and worker required by the Organizer are deployed. Both load from the Secure Tools origin; no viewer application, examples, CDN, remote worker, CMaps, standard fonts, or optional WASM assets are included.

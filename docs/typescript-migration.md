# TypeScript migration policy

Secure Tools adopts TypeScript incrementally within its existing static ES-module architecture. New shared and core browser modules should prefer TypeScript when explicit contracts improve safety. Existing JavaScript remains valid and should move only when a focused change benefits from typing; repository-wide rename-only migrations are out of scope.

TypeScript source uses strict mode. Run `npm run typecheck` before a pull request is merged. Browser TypeScript is compiled by `npm run compile:ts` into the ignored `.ts-build/` staging directory, then the static build copies only the declared modules to their established public JavaScript paths. Production builds do not include TypeScript sources, declaration files, or source maps.

Node build and release scripts may remain `.mjs`. Tests, locale catalogs, DOM-heavy page modules, and specialized PDF or image workflows may remain JavaScript until a bounded migration is useful. Vendored and generated third-party code, including Tesseract assets, is excluded from migration.

The module list in `scripts/typescript-modules.mjs` is the emission boundary. Add a browser module there only when its output path is stable and its consumers can continue importing JavaScript. This preserves JavaScript and TypeScript coexistence without a framework, bundler, runtime compiler, or Big Bang rewrite.

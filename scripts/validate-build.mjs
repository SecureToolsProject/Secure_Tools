import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalPages, legacyRedirects, redirectStatus } from "./site-routes.mjs";
import { compiledBrowserModules } from "./typescript-modules.mjs";
import { validateBuildProvenance } from "./build-provenance.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, process.argv[2] || "dist");
validateBuildProvenance(output);
const htmlFiles = [];
const outputFiles = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else {
      outputFiles.push(target);
      if (entry.name === "index.html") htmlFiles.push(target);
    }
  }
}

visit(output);
assert.equal(htmlFiles.length, canonicalPages.length, "build output canonical page count matches the route manifest");
for (const { route } of canonicalPages) {
  const target = route === "/" ? path.join(output, "index.html") : path.join(output, route.slice(1), "index.html");
  assert.ok(fs.existsSync(target), `missing built route ${route}`);
}

const expectedRedirects = `${legacyRedirects.map(({ from, to }) => `${from} ${to} ${redirectStatus}`).join("\n")}\n`;
assert.equal(fs.readFileSync(path.join(output, "_redirects"), "utf8"), expectedRedirects);
assert.ok(fs.existsSync(path.join(output, "assets", "vendor", "tesseract", "worker", "worker.min.js")));
assert.ok(fs.existsSync(path.join(output, "assets", "vendor", "tesseract", "core", "tesseract-core-simd-lstm.wasm.js")));
assert.ok(fs.existsSync(path.join(output, "assets", "vendor", "tesseract", "lang", "eng.traineddata.gz")));
assert.ok(fs.existsSync(path.join(output, "assets", "vendor", "tesseract", "lang", "kor.traineddata.gz")));

for (const module of compiledBrowserModules) {
  const compiledFile = path.join(output, module.public);
  assert.ok(fs.existsSync(compiledFile), `missing compiled TypeScript module ${module.public}`);
  const contents = fs.readFileSync(compiledFile, "utf8");
  assert.doesNotMatch(contents, /sourceMappingURL=/, `${module.public} exposes a source-map reference`);
  assert.doesNotMatch(contents, /[A-Za-z]:[\\/]Users[\\/]|\/Users\//, `${module.public} exposes a local path`);
}

assert.deepEqual(
  outputFiles.filter((file) => /\.(?:d\.ts|ts|tsx|map)$/.test(file)),
  [],
  "production output excludes TypeScript sources and source maps",
);

for (const file of outputFiles.filter((candidate) => /\.(?:html|css|js|json|txt|xml)$/.test(candidate))) {
  const contents = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(contents, /[A-Za-z]:[\\/]Users[\\/]|\/Users\//, `${path.relative(output, file)} exposes a local path`);
}

console.log(`Validated ${canonicalPages.length} canonical pages, ${legacyRedirects.length} redirects, ${compiledBrowserModules.length} compiled TypeScript modules, and local OCR assets in ${output}.`);

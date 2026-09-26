import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalPages, legacyRedirects, redirectStatus } from "./site-routes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, process.argv[2] || "dist");
const htmlFiles = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.name === "index.html") htmlFiles.push(target);
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

console.log(`Validated ${canonicalPages.length} canonical pages, ${legacyRedirects.length} redirects, and local OCR assets in ${output}.`);

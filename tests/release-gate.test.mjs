import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadBlob,
  requestPdfSaveHandle,
  requestSaveHandle,
  writeBlobToHandle,
} from "../tools/shared/save.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const sha256 = (relative) => createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");

const vendors = {
  jspdf: {
    name: "jspdf",
    version: "4.2.1",
    license: "MIT",
    files: ["LICENSE.txt", "README.md", "jspdf.umd.min.js", "package.json"],
    runtimes: {
      "jspdf.umd.min.js": "e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54",
    },
  },
  jszip: {
    name: "jszip",
    version: "3.10.1",
    license: "(MIT OR GPL-3.0-or-later)",
    files: ["LICENSE.markdown", "README.md", "jszip.min.js", "package.json"],
    runtimes: {
      "jszip.min.js": "acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e",
    },
  },
  "pdf-lib": {
    name: "pdf-lib",
    version: "1.17.1",
    license: "MIT",
    files: ["LICENSE.md", "README.md", "package.json", "pdf-lib.min.js"],
    runtimes: {
      "pdf-lib.min.js": "0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f",
    },
  },
  pdfjs: {
    name: "pdfjs-dist",
    version: "6.2.108",
    license: "Apache-2.0",
    files: ["LICENSE", "README.md", "package.json", "pdf.min.mjs", "pdf.worker.min.mjs"],
    runtimes: {
      "pdf.min.mjs": "e0be3863c23c8af2305b16548febd58e7f8874a460253317d7771cddbc1c0f6d",
      "pdf.worker.min.mjs": "0613f41490dd6aaceed7a93fbbd38c85e6d6aa60474b6588c6e7709cfbe18cb3",
    },
  },
  "secure-metadata": {
    name: "secure-metadata",
    version: "0.1.1",
    license: "MIT",
    files: ["LICENSE", "README.md", "package.json", "secure-metadata-0.1.1.browser.js"],
    runtimes: {
      "secure-metadata-0.1.1.browser.js": "4bfcc9e0e484db12192e46f076c19cf69cd36c496c7cfbb5a71c1057cbcccba1",
    },
  },

};

assert.deepEqual(fs.readdirSync(path.join(root, "assets/vendor")).sort(), Object.keys(vendors).sort());
for (const [directory, expected] of Object.entries(vendors)) {
  const base = path.join(root, "assets/vendor", directory);
  const metadata = JSON.parse(fs.readFileSync(path.join(base, "package.json"), "utf8"));
  assert.equal(metadata.name, expected.name, `${directory}: package name`);
  assert.equal(metadata.version, expected.version, `${directory}: package version`);
  assert.equal(metadata.license, expected.license, `${directory}: package license`);
  assert.deepEqual(fs.readdirSync(base).sort(), expected.files.slice().sort(), `${directory}: approved files only`);
  assert.ok(read(`assets/vendor/${directory}/README.md`).length > 0, `${directory}: README`);
  for (const [runtime, hash] of Object.entries(expected.runtimes)) {
    assert.equal(sha256(`assets/vendor/${directory}/${runtime}`), hash, `${directory}/${runtime}: integrity`);
  }
}
assert.match(read("assets/vendor/jszip/README.md"), /License choice: MIT/);
const secureMetadataProvenance = read("assets/vendor/secure-metadata/README.md");
assert.match(secureMetadataProvenance, /Release tag: `v0\.1\.1`/);
assert.match(secureMetadataProvenance, /Release commit: `cdcd138e48d30618b6d76f7c6538cd43ad660b53`/);
assert.match(secureMetadataProvenance, /SHA-256: `4bfcc9e0e484db12192e46f076c19cf69cd36c496c7cfbb5a71c1057cbcccba1`/);
assert.match(secureMetadataProvenance, /Runtime dependencies: 0/);
assert.match(read("assets/vendor/secure-metadata/secure-metadata-0.1.1.browser.js"), /maxInputBytes:\s*100 \* 1024 \* 1024/);

const renderer = read("tools/shared/pdf-renderer.js");
assert.match(renderer, /new URL\("\.\.\/\.\.\/assets\/vendor\/pdfjs\/pdf\.worker\.min\.mjs", import\.meta\.url\)/);
assert.doesNotMatch(renderer, /https?:\/\//);
for (const relative of [
  "tools/pdf/organize/index.html",
  "tools/pdf/to-images/index.html",
  "tools/pdf/metadata/index.html",
]) {
  const csp = read(relative).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] || "";
  assert.ok(csp.includes("worker-src 'self'") || (!csp.includes("worker-src") && csp.includes("default-src 'self'")), `${relative}: same-origin worker policy`);
}

const blob = new Blob(["release candidate"]);
const downloadEvents = [];
let deferredRevoke;
const anchor = {
  click() { downloadEvents.push("click"); },
  remove() { downloadEvents.push("remove"); },
};
downloadBlob(blob, "secure-tools.txt", {
  documentObject: {
    createElement(tag) { assert.equal(tag, "a"); return anchor; },
    body: { append(node) { assert.equal(node, anchor); downloadEvents.push("append"); } },
  },
  urlObject: {
    createObjectURL(value) { assert.equal(value, blob); return "blob:release-gate"; },
    revokeObjectURL(value) { assert.equal(value, "blob:release-gate"); downloadEvents.push("revoke"); },
  },
  schedule(callback, delay) { assert.equal(delay, 1500); deferredRevoke = callback; },
});
assert.equal(anchor.href, "blob:release-gate");
assert.equal(anchor.download, "secure-tools.txt");
assert.deepEqual(downloadEvents, ["append", "click", "remove"]);
deferredRevoke();
assert.deepEqual(downloadEvents, ["append", "click", "remove", "revoke"]);

assert.equal(await requestSaveHandle({}, {
  suggestedName: "ignored.pdf", description: "PDF", mimeType: "application/pdf", extension: ".pdf",
}), null);
let pickerOptions;
const saveHandle = { id: "save-handle" };
assert.equal(await requestPdfSaveHandle({
  async showSaveFilePicker(options) { pickerOptions = options; return saveHandle; },
}, "document.pdf", "PDF document"), saveHandle);
assert.deepEqual(pickerOptions, {
  suggestedName: "document.pdf",
  types: [{ description: "PDF document", accept: { "application/pdf": [".pdf"] } }],
});

const writeEvents = [];
await writeBlobToHandle({
  async createWritable() {
    writeEvents.push("create");
    return {
      async write(value) { assert.equal(value, blob); writeEvents.push("write"); },
      async close() { writeEvents.push("close"); },
    };
  },
}, blob);
assert.deepEqual(writeEvents, ["create", "write", "close"]);

const writeFailure = new Error("disk full");
await assert.rejects(writeBlobToHandle({
  async createWritable() {
    return { async write() { throw writeFailure; }, async close() { assert.fail("close must not mask a failed write"); } };
  },
}, blob), writeFailure);

console.log("Release integrity and save-path gate checks passed.");

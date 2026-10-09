import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPdfToTextController } from "../.ts-build/tools/pdf/to-text/controller.js";
import { copyText, downloadPdfText, formatPdfOcrText, pdfTextFilename } from "../.ts-build/tools/pdf/to-text/output.js";
import { canonicalPages, legacyRedirects } from "../scripts/site-routes.mjs";
import { translations } from "../js/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("tools/pdf/to-text/index.html");

assert.equal(canonicalPages.length, 19);
assert.equal(legacyRedirects.length, 17);
assert.ok(canonicalPages.some(({ route }) => route === "/pdf/to-text/"));
assert.ok(!legacyRedirects.some(({ from }) => from === "/tools/pdf/to-text/"));
assert.match(html, /data-page="pdfToText"/);
assert.match(html, /href="https:\/\/tools\.securetools\.app\/pdf\/to-text\/"/);
assert.match(html, /id="pages-all"[\s\S]*id="pages-selected"[\s\S]*id="page-range"/);
assert.match(html, /value="eng"[\s\S]*value="kor"[\s\S]*value="eng\+kor"/);
assert.match(html, /connect-src 'none'/);
assert.doesNotMatch(html, /https?:\/\/(?!tools\.securetools\.app|github\.com)/);
for (const language of ["en", "ko", "ja", "es", "de", "fr"]) {
  assert.ok(translations[language].metadata.pdfToText.title);
  assert.ok(translations[language].pdfToText.result.copyAll);
  assert.ok(translations[language].pdfToText.result.downloadSearchable);
  assert.ok(translations[language].pdfToText.result.searchableHint);
  assert.ok(translations[language].categories.pdf.toText);
}

assert.equal(formatPdfOcrText([{ pageNumber: 1, text: "One" }, { pageNumber: 3, text: "Three\n" }]), "--- Page 1 ---\nOne\n\n--- Page 3 ---\nThree\n");
assert.equal(pdfTextFilename("private/report.pdf"), "private_report.txt");

let resolveFirst;
const first = new Promise((resolve) => { resolveFirst = resolve; });
let request;
const states = [];
const service = {
  async recognizeDocument(value) { request = value; await first; value.onPageResult?.({ pageNumber: 1, text: "stale" }); return { pages: [{ pageNumber: 1, text: "stale" }] }; },
  async cancel() { resolveFirst?.(); return true; },
  async dispose() {},
};
const controller = createPdfToTextController({ service, inspect: async () => ({ pageCount: 2 }), onChange: (state) => states.push(state.phase) });
const file = Object.assign(new Blob(["%PDF-1.7"], { type: "application/pdf" }), { name: "sample.pdf", lastModified: 0 });
await controller.select(file);
const running = controller.recognize("eng", { mode: "all" });
await controller.cancel();
await running;
assert.equal(controller.getState().phase, "cancelled");
assert.deepEqual(controller.getState().pages, []);
assert.equal(request.selection.mode, "all");
assert.equal(request.includeLayout, true);
assert.equal(request.inspectExistingText, true);
assert.ok(states.includes("recognizing"));

let copied = "";
await copyText(formatPdfOcrText([{ pageNumber: 2, text: "editable" }]), { navigatorObject: { clipboard: { writeText: async (text) => { copied = text; } } } });
assert.equal(copied, "--- Page 2 ---\neditable\n");
let downloaded;
const anchor = { click() { this.clicked = true; }, remove() {} };
downloadPdfText([{ pageNumber: 2, text: "editable" }], "unsafe:name.pdf", {
  documentObject: { body: { append() {} }, createElement: () => anchor },
  urlObject: { createObjectURL(blob) { downloaded = blob; return "blob:test"; }, revokeObjectURL() {} }, schedule() {},
});
assert.equal(anchor.download, "unsafe_name.txt");
assert.equal(anchor.clicked, true);
assert.equal(await downloaded.text(), "--- Page 2 ---\neditable\n");

let attempts = 0;
const retryController = createPdfToTextController({
  inspect: async () => ({ pageCount: 1 }),
  service: {
    async recognizeDocument(value) {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("failed"), { code: "PDF_OCR_FAILED" });
      const page = { pageNumber: 1, text: "retry worked" }; value.onPageResult?.(page);
      return { pages: [page] };
    },
    async cancel() { return false; }, async dispose() {},
  },
});
await retryController.select(file);
await retryController.recognize("eng", { mode: "all" });
assert.equal(retryController.getState().phase, "error");
await retryController.recognize("eng", { mode: "all" });
assert.equal(retryController.getState().phase, "success");
assert.equal(retryController.getState().pages[0].text, "retry worked");

let releaseOld;
const replacementController = createPdfToTextController({
  service: { async recognizeDocument() { throw new Error("unused"); }, async cancel() { return false; }, async dispose() {} },
  inspect: async (source) => source.name === "old.pdf" ? new Promise((resolve) => { releaseOld = () => resolve({ pageCount: 9 }); }) : { pageCount: 2 },
});
const oldFile = Object.assign(new Blob(["%PDF-1.7"], { type: "application/pdf" }), { name: "old.pdf", lastModified: 0 });
const newFile = Object.assign(new Blob(["%PDF-1.7"], { type: "application/pdf" }), { name: "new.pdf", lastModified: 0 });
const oldSelection = replacementController.select(oldFile);
await replacementController.select(newFile);
releaseOld(); await oldSelection;
assert.equal(replacementController.getState().source.file.name, "new.pdf");
assert.equal(replacementController.getState().source.pageCount, 2);

let releaseBuild;
const buildController = createPdfToTextController({
  inspect: async () => ({ pageCount: 1 }),
  service: {
    async recognizeDocument() { return { pages: [{ pageNumber: 1, text: "layout", lines: [], rasterToPdfTransform: [1, 0, 0, 1, 0, 0] }] }; },
    async cancel() { return false; }, async dispose() {},
  },
  buildSearchablePdf: async () => new Promise((resolve) => { releaseBuild = () => resolve(Uint8Array.of(1, 2, 3)); }),
});
await buildController.select(file); await buildController.recognize("eng", { mode: "all" });
const staleBuild = buildController.buildSearchable({}, {}, new ArrayBuffer(1));
await buildController.select(newFile); releaseBuild();
assert.equal(await staleBuild, null, "a replaced source rejects a delayed searchable PDF");
assert.equal(buildController.getState().source.file.name, "new.pdf");
console.log("PDF to Text route, localization, output, and stale-job cancellation checks passed.");

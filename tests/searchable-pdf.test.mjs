import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyTransform, createSearchablePdf, searchablePdfFilename } from "../.ts-build/tools/shared/searchable-pdf.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
new Function(fs.readFileSync(path.join(root, "assets/vendor/pdf-lib/pdf-lib.min.js"), "utf8"))();
const PDFLib = globalThis.PDFLib;
const fontkit = createRequire(import.meta.url)(path.join(root, "node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js"));
const fontBytes = fs.readFileSync(path.join(root, "node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff"));
globalThis.DOMMatrix ||= class DOMMatrix {};
globalThis.ImageData ||= class ImageData {};
globalThis.Path2D ||= class Path2D {};
Uint8Array.prototype.toHex ||= function toHex() { return Array.from(this, (value) => value.toString(16).padStart(2, "0")).join(""); };
Math.sumPrecise ||= (values) => Array.from(values).reduce((sum, value) => sum + value, 0);
const pdfjs = await import("../assets/vendor/pdfjs/pdf.min.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = new URL("../assets/vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

const source = await PDFLib.PDFDocument.create();
source.setTitle("Preserved title"); source.setAuthor("Secure Tools");
for (let index = 0; index < 5; index += 1) {
  const page = source.addPage([300, 180]);
  page.drawRectangle({ x: 20, y: 30, width: 250, height: 100, color: PDFLib.rgb((index + 1) / 10, 0.4, 0.7) });
  if (index === 3) page.drawText("EXISTING TEXT", { x: 40, y: 140, size: 14 });
}
const sourceBytes = await source.save();
const matrix = [0.5, 0, 0, -0.5, 0, 180];
const line = (text, y) => ({ text, confidence: 63, bbox: { x0: 40, y0: y, x1: 560, y1: y + 32 } });
const pages = [
  { pageNumber: 1, text: "HELLO SEARCHABLE PDF", lines: [line("HELLO SEARCHABLE PDF", 40)], rasterWidth: 600, rasterHeight: 360, rasterToPdfTransform: matrix, hasMeaningfulText: false },
  { pageNumber: 2, text: "검색 가능한 PDF", lines: [line("검색 가능한 PDF", 40)], rasterWidth: 600, rasterHeight: 360, rasterToPdfTransform: matrix, hasMeaningfulText: false },
  { pageNumber: 3, text: "HELLO 검색 PDF", lines: [line("HELLO 검색 PDF", 40)], rasterWidth: 600, rasterHeight: 360, rasterToPdfTransform: matrix, hasMeaningfulText: false },
  { pageNumber: 4, text: "DO NOT DUPLICATE", lines: [line("DO NOT DUPLICATE", 40)], rasterWidth: 600, rasterHeight: 360, rasterToPdfTransform: matrix, hasMeaningfulText: true },
];
const progress = [];
const output = await createSearchablePdf({ sourceBytes: sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength), pages, PDFLib, fontkit, fontBytes: fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength), onProgress(value) { progress.push(value); } });
assert.ok(output.length > sourceBytes.length && output.length < sourceBytes.length + fontBytes.length, "the font is subset rather than embedded in full");
const loadingTask = pdfjs.getDocument({ data: output.slice(), isEvalSupported: false, useWorkerFetch: false, useWasm: false });
const parsed = await loadingTask.promise;
assert.equal(parsed.numPages, 5, "all pages and their order are preserved");
const extract = async (pageNumber) => (await (await parsed.getPage(pageNumber)).getTextContent()).items.map((item) => item.str).join("").trim();
assert.equal(await extract(1), "HELLO SEARCHABLE PDF");
assert.equal(await extract(2), "검색 가능한 PDF");
assert.equal(await extract(3), "HELLO 검색 PDF");
assert.equal(await extract(4), "EXISTING TEXT", "pages with meaningful text retain one original text layer without OCR duplication");
assert.equal(await extract(5), "", "unselected pages remain without an added layer");
const reloaded = await PDFLib.PDFDocument.load(output);
assert.equal(reloaded.getTitle(), "Preserved title"); assert.equal(reloaded.getAuthor(), "Secure Tools");
assert.ok(reloaded.getPages()[0].node.Contents().size() >= 2, "the original visible content stream remains before the added text layer");
assert.equal(reloaded.getPages()[4].node.Contents().size(), 1, "an unselected page keeps only its original visible content stream");
assert.equal(progress.at(-1).phase, "complete");
assert.equal(searchablePdfFilename("unsafe:name.PDF"), "unsafe-name-searchable.pdf");

async function measureOnePage(text) {
  const input = await PDFLib.PDFDocument.create(); input.addPage([300, 180]).drawRectangle({ x: 20, y: 30, width: 250, height: 100, color: PDFLib.rgb(0.2, 0.4, 0.7) });
  const inputBytes = await input.save(); const started = performance.now();
  const result = await createSearchablePdf({ sourceBytes: inputBytes.buffer.slice(inputBytes.byteOffset, inputBytes.byteOffset + inputBytes.byteLength), pages: [{ pageNumber: 1, text, lines: [line(text, 40)], rasterWidth: 600, rasterHeight: 360, rasterToPdfTransform: matrix, hasMeaningfulText: false }], PDFLib, fontkit, fontBytes: fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength) });
  return { input: inputBytes.length, output: result.length, milliseconds: Math.round((performance.now() - started) * 10) / 10 };
}
const englishMeasurement = await measureOnePage("HELLO SEARCHABLE PDF");
const koreanMeasurement = await measureOnePage("검색 가능한 PDF");

assert.deepEqual(applyTransform([0.5, 0, 0, -0.5, 0, 180], 40, 80), { x: 20, y: 140 });
assert.deepEqual(applyTransform([0, 0.5, 0.5, 0, 0, 0], 40, 80), { x: 40, y: 20 });
assert.deepEqual(applyTransform([-0.5, 0, 0, 0.5, 300, 0], 40, 80), { x: 280, y: 40 });
assert.deepEqual(applyTransform([0, -0.5, -0.5, 0, 300, 180], 40, 80), { x: 260, y: 160 });

const controller = new AbortController(); controller.abort();
await assert.rejects(createSearchablePdf({ sourceBytes: new ArrayBuffer(1), pages: [], PDFLib, fontkit, fontBytes: new ArrayBuffer(1), signal: controller.signal }), (error) => error.code === "SEARCHABLE_PDF_CANCELLED");
await assert.rejects(createSearchablePdf({ sourceBytes: new ArrayBuffer(1), pages: [], PDFLib, fontkit, fontBytes: new ArrayBuffer(1) }));
const midBuild = new AbortController();
const fakePage = { drawText() {} };
const fakeLibrary = { degrees: (angle) => angle, PDFDocument: { async load() { return { registerFontkit() {}, async embedFont() { return { widthOfTextAtSize: () => 10 }; }, getPages: () => [fakePage, fakePage], async save() { return Uint8Array.of(1); } }; } } };
await assert.rejects(createSearchablePdf({ sourceBytes: new ArrayBuffer(1), pages: [pages[0], { ...pages[0], pageNumber: 2 }], PDFLib: fakeLibrary, fontkit: {}, fontBytes: new ArrayBuffer(1), signal: midBuild.signal, onProgress(value) { if (value.phase === "building-pdf" && value.pageIndex === 1) midBuild.abort(); } }), (error) => error.code === "SEARCHABLE_PDF_CANCELLED");
const sourceCode = fs.readFileSync(path.join(root, "tools/shared/searchable-pdf.ts"), "utf8");
assert.doesNotMatch(sourceCode, /fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|https?:\/\//);
assert.match(sourceCode, /opacity: 0/);
await loadingTask.destroy();
console.log(`Searchable PDF extraction passed for English, Korean, and mixed text. English ${JSON.stringify(englishMeasurement)}; Korean ${JSON.stringify(koreanMeasurement)}; five-page mixed ${sourceBytes.length} -> ${output.length} bytes.`);

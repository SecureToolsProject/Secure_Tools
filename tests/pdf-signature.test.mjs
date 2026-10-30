import assert from "node:assert/strict";
import { File } from "node:buffer";
import { createRequire } from "node:module";
import { inspectPdf, loadPdfSource, readPdfSourceBytes, requirePdfSignature } from "../tools/shared/pdf.js";
import { mergePdfFiles } from "../tools/pdf/merge/pdf.js";
import { splitPdfFile } from "../tools/pdf/split/pdf.js";
import { organizePdf, readOrganizerSource } from "../tools/pdf/organize/pdf.js";
import { cleanPdfMetadata, readPdfMetadata } from "../tools/pdf/metadata/pdf.js";
import { createSearchablePdf } from "../.ts-build/tools/shared/searchable-pdf.js";
import { createPdfOcrService, readPdfOcrSource } from "../.ts-build/tools/shared/pdf-ocr.js";

const PDFLib = createRequire(import.meta.url)("../assets/vendor/pdf-lib/pdf-lib.min.js");
const { PDFDocument } = PDFLib;
const source = await PDFDocument.create();
source.addPage([200, 300]);
const validBytes = await source.save();
const buffer = (text) => new TextEncoder().encode(text).buffer;
const unreadable = (error) => ["UNREADABLE_PDF", "UNSUPPORTED_PDF"].includes(error.code);

// Actual PDF fixtures, including valid bytes with misleading metadata.
for (const [name, type] of [["minimal.pdf", "application/pdf"], ["empty-mime.pdf", ""], ["no-extension", ""], ["image.png", "image/png"]]) {
  const file = new File([validBytes], name, { type });
  assert.deepEqual(await inspectPdf(file, PDFDocument), { pageCount: 1 });
  assert.equal((await readPdfOcrSource(file)).byteLength, validBytes.byteLength);
  const merged = await mergePdfFiles({ files: [file, file], PDFDocument });
  assert.equal((await PDFDocument.load(await merged.blob.arrayBuffer())).getPageCount(), 2);
  const split = await splitPdfFile({ file, mode: "extract", selection: "1", PDFDocument });
  assert.equal((await PDFDocument.load(await split.blob.arrayBuffer())).getPageCount(), 1);
}

let loads = 0;
const parser = { create: PDFDocument.create.bind(PDFDocument), async load(...args) { loads += 1; return PDFDocument.load(...args); } };
const invalidFiles = [
  new File(["plain text"], "spoof.pdf"),
  new File(["<html>not a PDF</html>"], "spoof.bin", { type: "application/pdf" }),
  new File([], "empty.pdf", { type: "application/pdf" }),
  ...["%", "%P", "%PD", "%PDF"].map((prefix) => new File([prefix], "truncated.pdf", { type: "application/pdf" })),
  new File(["\uFEFF%PDF-1.7"], "bom.pdf", { type: "application/pdf" }),
  new File(["junk\n%PDF-1.7"], "preamble.pdf", { type: "application/pdf" }),
];
for (const file of invalidFiles) {
  await assert.rejects(loadPdfSource(file, parser), unreadable);
  await assert.rejects(mergePdfFiles({ files: [file], PDFDocument: parser }), unreadable);
  await assert.rejects(splitPdfFile({ file, mode: "extract", selection: "1", PDFDocument: parser }), unreadable);
  await assert.rejects(readOrganizerSource(file, parser), unreadable);
  await assert.rejects(readPdfMetadata(file, parser), unreadable);
  await assert.rejects(readPdfOcrSource(file), unreadable);
}
assert.equal(loads, 0, "spoofed or truncated input never enters the parser");

// Five complete header bytes are admission, not proof of a valid document.
for (const text of ["%PDF-", "%PDF-1.7\n1 0 obj\n<< /Type /Catalog"]) {
  const file = new File([text], "malformed.pdf", { type: "application/pdf" });
  await assert.rejects(loadPdfSource(file, parser), (error) => error.code === "UNREADABLE_PDF" && Boolean(error.cause));
}
assert.equal(loads, 2, "valid headers reach the deep parser, which rejects malformed structure");

// A spoofed file adapter must be rejected after a bounded read, without a full read.
let fullReads = 0;
const boundedFile = {
  name: "large.pdf", type: "application/pdf",
  slice(start, end) { assert.equal(start, 0); assert.equal(end, 5); return new Blob(["wrong"]); },
  async arrayBuffer() { fullReads += 1; throw new Error("must not read the whole spoofed file"); },
};
await assert.rejects(readPdfSourceBytes(boundedFile), unreadable);
assert.equal(fullReads, 0);
// Also validate the full returned buffer so a non-Blob adapter cannot swap bytes.
await assert.rejects(readPdfSourceBytes({ ...boundedFile, slice() { return new Blob(["%PDF-"]); }, async arrayBuffer() { return buffer("wrong"); } }), unreadable);

const offsetBytes = new Uint8Array(buffer("junk%PDF-1.7"));
assert.doesNotThrow(() => requirePdfSignature(offsetBytes.subarray(4)));
assert.doesNotThrow(() => requirePdfSignature(new DataView(offsetBytes.buffer, 4)));
assert.throws(() => requirePdfSignature(offsetBytes), unreadable);
assert.throws(() => requirePdfSignature(new ArrayBuffer(0)), unreadable);

// Exported cached-byte entry points cannot bypass admission.
const invalid = buffer("not a PDF");
loads = 0;
await assert.rejects(organizePdf({ sourceBytes: invalid, pages: [{ originalIndex: 0, removed: false, rotation: 0 }], PDFDocument: parser, degrees: PDFLib.degrees }), unreadable);
await assert.rejects(cleanPdfMetadata({ sourceBytes: invalid, selectedKeys: ["title"], PDFDocument: parser, PDFName: PDFLib.PDFName }), unreadable);
await assert.rejects(createSearchablePdf({ sourceBytes: invalid, pages: [], PDFLib: { PDFDocument: parser }, fontkit: {}, fontBytes: new ArrayBuffer(0) }), unreadable);
assert.equal(loads, 0);
let renderers = 0;
const service = createPdfOcrService({ rendererFactory() { renderers += 1; throw new Error("must not create renderer"); } });
await assert.rejects(service.recognizeDocument({ sourceBytes: invalid, language: "eng" }), unreadable);
assert.equal(renderers, 0);
await service.dispose();

globalThis.DOMMatrix ||= class DOMMatrix {};
globalThis.ImageData ||= class ImageData {};
globalThis.Path2D ||= class Path2D {};
// Match the existing searchable-PDF test's Node-only browser API shims.
Uint8Array.prototype.toHex ||= function toHex() { return Array.from(this, (value) => value.toString(16).padStart(2, "0")).join(""); };
Math.sumPrecise ||= (values) => Array.from(values).reduce((sum, value) => sum + value, 0);
const { LocalPdfRenderer } = await import("../tools/shared/pdf-renderer.js");
const validRenderer = new LocalPdfRenderer(validBytes.buffer.slice(validBytes.byteOffset, validBytes.byteOffset + validBytes.byteLength));
assert.equal(await validRenderer.load(), 1, "a real PDF also passes PDF.js admission");
await validRenderer.destroy();
const renderer = new LocalPdfRenderer(invalid);
await assert.rejects(renderer.load(), unreadable);
assert.equal(renderer.loadingTask, null, "PDF.js is never started for invalid signatures");
await renderer.destroy();

console.log("PDF signature admission passed: real merge/split, bounded reads, spoofed metadata, strict byte-zero headers, parser failure, and cached/OCR/renderer entry points.");

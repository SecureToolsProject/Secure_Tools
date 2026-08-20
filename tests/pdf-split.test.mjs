import assert from "node:assert/strict";
import { File } from "node:buffer";
import { createRequire } from "node:module";

import { createPageGroups, createSplitNames, parsePageSelection, splitPdfFile } from "../tools/pdf/split/pdf.js";

const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts } = require("../assets/vendor/pdf-lib/pdf-lib.min.js");
const JSZip = require("../assets/vendor/jszip/jszip.min.js");

async function makePdf(name, pageSizes, type = "application/pdf") {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  pageSizes.forEach(([width, height], index) => {
    const page = document.addPage([width, height]);
    page.drawText(`page-${index + 1}`, { x: 20, y: Math.max(20, height - 32), size: 12, font });
  });
  return new File([await document.save()], name, { type });
}

async function loadPdfBlob(blob) {
  assert.equal(blob.type, "application/pdf");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), "%PDF-");
  return PDFDocument.load(bytes);
}

async function loadZip(blob) {
  assert.equal(blob.type, "application/zip");
  return JSZip.loadAsync(await blob.arrayBuffer());
}

function testPageParser() {
  assert.deepEqual(parsePageSelection("1", 10), [0]);
  assert.deepEqual(parsePageSelection("1-3", 10), [0, 1, 2]);
  assert.deepEqual(parsePageSelection("1,3,5", 10), [0, 2, 4]);
  assert.deepEqual(parsePageSelection("1-3,5,8-10", 10), [0, 1, 2, 4, 7, 8, 9]);
  assert.deepEqual(parsePageSelection(" 1 - 3 , 5 ", 10), [0, 1, 2, 4]);
  assert.deepEqual(parsePageSelection("5,1,3", 5), [4, 0, 2]);
  assert.deepEqual(parsePageSelection("2,2,1-2", 5), [1, 1, 0, 1]);

  const rejects = [
    ["", "PAGE_RANGE_REQUIRED"], ["0", "PAGE_RANGE_INVALID"], ["-1", "PAGE_RANGE_INVALID"],
    ["5-2", "PAGE_RANGE_REVERSED"], ["6", "PAGE_OUT_OF_RANGE"], ["1-a", "PAGE_RANGE_INVALID"],
    ["1,,2", "PAGE_RANGE_INVALID"], ["1-2-3", "PAGE_RANGE_INVALID"],
  ];
  for (const [value, code] of rejects) {
    assert.throws(() => parsePageSelection(value, 5), (error) => error.code === code, `${value} should fail with ${code}`);
  }
}

function testGroupsAndNames() {
  assert.deepEqual(createPageGroups({ mode: "extract", selection: "4,1", pageCount: 5 }), [[3, 0]]);
  assert.deepEqual(createPageGroups({ mode: "every", pageCount: 3 }), [[0], [1], [2]]);
  assert.deepEqual(createPageGroups({ mode: "interval", interval: 3, pageCount: 10 }), [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]]);
  assert.throws(() => createPageGroups({ mode: "interval", interval: 0, pageCount: 5 }), (error) => error.code === "INTERVAL_INVALID");
  assert.throws(() => createPageGroups({ mode: "interval", interval: 1.5, pageCount: 5 }), (error) => error.code === "INTERVAL_INVALID");

  const groups = createPageGroups({ mode: "interval", interval: 3, pageCount: 10 });
  assert.deepEqual(createSplitNames({ mode: "interval", groups, baseName: " report:* ", sourceName: "source.pdf", pageCount: 10 }), {
    archive: "report__split.zip",
    entries: ["report__pages_001-003.pdf", "report__pages_004-006.pdf", "report__pages_007-009.pdf", "report__pages_010-010.pdf"],
  });
}

async function testPdfOutputs() {
  const onePage = await makePdf("one.pdf", [[300, 500]]);
  const one = await splitPdfFile({ file: onePage, mode: "extract", selection: "1", baseName: "one-out", PDFDocument, JSZip });
  assert.equal(one.kind, "pdf");
  assert.equal(one.filename, "one-out.pdf");
  assert.equal((await loadPdfBlob(one.blob)).getPageCount(), 1);

  const sizes = [[300, 500], [640, 360], [420, 420], [612, 792], [500, 700]];
  const source = await makePdf("mixed.pdf", sizes, "");
  const reordered = await splitPdfFile({ file: source, mode: "extract", selection: "5,1,3,1", baseName: "ordered", PDFDocument, JSZip });
  const reorderedPdf = await loadPdfBlob(reordered.blob);
  assert.deepEqual(reorderedPdf.getPages().map((page) => [page.getWidth(), page.getHeight()]), [sizes[4], sizes[0], sizes[2], sizes[0]]);

  const every = await splitPdfFile({ file: source, mode: "every", baseName: "mixed", PDFDocument, JSZip });
  assert.equal(every.kind, "zip");
  assert.equal(every.filename, "mixed_split.zip");
  const everyZip = await loadZip(every.blob);
  assert.deepEqual(Object.keys(everyZip.files).sort(), ["mixed_001.pdf", "mixed_002.pdf", "mixed_003.pdf", "mixed_004.pdf", "mixed_005.pdf"]);
  for (let index = 0; index < sizes.length; index += 1) {
    const bytes = await everyZip.file(`mixed_${String(index + 1).padStart(3, "0")}.pdf`).async("uint8array");
    const document = await PDFDocument.load(bytes);
    assert.equal(document.getPageCount(), 1);
    assert.deepEqual([document.getPage(0).getWidth(), document.getPage(0).getHeight()], sizes[index]);
  }

  const interval = await splitPdfFile({ file: source, mode: "interval", interval: 2, baseName: "grouped", PDFDocument, JSZip });
  const intervalZip = await loadZip(interval.blob);
  assert.deepEqual(Object.keys(intervalZip.files).sort(), ["grouped_pages_001-002.pdf", "grouped_pages_003-004.pdf", "grouped_pages_005-005.pdf"]);
  const intervalCounts = [];
  for (const name of Object.keys(intervalZip.files).sort()) {
    const document = await PDFDocument.load(await intervalZip.file(name).async("uint8array"));
    intervalCounts.push(document.getPageCount());
  }
  assert.deepEqual(intervalCounts, [2, 2, 1]);

  const repeatOne = await splitPdfFile({ file: source, mode: "extract", selection: "2-4", baseName: "repeat", PDFDocument, JSZip });
  const repeatTwo = await splitPdfFile({ file: source, mode: "extract", selection: "2-4", baseName: "repeat", PDFDocument, JSZip });
  assert.equal((await loadPdfBlob(repeatOne.blob)).getPageCount(), 3);
  assert.equal((await loadPdfBlob(repeatTwo.blob)).getPageCount(), 3);
}

async function testFailures() {
  const valid = await makePdf("valid.pdf", [[300, 500]]);
  await assert.rejects(
    splitPdfFile({ file: new File(["text"], "note.txt", { type: "text/plain" }), mode: "extract", selection: "1", PDFDocument, JSZip }),
    (error) => error.code === "UNSUPPORTED_PDF",
  );
  await assert.rejects(
    splitPdfFile({ file: new File(["broken"], "broken.pdf", { type: "application/pdf" }), mode: "extract", selection: "1", PDFDocument, JSZip }),
    (error) => error.code === "UNREADABLE_PDF",
  );
  const encryptedLibrary = {
    create: () => PDFDocument.create(),
    load: async () => { throw new Error("Encrypted PDF; password required"); },
  };
  await assert.rejects(
    splitPdfFile({ file: valid, mode: "extract", selection: "1", PDFDocument: encryptedLibrary, JSZip }),
    (error) => error.code === "ENCRYPTED_PDF",
  );
  await assert.rejects(
    splitPdfFile({ file: valid, mode: "every", PDFDocument, JSZip: null }),
    (error) => error.code === "ARCHIVE_LIBRARY_UNAVAILABLE",
  );
}

testPageParser();
testGroupsAndNames();
await testPdfOutputs();
await testFailures();

console.log("PDF Split parser, PDF, ZIP, naming, and failure checks passed.");

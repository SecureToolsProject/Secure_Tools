import assert from "node:assert/strict";
import { File } from "node:buffer";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { en } from "../js/locales/en.js";
import { ko } from "../js/locales/ko.js";
import { formatBytes, moveArrayItem, sanitizePdfFilename } from "../tools/shared/file.js";
import { inspectPdf, isSupportedPdf, mergePdfFiles } from "../tools/pdf/merge/pdf.js";

const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts } = require("../assets/vendor/pdf-lib/pdf-lib.min.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function makePdf(name, pageSizes, type = "application/pdf") {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  pageSizes.forEach(([width, height], index) => {
    const page = document.addPage([width, height]);
    page.drawText(`${name}:${index + 1}`, { x: 24, y: Math.max(24, height - 36), size: 12, font });
  });
  return new File([await document.save()], name, { type });
}

async function loadBlob(blob) {
  assert.equal(blob.type, "application/pdf");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), "%PDF-");
  return PDFDocument.load(bytes);
}

function testInputValidation() {
  assert.equal(isSupportedPdf(new File(["x"], "document.bin", { type: "application/pdf" })), true);
  assert.equal(isSupportedPdf(new File(["x"], "document.pdf", { type: "" })), true);
  assert.equal(isSupportedPdf(new File(["x"], "DOCUMENT.PDF", { type: "" })), true);
  assert.equal(isSupportedPdf(new File(["x"], "document.pdf", { type: "text/plain" })), false);
  assert.equal(isSupportedPdf(new File(["x"], "document.txt", { type: "" })), false);
  assert.equal(isSupportedPdf(null), false);
}

function testSharedUtilities() {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(sanitizePdfFilename(" quarterly/report:* ", "merged-document"), "quarterly_report_.pdf");
  assert.equal(sanitizePdfFilename("ready.PDF", "merged-document"), "ready.PDF");
  assert.equal(sanitizePdfFilename("  ", "merged-document"), "merged-document.pdf");

  const queue = ["first", "second", "third"];
  assert.equal(moveArrayItem(queue, 2, -1), 1);
  assert.deepEqual(queue, ["first", "third", "second"]);
  assert.equal(moveArrayItem(queue, 0, -1), -1);
  queue.splice(1, 1);
  assert.deepEqual(queue, ["first", "second"]);
}

async function testInspectionAndFailures() {
  const valid = await makePdf("valid.pdf", [[300, 400], [500, 200]]);
  assert.deepEqual(await inspectPdf(valid, PDFDocument), { pageCount: 2 });
  await assert.rejects(mergePdfFiles({ files: [], PDFDocument }), (error) => error.code === "NO_FILES");
  await assert.rejects(
    mergePdfFiles({ files: [new File(["hello"], "note.txt", { type: "text/plain" })], PDFDocument }),
    (error) => error.code === "UNSUPPORTED_PDF" && error.fileName === "note.txt",
  );
  await assert.rejects(
    inspectPdf(new File(["not a pdf"], "broken.pdf", { type: "application/pdf" }), PDFDocument),
    (error) => error.code === "UNREADABLE_PDF" && error.fileName === "broken.pdf",
  );
  const encryptedLibrary = {
    create: () => PDFDocument.create(),
    load: async () => { const error = new Error("Input document is encrypted; password required"); error.name = "EncryptedPDFError"; throw error; },
  };
  await assert.rejects(
    inspectPdf(valid, encryptedLibrary),
    (error) => error.code === "ENCRYPTED_PDF" && error.fileName === "valid.pdf",
  );
  await assert.rejects(inspectPdf(valid, null), (error) => error.code === "PDF_LIBRARY_UNAVAILABLE");
}

async function testMergeBehavior() {
  const portrait = await makePdf("portrait.pdf", [[300, 500]]);
  const mixed = await makePdf("mixed.pdf", [[640, 360], [420, 420]], "");

  const single = await mergePdfFiles({ files: [portrait], PDFDocument });
  assert.equal(single.pageCount, 1);
  assert.equal((await loadBlob(single.blob)).getPageCount(), 1);

  const progress = [];
  const duplicateMerge = await mergePdfFiles({
    files: [portrait, mixed, portrait], PDFDocument,
    onProgress: (...values) => progress.push(values),
  });
  assert.equal(duplicateMerge.pageCount, 4);
  const duplicateOutput = await loadBlob(duplicateMerge.blob);
  assert.deepEqual(
    duplicateOutput.getPages().map((page) => [page.getWidth(), page.getHeight()]),
    [[300, 500], [640, 360], [420, 420], [300, 500]],
  );
  assert.deepEqual(progress, [[1, 3, 1], [2, 3, 3], [3, 3, 4]]);

  const repeated = await mergePdfFiles({ files: [mixed, portrait], PDFDocument });
  const repeatedAgain = await mergePdfFiles({ files: [mixed, portrait], PDFDocument });
  assert.equal((await loadBlob(repeated.blob)).getPageCount(), 3);
  assert.equal((await loadBlob(repeatedAgain.blob)).getPageCount(), 3);

  const largerFiles = [];
  for (let fileIndex = 0; fileIndex < 6; fileIndex += 1) {
    largerFiles.push(await makePdf(`batch-${fileIndex}.pdf`, Array.from({ length: 8 }, (_, pageIndex) => [400 + pageIndex, 600 + fileIndex])));
  }
  const larger = await mergePdfFiles({ files: largerFiles, PDFDocument });
  assert.equal(larger.pageCount, 48);
  assert.equal((await loadBlob(larger.blob)).getPageCount(), 48);
}

function listFiles(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target, predicate);
    return predicate(target) ? [target] : [];
  });
}

function lookup(dictionary, key) {
  return key.split(".").reduce((value, part) => value?.[part], dictionary);
}

function testRoutesTranslationsAndPrivacy() {
  const routeFiles = [
    "index.html", "privacy/index.html", "about/index.html", "404.html", "tools/image-to-pdf/index.html",
    "tools/pdf/index.html", "tools/pdf/images-to-pdf/index.html", "tools/pdf/merge/index.html", "tools/pdf/split/index.html",
    "tools/image/index.html", "tools/privacy/index.html", "tools/scan/index.html", "tools/media/index.html",
  ];
  for (const relative of routeFiles) assert.equal(fs.existsSync(path.join(root, relative)), true, `Missing route: ${relative}`);

  const migration = fs.readFileSync(path.join(root, "tools/image-to-pdf/index.html"), "utf8");
  assert.match(migration, /http-equiv="refresh" content="0; url=\.\.\/pdf\/images-to-pdf\/"/i);
  assert.match(migration, /<a[^>]+href="\.\.\/pdf\/images-to-pdf\/"/i);
  assert.doesNotMatch(migration, /<script[^>]+src=/i);

  for (const relative of routeFiles) {
    const file = path.join(root, relative);
    const html = fs.readFileSync(file, "utf8");
    for (const [, key] of html.matchAll(/data-i18n(?:-aria-label|-title)?="([^"]+)"/g)) {
      for (const [language, dictionary] of [["en", en], ["ko", ko]]) {
        assert.notEqual(lookup(dictionary, key), undefined, `${relative} missing ${language} translation: ${key}`);
      }
    }
    const page = html.match(/<body[^>]*data-page="([^"]+)"/)?.[1];
    if (page) {
      for (const [language, dictionary] of [["en", en], ["ko", ko]]) {
        assert.equal(typeof lookup(dictionary, `metadata.${page}.title`), "string", `${relative} missing ${language} metadata`);
      }
    }
    for (const [, attribute, rawReference] of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|#)/i.test(rawReference)) continue;
      const reference = rawReference.split(/[?#]/)[0];
      if (!reference) continue;
      let target = path.resolve(path.dirname(file), reference);
      if (reference.endsWith("/") || (fs.existsSync(target) && fs.statSync(target).isDirectory())) target = path.join(target, "index.html");
      assert.equal(fs.existsSync(target), true, `${relative} has missing ${attribute}: ${rawReference}`);
    }
    for (const [, source] of html.matchAll(/<script[^>]+src="([^"]+)"/gi)) assert.doesNotMatch(source, /^https?:/i, `${relative} loads an external script`);
    for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
      if (!/rel="stylesheet"/i.test(tag[0])) continue;
      const source = tag[0].match(/href="([^"]+)"/i)?.[1] || "";
      assert.doesNotMatch(source, /^https?:/i, `${relative} loads an external stylesheet`);
    }
  }

  const firstPartyScripts = [
    ...listFiles(path.join(root, "js"), (file) => file.endsWith(".js")),
    ...listFiles(path.join(root, "tools"), (file) => file.endsWith(".js")),
  ];
  const networkApi = /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\.sendBeacon\s*\(/;
  for (const file of firstPartyScripts) assert.doesNotMatch(fs.readFileSync(file, "utf8"), networkApi, `Network API found in ${path.relative(root, file)}`);
  const mergeHtml = fs.readFileSync(path.join(root, "tools/pdf/merge/index.html"), "utf8");
  assert.match(mergeHtml, /assets\/vendor\/pdf-lib\/pdf-lib\.min\.js/);
  const splitHtml = fs.readFileSync(path.join(root, "tools/pdf/split/index.html"), "utf8");
  assert.match(splitHtml, /assets\/vendor\/pdf-lib\/pdf-lib\.min\.js/);
  assert.match(splitHtml, /assets\/vendor\/jszip\/jszip\.min\.js/);
}

testInputValidation();
testSharedUtilities();
await testInspectionAndFailures();
await testMergeBehavior();
testRoutesTranslationsAndPrivacy();

console.log("PDF Merge, category route, i18n, resource, and privacy checks passed.");

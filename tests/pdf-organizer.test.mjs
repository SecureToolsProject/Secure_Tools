import assert from "node:assert/strict";
import { File } from "node:buffer";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPageState, isDirty, movePage, normalizeRotation, removePage, resetPages, rotatePage, visiblePages } from "../tools/pdf/organize/model.js";
import { organizePdf, organizerFilename, readOrganizerSource } from "../tools/pdf/organize/pdf.js";

const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts, degrees } = require("../assets/vendor/pdf-lib/pdf-lib.min.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

async function makePdf(name, specs) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  specs.forEach(({ size, rotation = 0 }, index) => {
    const page = document.addPage(size);
    page.setRotation(degrees(rotation));
    page.drawText(`organizer-page-${index + 1}`, { x: 20, y: size[1] - 30, size: 12, font });
  });
  return new File([await document.save()], name, { type: "application/pdf" });
}

async function load(blob) { return PDFDocument.load(new Uint8Array(await blob.arrayBuffer())); }

function testPageModel() {
  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(450), 90);
  let pages = createPageState(4, [0, 90, 180, 270]);
  assert.deepEqual(pages.map((page) => page.originalIndex), [0, 1, 2, 3]);
  assert.equal(isDirty(pages), false);
  assert.equal(movePage(pages, 2, -1), 1);
  assert.deepEqual(visiblePages(pages).map((page) => page.originalIndex), [0, 2, 1, 3]);
  movePage(pages, 2, -1);
  assert.deepEqual(visiblePages(pages).map((page) => page.originalIndex), [2, 0, 1, 3]);
  rotatePage(pages, 0, -90);
  assert.equal(pages.find((page) => page.originalIndex === 0).rotation, 270);
  removePage(pages, 1);
  assert.deepEqual(visiblePages(pages).map((page) => page.originalIndex), [2, 0, 3]);
  assert.equal(isDirty(pages), true);
  pages = resetPages(pages);
  assert.deepEqual(pages.map(({ originalIndex, rotation, removed }) => [originalIndex, rotation, removed]), [[0, 0, false], [1, 90, false], [2, 180, false], [3, 270, false]]);
  assert.equal(isDirty(pages), false);
}

async function testExport() {
  const sourceFile = await makePdf("mixed.pdf", [
    { size: [300, 500] }, { size: [612, 792], rotation: 90 }, { size: [800, 400], rotation: 180 },
  ]);
  const source = await readOrganizerSource(sourceFile, PDFDocument);
  assert.equal(source.pageCount, 3);
  assert.deepEqual(source.rotations, [0, 90, 180]);
  const unchanged = await load(await organizePdf({ sourceBytes: source.bytes, pages: createPageState(3, source.rotations), PDFDocument, degrees }));
  assert.equal(unchanged.getPageCount(), 3);
  assert.deepEqual(unchanged.getPages().map((page) => page.getRotation().angle), [0, 90, 180]);

  const pages = createPageState(3, source.rotations);
  movePage(pages, 2, -1); movePage(pages, 2, -1);
  rotatePage(pages, 0, 90);
  removePage(pages, 1);
  const first = await load(await organizePdf({ sourceBytes: source.bytes, pages, PDFDocument, degrees }));
  const second = await load(await organizePdf({ sourceBytes: source.bytes, pages, PDFDocument, degrees }));
  assert.equal(first.getPageCount(), 2);
  assert.equal(second.getPageCount(), 2);
  assert.deepEqual(first.getPages().map((page) => page.getSize()), [{ width: 800, height: 400 }, { width: 300, height: 500 }]);
  assert.deepEqual(first.getPages().map((page) => page.getRotation().angle), [180, 90]);

  const one = await makePdf("one.pdf", [{ size: [200, 300] }]);
  const oneSource = await readOrganizerSource(one, PDFDocument);
  assert.equal((await load(await organizePdf({ sourceBytes: oneSource.bytes, pages: createPageState(1), PDFDocument, degrees }))).getPageCount(), 1);
  await assert.rejects(organizePdf({ sourceBytes: oneSource.bytes, pages: [{ ...createPageState(1)[0], removed: true }], PDFDocument, degrees }), (error) => error.code === "NO_PAGES_REMAIN");
  assert.equal(organizerFilename("report.pdf"), "report_organized.pdf");
  assert.equal(organizerFilename("report.pdf", "custom/name"), "custom_name.pdf");
}

function testArchitectureAndUi() {
  const html = read("tools/pdf/organize/index.html");
  const app = read("tools/pdf/organize/app.js");
  const model = read("tools/pdf/organize/model.js");
  const pdf = read("tools/pdf/organize/pdf.js");
  const renderer = read("tools/pdf/organize/renderer.js");
  const css = read("tools/pdf/organize/tool.css");
  const vendor = JSON.parse(read("assets/vendor/pdfjs/package.json"));
  assert.equal(vendor.version, "6.2.108");
  assert.match(renderer, /assets\/vendor\/pdfjs\/pdf\.min\.mjs/);
  assert.match(renderer, /assets\/vendor\/pdfjs\/pdf\.worker\.min\.mjs/);
  assert.match(renderer, /useWorkerFetch:\s*false/);
  assert.match(renderer, /useWasm:\s*false/);
  assert.match(renderer, /RENDER_CONCURRENCY\s*=\s*2/);
  assert.doesNotMatch(renderer, /https?:|unpkg|jsdelivr|cdnjs/i);
  assert.match(pdf, /copyPages\(/);
  assert.match(pdf, /setRotation\(/);
  assert.doesNotMatch(pdf, /canvas|addImage|toDataURL/);
  assert.match(model, /originalIndex[\s\S]*originalRotation[\s\S]*rotation[\s\S]*removed/);
  assert.match(html, /<label class="drop-zone__picker" for="file-input">/);
  assert.match(html, /id="source-empty"/);
  assert.match(css, /\.source-empty\[hidden\][^{]*\{[^}]*display:\s*none/);
  assert.match(app, /actionButton\("earlier"/);
  assert.match(app, /actionButton\("later"/);
  assert.match(app, /button\.setAttribute\("aria-label"/);
  assert.match(app, /securetools:languagechange/);
  assert.match(app, /renderer\.destroy\(\)/);
  assert.match(app, /canvas\.width = 1/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(read("tools/pdf/index.html"), /href="\.\/organize\/"/);
}

testPageModel();
await testExport();
testArchitectureAndUi();
console.log("PDF Organizer state, export, rendering architecture, and UI checks passed.");

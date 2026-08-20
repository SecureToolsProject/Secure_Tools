import assert from "node:assert/strict";
import { File } from "node:buffer";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  clearMetadataSelection, extractMetadata, MAX_METADATA_DISPLAY_LENGTH,
  selectedMetadataKeys, selectAllPresentMetadata, setMetadataSelected, SUPPORTED_METADATA_FIELDS,
} from "../tools/pdf/metadata/model.js";
import { cleanPdfMetadata, metadataFilename, readPdfMetadata } from "../tools/pdf/metadata/pdf.js";

const require = createRequire(import.meta.url);
const { PDFDocument, PDFName, StandardFonts, degrees } = require("../assets/vendor/pdf-lib/pdf-lib.min.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const ALL_KEYS = SUPPORTED_METADATA_FIELDS.map(({ key }) => key);

function deleteInfoFields(document, keys = ALL_KEYS) {
  const definitions = new Map(SUPPORTED_METADATA_FIELDS.map((field) => [field.key, field]));
  const info = document.context.lookup(document.context.trailerInfo.Info);
  keys.forEach((key) => info.delete(PDFName.of(definitions.get(key).pdfName)));
}

async function fixture(name, metadata = {}) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([320, 480]);
  first.drawText("selectable vector metadata fixture", { x: 24, y: 430, size: 12, font });
  first.setRotation(degrees(90));
  const second = document.addPage([612, 792]);
  second.drawText("second page", { x: 24, y: 740, size: 12, font });
  const setters = {
    title: (value) => document.setTitle(value), author: (value) => document.setAuthor(value),
    subject: (value) => document.setSubject(value), keywords: (value) => document.setKeywords(value),
    creator: (value) => document.setCreator(value), producer: (value) => document.setProducer(value),
    creationDate: (value) => document.setCreationDate(value), modificationDate: (value) => document.setModificationDate(value),
  };
  for (const [key, value] of Object.entries(metadata)) setters[key](value);
  deleteInfoFields(document, ALL_KEYS.filter((key) => !(key in metadata)));
  return new File([await document.save()], name, { type: "application/pdf" });
}

async function inspectOutput(bytes) {
  return extractMetadata(await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false }));
}

function fieldMap(fields) { return new Map(fields.map((field) => [field.key, field])); }

async function testExtractionAndModel() {
  const allValues = {
    title: "프로젝트 노트 📄\nInternal", author: "Zoë 김", subject: "Line one\nLine two",
    keywords: ["내부", "draft", "🔒"], creator: "Writer Ω", producer: "PDF Engine β",
    creationDate: new Date("2024-01-02T03:04:05.000Z"), modificationDate: new Date("2025-06-07T08:09:10.000Z"),
  };
  const source = await readPdfMetadata(await fixture("all.pdf", allValues), PDFDocument);
  assert.equal(source.fields.filter(({ present }) => present).length, 8);
  const fields = fieldMap(source.fields);
  assert.equal(fields.get("title").rawValue, allValues.title);
  assert.equal(fields.get("author").rawValue, allValues.author);
  assert.match(fields.get("keywords").rawValue, /내부/);
  assert.equal(fields.get("creationDate").rawValue.toISOString(), "2024-01-02T03:04:05.000Z");
  assert.equal(fields.get("modificationDate").rawValue.toISOString(), "2025-06-07T08:09:10.000Z");
  assert.deepEqual(source.pages, [{ width: 320, height: 480, rotation: 90 }, { width: 612, height: 792, rotation: 0 }]);

  const partial = (await readPdfMetadata(await fixture("partial.pdf", { title: "Only title", author: "" }), PDFDocument)).fields;
  assert.equal(fieldMap(partial).get("title").present, true);
  assert.equal(fieldMap(partial).get("author").present, false);
  assert.equal((await readPdfMetadata(await fixture("none.pdf"), PDFDocument)).fields.some(({ present }) => present), false);

  let selected = setMetadataSelected(partial, "title", true);
  assert.deepEqual(selectedMetadataKeys(selected), ["title"]);
  selected = selectAllPresentMetadata(partial);
  assert.deepEqual(selectedMetadataKeys(selected), ["title"]);
  assert.deepEqual(selectedMetadataKeys(clearMetadataSelection(selected)), []);
  assert.equal(setMetadataSelected(partial, "not-supported", true), partial);
}

async function testSelectiveAndRepeatedCleaning() {
  const source = await readPdfMetadata(await fixture("report.pdf", {
    title: "Quarterly", author: "A. Person", subject: "Private", keywords: ["draft", "internal"],
    creator: "Office App", producer: "Office PDF", creationDate: new Date("2023-02-03T04:05:06Z"), modificationDate: new Date("2024-03-04T05:06:07Z"),
  }), PDFDocument);
  const one = await cleanPdfMetadata({ sourceBytes: source.bytes, selectedKeys: ["author"], PDFDocument, PDFName });
  assert.deepEqual(one.cleared, ["author"]);
  assert.deepEqual(one.retained, []);
  let values = fieldMap(await inspectOutput(one.bytes));
  assert.equal(values.get("author").present, false);
  assert.equal(values.get("title").rawValue, "Quarterly");
  assert.equal(values.get("producer").rawValue, "Office PDF");
  assert.deepEqual(one.pages, source.pages);

  const several = await cleanPdfMetadata({ sourceBytes: one.bytes, selectedKeys: ["title", "creator", "modificationDate"], PDFDocument, PDFName });
  assert.deepEqual(several.cleared, ["title", "creator", "modificationDate"]);
  values = fieldMap(await inspectOutput(several.bytes));
  assert.equal(values.get("subject").rawValue, "Private");
  assert.equal(values.get("creator").present, false);
  assert.equal(values.get("modificationDate").present, false);

  const remaining = several.after.filter(({ present }) => present).map(({ key }) => key);
  const all = await cleanPdfMetadata({ sourceBytes: several.bytes, selectedKeys: remaining, PDFDocument, PDFName });
  assert.equal(all.after.some(({ present }) => present), false);
  assert.equal(all.retained.length, 0);
  assert.deepEqual(all.pages, source.pages);
  for (const key of ["creator", "producer", "creationDate", "modificationDate"]) assert.equal(fieldMap(await inspectOutput(all.bytes)).get(key).present, false, `${key} was reintroduced`);
  await assert.rejects(cleanPdfMetadata({ sourceBytes: source.bytes, selectedKeys: [], PDFDocument, PDFName }), (error) => error.code === "NO_METADATA_SELECTED");
  await assert.rejects(cleanPdfMetadata({ sourceBytes: source.bytes, selectedKeys: ["xmp"], PDFDocument, PDFName }), (error) => error.code === "UNSUPPORTED_METADATA_FIELD");
}

async function testFailuresAndNames() {
  await assert.rejects(readPdfMetadata(new File(["not pdf"], "broken.pdf", { type: "application/pdf" }), PDFDocument), (error) => error.code === "UNREADABLE_PDF");
  await assert.rejects(readPdfMetadata(new File(["text"], "notes.txt", { type: "text/plain" }), PDFDocument), (error) => error.code === "UNSUPPORTED_PDF");
  const encryptedLibrary = { create: PDFDocument.create, load: async () => { throw new Error("password encrypted"); } };
  await assert.rejects(readPdfMetadata(new File(["%PDF"], "locked.pdf", { type: "application/pdf" }), encryptedLibrary), (error) => error.code === "ENCRYPTED_PDF");
  assert.equal(metadataFilename("report.pdf"), "report_clean.pdf");
  assert.equal(metadataFilename("report.PDF"), "report_clean.pdf");
  assert.equal(metadataFilename("report.pdf", "client/private"), "client_private.pdf");
}

function testUntrustedAndLongMetadata() {
  const attacks = ["<img src=x onerror=alert(1)>", "<script>alert(1)</script>", "\"><svg onload=alert(1)>"];
  const fields = extractMetadata({
    getTitle: () => attacks[0], getAuthor: () => attacks[1], getSubject: () => attacks[2], getKeywords: () => "a\0b",
    getCreator: () => "x".repeat(MAX_METADATA_DISPLAY_LENGTH + 100), getProducer: () => null,
    getCreationDate: () => undefined, getModificationDate: () => new Date("invalid"),
  });
  assert.deepEqual(fields.slice(0, 3).map(({ rawValue }) => rawValue), attacks);
  assert.equal(fields[3].display.value, "a�b");
  assert.equal(fields[3].rawValue, "a\0b");
  assert.equal(fields[4].display.truncated, true);
  assert.equal(fields[4].display.value.length, MAX_METADATA_DISPLAY_LENGTH + 1);
  assert.equal(fields[4].rawValue.length, MAX_METADATA_DISPLAY_LENGTH + 100);
  const app = read("tools/pdf/metadata/app.js");
  assert.match(app, /text\.textContent = displayValue\(field\)/);
  assert.match(app, /value\.textContent = displayValue\(field\)/);
  assert.doesNotMatch(app, /innerHTML|insertAdjacentHTML|outerHTML/);
}

function testUiArchitectureAndScope() {
  const html = read("tools/pdf/metadata/index.html");
  const app = read("tools/pdf/metadata/app.js");
  const pdf = read("tools/pdf/metadata/pdf.js");
  const css = read("tools/pdf/metadata/tool.css");
  const vendor = JSON.parse(read("assets/vendor/pdf-lib/package.json"));
  assert.equal(vendor.version, "1.17.1");
  assert.match(html, /<label class="drop-zone__picker" for="file-input">/);
  assert.match(html, /<table class="metadata-table">/);
  assert.match(html, /id="select-all"/);
  assert.match(html, /id="clear-selection"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /XMP packets/);
  assert.match(html, /connect-src 'none'/);
  assert.match(app, /Intl\.DateTimeFormat/);
  assert.match(app, /securetools:languagechange/);
  assert.match(app, /state\.source\.bytes = result\.bytes/);
  assert.match(app, /requestPdfSaveHandle/);
  assert.match(app, /downloadBlob/);
  assert.match(pdf, /updateMetadata: false/);
  assert.match(pdf, /PDFDocument\.load\(bytes/);
  assert.match(pdf, /samePages\(beforePages, afterPages\)/);
  assert.doesNotMatch(pdf, /copyPages|canvas|addImage|toDataURL/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.metadata-comparison\[hidden\]/);
  assert.match(html, /id="remove-all"[^>]*data-i18n="pdfMetadata\.actions\.removeAll"/);
  assert.match(css, /grid-template-columns:\s*2\.5rem minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /\.metadata-table\s*\{\s*min-width/);
  assert.match(read("tools/pdf/index.html"), /href="\.\/metadata\/"/);
}

await testExtractionAndModel();
await testSelectiveAndRepeatedCleaning();
await testFailuresAndNames();
testUntrustedAndLongMetadata();
testUiArchitectureAndScope();
console.log("PDF metadata inspection, verified cleaning, safety, preservation, and UI checks passed.");

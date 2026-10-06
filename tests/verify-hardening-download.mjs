import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
const [file, count, ...phrases] = process.argv.slice(2);
assert.ok(file && count && phrases.length, "usage: node tests/verify-hardening-download.mjs FILE PAGE_COUNT PHRASE...");
const bytes = fs.readFileSync(file); assert.ok(bytes.length > 0);
new Function(fs.readFileSync(new URL("../assets/vendor/pdf-lib/pdf-lib.min.js", import.meta.url), "utf8"))();
const reloaded = await globalThis.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
assert.equal(reloaded.getPageCount(), Number(count));
globalThis.DOMMatrix ||= class DOMMatrix {};
globalThis.ImageData ||= class ImageData {};
globalThis.Path2D ||= class Path2D {};
Uint8Array.prototype.toHex ||= function() { return Array.from(this, value => value.toString(16).padStart(2,"0")).join(""); };
Math.sumPrecise ||= values => Array.from(values).reduce((sum,value)=>sum+value,0);
const pdfjs = await import("../assets/vendor/pdfjs/pdf.min.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = new URL("../assets/vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useWorkerFetch: false, useWasm: false });
const parsed = await task.promise; assert.equal(parsed.numPages, Number(count));
const extracted = [];
for(let page=1;page<=parsed.numPages;page++) {
  const text = (await (await parsed.getPage(page)).getTextContent()).items.map(item=>item.str).join(" ").trim();
  for(const phrase of phrases) assert.ok(text.includes(phrase), `page ${page} includes exact ${phrase}`);
  extracted.push(text);
}
await task.destroy();
console.log(JSON.stringify({ bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), pages: Number(count), pdfLibReload: true, pdfJsParse: true, extracted }));

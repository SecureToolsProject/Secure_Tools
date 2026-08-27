import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARCHIVE_FILENAME,
  calculateResizeDimensions,
  createResizePlan,
  MAX_OUTPUT_JOB_PIXELS,
  normalizeOutputFormat,
  normalizeResizeMode,
  resizeImages,
  resolveOutputFormats,
} from "../tools/image/resize/resize.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

assert.equal(normalizeResizeMode("pixels"), "pixels");
assert.equal(normalizeResizeMode("percentage"), "percentage");
assert.throws(() => normalizeResizeMode("crop"), (error) => error.code === "RESIZE_MODE_INVALID");
assert.equal(normalizeOutputFormat("ORIGINAL"), "original");
assert.throws(() => normalizeOutputFormat("gif"), (error) => error.code === "IMAGE_FORMAT_INVALID");

assert.deepEqual(calculateResizeDimensions({ sourceWidth: 1920, sourceHeight: 1080, mode: "percentage", percentage: 50 }), { width: 960, height: 540 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 1, sourceHeight: 1, mode: "percentage", percentage: 1 }), { width: 1, height: 1 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 1920, sourceHeight: 1080, mode: "pixels", width: 1280, height: "", lockAspectRatio: true }), { width: 1280, height: 720 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 800, sourceHeight: 1200, mode: "pixels", width: "", height: 600, lockAspectRatio: true }), { width: 400, height: 600 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 2000, sourceHeight: 1000, mode: "pixels", width: 1000, height: 1000, lockAspectRatio: true }), { width: 1000, height: 500 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 800, sourceHeight: 1200, mode: "pixels", width: 1000, height: 1000, lockAspectRatio: true }), { width: 667, height: 1000 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 800, sourceHeight: 600, mode: "pixels", width: 400, height: 200, lockAspectRatio: false }), { width: 400, height: 200 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 800, sourceHeight: 600, mode: "pixels", width: 1600, height: 1200, lockAspectRatio: true, allowEnlargement: false }), { width: 800, height: 600 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 800, sourceHeight: 600, mode: "pixels", width: 1600, height: 1200, lockAspectRatio: true, allowEnlargement: true }), { width: 1600, height: 1200 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 800, sourceHeight: 600, mode: "percentage", percentage: 150, allowEnlargement: false }), { width: 800, height: 600 });
assert.deepEqual(calculateResizeDimensions({ sourceWidth: 800, sourceHeight: 600, mode: "percentage", percentage: 150, allowEnlargement: true }), { width: 1200, height: 900 });
for (const settings of [
  { mode: "pixels", width: "", height: "", lockAspectRatio: true },
  { mode: "pixels", width: 0, height: 20, lockAspectRatio: false },
]) assert.throws(() => calculateResizeDimensions({ sourceWidth: 100, sourceHeight: 100, ...settings }), (error) => /^RESIZE_DIMENSION_/.test(error.code));
assert.throws(() => calculateResizeDimensions({ sourceWidth: 100, sourceHeight: 100, mode: "percentage", percentage: 0 }), (error) => error.code === "RESIZE_PERCENTAGE_INVALID");
assert.throws(() => calculateResizeDimensions({ sourceWidth: 100, sourceHeight: 100, mode: "percentage", percentage: 1001, allowEnlargement: true }), (error) => error.code === "RESIZE_PERCENTAGE_INVALID");
assert.throws(() => calculateResizeDimensions({ sourceWidth: 100, sourceHeight: 100, mode: "pixels", width: 16385, lockAspectRatio: true, allowEnlargement: true }), (error) => error.code === "IMAGE_DIMENSION_EXCEEDED");

assert.deepEqual(resolveOutputFormats("original", ["jpeg", "png", "webp"]), ["jpeg", "png", "webp"]);
assert.deepEqual(resolveOutputFormats("png", ["jpeg", "webp"]), ["png", "png"]);
const plan = createResizePlan({ files: [{ name: "photo.jpg" }, { name: "photo.png" }, { name: "한글 사진.webp" }], sourceFormats: ["jpeg", "png", "webp"], outputFormat: "original", quality: 0.8, settings: { mode: "percentage", percentage: 50 } });
assert.deepEqual(plan.names, { archive: ARCHIVE_FILENAME, entries: ["photo_resized.jpg", "photo_resized.png", "한글 사진_resized.webp"] });
const collisions = createResizePlan({ files: [{ name: "photo.png" }, { name: "photo.jpg" }], sourceFormats: ["png", "png"], outputFormat: "png", quality: 1, settings: { mode: "percentage", percentage: 50 } });
assert.deepEqual(collisions.names.entries, ["photo_resized.png", "photo_resized_2.png"]);
assert.ok(new TextEncoder().encode(plan.names.entries[2]).length <= 196, "Unicode output remains bounded after suffix and extension");

function canvasHarness() {
  const events = [];
  const context = { set fillStyle(value) { events.push(["fillStyle", value]); }, fillRect(...args) { events.push(["fillRect", ...args]); }, drawImage(...args) { events.push(["drawImage", ...args]); } };
  const canvas = { width: 0, height: 0, getContext(type, options) { events.push(["context", type, options]); return context; }, toBlob(callback, type, quality) { events.push(["encode", type, quality]); callback(new Blob([type], { type })); } };
  return { canvas, events };
}
class TestZip { constructor() { this.entries = []; TestZip.instance = this; } file(name, bytes) { this.entries.push([name, bytes.length]); } async generateAsync(options) { this.options = options; return new Blob(["zip"], { type: "application/zip" }); } }

let closed = 0;
const canvases = [];
const batch = await resizeImages({
  files: [{ name: "wide.png" }, { name: "tall.jpg" }], outputFormat: "jpeg", quality: 0.75,
  settings: { mode: "percentage", percentage: 50, allowEnlargement: false }, JSZip: TestZip,
  identify: async (file) => file.name.endsWith(".jpg") ? "jpeg" : "png",
  decode: async (file) => ({ source: file, width: file.name.startsWith("wide") ? 2000 : 800, height: file.name.startsWith("wide") ? 1000 : 1200, close() { closed += 1; } }),
  canvasFactory: () => { const harness = canvasHarness(); canvases.push(harness); return harness.canvas; },
});
assert.equal(batch.kind, "zip");
assert.deepEqual(batch.results, [{ original: { width: 2000, height: 1000 }, output: { width: 1000, height: 500 } }, { original: { width: 800, height: 1200 }, output: { width: 400, height: 600 } }]);
assert.equal(closed, 2);
assert.ok(canvases.every(({ events }) => events.some((event) => event[0] === "fillRect" && event[1] === 0)), "JPEG must flatten alpha onto white");
assert.deepEqual(canvases[0].events.find((event) => event[0] === "drawImage").slice(-2), [1000, 500]);
assert.deepEqual(TestZip.instance.entries.map(([name]) => name), ["wide_resized.jpg", "tall_resized.jpg"]);
assert.deepEqual(TestZip.instance.options, { type: "blob", compression: "STORE", streamFiles: true });

let limitClosed = 0;
await assert.rejects(resizeImages({
  files: Array.from({ length: 5 }, (_, index) => ({ name: `${index}.png` })), outputFormat: "png", settings: { mode: "percentage", percentage: 100 }, JSZip: TestZip,
  identify: async () => "png", decode: async () => ({ source: {}, width: 10_000, height: 5_000, close() { limitClosed += 1; } }), canvasFactory: () => canvasHarness().canvas,
}), (error) => error.code === "RESIZE_JOB_PIXELS_EXCEEDED" && error.fileName === "4.png");
assert.equal(MAX_OUTPUT_JOB_PIXELS, 200_000_000);
assert.equal(limitClosed, 5, "Decoded sources close after aggregate output rejection");

let recoveryClosed = false;
await assert.rejects(resizeImages({ files: [{ name: "bad.png" }], outputFormat: "png", settings: { mode: "pixels", width: 0, height: 10, lockAspectRatio: false }, identify: async () => "png", decode: async () => ({ source: {}, width: 20, height: 20, close() { recoveryClosed = true; } }) }), (error) => error.code === "RESIZE_DIMENSION_INVALID");
assert.equal(recoveryClosed, true, "Decoded source closes after recoverable settings failure");

const html = read("tools/image/resize/index.html");
const app = read("tools/image/resize/app.js");
const logic = read("tools/image/resize/resize.js");
const css = read("tools/image/resize/tool.css");
const category = read("tools/image/index.html");
assert.match(category, /href="\.\/converter\/"/); assert.match(category, /href="\.\/resize\/"/);
assert.match(category, /href="\.\/compress\/"/); assert.match(category, /href="\.\/metadata\/"/); assert.equal((category.match(/class="category-tool surface"/g) || []).length, 4);
assert.doesNotMatch(category, /categories\.plannedNote/);
assert.match(html, /type="file"[^>]*multiple[^>]*aria-describedby="drop-description"/);
assert.match(html, /name="resize-mode"[^>]*value="pixels"/); assert.match(html, /name="resize-mode"[^>]*value="percentage"/);
assert.match(html, /id="aspect-ratio"[^>]*checked/); assert.match(html, /id="allow-enlargement"/);
assert.match(html, /id="output-format"[\s\S]*value="original"[\s\S]*value="jpeg"[\s\S]*value="png"[\s\S]*value="webp"/);
assert.match(html, /role="status" aria-live="polite"/); assert.match(html, /assets\/vendor\/jszip\/jszip\.min\.js/);
assert.match(html, /connect-src 'none'/); assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/); assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i); assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"[^>]+href="https?:/i);
assert.match(app, /finally\s*\{[\s\S]*state\.busy = false[\s\S]*elements\.progress\.hidden = true/);
assert.match(app, /URL\.revokeObjectURL/); assert.match(logic, /decoded\?\.close\(\)/);
assert.match(read("tools/shared/image.js"), /imageOrientation: "from-image"/);
assert.doesNotMatch(app + logic, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//);
assert.match(css, /@media \(max-width: 38rem\)/); assert.doesNotMatch(css, /width:\s*100vw|word-break:\s*break-all|transform:\s*scale\(/);
assert.match(read("tools/image/converter/converter.js"), /from "\.\.\/\.\.\/shared\/image-output\.js"/);
assert.ok(read("tests/run-all.mjs").includes("image-converter.test.mjs"));
assert.ok(read("tests/run-all.mjs").includes("pdf-merge-and-categories.test.mjs"));

console.log("Image Resize dimensions, formats, alpha, batch, limits, recovery, UI, privacy, and regression contracts passed.");

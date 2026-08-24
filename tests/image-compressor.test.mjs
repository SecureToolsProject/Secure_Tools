import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARCHIVE_FILENAME, calculateAggregateMetrics, calculateCompressionMetrics, compressImages,
  createCompressionPlan, MAX_JOB_PIXELS, normalizeOutputFormat, resolveOutputFormats,
} from "../tools/image/compress/compressor.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
assert.equal(normalizeOutputFormat("ORIGINAL"), "original");
assert.throws(() => normalizeOutputFormat("gif"), (error) => error.code === "IMAGE_FORMAT_INVALID");
assert.deepEqual(resolveOutputFormats("original", ["jpeg", "png", "webp"]), ["jpeg", "png", "webp"]);
assert.deepEqual(resolveOutputFormats("webp", ["jpeg", "png"]), ["webp", "webp"]);

assert.deepEqual(calculateCompressionMetrics(1000, 600), { originalSize: 1000, resultSize: 600, difference: 400, reductionPercent: 40, larger: false });
assert.deepEqual(calculateCompressionMetrics(1000, 1134), { originalSize: 1000, resultSize: 1134, difference: -134, reductionPercent: -13.4, larger: true });
assert.deepEqual(calculateAggregateMetrics([{ originalSize: 1000, resultSize: 600 }, { originalSize: 500, resultSize: 600 }]), { originalSize: 1500, resultSize: 1200, difference: 300, reductionPercent: 20, larger: false });
assert.throws(() => calculateCompressionMetrics(0, 10), (error) => error.code === "COMPRESSION_SIZE_INVALID");
assert.throws(() => calculateCompressionMetrics(10, -1), (error) => error.code === "COMPRESSION_SIZE_INVALID");

const plan = createCompressionPlan({ files: [{ name: "photo.jpg" }, { name: "photo.png" }, { name: "한글 사진.webp" }], sourceFormats: ["jpeg", "png", "webp"], outputFormat: "original", quality: 0.8 });
assert.deepEqual(plan.formats, ["jpeg", "png", "webp"]);
assert.deepEqual(plan.qualities, [0.8, null, 0.8]);
assert.deepEqual(plan.names, { archive: ARCHIVE_FILENAME, entries: ["photo_compressed.jpg", "photo_compressed.png", "한글 사진_compressed.webp"] });
assert.deepEqual(createCompressionPlan({ files: [{ name: "same.jpg" }, { name: "same.png" }], sourceFormats: ["png", "png"], outputFormat: "png", quality: 0.5 }).names.entries, ["same_compressed.png", "same_compressed_2.png"]);
assert.ok(new TextEncoder().encode(plan.names.entries[2]).length <= 196);

function canvasHarness({ resultSize = 40, fail = false } = {}) { const events = []; const context = { set fillStyle(value) { events.push(["fillStyle", value]); }, fillRect(...args) { events.push(["fillRect", ...args]); }, drawImage(...args) { events.push(["drawImage", ...args]); } }; const canvas = { width: 0, height: 0, getContext(type, options) { events.push(["context", type, options]); return context; }, toBlob(callback, type, quality) { events.push(["encode", type, quality]); callback(fail ? null : new Blob([new Uint8Array(resultSize)], { type })); } }; return { canvas, events }; }
class TestZip { constructor() { this.entries = []; TestZip.instance = this; } file(name, bytes) { this.entries.push([name, bytes.length]); } async generateAsync(options) { this.options = options; return new Blob(["zip"], { type: "application/zip" }); } }

let closed = 0; const canvases = [];
const result = await compressImages({ files: [{ name: "alpha.png", size: 100 }, { name: "photo.jpg", size: 80 }], outputFormat: "original", quality: 0.75, JSZip: TestZip, identify: async (file) => file.name.endsWith(".png") ? "png" : "jpeg", decode: async (file) => ({ source: file, width: 20, height: 10, close() { closed += 1; } }), canvasFactory: () => { const harness = canvasHarness({ resultSize: 40 }); canvases.push(harness); return harness.canvas; } });
assert.equal(result.kind, "zip"); assert.equal(closed, 2); assert.deepEqual(result.results.map(({ width, height, originalSize, resultSize }) => ({ width, height, originalSize, resultSize })), [{ width: 20, height: 10, originalSize: 100, resultSize: 40 }, { width: 20, height: 10, originalSize: 80, resultSize: 40 }]);
assert.deepEqual(result.aggregate, { originalSize: 180, resultSize: 80, difference: 100, reductionPercent: 55.6, larger: false });
assert.deepEqual(canvases[0].events[0], ["context", "2d", { alpha: true }]); assert.equal(canvases[0].events.some(([event]) => event === "fillRect"), false); assert.deepEqual(canvases[0].events.find(([event]) => event === "drawImage").length, 4, "Compression must preserve source dimensions without resize arguments");
assert.deepEqual(canvases[1].events.slice(0, 3), [["context", "2d", { alpha: false }], ["fillStyle", "#ffffff"], ["fillRect", 0, 0, 20, 10]]);
assert.deepEqual(canvases.map(({ events }) => events.find(([event]) => event === "encode").slice(1)), [["image/png", undefined], ["image/jpeg", 0.75]]);
assert.deepEqual(TestZip.instance.entries.map(([name]) => name), ["alpha_compressed.png", "photo_compressed.jpg"]);

let repeatClosed = 0;
for (const quality of [0.9, 0.7]) await compressImages({ files: [{ name: "again.webp", size: 100 }], outputFormat: "webp", quality, identify: async () => "webp", decode: async () => ({ source: {}, width: 10, height: 5, close() { repeatClosed += 1; } }), canvasFactory: () => canvasHarness({ resultSize: 60 }).canvas });
assert.equal(repeatClosed, 2, "Repeated compression releases every decoded source");
let failureClosed = false;
await assert.rejects(compressImages({ files: [{ name: "broken.png", size: 100 }], outputFormat: "png", identify: async () => "png", decode: async () => ({ source: {}, width: 10, height: 10, close() { failureClosed = true; } }), canvasFactory: () => canvasHarness({ fail: true }).canvas }), (error) => error.code === "IMAGE_ENCODER_FAILED" && error.fileName === "broken.png");
assert.equal(failureClosed, true);
let limitClosed = 0;
await assert.rejects(compressImages({ files: Array.from({ length: 5 }, (_, i) => ({ name: `${i}.png`, size: 100 })), outputFormat: "png", identify: async () => "png", decode: async () => ({ source: {}, width: 10_000, height: 5_000, close() { limitClosed += 1; } }), canvasFactory: () => canvasHarness().canvas, JSZip: TestZip }), (error) => error.code === "IMAGE_JOB_PIXELS_EXCEEDED" && error.fileName === "4.png");
assert.equal(MAX_JOB_PIXELS, 200_000_000); assert.equal(limitClosed, 5);

const html = read("tools/image/compress/index.html"); const app = read("tools/image/compress/app.js"); const logic = read("tools/image/compress/compressor.js"); const css = read("tools/image/compress/tool.css"); const category = read("tools/image/index.html");
assert.match(category, /href="\.\/converter\/"/); assert.match(category, /href="\.\/resize\/"/); assert.match(category, /href="\.\/compress\/"/); assert.equal((category.match(/class="category-tool surface"/g) || []).length, 3); assert.doesNotMatch(category, /metadataInspector|metadataCleaner|categories\.plannedNote/);
assert.match(html, /type="file"[^>]*multiple[^>]*aria-describedby="drop-description"/); assert.match(html, /id="output-format"[\s\S]*value="original"[\s\S]*value="jpeg"[\s\S]*value="png"[\s\S]*value="webp"/); assert.match(html, /id="quality"[^>]*min="0\.5"[^>]*max="1"[^>]*value="0\.8"/); assert.match(html, /id="compression-results"[^>]*hidden[^>]*aria-labelledby="results-title"/); assert.match(html, /role="status" aria-live="polite"/); assert.match(html, /connect-src 'none'/);
assert.match(app, /showQuality = elements\.format\.value !== "png"/); assert.match(app, /invalidateResults\(true\)/); assert.match(app, /finally \{ state\.busy = false; elements\.progress\.hidden = true/); assert.match(app, /URL\.revokeObjectURL/); assert.match(logic, /decoded\?\.close\(\)/); assert.match(read("tools/shared/image.js"), /imageOrientation: "from-image"/);
assert.doesNotMatch(app + logic, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//); assert.match(css, /@media \(max-width: 44rem\)/); assert.match(css, /@media \(max-width: 24rem\)/); assert.doesNotMatch(css, /width:\s*100vw|word-break:\s*break-all|transform:\s*scale\(/);
assert.ok(read("tests/run-all.mjs").includes("image-converter.test.mjs")); assert.ok(read("tests/run-all.mjs").includes("image-resize.test.mjs")); assert.ok(read("tests/run-all.mjs").includes("pdf-merge-and-categories.test.mjs"));
console.log("Image Compressor metrics, formats, quality, alpha, dimensions, batch, cleanup, UI, privacy, and regression contracts passed.");

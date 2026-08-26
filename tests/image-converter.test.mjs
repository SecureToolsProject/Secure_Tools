import assert from "node:assert/strict";
import { File } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARCHIVE_FILENAME,
  createConversionPlan,
  createOutputNames,
  convertImages,
  DEFAULT_QUALITY,
  IMAGE_FORMATS,
  MAX_BASE_BYTES,
  MAX_JOB_PIXELS,
  normalizeFormat,
  normalizeQuality,
  packageConvertedImages,
  renderDecodedImage,
  sourceBaseName,
} from "../tools/image/converter/converter.js";
import { selectImageQueueFiles } from "../tools/shared/image.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const imageFile = (bytes, name, type) => new File([bytes], name, { type });
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new TextEncoder().encode("RIFF0000WEBP");

assert.deepEqual(IMAGE_FORMATS, {
  jpeg: { extension: "jpg", mimeType: "image/jpeg", label: "JPEG" },
  png: { extension: "png", mimeType: "image/png", label: "PNG" },
  webp: { extension: "webp", mimeType: "image/webp", label: "WebP" },
});
assert.equal(normalizeFormat("JPEG"), "jpeg");
assert.throws(() => normalizeFormat("gif"), (error) => error.code === "IMAGE_FORMAT_INVALID");
assert.equal(normalizeQuality("png", 0.5), null);
assert.equal(normalizeQuality("jpeg", "invalid"), DEFAULT_QUALITY);
assert.equal(normalizeQuality("webp", 0.1), 0.5);
assert.equal(normalizeQuality("jpeg", 2), 1);

assert.equal(sourceBaseName(" photo.png "), "photo");
assert.equal(sourceBaseName("한글 파일.webp"), "한글 파일");
assert.equal(sourceBaseName("bad:name.jpg"), "bad_name");
const veryLong = `${"가".repeat(200)}.png`;
const shortened = sourceBaseName(veryLong);
assert.ok(Array.from(shortened).length <= 120);
assert.ok(new TextEncoder().encode(shortened).length <= MAX_BASE_BYTES);
const named = createOutputNames([
  { name: "photo.png" }, { name: "photo.jpg" }, { name: "photo_2.webp" }, { name: "한글 파일.png" },
], "jpeg");
assert.deepEqual(named, {
  archive: ARCHIVE_FILENAME,
  entries: ["photo.jpg", "photo_2.jpg", "photo_2_2.jpg", "한글 파일.jpg"],
});
assert.deepEqual(createConversionPlan({ files: [{ name: "one.png" }], format: "png", quality: 0.5 }), {
  format: "png", mimeType: "image/png", quality: null,
  names: { archive: ARCHIVE_FILENAME, entries: ["one.png"] },
});
assert.throws(() => createConversionPlan({ files: [], format: "png" }), (error) => error.code === "NO_FILES");

const selected = await selectImageQueueFiles([], [
  imageFile(png, "valid.jpg", "image/jpeg"),
  imageFile([], "empty.png", "image/png"),
  imageFile(new TextEncoder().encode("not an image"), "fake.webp", "image/webp"),
  imageFile(jpeg, "camera.unknown", "image/jpeg"),
  imageFile(webp, "graphic.webp", "image/webp"),
]);
assert.deepEqual(selected.accepted.map((file) => file.name), ["valid.jpg", "camera.unknown", "graphic.webp"]);
assert.deepEqual(selected.rejected.map(({ code }) => code), ["IMAGE_SIGNATURE_INVALID", "IMAGE_SIGNATURE_INVALID"]);

function canvasHarness({ encodedType, fail = false } = {}) {
  const events = [];
  const context = {
    set fillStyle(value) { events.push(["fillStyle", value]); },
    fillRect(...values) { events.push(["fillRect", ...values]); },
    drawImage(...values) { events.push(["drawImage", ...values]); },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext(type, options) { events.push(["context", type, options]); return context; },
    toBlob(callback, mimeType, quality) {
      events.push(["encode", mimeType, quality]);
      callback(fail ? null : new Blob([mimeType], { type: encodedType || mimeType }));
    },
  };
  return { canvas, events };
}

const decoded = { source: { id: "pixels" }, width: 12, height: 8 };
const jpegCanvas = canvasHarness();
const jpegBlob = await renderDecodedImage({ decoded, format: "jpeg", quality: 0.8, canvasFactory: () => jpegCanvas.canvas });
assert.equal(jpegBlob.type, "image/jpeg");
assert.deepEqual(jpegCanvas.events.slice(0, 4), [
  ["context", "2d", { alpha: false }],
  ["fillStyle", "#ffffff"],
  ["fillRect", 0, 0, 12, 8],
  ["drawImage", decoded.source, 0, 0],
]);
assert.deepEqual(jpegCanvas.events.at(-1), ["encode", "image/jpeg", 0.8]);
assert.equal(jpegCanvas.canvas.width, 1);
assert.equal(jpegCanvas.canvas.height, 1);

const pngCanvas = canvasHarness();
await renderDecodedImage({ decoded, format: "png", quality: 0.5, canvasFactory: () => pngCanvas.canvas });
assert.deepEqual(pngCanvas.events[0], ["context", "2d", { alpha: true }]);
assert.equal(pngCanvas.events.some(([event]) => event === "fillRect"), false, "PNG must preserve alpha pixels");
assert.deepEqual(pngCanvas.events.at(-1), ["encode", "image/png", undefined]);
await assert.rejects(renderDecodedImage({ decoded, format: "webp", canvasFactory: () => canvasHarness({ fail: true }).canvas }), (error) => error.code === "IMAGE_ENCODER_FAILED");
await assert.rejects(renderDecodedImage({ decoded, format: "png", canvasFactory: () => ({ width: 0, height: 0, getContext: () => null }) }), (error) => error.code === "CANVAS_UNAVAILABLE");

const singleBlob = new Blob(["single"], { type: "image/png" });
assert.deepEqual(await packageConvertedImages({
  blobs: [singleBlob], names: { archive: ARCHIVE_FILENAME, entries: ["one.png"] }, JSZip: null,
}), { kind: "image", filename: "one.png", entries: ["one.png"], blob: singleBlob });

class TestZip {
  constructor() { this.entries = []; TestZip.instance = this; }
  file(name, bytes) { this.entries.push([name, [...bytes]]); }
  async generateAsync(options) { this.options = options; return new Blob(["zip"], { type: "application/zip" }); }
}
const batch = await packageConvertedImages({
  blobs: [new Blob(["a"], { type: "image/png" }), new Blob(["b"], { type: "image/png" })],
  names: { archive: ARCHIVE_FILENAME, entries: ["a.png", "b.png"] },
  JSZip: TestZip,
});
assert.equal(batch.kind, "zip");
assert.equal(batch.filename, ARCHIVE_FILENAME);
assert.deepEqual(TestZip.instance.entries.map(([name]) => name), ["a.png", "b.png"]);
assert.deepEqual(TestZip.instance.options, { type: "blob", compression: "STORE", streamFiles: true });
await assert.rejects(packageConvertedImages({ blobs: [singleBlob, singleBlob], names: { archive: "x.zip", entries: ["a.png", "b.png"] } }), (error) => error.code === "ARCHIVE_LIBRARY_UNAVAILABLE");

let closed = 0;
const progress = [];
const conversionCanvas = () => canvasHarness().canvas;
const converted = await convertImages({
  files: [{ name: "a.png" }, { name: "a.jpg" }], format: "webp", quality: 0.75, JSZip: TestZip,
  decode: async (file) => ({ source: file, width: 20, height: 10, close() { closed += 1; } }),
  canvasFactory: conversionCanvas,
  onProgress: (completed, total, file) => progress.push([completed, total, file.name]),
});
assert.equal(converted.kind, "zip");
assert.deepEqual(converted.entries, ["a.webp", "a_2.webp"]);
assert.equal(closed, 2);
assert.deepEqual(progress, [[1, 2, "a.png"], [2, 2, "a.jpg"]]);

let limitClosed = 0;
await assert.rejects(convertImages({
  files: Array.from({ length: 5 }, (_, index) => ({ name: `${index}.png` })), format: "png", JSZip: TestZip,
  decode: async () => ({ source: {}, width: 10_000, height: 5_000, close() { limitClosed += 1; } }),
  canvasFactory: conversionCanvas,
}), (error) => error.code === "IMAGE_JOB_PIXELS_EXCEEDED" && error.fileName === "4.png");
assert.equal(MAX_JOB_PIXELS, 200_000_000);
assert.equal(limitClosed, 5, "Every decoded source must be released when the aggregate limit is reached");

let failureClosed = false;
await assert.rejects(convertImages({
  files: [{ name: "broken.png" }], format: "png",
  decode: async () => ({ source: {}, width: 2, height: 2, close() { failureClosed = true; } }),
  canvasFactory: () => canvasHarness({ fail: true }).canvas,
}), (error) => error.code === "IMAGE_ENCODER_FAILED" && error.fileName === "broken.png");
assert.equal(failureClosed, true, "Decoded sources must be released after encoder failure");

const html = read("tools/image/converter/index.html");
const app = read("tools/image/converter/app.js");
const css = read("tools/image/converter/tool.css");
const category = read("tools/image/index.html");
const pdfCategory = read("tools/pdf/index.html");
const organizer = read("tools/pdf/organize/app.js");
assert.match(category, /href="\.\/converter\/"[\s\S]*status--available/);
assert.match(category, /href="\.\/resize\/"[\s\S]*status--available/);
assert.match(category, /href="\.\/compress\/"[\s\S]*status--available/);
assert.equal((category.match(/class="category-tool surface"/g) || []).length, 4);
assert.doesNotMatch(category, /categories\.plannedNote/);
assert.match(html, /type="file"[^>]*multiple[^>]*aria-describedby="drop-description"/);
assert.match(html, /<label class="drop-zone__picker" for="file-input">/);
assert.match(html, /id="output-format"[\s\S]*value="jpeg"[\s\S]*value="png"[\s\S]*value="webp"/);
assert.match(html, /id="quality"[^>]*type="range"[^>]*aria-describedby="quality-help"/);
assert.match(html, /role="status" aria-live="polite"/);
assert.match(html, /assets\/vendor\/jszip\/jszip\.min\.js/);
assert.match(app, /finally\s*\{[\s\S]*state\.busy = false[\s\S]*elements\.progress\.hidden = true/);
assert.match(app, /elements\.qualityField\.hidden = isPng/);
assert.match(app, /elements\.input\.disabled = state\.busy/);
assert.match(css, /@media \(max-width: 38rem\)/);
assert.doesNotMatch(css, /width:\s*100vw|word-break:\s*break-all|transform:\s*scale\(/);
assert.doesNotMatch(app + read("tools/image/converter/converter.js"), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//);
assert.doesNotMatch(pdfCategory, /rotateTitle|categories\.pdf\.rotate|>Rotate PDF</);
assert.match(organizer, /rotatePage\(/, "Organizer rotation behavior must remain available");
assert.match(read("tools/shared/image.js"), /createImageBitmap\(file, \{ imageOrientation: "from-image" \}\)/);

console.log("Image Converter format, naming, alpha, batch, limits, UI, privacy, and Rotation cleanup checks passed.");

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_QUALITY, IMAGE_FORMATS, MAX_CONCURRENT_RENDERS, MAX_RENDER_DIMENSION, MAX_RENDER_PIXELS, SCALE_PRESETS,
  canvasToBlob, createConversionPlan, createOutputNames, normalizeFormat, normalizeQuality, normalizeScale,
  packageRenderedImages, renderPageImage, selectPages, validateRenderDimensions,
} from "../tools/pdf/to-images/converter.js";

const require = createRequire(import.meta.url);
const JSZip = require("../assets/vendor/jszip/jszip.min.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function testPageSelectionAndPlan() {
  assert.deepEqual(selectPages({ mode: "all", pageCount: 4 }), [0, 1, 2, 3]);
  assert.deepEqual(selectPages({ mode: "selected", selection: "1", pageCount: 10 }), [0]);
  assert.deepEqual(selectPages({ mode: "selected", selection: "1-3", pageCount: 10 }), [0, 1, 2]);
  assert.deepEqual(selectPages({ mode: "selected", selection: "1-3,5,8-10", pageCount: 10 }), [0, 1, 2, 4, 7, 8, 9]);
  assert.deepEqual(selectPages({ mode: "selected", selection: "5,1,3", pageCount: 5 }), [4, 0, 2]);
  assert.deepEqual(selectPages({ mode: "selected", selection: "2,2,1-2", pageCount: 5 }), [1, 1, 0, 1]);
  for (const [selection, code] of [["", "PAGE_RANGE_REQUIRED"], ["0", "PAGE_RANGE_INVALID"], ["5-2", "PAGE_RANGE_REVERSED"], ["6", "PAGE_OUT_OF_RANGE"], ["1-a", "PAGE_RANGE_INVALID"]]) {
    assert.throws(() => selectPages({ mode: "selected", selection, pageCount: 5 }), (error) => error.code === code);
  }
  assert.throws(() => selectPages({ mode: "unknown", pageCount: 1 }), (error) => error.code === "PAGE_MODE_INVALID");

  const plan = createConversionPlan({ mode: "selected", selection: "5,1,3,1", pageCount: 5, format: "jpeg", quality: 0.92, scale: 2, baseName: "report", sourceName: "report.pdf" });
  assert.deepEqual(plan.pages, [4, 0, 2, 0]);
  assert.deepEqual(plan.names.entries, ["report_page_005.jpg", "report_page_001.jpg", "report_page_003.jpg", "report_page_001_2.jpg"]);
  assert.equal(plan.names.archive, "report_images.zip");
}

function testFormatsScalesAndLimits() {
  assert.deepEqual(Object.keys(IMAGE_FORMATS), ["png", "jpeg", "webp"]);
  assert.equal(normalizeFormat("JPEG"), "jpeg");
  assert.throws(() => normalizeFormat("avif"), (error) => error.code === "IMAGE_FORMAT_INVALID");
  assert.equal(normalizeQuality("png", 0.5), null);
  assert.equal(normalizeQuality("jpeg", undefined), DEFAULT_QUALITY);
  assert.equal(normalizeQuality("jpeg", 0.2), 0.5);
  assert.equal(normalizeQuality("webp", 2), 1);
  assert.deepEqual(SCALE_PRESETS, [1, 1.5, 2, 3]);
  assert.equal(normalizeScale("1.5"), 1.5);
  assert.throws(() => normalizeScale(4), (error) => error.code === "IMAGE_SCALE_INVALID");
  assert.equal(MAX_RENDER_DIMENSION, 16384);
  assert.equal(MAX_RENDER_PIXELS, 50_000_000);
  assert.equal(MAX_CONCURRENT_RENDERS, 2);
  assert.deepEqual(validateRenderDimensions(100.1, 200.1), { width: 101, height: 201 });
  assert.throws(() => validateRenderDimensions(MAX_RENDER_DIMENSION + 1, 1), (error) => error.code === "RENDER_DIMENSION_EXCEEDED");
  assert.throws(() => validateRenderDimensions(10_000, 5_001), (error) => error.code === "RENDER_PIXELS_EXCEEDED");
  assert.throws(() => validateRenderDimensions(0, 20), (error) => error.code === "RENDER_DIMENSIONS_INVALID");
}

async function testCanvasAndPackaging() {
  const calls = [];
  const encoded = await canvasToBlob({ toBlob(callback, type, quality) { calls.push([type, quality]); callback(new Blob(["image"], { type })); } }, "image/webp", 0.8);
  assert.equal(encoded.type, "image/webp");
  assert.deepEqual(calls, [["image/webp", 0.8]]);
  await assert.rejects(canvasToBlob({ toBlob(callback) { callback(null); } }, "image/png", null), (error) => error.code === "IMAGE_ENCODER_FAILED");
  await assert.rejects(canvasToBlob({ toBlob(callback) { callback(new Blob(["x"], { type: "image/png" })); } }, "image/webp", 0.9), (error) => error.code === "IMAGE_ENCODER_FAILED");

  let cleaned = false;
  const page = { getViewport: ({ scale }) => ({ width: 300 * scale, height: 200 * scale }), cleanup() { cleaned = true; } };
  const renderer = { async getPage(number) { assert.equal(number, 2); return page; }, async runRender(target, context) { assert.equal(target, page); assert.equal(context.background, "#ffffff"); } };
  const canvas = { width: 0, height: 0, getContext: () => ({}), toBlob: (callback, type) => callback(new Blob(["page"], { type })) };
  const blob = await renderPageImage({ renderer, pageIndex: 1, scale: 2, mimeType: "image/png", quality: null, canvasFactory: () => canvas });
  assert.equal(blob.type, "image/png");
  assert.equal(cleaned, true);
  assert.deepEqual([canvas.width, canvas.height], [1, 1]);

  const singleNames = createOutputNames({ pages: [0], pageCount: 1, baseName: "one", sourceName: "one.pdf", format: "png" });
  const single = await packageRenderedImages({ blobs: [new Blob(["one"], { type: "image/png" })], names: singleNames, JSZip });
  assert.equal(single.kind, "image");
  assert.equal(single.filename, "one_page_001.png");

  const pages = [4, 0, 2, 0];
  const names = createOutputNames({ pages, pageCount: 5, baseName: "ordered", sourceName: "source.pdf", format: "webp" });
  const blobs = pages.map((page) => new Blob([String(page)], { type: "image/webp" }));
  for (let repeat = 0; repeat < 2; repeat += 1) {
    const result = await packageRenderedImages({ blobs, names, JSZip });
    assert.equal(result.kind, "zip");
    assert.equal(result.filename, "ordered_images.zip");
    const archive = await JSZip.loadAsync(await result.blob.arrayBuffer());
    assert.deepEqual(Object.keys(archive.files), names.entries);
    const contents = [];
    for (const name of names.entries) contents.push(await archive.file(name).async("string"));
    assert.deepEqual(contents, ["4", "0", "2", "0"]);
  }
}

function testArchitectureAndUi() {
  const converter = read("tools/pdf/to-images/converter.js");
  const sharedRenderer = read("tools/shared/pdf-renderer.js");
  const app = read("tools/pdf/to-images/app.js");
  const html = read("tools/pdf/to-images/index.html");
  const css = read("tools/pdf/to-images/tool.css");
  assert.match(converter, /canvas\.toBlob\(/);
  assert.doesNotMatch(converter, /toDataURL|base64/i);
  assert.match(converter, /canvas\.width = 1;[\s\S]*canvas\.height = 1/);
  assert.match(converter, /runRenderQueue\(tasks, MAX_CONCURRENT_RENDERS\)/);
  assert.match(converter, /new LocalPdfRenderer\(sourceBytes\)/);
  assert.match(converter, /signal\?\.addEventListener\("abort"/);
  assert.match(sharedRenderer, /assets\/vendor\/pdfjs\/pdf\.min\.mjs/);
  assert.match(sharedRenderer, /assets\/vendor\/pdfjs\/pdf\.worker\.min\.mjs/);
  assert.match(sharedRenderer, /useWorkerFetch:\s*false/);
  assert.match(sharedRenderer, /useWasm:\s*false/);
  assert.doesNotMatch(sharedRenderer, /https?:|unpkg|jsdelivr|cdnjs/i);
  assert.match(html, /<label class="drop-zone__picker" for="file-input">/);
  assert.match(html, /value="png"[\s\S]*value="jpeg"[\s\S]*value="webp"/);
  assert.match(html, /value="1"[\s\S]*value="1\.5"[\s\S]*value="2"[\s\S]*value="3"/);
  assert.match(html, /aria-describedby="range-help range-error"/);
  assert.match(app, /async function addSource\(files\) \{\s*if \(state\.loading \|\| !files\.length\) return;/);
  assert.match(app, /finally \{\s*elements\.input\.value = "";\s*state\.loading = false;\s*renderState\(\);/);
  assert.match(app, /elements\.input\.disabled = state\.loading/);
  assert.match(html, /<progress[^>]+data-i18n-aria-label=/);
  assert.match(app, /stopActiveJob\(\)/);
  assert.match(app, /state\.controller\?\.abort\(\)/);
  assert.match(app, /securetools:languagechange/);
  assert.match(css, /#quality-field\[hidden\][^{]*[\s\S]*display:\s*none/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(read("tools/pdf/index.html"), /href="\.\/to-images\/"/);
  assert.equal(JSON.parse(read("assets/vendor/pdfjs/package.json")).version, "6.2.108");
  assert.equal(JSON.parse(read("assets/vendor/jszip/package.json")).version, "3.10.1");
}

testPageSelectionAndPlan();
testFormatsScalesAndLimits();
await testCanvasAndPackaging();
testArchitectureAndUi();
console.log("PDF to Images selection, rendering plan, output, and UI checks passed.");

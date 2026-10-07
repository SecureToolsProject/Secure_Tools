import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PDF_OCR_LARGE_DOCUMENT_THRESHOLD,
  PDF_OCR_MAX_RENDER_DIMENSION,
  PDF_OCR_MAX_RENDER_PIXELS,
  PDF_OCR_RENDER_SCALE,
  createPdfOcrService,
  readPdfOcrSource,
  resolvePdfOcrPages,
} from "../.ts-build/tools/shared/pdf-ocr.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const codedError = (code) => Object.assign(new Error(code), { code });
const waitTurn = () => new Promise((resolve) => setImmediate(resolve));

function canvasHarness(events) {
  return {
    width: 0,
    height: 0,
    getContext() { return {}; },
    toBlob(callback, type) {
      events.push(["encode", this.width, this.height, type]);
      callback(new Blob([`page:${this.width}x${this.height}`], { type }));
    },
  };
}

function rendererHarness({ pageCount = 3, loadError = null, blockRender = false } = {}) {
  const events = [];
  let rejectRender = null;
  const renderer = {
    async load() {
      events.push("load");
      if (loadError) throw loadError;
      return pageCount;
    },
    async getPage(pageNumber) {
      events.push(["getPage", pageNumber]);
      return {
        getViewport({ scale }) { return { width: (100 + pageNumber) * scale, height: 50 * scale }; },
        cleanup() { events.push(["cleanup", pageNumber]); },
      };
    },
    runRender(page, context) {
      events.push(["render", context.viewport.width, context.background]);
      if (!blockRender) return Promise.resolve();
      return new Promise((resolve, reject) => { rejectRender = reject; });
    },
    async destroy() {
      events.push("destroy");
      rejectRender?.(new Error("render cancelled"));
      rejectRender = null;
    },
  };
  return { renderer, events };
}

function ocrHarness(handler = async (_image, options) => ({ text: `${options.language} text` })) {
  const events = [];
  return {
    service: {
      async recognizeImage(image, options) {
        events.push(["recognize", options.language, image.type]);
        options.onProgress?.({ stage: "recognizing", progress: 0.5 });
        return handler(image, options);
      },
      async dispose() { events.push("dispose"); },
    },
    events,
  };
}

assert.equal(PDF_OCR_RENDER_SCALE, 2);
assert.equal(PDF_OCR_MAX_RENDER_DIMENSION, 16_384);
assert.equal(PDF_OCR_MAX_RENDER_PIXELS, 50_000_000);
assert.equal(PDF_OCR_LARGE_DOCUMENT_THRESHOLD, 25);
assert.deepEqual(resolvePdfOcrPages({ mode: "all" }, 3), [1, 2, 3]);
assert.deepEqual(resolvePdfOcrPages({ mode: "selected", pageNumbers: [3, 1] }, 3), [3, 1]);
for (const [selection, code] of [
  [{ mode: "selected", pageNumbers: [] }, "PDF_OCR_PAGE_SELECTION_REQUIRED"],
  [{ mode: "selected", pageNumbers: [0] }, "PDF_OCR_PAGE_SELECTION_INVALID"],
  [{ mode: "selected", pageNumbers: [4] }, "PDF_OCR_PAGE_OUT_OF_RANGE"],
  [{ mode: "selected", pageNumbers: [2, 2] }, "PDF_OCR_PAGE_DUPLICATE"],
]) {
  assert.throws(() => resolvePdfOcrPages(selection, 3), (error) => error.code === code);
}
assert.throws(() => resolvePdfOcrPages({ mode: "all" }, 0), (error) => error.code === "PDF_HAS_NO_PAGES");

await assert.rejects(
  readPdfOcrSource(Object.assign(new Blob(["x"], { type: "text/plain" }), { name: "notes.txt" })),
  (error) => error.code === "UNSUPPORTED_PDF",
);
const acceptedPdf = Object.assign(new Blob(["%PDF-1.7"], { type: "application/pdf" }), { name: "input.pdf" });
assert.equal(new TextDecoder().decode(await readPdfOcrSource(acceptedPdf)), "%PDF-1.7");

{
  const renderer = rendererHarness({ pageCount: 4 });
  const ocr = ocrHarness();
  const canvases = [];
  const progress = [];
  const pageResults = [];
  const service = createPdfOcrService({
    rendererFactory: async () => renderer.renderer,
    ocrService: ocr.service,
    canvasFactory() { const canvas = canvasHarness(renderer.events); canvases.push(canvas); return canvas; },
  });
  const result = await service.recognizeDocument({
    sourceBytes: Uint8Array.of(1, 2, 3).buffer,
    language: "eng+kor",
    selection: { mode: "selected", pageNumbers: [3, 1] },
    onProgress(value) { progress.push(value); },
    onPageResult(value) { pageResults.push(value); },
  });
  assert.deepEqual(result.selectedPageNumbers, [3, 1]);
  assert.deepEqual(result.pages, [{ pageNumber: 3, text: "eng+kor text" }, { pageNumber: 1, text: "eng+kor text" }]);
  assert.deepEqual(pageResults, result.pages);
  assert.equal(result.pageCount, 4);
  assert.equal(result.largeDocument, false);
  assert.deepEqual(ocr.events.filter((event) => event[0] === "recognize").map((event) => event[1]), ["eng+kor", "eng+kor"]);
  assert.deepEqual(renderer.events.filter((event) => Array.isArray(event) && event[0] === "getPage"), [["getPage", 3], ["getPage", 1]]);
  assert.deepEqual(renderer.events.filter((event) => Array.isArray(event) && event[0] === "cleanup"), [["cleanup", 3], ["cleanup", 1]]);
  assert.equal(renderer.events.filter((event) => event === "destroy").length, 1);
  assert.ok(canvases.every((canvas) => canvas.width === 1 && canvas.height === 1), "every page canvas is released");
  assert.equal(progress[0].phase, "loading-document");
  assert.ok(progress.some((value) => value.phase === "rendering-page" && value.pageNumber === 3));
  assert.ok(progress.some((value) => value.phase === "recognizing-page" && value.pageProgress === 0.5));
  assert.deepEqual(progress.at(-1), {
    phase: "complete", pageNumber: 1, pageIndex: 2, pageCount: 2, documentPageCount: 4,
    pageProgress: 1, overallProgress: 1, ocrStage: "complete",
  });
  await service.dispose();
  assert.deepEqual(ocr.events.at(-1), "dispose");
}

{
  const renderer = rendererHarness({ pageCount: 1 });
  const ocr = ocrHarness(async (_image, options) => {
    assert.equal(options.includeLayout, true);
    return { text: "layout", lines: [{ text: "layout", confidence: 54, bbox: { x0: 2, y0: 4, x1: 20, y1: 14 } }] };
  });
  const service = createPdfOcrService({ rendererFactory: async () => renderer.renderer, ocrService: ocr.service, canvasFactory: () => canvasHarness([]) });
  const result = await service.recognizeDocument({ sourceBytes: new ArrayBuffer(1), language: "eng", includeLayout: true, inspectExistingText: true });
  assert.deepEqual(result.pages[0].lines, [{ text: "layout", confidence: 54, bbox: { x0: 2, y0: 4, x1: 20, y1: 14 } }]);
  assert.deepEqual(result.pages[0].rasterToPdfTransform.map((value) => Object.is(value, -0) ? 0 : value), [0.5, 0, 0, -0.5, 0, 50]);
  assert.equal(result.pages[0].hasMeaningfulText, false);
  await service.dispose();
}

{
  const languages = [];
  const ocr = ocrHarness(async (_image, options) => { languages.push(options.language); return { text: options.language }; });
  const service = createPdfOcrService({
    rendererFactory: async () => rendererHarness({ pageCount: 1 }).renderer,
    ocrService: ocr.service,
    canvasFactory: () => canvasHarness([]),
  });
  for (const language of ["eng", "kor", "eng+kor"]) {
    const result = await service.recognizeDocument({ sourceBytes: new ArrayBuffer(1), language });
    assert.equal(result.pages[0].text, language);
  }
  assert.deepEqual(languages, ["eng", "kor", "eng+kor"]);
  await service.dispose();
}

{
  let savedProgress = null;
  let recognitionAttempts = 0;
  const emitted = [];
  const appended = [];
  const ocr = ocrHarness((_image, options) => {
    recognitionAttempts += 1;
    if (recognitionAttempts > 1) return Promise.resolve({ text: "replacement" });
    return new Promise((_resolve, reject) => {
      savedProgress = options.onProgress;
      options.signal.addEventListener("abort", () => reject(codedError("OCR_CANCELLED")), { once: true });
    });
  });
  const service = createPdfOcrService({
    rendererFactory: async () => rendererHarness({ pageCount: 2 }).renderer,
    ocrService: ocr.service,
    canvasFactory: () => canvasHarness([]),
  });
  const task = service.recognizeDocument({
    sourceBytes: new ArrayBuffer(2), language: "eng",
    onProgress(value) { emitted.push(value); },
    onPageResult(value) { appended.push(value); },
  });
  await waitTurn();
  assert.equal(await service.cancel(), true);
  await assert.rejects(task, (error) => error.code === "PDF_OCR_CANCELLED");
  const countAfterCancel = emitted.length;
  savedProgress?.({ stage: "recognizing", progress: 1 });
  assert.equal(emitted.length, countAfterCancel, "stale progress is rejected after cancellation");
  assert.deepEqual(appended, [], "no stale page result is appended");

  const replacementResult = await service.recognizeDocument({
    sourceBytes: Uint8Array.of(9).buffer,
    language: "eng",
    selection: { mode: "selected", pageNumbers: [2] },
  });
  assert.equal(replacementResult.pages[0].text, "replacement", "a replacement source can start cleanly");
  await service.dispose();
}

{
  const renderer = rendererHarness({ pageCount: 1, blockRender: true });
  const ocr = ocrHarness();
  const service = createPdfOcrService({
    rendererFactory: async () => renderer.renderer,
    ocrService: ocr.service,
    canvasFactory: () => canvasHarness(renderer.events),
  });
  const task = service.recognizeDocument({ sourceBytes: new ArrayBuffer(1), language: "eng" });
  await waitTurn();
  const started = performance.now();
  assert.equal(await service.cancel(), true);
  assert.ok(performance.now() - started < 1_000, "render cancellation is responsive");
  await assert.rejects(task, (error) => error.code === "PDF_OCR_CANCELLED");
  assert.equal(renderer.events.filter((event) => event === "destroy").length, 1, "render cancellation destroys once");
  await service.dispose();
}

{
  let attempts = 0;
  const ocr = ocrHarness(async () => {
    attempts += 1;
    if (attempts === 1) throw codedError("OCR_RECOGNITION_FAILED");
    return { text: "retry succeeded" };
  });
  const service = createPdfOcrService({
    rendererFactory: async () => rendererHarness({ pageCount: 1 }).renderer,
    ocrService: ocr.service,
    canvasFactory: () => canvasHarness([]),
  });
  await assert.rejects(service.recognizeDocument({ sourceBytes: new ArrayBuffer(1), language: "eng" }), (error) => error.code === "PDF_OCR_FAILED");
  assert.equal((await service.recognizeDocument({ sourceBytes: new ArrayBuffer(1), language: "eng" })).pages[0].text, "retry succeeded");
  await service.dispose();
  await assert.rejects(service.recognizeDocument({ sourceBytes: new ArrayBuffer(1), language: "eng" }), (error) => error.code === "PDF_OCR_DISPOSED");
}

{
  const renderer = rendererHarness({ loadError: new Error("FormatError: Invalid PDF structure") });
  const ocr = ocrHarness();
  const service = createPdfOcrService({ rendererFactory: async () => renderer.renderer, ocrService: ocr.service, canvasFactory: () => canvasHarness([]) });
  await assert.rejects(service.recognizeDocument({ sourceBytes: new ArrayBuffer(1), language: "eng" }), (error) => error.code === "UNREADABLE_PDF");
  assert.equal(renderer.events.filter((event) => event === "destroy").length, 1);
  await service.dispose();
}

{
  const renderer = rendererHarness({ pageCount: PDF_OCR_LARGE_DOCUMENT_THRESHOLD });
  const ocr = ocrHarness();
  const service = createPdfOcrService({ rendererFactory: async () => renderer.renderer, ocrService: ocr.service, canvasFactory: () => canvasHarness([]) });
  const result = await service.recognizeDocument({
    sourceBytes: new ArrayBuffer(1), language: "eng", selection: { mode: "selected", pageNumbers: [1] },
  });
  assert.equal(result.largeDocument, true, "large documents surface a warning signal without an arbitrary hard limit");
  await service.dispose();
}

const source = read("tools/shared/pdf-ocr.ts");
assert.match(source, /for \(let index = 0; index < selectedPageNumbers\.length; index \+= 1\)/, "pages process sequentially");
assert.match(source, /page\.cleanup\(\);[\s\S]*canvas\.width = 1;[\s\S]*canvas\.height = 1;/);
assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|https?:\/\//);
assert.doesNotMatch(source, /createObjectURL|revokeObjectURL/);
assert.doesNotMatch(source, /\bany\b|sourceMappingURL/);
assert.match(read("docs/pdf-ocr-foundation.md"), /layout-aware contract/);
assert.match(read("tests/browser/pdf-ocr-smoke.html"), /connect-src 'none'/);
assert.match(read("tests/browser/pdf-ocr-smoke.js"), /externalRequests/);

console.log("PDF OCR page selection, typed progress, sequential rendering, cancellation, stale-result, retry, and cleanup checks passed.");

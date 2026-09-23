import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OCR_ASSET_PATHS,
  OCR_LANGUAGES,
  createOcrService,
  normalizeOcrProgress,
  prepareImageForOcr,
  resolveOcrLanguage,
} from "../tools/shared/ocr.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

assert.equal(resolveOcrLanguage("eng"), OCR_LANGUAGES.ENGLISH);
assert.equal(resolveOcrLanguage("kor"), OCR_LANGUAGES.KOREAN);
assert.equal(resolveOcrLanguage("eng+kor"), OCR_LANGUAGES.KOREAN_ENGLISH);
assert.throws(() => resolveOcrLanguage("fra"), (error) => error.code === "OCR_LANGUAGE_UNSUPPORTED");

assert.deepEqual(normalizeOcrProgress({ status: "loading tesseract core", progress: 0.25 }), { stage: "loading-engine", progress: 0.25 });
assert.deepEqual(normalizeOcrProgress({ status: "loading language traineddata", progress: 2 }), { stage: "loading-language", progress: 1 });
assert.deepEqual(normalizeOcrProgress({ status: "initializing api", progress: -1 }), { stage: "initializing", progress: 0 });
assert.deepEqual(normalizeOcrProgress({ status: "recognizing text" }), { stage: "recognizing", progress: null });
assert.equal(normalizeOcrProgress({ status: "unknown upstream status", progress: 0.5 }), null);
assert.equal(normalizeOcrProgress(null), null);

for (const value of Object.values(OCR_ASSET_PATHS)) {
  assert.match(value, /^file:\/\/\/.+\/assets\/vendor\/tesseract\//);
  assert.doesNotMatch(value, /(?:jsdelivr|unpkg|projectnaptha|github|google)/i);
}

const png = new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0)], { type: "image/png" });
const orientationEvents = [];
const prepared = await prepareImageForOcr(png, {
  async decodeImage() {
    return { source: { oriented: true }, width: 12, height: 7, close() { orientationEvents.push("close"); } };
  },
  documentObject: {
    createElement(tag) {
      assert.equal(tag, "canvas");
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            set fillStyle(value) { orientationEvents.push(["fill", value]); },
            fillRect(...values) { orientationEvents.push(["fillRect", ...values]); },
            drawImage(...values) { orientationEvents.push(["drawImage", ...values]); },
          };
        },
        toBlob(callback, type) { orientationEvents.push(["encode", type]); callback(new Blob(["oriented"], { type })); },
      };
    },
  },
});
assert.equal(prepared.type, "image/png");
assert.deepEqual(orientationEvents.at(-1), "close");
assert.equal(orientationEvents.find((event) => Array.isArray(event) && event[0] === "drawImage")[1].oriented, true);

function workerHarness() {
  const workers = [];
  const calls = [];
  async function createWorker(language, oem, options) {
    const worker = {
      language,
      terminated: 0,
      async recognize(image) { calls.push(["recognize", language, image]); return { data: { text: `${language} text` } }; },
      async terminate() { this.terminated += 1; calls.push(["terminate", language]); },
    };
    workers.push(worker);
    calls.push(["create", language, oem, options]);
    options.logger({ status: "loading language traineddata", progress: 0.5 });
    return worker;
  }
  return { workers, calls, createWorker };
}

const harness = workerHarness();
const progress = [];
const service = createOcrService({ createWorker: harness.createWorker, prepareImage: async (image) => image });
assert.deepEqual(await service.recognizeImage(png, { language: "eng", onProgress: (value) => progress.push(value) }), { text: "eng text" });
assert.deepEqual(await service.recognizeImage(png, { language: "eng" }), { text: "eng text" });
assert.equal(harness.workers.length, 1, "same-language recognition reuses the worker");
assert.equal(harness.workers[0].terminated, 0);
assert.deepEqual(await service.recognizeImage(png, { language: "kor" }), { text: "kor text" });
assert.equal(harness.workers.length, 2, "language changes recreate the worker");
assert.equal(harness.workers[0].terminated, 1);
assert.ok(progress.some((value) => value.stage === "loading-engine" && value.progress === null));
assert.ok(progress.some((value) => value.stage === "loading-language" && value.progress === 0.5));
assert.deepEqual(progress.at(-1), { stage: "complete", progress: 1 });
const staleLogger = harness.calls.find((call) => call[0] === "create")[3].logger;
const progressCount = progress.length;
staleLogger({ status: "recognizing text", progress: 0.9 });
assert.equal(progress.length, progressCount, "completed operations do not retain progress callbacks");
await service.dispose();
assert.equal(harness.workers[1].terminated, 1);
await service.dispose();
assert.equal(harness.workers[1].terminated, 1, "dispose is idempotent");
await assert.rejects(service.recognizeImage(png, { language: "eng" }), (error) => error.code === "OCR_DISPOSED");

const initFailure = createOcrService({
  createWorker: async () => { throw new Error("local worker unavailable"); },
  prepareImage: async (image) => image,
});
await assert.rejects(initFailure.recognizeImage(png, { language: "eng" }), (error) => error.code === "OCR_INITIALIZATION_FAILED" && error.cause.message === "local worker unavailable");

let resolveInitialization;
let initializationCancellationTerminations = 0;
const initializationCancellation = createOcrService({
  createWorker: () => new Promise((resolve) => {
    resolveInitialization = () => resolve({
      async recognize() { return { data: { text: "unused" } }; },
      async terminate() { initializationCancellationTerminations += 1; },
    });
  }),
  prepareImage: async (image) => image,
});
const initializationController = new AbortController();
const cancelledInitialization = initializationCancellation.recognizeImage(png, { language: "eng", signal: initializationController.signal });
await new Promise((resolve) => setImmediate(resolve));
initializationController.abort();
resolveInitialization();
await assert.rejects(cancelledInitialization, (error) => error.code === "OCR_CANCELLED");
assert.equal(initializationCancellationTerminations, 1, "initialization cancellation terminates the worker before returning");

let failedWorkerTerminations = 0;
const recognizeFailure = createOcrService({
  createWorker: async () => ({
    async recognize() { throw new Error("recognition failed"); },
    async terminate() { failedWorkerTerminations += 1; },
  }),
  prepareImage: async (image) => image,
});
await assert.rejects(recognizeFailure.recognizeImage(png, { language: "eng" }), (error) => error.code === "OCR_RECOGNITION_FAILED");
assert.equal(failedWorkerTerminations, 1, "recognition failures discard the worker");

let releaseRecognition;
let cancellationTerminations = 0;
let cancellationWorkers = 0;
const cancellation = createOcrService({
  createWorker: async () => {
    cancellationWorkers += 1;
    return ({
    recognize() {
      if (cancellationWorkers > 1) return Promise.resolve({ data: { text: "recovered" } });
      return new Promise((resolve) => { releaseRecognition = resolve; });
    },
    async terminate() { cancellationTerminations += 1; },
  });
  },
  prepareImage: async (image) => image,
});
const controller = new AbortController();
const cancelled = cancellation.recognizeImage(png, { language: "eng", signal: controller.signal });
await new Promise((resolve) => setImmediate(resolve));
controller.abort();
await assert.rejects(cancelled, (error) => error.code === "OCR_CANCELLED");
assert.equal(cancellationTerminations, 1, "cancellation terminates active computation");
releaseRecognition({ data: { text: "late result" } });
assert.deepEqual(await cancellation.recognizeImage(png, { language: "eng" }), { text: "recovered" }, "a cancelled worker is recreated for later work");
await cancellation.dispose();

let disposeTerminations = 0;
const disposeDuringRecognition = createOcrService({
  createWorker: async () => ({
    recognize() { return new Promise(() => {}); },
    async terminate() { disposeTerminations += 1; },
  }),
  prepareImage: async (image) => image,
});
const interruptedByDispose = disposeDuringRecognition.recognizeImage(png, { language: "eng" });
await new Promise((resolve) => setImmediate(resolve));
await disposeDuringRecognition.dispose();
await assert.rejects(interruptedByDispose, (error) => error.code === "OCR_DISPOSED");
assert.equal(disposeTerminations, 1, "disposing rejects active recognition and terminates its worker");

const manifest = JSON.parse(read("assets/vendor/tesseract/manifest.json"));
assert.deepEqual(manifest.packages, {
  "@tesseract.js-data/eng": "1.0.0",
  "@tesseract.js-data/kor": "1.0.0",
  "tesseract.js": "7.0.0",
  "tesseract.js-core": "7.0.0",
});
for (const [relative, expected] of Object.entries(manifest.assets)) {
  const bytes = fs.readFileSync(path.join(root, "assets/vendor/tesseract", relative));
  assert.equal(bytes.length, expected.bytes, relative);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, relative);
}
function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(target) : [path.relative(path.join(root, "assets/vendor/tesseract"), target).replaceAll("\\", "/")];
  });
}
assert.deepEqual(
  listFiles(path.join(root, "assets/vendor/tesseract")).sort(),
  [...Object.keys(manifest.assets), "README.md", "manifest.json"].sort(),
  "OCR vendor inventory contains only documented prepared assets",
);
function listAbsoluteFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listAbsoluteFiles(target) : [target];
  });
}
const publicOcrReferences = listAbsoluteFiles(path.join(root, "tools"))
  .filter((file) => file.endsWith(".html"))
  .map((file) => path.relative(root, file).replaceAll("\\", "/"))
  .filter((relative) => read(relative).includes("assets/vendor/tesseract"));
assert.deepEqual(publicOcrReferences, ["tools/image/to-text/index.html"], "OCR runtime must stay lazy to its public route");
for (const required of ["engine/tesseract.min.js", "worker/worker.min.js", "lang/eng.traineddata.gz", "lang/kor.traineddata.gz"]) {
  assert.ok(manifest.assets[required], `missing ${required}`);
}
assert.equal(Object.keys(manifest.assets).filter((name) => name.startsWith("core/tesseract-core")).length, 18);
assert.doesNotMatch(read("tools/shared/ocr.js"), /https?:\/\/|(?:jsdelivr|unpkg|projectnaptha|github|google)/i);

console.log("OCR language, progress, orientation, lifecycle, cancellation, local-asset, and privacy checks passed.");

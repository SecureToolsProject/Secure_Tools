import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createImageToTextController, defaultOcrLanguage, OCR_UI_STATES } from "../tools/image/to-text/controller.js";
import { copyText, createTextBlob, downloadText, textFilename } from "../tools/image/to-text/output.js";
import { preparePreviewSource, releasePreviewSource } from "../tools/image/to-text/preview.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const cancellationError = () => Object.assign(new Error("OCR_CANCELLED"), { code: "OCR_CANCELLED" });

assert.equal(defaultOcrLanguage("ko"), "eng+kor");
assert.equal(defaultOcrLanguage("ko-KR"), "eng+kor");
for (const language of ["en", "ja", "es", "de", "fr", ""]) assert.equal(defaultOcrLanguage(language), "eng");
assert.equal(textFilename("영수증.사진.png"), "영수증.사진.txt");
assert.equal(textFilename("bad:name.webp"), "bad_name.txt");
assert.equal(textFilename(".png"), "recognized-text.txt");
const unicodeBlob = createTextBlob("English 한국어 日本語");
assert.equal(unicodeBlob.type, "text/plain;charset=utf-8");
assert.equal(await unicodeBlob.text(), "English 한국어 日本語");

let copied = "";
await copyText("corrected text", { navigatorObject: { clipboard: { async writeText(value) { copied = value; } } } });
assert.equal(copied, "corrected text");
const downloadCalls = [];
downloadText("한글", "scan.jpeg", {
  documentObject: { body: { append() {} }, createElement() { return { click() { downloadCalls.push([this.download, this.href]); }, remove() {} }; } },
  urlObject: { createObjectURL(blob) { assert.equal(blob.type, "text/plain;charset=utf-8"); return "blob:txt"; }, revokeObjectURL(value) { downloadCalls.push(["revoke", value]); } },
  schedule(callback) { callback(); },
});
assert.deepEqual(downloadCalls, [["scan.txt", "blob:txt"], ["revoke", "blob:txt"]]);

const previewUrls = [];
const previewFile = new Blob(["image"], { type: "image/png" });
Object.defineProperty(previewFile, "name", { value: "oriented.png" });
const preview = await preparePreviewSource(previewFile, { prepareImage: async () => new Blob(["oriented"], { type: "image/png" }), urlObject: { createObjectURL() { previewUrls.push("blob:preview"); return "blob:preview"; } } });
assert.equal(preview.file, previewFile);
assert.equal(preview.previewUrl, "blob:preview");
releasePreviewSource(preview, { urlObject: { revokeObjectURL(value) { previewUrls.push(`revoked:${value}`); } } });
assert.deepEqual(previewUrls, ["blob:preview", "revoked:blob:preview"]);

const file = (name) => ({ name, size: 10, type: "image/png" });
const releases = [];
const calls = [];
const requests = [];
const controller = createImageToTextController({
  language: "eng",
  prepareSource: async (candidate) => ({ file: candidate, previewUrl: `blob:${candidate.name}`, previewType: candidate.type }),
  releaseSource(source) { releases.push(source.file.name); },
  recognizeImage(candidate, options) {
    const job = deferred();
    const request = { candidate, options, job };
    requests.push(request);
    options.signal.addEventListener("abort", () => job.reject(cancellationError()), { once: true });
    return job.promise;
  },
  onChange(state) { calls.push(state); },
});

await controller.select(file("first.png"));
assert.equal(controller.snapshot().phase, OCR_UI_STATES.READY);
const firstRecognition = controller.recognize();
assert.equal(controller.snapshot().phase, OCR_UI_STATES.RECOGNIZING);
requests[0].options.onProgress({ stage: "recognizing", progress: 0.42 });
assert.deepEqual(controller.snapshot().progress, { stage: "recognizing", progress: 0.42 });
requests[0].job.resolve({ text: "first result" });
await firstRecognition;
assert.equal(controller.snapshot().phase, OCR_UI_STATES.SUCCESS);
assert.equal(controller.snapshot().text, "first result");
controller.updateText("edited result");
assert.equal(controller.snapshot().text, "edited result");
requests[0].options.onProgress({ stage: "recognizing", progress: 0.99 });
assert.equal(controller.snapshot().progress, null, "late progress after completion is ignored");

await controller.setLanguage("kor");
assert.equal(controller.snapshot().phase, OCR_UI_STATES.READY);
assert.equal(controller.snapshot().text, "", "language changes clear stale output");
const cancelledRecognition = controller.recognize();
const cancelling = controller.cancel();
await cancelling;
await cancelledRecognition;
assert.equal(controller.snapshot().phase, OCR_UI_STATES.CANCELLED);
requests[1].options.onProgress({ stage: "recognizing", progress: 1 });
assert.equal(controller.snapshot().phase, OCR_UI_STATES.CANCELLED, "callbacks after cancellation are ignored");

const restarted = controller.recognize();
requests[2].job.resolve({ text: "restarted" });
await restarted;
assert.equal(controller.snapshot().text, "restarted", "start-cancel-start produces only the newest result");

const replacing = controller.recognize();
const replacement = controller.select(file("second.png"));
await replacing;
await replacement;
requests[3].options.onProgress({ stage: "recognizing", progress: 0.8 });
assert.equal(controller.snapshot().source.file.name, "second.png");
assert.equal(controller.snapshot().phase, OCR_UI_STATES.READY, "callbacks after source replacement are ignored");
assert.deepEqual(releases, ["first.png"]);

const languageChangeRecognition = controller.recognize();
const languageChange = controller.setLanguage("eng+kor");
await languageChangeRecognition;
await languageChange;
requests[4].options.onProgress({ stage: "recognizing", progress: 0.7 });
assert.equal(controller.snapshot().language, "eng+kor");
assert.equal(controller.snapshot().phase, OCR_UI_STATES.READY, "callbacks after language change are ignored");

const failed = controller.recognize();
requests[5].job.reject(Object.assign(new Error("failed"), { code: "OCR_RECOGNITION_FAILED" }));
await failed;
assert.equal(controller.snapshot().phase, OCR_UI_STATES.ERROR);
const retried = controller.recognize();
requests[6].job.resolve({ text: "recovered" });
await retried;
assert.equal(controller.snapshot().text, "recovered");
await controller.remove();
assert.equal(controller.snapshot().phase, OCR_UI_STATES.EMPTY);
assert.deepEqual(releases, ["first.png", "second.png"]);
await controller.dispose();

const html = read("tools/image/to-text/index.html");
const app = read("tools/image/to-text/app.js");
const css = read("tools/image/to-text/tool.css");
const category = read("tools/image/index.html");
assert.match(html, /type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp,[^"]+"[^>]*aria-describedby="drop-description"/);
assert.doesNotMatch(html, /type="file"[^>]*multiple/);
assert.match(html, /assets\/vendor\/tesseract\/engine\/tesseract\.min\.js/);
assert.match(html, /id="result-text"[^>]*spellcheck="true"/);
assert.match(html, /id="ocr-progress"[^>]*max="1"[^>]*hidden/);
assert.match(html, /connect-src 'none'/);
assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/);
assert.match(app, /securetools:languagechange/);
assert.match(app, /pagehide/);
assert.match(app, /removeAttribute\("value"\)/, "unknown progress remains indeterminate");
assert.match(css, /\.ocr-source\[hidden\][^{]*[\s\S]*\.button\[hidden\][^{]*\{\s*display:\s*none/, "component display rules must preserve hidden states");
assert.doesNotMatch(app, /fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
assert.match(category, /href="\.\/to-text\/"/);
for (const required of ["empty", "ready", "recognizing", "success", "error", "cancelled"]) assert.ok(Object.values(OCR_UI_STATES).includes(required));
assert.ok(calls.length > 10, "state changes remain observable for the UI");

console.log("Image to Text workflow, stale-callback safety, localization hooks, preview cleanup, copy, and UTF-8 download checks passed.");

import { createPdfToTextController } from "/pdf/to-text/controller.js";
import { copyText, downloadPdfText, formatPdfOcrText } from "/pdf/to-text/output.js";
import { translations } from "/js/i18n.js";

const status = document.querySelector("#status");
const results = document.querySelector("#results");
const checks = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
const file = (name) => new File(["%PDF-1.7"], name, { type: "application/pdf" });
const show = () => { results.replaceChildren(...checks.map((message) => Object.assign(document.createElement("li"), { textContent: message }))); };

try {
  const happy = createPdfToTextController({
    inspect: async () => ({ pageCount: 2 }),
    service: {
      async recognizeDocument(request) {
        const pages = [{ pageNumber: 1, text: "first" }, { pageNumber: 2, text: "second" }];
        pages.forEach((page, index) => { request.onProgress?.({ phase: "recognizing-page", pageNumber: page.pageNumber, pageIndex: index + 1, pageCount: 2, documentPageCount: 2, pageProgress: 1, overallProgress: (index + 1) / 2, ocrStage: "recognizing" }); request.onPageResult?.(page); });
        return { pageCount: 2, selectedPageNumbers: [1, 2], pages, largeDocument: false };
      }, async cancel() { return false; }, async dispose() {},
    },
  });
  await happy.select(file("multi.pdf")); await happy.recognize("eng", { mode: "all" });
  assert(happy.getState().phase === "success", "happy path reaches success");
  assert(happy.getState().pages.map(({ pageNumber }) => pageNumber).join(",") === "1,2", "multi-page order is preserved");

  let release;
  const cancelled = createPdfToTextController({ inspect: async () => ({ pageCount: 1 }), service: {
    async recognizeDocument() { await new Promise((resolve) => { release = resolve; }); throw Object.assign(new Error("cancelled"), { code: "PDF_OCR_CANCELLED" }); },
    async cancel() { release?.(); return true; }, async dispose() {},
  } });
  await cancelled.select(file("cancel.pdf")); const job = cancelled.recognize("eng", { mode: "all" }); await cancelled.cancel(); await job;
  assert(cancelled.getState().phase === "cancelled" && cancelled.getState().pages.length === 0, "cancellation suppresses stale results");

  let attempts = 0;
  const retry = createPdfToTextController({ inspect: async () => ({ pageCount: 1 }), service: {
    async recognizeDocument() { attempts += 1; if (attempts === 1) throw Object.assign(new Error("failed"), { code: "PDF_OCR_FAILED" }); return { pages: [{ pageNumber: 1, text: "recovered" }] }; },
    async cancel() { return false; }, async dispose() {},
  } });
  await retry.select(file("retry.pdf")); await retry.recognize("eng", { mode: "all" }); await retry.recognize("eng", { mode: "all" });
  assert(retry.getState().phase === "success", "retry recovers after a controlled failure");

  let releaseOld;
  const replacement = createPdfToTextController({ service: { async recognizeDocument() {}, async cancel() { return false; }, async dispose() {} }, inspect: async (source) => source.name === "old.pdf" ? new Promise((resolve) => { releaseOld = () => resolve({ pageCount: 9 }); }) : { pageCount: 2 } });
  const oldJob = replacement.select(file("old.pdf")); await replacement.select(file("new.pdf")); releaseOld(); await oldJob;
  assert(replacement.getState().source.file.name === "new.pdf", "source replacement rejects stale preparation");

  let clipboard = "";
  const text = formatPdfOcrText(happy.getState().pages);
  await copyText(text, { navigatorObject: { clipboard: { writeText: async (value) => { clipboard = value; } } } });
  assert(clipboard.includes("--- Page 1 ---") && clipboard.includes("--- Page 2 ---"), "copy-all preserves page boundaries");
  let blob; const anchor = { click() { this.clicked = true; }, remove() {} };
  downloadPdfText(happy.getState().pages, "multi.pdf", { documentObject: { body: { append() {} }, createElement: () => anchor }, urlObject: { createObjectURL(value) { blob = value; return "blob:test"; }, revokeObjectURL() {} }, schedule() {} });
  assert(anchor.download === "multi.txt" && (await blob.text()) === text, "TXT export preserves filename and UTF-8 content");
  assert(["en", "ko", "ja", "es", "de", "fr"].every((language) => translations[language].pdfToText.title && translations[language].pdfToText.result.copyAll), "all six locale catalogs load without raw keys");
  show(); status.textContent = `${checks.length} browser checks passed.`; document.body.dataset.state = "passed";
} catch (error) {
  status.textContent = error instanceof Error ? error.message : String(error); document.body.dataset.state = "failed"; console.error(error);
}

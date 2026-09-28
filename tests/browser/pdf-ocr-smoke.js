import { createPdfOcrService } from "/shared/pdf-ocr.js";

const output = document.querySelector("#result");
const requestsBefore = performance.getEntriesByType("resource").map((entry) => entry.name);

async function createPdf(labels, dimensions = [612, 792]) {
  const document = await window.PDFLib.PDFDocument.create();
  const font = await document.embedFont(window.PDFLib.StandardFonts.HelveticaBold);
  for (const label of labels) {
    const page = document.addPage(dimensions);
    page.drawText(label, { x: 90, y: dimensions[1] / 2, size: 88, font, color: window.PDFLib.rgb(0, 0, 0) });
  }
  const bytes = await document.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function runRealOcr() {
  const service = createPdfOcrService();
  const started = performance.now();
  try {
    const result = await service.recognizeDocument({ sourceBytes: await createPdf(["HELLO"]), language: "eng" });
    if (result.pages.length !== 1 || result.pages[0].pageNumber !== 1 || !/HELLO/i.test(result.pages[0].text)) {
      throw new Error(`Unexpected PDF OCR result: ${JSON.stringify(result.pages)}`);
    }
    return { milliseconds: Math.round(performance.now() - started), text: result.pages[0].text.trim() };
  } finally {
    await service.dispose();
  }
}

async function runRenderingSanity(labels, dimensions) {
  let calls = 0;
  const service = createPdfOcrService({
    ocrService: {
      async recognizeImage(image, options) {
        calls += 1;
        if (image.type !== "image/png") throw new Error(`Unexpected rendered type: ${image.type}`);
        options.onProgress?.({ stage: "recognizing", progress: 1 });
        return { text: `page ${calls}` };
      },
      async dispose() {},
    },
  });
  const started = performance.now();
  try {
    const result = await service.recognizeDocument({ sourceBytes: await createPdf(labels, dimensions), language: "eng" });
    if (result.pages.length !== labels.length) throw new Error(`Expected ${labels.length} pages, received ${result.pages.length}`);
    return { milliseconds: Math.round(performance.now() - started), pages: result.pages.length };
  } finally {
    await service.dispose();
  }
}

async function runCancellationSanity() {
  let recognizing;
  const reachedRecognition = new Promise((resolve) => { recognizing = resolve; });
  const service = createPdfOcrService({
    ocrService: {
      recognizeImage(_image, options) {
        recognizing();
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(Object.assign(new Error("OCR_CANCELLED"), { code: "OCR_CANCELLED" })), { once: true });
        });
      },
      async dispose() {},
    },
  });
  const task = service.recognizeDocument({ sourceBytes: await createPdf(["CANCEL"]), language: "eng" });
  await reachedRecognition;
  const started = performance.now();
  await service.cancel();
  let code = null;
  try { await task; } catch (error) { code = error.code; }
  await service.dispose();
  if (code !== "PDF_OCR_CANCELLED") throw new Error(`Unexpected cancellation result: ${code}`);
  return { milliseconds: Math.round(performance.now() - started) };
}

try {
  const onePage = await runRealOcr();
  const multiPage = await runRenderingSanity(["ONE", "TWO", "THREE"], [612, 792]);
  const largerPage = await runRenderingSanity(["LARGE"], [900, 1200]);
  const cancellation = await runCancellationSanity();
  const requests = performance.getEntriesByType("resource").map((entry) => entry.name).slice(requestsBefore.length);
  const externalRequests = requests.filter((value) => new URL(value).origin !== location.origin);
  if (externalRequests.length) throw new Error(`External requests: ${externalRequests.join(", ")}`);
  window.__pdfOcrSmokeResult = { ok: true, onePage, multiPage, largerPage, cancellation, requests, externalRequests };
  output.textContent = `PASS: PDF OCR — ${onePage.text} | 1 page ${onePage.milliseconds} ms | 3 pages ${multiPage.milliseconds} ms | large page ${largerPage.milliseconds} ms | cancel ${cancellation.milliseconds} ms`;
} catch (error) {
  window.__pdfOcrSmokeResult = { ok: false, error: error.message, cause: error.cause?.message || null };
  output.textContent = `FAIL: ${error.message}`;
  throw error;
}

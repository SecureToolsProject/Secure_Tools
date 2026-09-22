import { createOcrService } from "../../tools/shared/ocr.js";

const output = document.querySelector("#result");
const requestsBefore = performance.getEntriesByType("resource").map((entry) => entry.name);
const canvas = document.createElement("canvas");
canvas.width = 720;
canvas.height = 220;
const context = canvas.getContext("2d", { alpha: false });
context.fillStyle = "#ffffff";
context.fillRect(0, 0, canvas.width, canvas.height);
context.fillStyle = "#000000";
context.font = "bold 96px sans-serif";
context.fillText("HELLO", 120, 145);

const image = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
const service = createOcrService();
try {
  const result = await service.recognizeImage(image, { language: "eng" });
  const requests = performance.getEntriesByType("resource").map((entry) => entry.name).slice(requestsBefore.length);
  const externalRequests = requests.filter((value) => new URL(value).origin !== location.origin);
  if (!/HELLO/i.test(result.text)) throw new Error(`Unexpected OCR text: ${result.text}`);
  if (externalRequests.length) throw new Error(`External requests: ${externalRequests.join(", ")}`);
  window.__ocrSmokeResult = { ok: true, text: result.text.trim(), requests, externalRequests };
  output.textContent = `PASS: ${result.text.trim()}`;
} catch (error) {
  window.__ocrSmokeResult = { ok: false, error: error.message, cause: error.cause?.message || null };
  output.textContent = `FAIL: ${error.message}`;
  throw error;
} finally {
  await service.dispose();
  canvas.width = 1;
  canvas.height = 1;
}

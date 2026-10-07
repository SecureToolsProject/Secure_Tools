import { createOcrService } from "/shared/ocr.js";

const output = document.querySelector("#result");
const requestsBefore = performance.getEntriesByType("resource").map((entry) => entry.name);

async function verifyCategoryAvailability() {
  const loadCategory = async (pathname) => {
    const response = await fetch(pathname);
    if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}`);
    return new DOMParser().parseFromString(await response.text(), "text/html");
  };
  const findOcrCard = (documentObject) => documentObject
    .querySelector('[data-i18n="tools.imageToText"]')
    ?.closest("a.category-tool");
  const cardPath = (card, categoryPath) => new URL(card.getAttribute("href"), new URL(categoryPath, location.origin)).pathname;

  const [imageDocument, scanDocument] = await Promise.all([
    loadCategory("/image/"),
    loadCategory("/scan/"),
  ]);
  const imageCard = findOcrCard(imageDocument);
  const scanCard = findOcrCard(scanDocument);
  if (!imageCard || !scanCard) throw new Error("Image to Text must be linked from both categories");
  if (!imageCard.querySelector(".status--available") || !scanCard.querySelector(".status--available")) {
    throw new Error("Image to Text must be available in both categories");
  }
  const imagePath = cardPath(imageCard, "/image/");
  const scanPath = cardPath(scanCard, "/scan/");
  if (imagePath !== "/image/to-text/" || scanPath !== imagePath) {
    throw new Error(`Category routes differ: ${imagePath}, ${scanPath}`);
  }
  const routeResponse = await fetch(scanPath);
  if (!routeResponse.ok) throw new Error(`${scanPath} returned HTTP ${routeResponse.status}`);
  const disabledControl = scanDocument.querySelector('[data-i18n="categories.scan.documentTitle"]')?.closest("article.category-tool");
  if (!disabledControl?.querySelector('[data-i18n="tools.comingSoon"]')) {
    throw new Error("Document Scanner must remain disabled");
  }
  return { imagePath, scanPath, disabledControl: true };
}

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
  const categoryAvailability = await verifyCategoryAvailability();
  const result = await service.recognizeImage(image, { language: "eng" });
  const requests = performance.getEntriesByType("resource").map((entry) => entry.name).slice(requestsBefore.length);
  const externalRequests = requests.filter((value) => new URL(value).origin !== location.origin);
  if (!/HELLO/i.test(result.text)) throw new Error(`Unexpected OCR text: ${result.text}`);
  if (externalRequests.length) throw new Error(`External requests: ${externalRequests.join(", ")}`);
  window.__ocrSmokeResult = { ok: true, text: result.text.trim(), requests, externalRequests, categoryAvailability };
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

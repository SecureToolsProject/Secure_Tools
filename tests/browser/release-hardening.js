import * as pdfjs from "/assets/vendor/pdfjs/pdf.min.mjs";
import { createPdfOcrService } from "/shared/pdf-ocr.js";
import { createSearchablePdf } from "/shared/searchable-pdf.js";
import { downloadBlob } from "/shared/save.js";

pdfjs.GlobalWorkerOptions.workerSrc = "/assets/vendor/pdfjs/pdf.worker.min.mjs";
const status = document.querySelector("#status");
const report = document.querySelector("#report");
const viewer = document.querySelector("#viewer");
const phrases = ["HELLO SEARCHABLE PDF", "검색 가능한 PDF", "HELLO 검색 PDF"];
const font = Uint8Array.from(atob(window.SecureToolsSearchablePdfFont), (c) => c.charCodeAt(0));
let output = null;
let source = null;
let loadingTask = null;
let searchRanges = [];
const evidence = { phrases, rotations: [0, 90, 180, 270], timings: [], extracts: [], preservation: [], downloadsRequested: 0, externalRequests: [], errors: [] };
const buffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
function assert(value, label) { if (!value) throw new Error(label); }
function show() { report.textContent = JSON.stringify(evidence, null, 2); }
const load = (bytes) => pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useWorkerFetch: false, useWasm: false });
async function renderPage(page, scale = 1) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport, background: "#ffffff" }).promise;
  return { canvas, viewport };
}
async function scanFixture() {
  // Draw source scans independently of the PDF text-layer writer/font subsetter.
  // This prevents the fixture from hiding a writer defect behind its own raster.
  const canvas = document.createElement("canvas"); canvas.width = 960; canvas.height = 640;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "white"; ctx.fillRect(0, 0, 960, 640);
  ctx.fillStyle = "black"; ctx.font = '50px "Malgun Gothic", Arial, sans-serif';
  phrases.forEach((text, index) => ctx.fillText(text, 80, 160 + index * 130));
  const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const fixturePdf = await window.PDFLib.PDFDocument.create(); fixturePdf.setTitle("v2.2 deterministic scan fixture"); fixturePdf.setAuthor("Secure Tools QA"); fixturePdf.setCreationDate(new Date("2026-01-01T00:00:00Z")); fixturePdf.setModificationDate(new Date("2026-01-01T00:00:00Z"));
  const image = await fixturePdf.embedPng(await png.arrayBuffer());
  for (const rotation of evidence.rotations) {
    const rotated = rotation % 180 !== 0; const p = fixturePdf.addPage(rotated ? [320, 480] : [480, 320]); p.setRotation(window.PDFLib.degrees(rotation));
    const origin = rotation === 90 ? [320, 0] : rotation === 180 ? [480, 320] : rotation === 270 ? [0, 480] : [0, 0];
    p.drawImage(image, { x: origin[0], y: origin[1], width: 480, height: 320, rotate: window.PDFLib.degrees(rotation) });
  }
  const existing = fixturePdf.addPage([480, 320]); existing.drawText("EXISTING TEXT", { x: 40, y: 240, size: 25 });
  const untouched = fixturePdf.addPage([480, 320]); untouched.drawImage(image, { x: 0, y: 0, width: 480, height: 320 });
  canvas.width = canvas.height = 1;
  return fixturePdf.save();
}
async function renderViewer(bytes) {
  viewer.replaceChildren(); if (loadingTask) await loadingTask.destroy(); loadingTask = load(bytes); const parsed = await loadingTask.promise;
  assert(parsed.numPages === 6, "Page count changed");
  const sourceTask = load(source); const original = await sourceTask.promise;
  for (let number = 1; number <= parsed.numPages; number += 1) {
    const page = await parsed.getPage(number); const content = await page.getTextContent();
    evidence.textGeometry ||= []; evidence.textGeometry.push({ page: number, viewport: page.getViewport({ scale: 1 }).transform, items: content.items.map(({ str, width, height, transform }) => ({ str, width, height, transform })) });
    const text = content.items.map((item) => item.str).join(" ").trim(); evidence.extracts.push({ page: number, rotation: page.rotate, text });
    if (number <= 4) for (const phrase of phrases) assert(text.includes(phrase), `Missing exact phrase on rotated page ${number}: ${text}`);
    if (number === 5) assert(text === "EXISTING TEXT", "Existing text duplicated");
    if (number === 6) assert(text === "", "Unselected page modified");
    const rendered = await renderPage(page); const before = await renderPage(await original.getPage(number));
    const pixels = rendered.canvas.getContext("2d").getImageData(0, 0, rendered.canvas.width, rendered.canvas.height).data;
    const prior = before.canvas.getContext("2d").getImageData(0, 0, before.canvas.width, before.canvas.height).data;
    let changed = 0; let absoluteError = 0; let maximumError = 0;
    for (let index = 0; index < pixels.length; index += 1) { const delta = Math.abs(pixels[index] - prior[index]); if (delta) changed += 1; absoluteError += delta; maximumError = Math.max(maximumError, delta); }
    const identical = pixels.length === prior.length && changed === 0;
    const comparison = { page: number, pixelsIdentical: identical, changedChannelRatio: changed / pixels.length, meanChannelError: absoluteError / pixels.length, maximumError };
    evidence.preservation.push(comparison);
    // PDF.js may choose a different image resampling path once text is appended.
    // Require identical dimensions and tiny whole-page error; inspect highlights
    // visually as well. Original content-stream bytes are tested separately.
    assert(pixels.length === prior.length && comparison.meanChannelError < 1 && comparison.changedChannelRatio < 0.02, `Visible page ${number} changed: ${JSON.stringify(comparison)}`); before.canvas.width = before.canvas.height = 1;
    const title = document.createElement("h2"); title.textContent = `Page ${number} — rotation ${page.rotate}°`;
    const shell = document.createElement("div"); shell.className = "page"; shell.style.width = `${rendered.viewport.width}px`; shell.style.height = `${rendered.viewport.height}px`; shell.style.setProperty("--total-scale-factor", "1");
    const layer = document.createElement("div"); layer.className = "textLayer"; shell.append(rendered.canvas, layer); viewer.append(title, shell);
    await new pdfjs.TextLayer({ textContentSource: content, container: layer, viewport: rendered.viewport }).render(); page.cleanup();
  }
  await sourceTask.destroy();
}
document.querySelector("#generate").addEventListener("click", async () => {
  const button = document.querySelector("#generate"); button.disabled = true;
  const service = createPdfOcrService(); const started = performance.now();
  try {
    evidence.timings = []; evidence.extracts = []; evidence.preservation = []; evidence.textGeometry = []; evidence.errors = []; output = null;
    status.textContent = "Generating raster scan fixtures…"; source = await scanFixture();
    const result = await service.recognizeDocument({ sourceBytes: buffer(source), language: "eng+kor", selection: { mode: "selected", pageNumbers: [1, 2, 3, 4, 5] }, includeLayout: true, inspectExistingText: true, onProgress(value) { status.textContent = `${value.phase}: page ${value.pageIndex}/${value.pageCount}`; } });
    evidence.timings.push({ stage: "OCR", milliseconds: Math.round(performance.now() - started) });
    evidence.ocrGeometry = result.pages.map(({ pageNumber, rasterToPdfTransform, lines }) => ({ pageNumber, rasterToPdfTransform, lines }));
    const buildStarted = performance.now(); output = await createSearchablePdf({ sourceBytes: buffer(source), pages: result.pages, PDFLib: window.PDFLib, fontkit: window.fontkit, fontBytes: buffer(font) });
    evidence.timings.push({ stage: "PDF build", milliseconds: Math.round(performance.now() - buildStarted) });
    evidence.inputBytes = source.length; evidence.outputBytes = output.length;
    const reloaded = await window.PDFLib.PDFDocument.load(output); assert(reloaded.getTitle() === "v2.2 deterministic scan fixture", "Metadata changed");
    await renderViewer(output);
    evidence.externalRequests = performance.getEntriesByType("resource").map((entry) => entry.name).filter((name) => new URL(name).origin !== location.origin);
    evidence.networkGatePassed = evidence.externalRequests.length === 0;
    document.querySelector("#download").disabled = false; document.querySelector("#find").disabled = false; document.querySelector("#select").disabled = false;
    status.textContent = "Correctness passed: real OCR, exact extraction, all rotations, visible-page comparison, selected pages, existing text. Search/select below. " + (evidence.networkGatePassed ? "Network gate passed." : "Network gate unresolved: environment-injected external requests are recorded, not hidden.");
  } catch (error) { evidence.errors.push(error.message); status.textContent = `FAIL: ${error.message}`; console.error(error); }
  finally { await service.dispose(); button.disabled = false; show(); }
});
document.querySelector("#download").addEventListener("click", () => { if (output) { downloadBlob(new Blob([buffer(output)], { type: "application/pdf" }), "hardening-searchable.pdf"); evidence.downloadsRequested += 1; show(); } });
document.querySelector("#find").addEventListener("click", () => {
  const query = document.querySelector("#query").value;
  const spans = [...viewer.querySelectorAll(".textLayer span")]; searchRanges = [];
  for (const span of spans) {
    const text = span.firstChild; if (!query || text?.nodeType !== Node.TEXT_NODE) continue;
    for (let start = span.textContent.indexOf(query); start !== -1; start = span.textContent.indexOf(query, start + query.length)) {
      const range = document.createRange(); range.setStart(text, start); range.setEnd(text, start + query.length); searchRanges.push(range);
    }
  }
  CSS.highlights.set("pdf-search", new Highlight(...searchRanges));
  status.textContent = `Found ${searchRanges.length} matching words for ${query}. Highlights come from PDF.js text-layer placement.`;
});
document.querySelector("#select").addEventListener("click", () => {
  if (!searchRanges.length) return;
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(searchRanges[0]);
  status.textContent = `Selected text: ${selection.toString()}`;
});


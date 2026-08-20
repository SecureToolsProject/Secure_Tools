import { t } from "../../../js/i18n.js";
import { formatBytes, sanitizePdfFilename } from "../../shared/file.js";
import { inspectPdf, isSupportedPdf } from "../../shared/pdf.js";
import { downloadBlob, requestSaveHandle, writeBlobToHandle } from "../../shared/save.js";
import { createConversionPlan, convertPdfToImages, IMAGE_FORMATS } from "./converter.js";

const elements = {
  input: document.querySelector("#file-input"), dropZone: document.querySelector("#drop-zone"),
  sourceEmpty: document.querySelector("#source-empty"), sourceCard: document.querySelector("#source-card"),
  sourceName: document.querySelector("#source-name"), sourceMeta: document.querySelector("#source-meta"), remove: document.querySelector("#remove-source"),
  form: document.querySelector("#conversion-settings"), rangePanel: document.querySelector("#range-panel"), range: document.querySelector("#page-range"), rangeError: document.querySelector("#range-error"),
  filename: document.querySelector("#filename"), format: document.querySelector("#image-format"), qualityField: document.querySelector("#quality-field"),
  quality: document.querySelector("#image-quality"), qualityValue: document.querySelector("#quality-value"), scale: document.querySelector("#render-scale"),
  convert: document.querySelector("#convert-pdf"), cancel: document.querySelector("#cancel-conversion"), clear: document.querySelector("#clear-source"),
  progress: document.querySelector("#conversion-progress"), status: document.querySelector("#tool-status"),
};

const state = { source: null, busy: false, controller: null, job: null, status: null, session: 0 };
const message = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));

function setStatus(key, values = {}, tone = "neutral") {
  state.status = key ? { key, values, tone } : null;
  elements.status.textContent = key ? message(key, values) : "";
  elements.status.dataset.tone = tone;
}

function selectedMode() { return new FormData(elements.form).get("mode") || "all"; }
function sourceBaseName(name) { return sanitizePdfFilename(name, "document").replace(/\.pdf$/i, ""); }

function renderState() {
  const hasSource = Boolean(state.source);
  elements.sourceEmpty.hidden = hasSource;
  elements.sourceCard.hidden = !hasSource;
  elements.convert.disabled = state.busy || !hasSource;
  elements.clear.disabled = state.busy || !hasSource;
  elements.remove.disabled = state.busy;
  elements.cancel.hidden = !state.busy;
  elements.filename.disabled = state.busy || !hasSource;
  for (const input of elements.form.elements) input.disabled = state.busy || (input.dataset.requiresSource === "true" && !hasSource);
  for (const input of [elements.format, elements.quality, elements.scale]) input.disabled = state.busy || !hasSource;
  if (hasSource) {
    elements.sourceName.textContent = state.source.file.name;
    elements.sourceMeta.textContent = message("pdfToImages.source.meta", { size: formatBytes(state.source.file.size), pages: state.source.pageCount });
  }
}

function clearFieldError() { elements.range.removeAttribute("aria-invalid"); elements.rangeError.textContent = ""; }

function updateOptions() {
  const selected = selectedMode() === "selected";
  elements.rangePanel.hidden = !selected;
  elements.range.disabled = state.busy || !state.source || !selected;
  elements.qualityField.hidden = elements.format.value === "png";
  elements.quality.disabled = state.busy || !state.source || elements.format.value === "png";
  elements.qualityValue.value = `${Math.round(Number(elements.quality.value) * 100)}%`;
  clearFieldError();
}

function showFieldError(error) {
  const keys = {
    PAGE_RANGE_REQUIRED: "pdfToImages.errors.rangeRequired", PAGE_RANGE_INVALID: "pdfToImages.errors.rangeInvalid",
    PAGE_OUT_OF_RANGE: "pdfToImages.errors.rangeOutOfBounds", PAGE_RANGE_REVERSED: "pdfToImages.errors.rangeReversed",
  };
  if (!keys[error?.code]) return false;
  elements.range.setAttribute("aria-invalid", "true");
  elements.rangeError.textContent = message(keys[error.code], { pages: state.source?.pageCount || 0 });
  elements.range.focus();
  return true;
}

function errorMessage(error) {
  const keys = {
    UNSUPPORTED_PDF: "pdfToImages.errors.unsupported", ENCRYPTED_PDF: "pdfToImages.errors.protected", UNREADABLE_PDF: "pdfToImages.errors.unreadable",
    PDF_HAS_NO_PAGES: "pdfToImages.errors.noPages", IMAGE_FORMAT_INVALID: "pdfToImages.errors.format", IMAGE_SCALE_INVALID: "pdfToImages.errors.scale",
    RENDER_DIMENSIONS_INVALID: "pdfToImages.errors.render", RENDER_DIMENSION_EXCEEDED: "pdfToImages.errors.dimension", RENDER_PIXELS_EXCEEDED: "pdfToImages.errors.pixels",
    CANVAS_UNAVAILABLE: "pdfToImages.errors.canvas", IMAGE_ENCODER_FAILED: "pdfToImages.errors.encoder", PAGE_RENDER_FAILED: "pdfToImages.errors.render",
    ARCHIVE_LIBRARY_UNAVAILABLE: "pdfToImages.errors.archiveLibrary", ARCHIVE_GENERATION_FAILED: "pdfToImages.errors.archive", PAGE_COUNT_MISMATCH: "pdfToImages.errors.render",
  };
  return message(keys[error?.code] || "pdfToImages.errors.failure");
}

async function stopActiveJob() {
  if (!state.busy) return;
  state.controller?.abort();
  await state.job?.catch(() => {});
}

async function addSource(files) {
  if (!files.length) return;
  await stopActiveJob();
  if (files.length !== 1) { setStatus("pdfToImages.errors.oneFile", {}, "error"); return; }
  const file = files[0];
  if (!isSupportedPdf(file)) { setStatus("pdfToImages.errors.unsupported", {}, "error"); return; }
  const session = ++state.session;
  setStatus("pdfToImages.status.reading");
  try {
    const [{ pageCount }, bytes] = await Promise.all([inspectPdf(file, window.PDFLib?.PDFDocument), file.arrayBuffer()]);
    if (session !== state.session) return;
    state.source = { file, pageCount, bytes };
    elements.filename.value = sourceBaseName(file.name);
    setStatus("pdfToImages.status.loaded", { pages: pageCount }, "success");
  } catch (error) {
    state.source = null;
    setStatus(null);
    elements.status.textContent = errorMessage(error);
    elements.status.dataset.tone = "error";
  } finally {
    elements.input.value = "";
    renderState();
    updateOptions();
  }
}

async function clearSource(statusKey = "pdfToImages.status.cleared") {
  await stopActiveJob();
  state.session += 1;
  state.source = null;
  elements.input.value = "";
  clearFieldError();
  setStatus(statusKey);
  renderState();
  updateOptions();
}

function currentPlan() {
  return createConversionPlan({
    mode: selectedMode(), selection: elements.range.value, pageCount: state.source.pageCount,
    format: elements.format.value, quality: elements.quality.value, scale: elements.scale.value,
    baseName: elements.filename.value, sourceName: state.source.file.name,
  });
}

async function runConversion() {
  if (!state.source || state.busy) { setStatus("pdfToImages.errors.noFile", {}, "error"); return; }
  clearFieldError();
  let plan;
  try { plan = currentPlan(); }
  catch (error) { if (showFieldError(error)) return; setStatus(null); elements.status.textContent = errorMessage(error); elements.status.dataset.tone = "error"; return; }
  const outputName = plan.pages.length === 1 ? plan.names.entries[0] : plan.names.archive;
  const outputType = plan.pages.length === 1 ? plan.mimeType : "application/zip";
  const extension = plan.pages.length === 1 ? `.${IMAGE_FORMATS[plan.format].extension}` : ".zip";
  let fileHandle = null;
  if ("showSaveFilePicker" in window) {
    try {
      fileHandle = await requestSaveHandle(window, { suggestedName: outputName, description: t(plan.pages.length === 1 ? "pdfToImages.settings.imageFile" : "pdfToImages.settings.zipFile"), mimeType: outputType, extension });
    } catch (error) {
      if (error.name === "AbortError") { setStatus("pdfToImages.status.saveCancelled"); return; }
      setStatus("pdfToImages.errors.save", {}, "error"); return;
    }
  }
  const source = state.source;
  const session = state.session;
  state.busy = true;
  state.controller = new AbortController();
  elements.progress.hidden = false;
  elements.progress.max = plan.pages.length;
  elements.progress.value = 0;
  renderState(); updateOptions();
  const task = convertPdfToImages({
    sourceBytes: source.bytes, pageCount: source.pageCount, mode: selectedMode(), selection: elements.range.value,
    format: elements.format.value, quality: elements.quality.value, scale: elements.scale.value,
    baseName: elements.filename.value, sourceName: source.file.name, JSZip: window.JSZip, signal: state.controller.signal,
    onPhase(phase) { if (session === state.session) setStatus(`pdfToImages.status.${phase}`); },
    onProgress(completed, total, page) { if (session === state.session) { elements.progress.value = completed; setStatus("pdfToImages.status.progress", { completed, total, page }); } },
  });
  state.job = task;
  try {
    const result = await task;
    if (session !== state.session) return;
    if (fileHandle) await writeBlobToHandle(fileHandle, result.blob); else downloadBlob(result.blob, result.filename);
    setStatus(fileHandle ? "pdfToImages.status.saved" : "pdfToImages.status.downloaded", { name: result.filename, count: result.entries.length }, "success");
  } catch (error) {
    if (error?.code === "CONVERSION_CANCELLED") setStatus("pdfToImages.status.cancelled");
    else { console.error("PDF to Images conversion failed", error?.code || error?.name || "error"); setStatus(null); elements.status.textContent = errorMessage(error); elements.status.dataset.tone = "error"; }
  } finally {
    state.busy = false;
    state.controller = null;
    state.job = null;
    elements.progress.hidden = true;
    renderState(); updateOptions();
  }
}

elements.input.addEventListener("change", (event) => addSource([...event.target.files]));
elements.remove.addEventListener("click", () => clearSource());
elements.clear.addEventListener("click", () => clearSource());
elements.convert.addEventListener("click", runConversion);
elements.cancel.addEventListener("click", () => state.controller?.abort());
elements.form.addEventListener("change", updateOptions);
elements.format.addEventListener("change", updateOptions);
elements.quality.addEventListener("input", updateOptions);
elements.range.addEventListener("input", clearFieldError);
for (const type of ["dragenter", "dragover"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); elements.dropZone.dataset.dragging = "true"; });
for (const type of ["dragleave", "drop"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); delete elements.dropZone.dataset.dragging; });
elements.dropZone.addEventListener("drop", (event) => addSource([...event.dataTransfer.files]));
document.addEventListener("securetools:languagechange", () => { renderState(); if (state.status) setStatus(state.status.key, state.status.values, state.status.tone); });
window.addEventListener("beforeunload", () => state.controller?.abort());
renderState(); updateOptions();

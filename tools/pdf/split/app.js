import { t } from "../../../js/i18n.js";
import { formatBytes, sanitizePdfFilename } from "../../shared/file.js";
import { inspectPdf, isSupportedPdf } from "../../shared/pdf.js";
import { downloadBlob, requestSaveHandle, writeBlobToHandle } from "../../shared/save.js";
import { createPageGroups, createSplitNames, splitPdfFile } from "./pdf.js";

const elements = {
  input: document.querySelector("#file-input"), dropZone: document.querySelector("#drop-zone"),
  sourceEmpty: document.querySelector("#source-empty"), sourceCard: document.querySelector("#source-card"),
  sourceName: document.querySelector("#source-name"), sourceMeta: document.querySelector("#source-meta"), remove: document.querySelector("#remove-source"),
  form: document.querySelector("#split-settings"), filename: document.querySelector("#filename"),
  rangePanel: document.querySelector("#range-panel"), range: document.querySelector("#page-range"), rangeError: document.querySelector("#range-error"),
  intervalPanel: document.querySelector("#interval-panel"), interval: document.querySelector("#interval"),
  split: document.querySelector("#split-pdf"), clear: document.querySelector("#clear-source"),
  progress: document.querySelector("#split-progress"), status: document.querySelector("#tool-status"),
};

const state = { source: null, busy: false, status: null };
const message = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), t(key));

function setStatus(key, values = {}, tone = "neutral") {
  state.status = { key, values, tone };
  elements.status.textContent = message(key, values);
  elements.status.dataset.tone = tone;
}

function selectedMode() {
  return new FormData(elements.form).get("mode") || "extract";
}

function sourceBaseName(name) {
  return sanitizePdfFilename(name, "split-document").replace(/\.pdf$/i, "");
}

function renderSource() {
  const hasSource = Boolean(state.source);
  elements.sourceEmpty.hidden = hasSource;
  elements.sourceCard.hidden = !hasSource;
  elements.remove.disabled = state.busy;
  elements.clear.disabled = state.busy || !hasSource;
  elements.split.disabled = state.busy || !hasSource;
  elements.input.disabled = state.busy;
  elements.filename.disabled = state.busy || !hasSource;
  document.querySelectorAll('[form="split-settings"]').forEach((input) => { input.disabled = state.busy || !hasSource; });
  elements.form.querySelectorAll("input").forEach((input) => { input.disabled = state.busy || (input.dataset.requiresSource === "true" && !hasSource); });
  if (hasSource) {
    elements.sourceName.textContent = state.source.file.name;
    elements.sourceMeta.textContent = message("splitPdf.source.meta", {
      size: formatBytes(state.source.file.size), pages: state.source.pageCount,
    });
  }
}

function updateMode() {
  const mode = selectedMode();
  elements.rangePanel.hidden = mode !== "extract";
  elements.range.disabled = state.busy || !state.source || mode !== "extract";
  elements.intervalPanel.hidden = mode !== "interval";
  elements.interval.disabled = state.busy || !state.source || mode !== "interval";
  clearFieldError();
}

function clearFieldError() {
  elements.range.removeAttribute("aria-invalid");
  elements.interval.removeAttribute("aria-invalid");
  elements.rangeError.textContent = "";
}

function showFieldError(error) {
  const keyByCode = {
    PAGE_RANGE_REQUIRED: "splitPdf.errors.rangeRequired", PAGE_RANGE_INVALID: "splitPdf.errors.rangeInvalid",
    PAGE_OUT_OF_RANGE: "splitPdf.errors.rangeOutOfBounds", PAGE_RANGE_REVERSED: "splitPdf.errors.rangeReversed",
    INTERVAL_INVALID: "splitPdf.errors.intervalInvalid", PDF_HAS_NO_PAGES: "splitPdf.errors.noPages", SPLIT_MODE_INVALID: "splitPdf.errors.mode",
  };
  const key = keyByCode[error?.code];
  if (!key) return false;
  const target = error.code === "INTERVAL_INVALID" ? elements.interval : elements.range;
  target.setAttribute("aria-invalid", "true");
  elements.rangeError.textContent = message(key, { pages: state.source?.pageCount || 0 });
  target.focus();
  return true;
}

function errorMessage(error) {
  const keyByCode = {
    UNSUPPORTED_PDF: "splitPdf.errors.unsupported", ENCRYPTED_PDF: "splitPdf.errors.protected", UNREADABLE_PDF: "splitPdf.errors.unreadable",
    PDF_LIBRARY_UNAVAILABLE: "splitPdf.errors.pdfLibrary", ARCHIVE_LIBRARY_UNAVAILABLE: "splitPdf.errors.archiveLibrary",
    PDF_GENERATION_FAILED: "splitPdf.errors.generation", ARCHIVE_GENERATION_FAILED: "splitPdf.errors.archive", PDF_HAS_NO_PAGES: "splitPdf.errors.noPages",
  };
  return message(keyByCode[error?.code] || "splitPdf.errors.generation", { name: error?.fileName || "PDF" });
}

async function addSource(files) {
  if (state.busy || !files.length) return;
  if (files.length !== 1) {
    setStatus("splitPdf.errors.oneFile", {}, "error");
    return;
  }
  const file = files[0];
  if (!isSupportedPdf(file)) {
    setStatus("splitPdf.errors.unsupported", {}, "error");
    return;
  }
  state.busy = true;
  setStatus("splitPdf.status.reading", {}, "neutral");
  renderSource();
  try {
    const { pageCount } = await inspectPdf(file, window.PDFLib?.PDFDocument);
    state.source = { file, pageCount };
    elements.filename.value = sourceBaseName(file.name);
    setStatus("splitPdf.status.loaded", { pages: pageCount }, "success");
  } catch (error) {
    state.source = null;
    state.status = null;
    elements.status.textContent = errorMessage(error);
    elements.status.dataset.tone = "error";
  } finally {
    state.busy = false;
    elements.input.value = "";
    renderSource();
    updateMode();
  }
}

function clearSource(statusKey = "splitPdf.status.cleared") {
  state.source = null;
  elements.input.value = "";
  clearFieldError();
  setStatus(statusKey, {}, "neutral");
  renderSource();
}

function outputPlan() {
  const mode = selectedMode();
  const groups = createPageGroups({
    mode, selection: elements.range.value, interval: elements.interval.value,
    pageCount: state.source.pageCount,
  });
  const names = createSplitNames({
    mode, groups, baseName: elements.filename.value,
    sourceName: state.source.file.name, pageCount: state.source.pageCount,
  });
  return { mode, groups, names, filename: mode === "extract" ? names.entries[0] : names.archive };
}

async function splitSource() {
  if (!state.source || state.busy) {
    setStatus("splitPdf.errors.noFile", {}, "error");
    return;
  }
  clearFieldError();
  let plan;
  try {
    plan = outputPlan();
  } catch (error) {
    if (showFieldError(error)) return;
    throw error;
  }

  const data = new FormData(elements.form);
  const autoDownload = data.get("auto-download") === "on";
  const clearAfterSave = data.get("clear-after-save") === "on";
  const isArchive = plan.mode !== "extract";
  let fileHandle = null;
  if (!autoDownload && "showSaveFilePicker" in window) {
    try {
      fileHandle = await requestSaveHandle(window, {
        suggestedName: plan.filename,
        description: t(isArchive ? "splitPdf.settings.zipFile" : "splitPdf.settings.pdfFile"),
        mimeType: isArchive ? "application/zip" : "application/pdf",
        extension: isArchive ? ".zip" : ".pdf",
      });
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus("splitPdf.status.saveCancelled", {}, "neutral");
        return;
      }
      setStatus("splitPdf.errors.save", {}, "error");
      return;
    }
  }

  state.busy = true;
  elements.progress.hidden = false;
  elements.progress.max = plan.groups.length;
  elements.progress.value = 0;
  setStatus("splitPdf.status.reading", {}, "neutral");
  renderSource();
  updateMode();
  try {
    const result = await splitPdfFile({
      file: state.source.file, mode: plan.mode, selection: elements.range.value,
      interval: elements.interval.value, baseName: elements.filename.value,
      PDFDocument: window.PDFLib?.PDFDocument, JSZip: window.JSZip,
      onPhase(phase) { setStatus(`splitPdf.status.${phase}`, {}, "neutral"); },
      onProgress(completed, total) {
        elements.progress.value = completed;
        setStatus("splitPdf.status.progress", { completed, total }, "neutral");
      },
    });
    if (fileHandle) await writeBlobToHandle(fileHandle, result.blob);
    else downloadBlob(result.blob, result.filename);
    setStatus(fileHandle ? "splitPdf.status.saved" : "splitPdf.status.downloaded", {
      name: result.filename, count: result.entries.length,
    }, "success");
    if (clearAfterSave) clearSource("splitPdf.status.savedAndCleared");
  } catch (error) {
    if (!showFieldError(error)) {
      state.status = null;
      elements.status.textContent = errorMessage(error);
      elements.status.dataset.tone = "error";
    }
  } finally {
    state.busy = false;
    elements.progress.hidden = true;
    renderSource();
    updateMode();
  }
}

elements.input.addEventListener("change", (event) => addSource([...event.target.files]));
elements.remove.addEventListener("click", () => clearSource());
elements.clear.addEventListener("click", () => clearSource());
elements.split.addEventListener("click", splitSource);
elements.form.addEventListener("change", (event) => { if (event.target.name === "mode") updateMode(); });
elements.range.addEventListener("input", clearFieldError);
elements.interval.addEventListener("input", clearFieldError);
for (const type of ["dragenter", "dragover"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); if (!state.busy) elements.dropZone.dataset.dragging = "true"; });
for (const type of ["dragleave", "drop"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); delete elements.dropZone.dataset.dragging; });
elements.dropZone.addEventListener("drop", (event) => { if (!state.busy) addSource([...event.dataTransfer.files]); });
document.addEventListener("securetools:languagechange", () => { renderSource(); if (state.status) setStatus(state.status.key, state.status.values, state.status.tone); });
renderSource();
updateMode();

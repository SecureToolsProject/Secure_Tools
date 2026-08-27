import { t } from "../../../js/i18n.js";
import { formatBytes } from "../../shared/file.js";
import { downloadBlob, requestPdfSaveHandle, writeBlobToHandle } from "../../shared/save.js";
import { isSupportedPdf } from "../../shared/pdf.js";
import { clearMetadataSelection, selectedMetadataKeys, selectAllPresentMetadata, setMetadataSelected } from "./model.js";
import { cleanPdfMetadata, metadataFilename, readPdfMetadata } from "./pdf.js";

const elements = {
  input: document.querySelector("#file-input"), dropZone: document.querySelector("#drop-zone"), empty: document.querySelector("#source-empty"),
  sourceCard: document.querySelector("#source-card"), sourceName: document.querySelector("#source-name"), summary: document.querySelector("#source-summary"),
  clearSource: document.querySelector("#clear-source"), inspector: document.querySelector("#inspector"), inspectorSummary: document.querySelector("#inspector-summary"),
  summaryList: document.querySelector("#metadata-summary-list"), decodedOverflowNotice: document.querySelector("#decoded-overflow-notice"), metadataEmpty: document.querySelector("#metadata-empty"), body: document.querySelector("#metadata-body"),
  inspectionDetails: document.querySelector("#inspection-details"), customizeCleaning: document.querySelector("#customize-cleaning"),
  customOptions: document.querySelector("#custom-policy-options"), selectAll: document.querySelector("#select-all"), clearSelection: document.querySelector("#clear-selection"),
  filename: document.querySelector("#filename"), clean: document.querySelector("#clean-pdf"), cleanCustom: document.querySelector("#clean-custom"),
  comparison: document.querySelector("#comparison"), comparisonSummary: document.querySelector("#comparison-summary"),
  before: document.querySelector("#comparison-before"), after: document.querySelector("#comparison-after"), status: document.querySelector("#tool-status"),
};

const state = { source: null, fields: [], comparison: null, busy: false, status: null };
const message = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));

function setStatus(key, values = {}, tone = "neutral") {
  state.status = key ? { key, values, tone } : null;
  elements.status.textContent = key ? message(key, values) : ""; elements.status.dataset.tone = tone;
}

function displayValue(field) {
  if (!field.present) return t("pdfMetadata.inspector.notSet");
  if (field.type === "date") {
    try { return new Intl.DateTimeFormat(document.documentElement.lang || "en", { dateStyle: "medium", timeStyle: "short" }).format(field.rawValue); }
    catch { return field.display.value; }
  }
  return field.display.value;
}

function appendDefinition(list, field) {
  const term = document.createElement("dt"); term.textContent = t(field.labelKey);
  const value = document.createElement("dd"); value.textContent = displayValue(field); list.append(term, value);
}

function renderComparison() {
  elements.comparison.hidden = !state.comparison; elements.before.replaceChildren(); elements.after.replaceChildren();
  if (!state.comparison) return;
  const { before, after, requested, retained } = state.comparison;
  const beforeMap = new Map(before.map((field) => [field.key, field])); const afterMap = new Map(after.map((field) => [field.key, field]));
  requested.forEach((key) => { appendDefinition(elements.before, beforeMap.get(key)); appendDefinition(elements.after, afterMap.get(key)); });
  elements.comparisonSummary.textContent = retained.length
    ? message("pdfMetadata.comparison.retained", { count: retained.length })
    : message("pdfMetadata.comparison.cleared", { count: requested.length });
}

function renderSummary() {
  elements.summaryList.replaceChildren();
  const present = state.fields.filter((field) => field.present);
  present.slice(0, 4).forEach((field) => appendDefinition(elements.summaryList, field));
  elements.decodedOverflowNotice.hidden = present.length <= 4;
  elements.decodedOverflowNotice.textContent = message("pdfMetadata.inspector.additionalDecoded", { count: Math.max(0, present.length - 4) });
  elements.metadataEmpty.hidden = present.length !== 0;
  elements.inspectorSummary.textContent = message("pdfMetadata.inspector.summary", { count: present.length });
}

function renderDetails() {
  elements.body.replaceChildren();
  state.fields.forEach((field) => {
    const row = document.createElement("tr"); const label = document.createElement("th"); label.scope = "row"; label.textContent = t(field.labelKey);
    const value = document.createElement("td"); const text = document.createElement("span"); text.className = "metadata-value"; text.textContent = displayValue(field); value.append(text);
    if (field.display.truncated) { const note = document.createElement("span"); note.className = "truncation-note"; note.textContent = t("pdfMetadata.inspector.truncated"); value.append(note); }
    row.append(label, value); elements.body.append(row);
  });
}

function renderCustomOptions() {
  elements.customOptions.replaceChildren();
  state.fields.filter((field) => field.present).forEach((field) => {
    const label = document.createElement("label"); label.className = "check-field";
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.dataset.metadataKey = field.key;
    checkbox.checked = field.selected; checkbox.disabled = state.busy;
    const text = document.createElement("span"); text.textContent = message("pdfMetadata.inspector.removeField", { field: t(field.labelKey) });
    label.append(checkbox, text); elements.customOptions.append(label);
  });
}

function render() {
  const hasSource = Boolean(state.source); const selected = selectedMetadataKeys(state.fields).length;
  const present = state.fields.filter((field) => field.present).length;
  elements.empty.hidden = hasSource; elements.sourceCard.hidden = !hasSource;
  if (hasSource) { elements.sourceName.textContent = state.source.file.name; elements.summary.textContent = message("pdfMetadata.source.meta", { size: formatBytes(state.source.file.size) }); }
  elements.inspector.hidden = !hasSource; elements.input.disabled = state.busy; elements.clearSource.disabled = state.busy || !hasSource;
  elements.inspectionDetails.hidden = !hasSource; elements.customizeCleaning.hidden = !hasSource || !present;
  elements.selectAll.disabled = state.busy || !present || selected === present; elements.clearSelection.disabled = state.busy || !selected;
  elements.filename.disabled = state.busy || !hasSource; elements.clean.disabled = state.busy || !hasSource || !present;
  elements.cleanCustom.disabled = state.busy || !hasSource || !selected;
  renderSummary(); renderDetails(); renderCustomOptions(); renderComparison();
}

function errorKey(error) {
  const detail = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
  if (error?.code === "UNSUPPORTED_PDF") return "pdfMetadata.errors.unsupported";
  if (error?.code === "ENCRYPTED_PDF" || detail.includes("password") || detail.includes("encrypt")) return "pdfMetadata.errors.protected";
  if (error?.code === "UNREADABLE_PDF") return "pdfMetadata.errors.unreadable";
  if (error?.code === "NO_METADATA_SELECTED") return "pdfMetadata.errors.noSelection";
  if (error?.code === "PAGE_PRESERVATION_FAILED") return "pdfMetadata.errors.pagesChanged";
  if (error?.code === "METADATA_VERIFICATION_FAILED") return "pdfMetadata.errors.verification";
  return "pdfMetadata.errors.failure";
}

async function addSource(files) {
  if (state.busy || !files.length) return;
  if (files.length !== 1) { setStatus("pdfMetadata.errors.oneFile", {}, "error"); return; }
  const file = files[0]; if (!isSupportedPdf(file)) { setStatus("pdfMetadata.errors.unsupported", {}, "error"); return; }
  state.busy = true; state.source = null; state.fields = []; state.comparison = null; elements.filename.value = "";
  elements.inspectionDetails.open = false; elements.customizeCleaning.open = false; render(); setStatus("pdfMetadata.status.reading");
  try {
    const source = await readPdfMetadata(file, window.PDFLib?.PDFDocument); state.source = { file, bytes: source.bytes, pages: source.pages };
    state.fields = selectAllPresentMetadata(source.fields); elements.filename.value = metadataFilename(file.name).replace(/\.pdf$/i, "");
    const count = source.fields.filter((field) => field.present).length;
    setStatus(count ? "pdfMetadata.status.loaded" : "pdfMetadata.status.noneFound", { count, pages: source.pages.length }, "success");
  } catch (error) { console.error("PDF metadata inspection failed", error?.name || error?.code || "error"); setStatus(errorKey(error), {}, "error"); }
  finally { state.busy = false; elements.input.value = ""; render(); }
}

function clearSource() {
  if (state.busy) return;
  state.source = null; state.fields = []; state.comparison = null; elements.filename.value = "";
  elements.inspectionDetails.open = false; elements.customizeCleaning.open = false;
  setStatus("pdfMetadata.status.cleared"); render(); elements.input.focus();
}

async function cleanAndSave(selectedKeys) {
  if (!state.source || state.busy) return;
  if (!selectedKeys.length) { setStatus("pdfMetadata.errors.noSelection", {}, "error"); return; }
  const filename = metadataFilename(state.source.file.name, elements.filename.value); let handle = null;
  if ("showSaveFilePicker" in window) {
    try { handle = await requestPdfSaveHandle(window, filename, t("pdfMetadata.output.pdfFile")); }
    catch (error) { if (error.name === "AbortError") setStatus("pdfMetadata.status.cancelled"); else setStatus("pdfMetadata.errors.save", {}, "error"); return; }
  }
  state.busy = true; render(); setStatus("pdfMetadata.status.cleaning");
  try {
    const result = await cleanPdfMetadata({ sourceBytes: state.source.bytes, selectedKeys, PDFDocument: window.PDFLib?.PDFDocument, PDFName: window.PDFLib?.PDFName });
    if (handle) await writeBlobToHandle(handle, result.blob); else downloadBlob(result.blob, filename);
    state.source.bytes = result.bytes; state.source.pages = result.pages; state.fields = result.after; state.comparison = result;
    setStatus(handle ? "pdfMetadata.status.saved" : "pdfMetadata.status.downloaded", { name: filename, count: result.cleared.length }, "success");
  } catch (error) { console.error("PDF metadata cleaning failed", error?.name || error?.code || "error"); setStatus(errorKey(error), {}, "error"); }
  finally { state.busy = false; render(); }
}

elements.input.addEventListener("change", (event) => addSource([...event.target.files])); elements.clearSource.addEventListener("click", clearSource);
elements.selectAll.addEventListener("click", () => { state.fields = selectAllPresentMetadata(state.fields); render(); });
elements.clearSelection.addEventListener("click", () => { state.fields = clearMetadataSelection(state.fields); render(); });
elements.customOptions.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[data-metadata-key]"); if (!checkbox || state.busy) return;
  state.fields = setMetadataSelected(state.fields, checkbox.dataset.metadataKey, checkbox.checked); render();
});
elements.clean.addEventListener("click", () => cleanAndSave(state.fields.filter((field) => field.present).map((field) => field.key)));
elements.cleanCustom.addEventListener("click", () => cleanAndSave(selectedMetadataKeys(state.fields)));
for (const type of ["dragenter", "dragover"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); if (!state.busy) elements.dropZone.dataset.dragging = "true"; });
for (const type of ["dragleave", "drop"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); delete elements.dropZone.dataset.dragging; });
elements.dropZone.addEventListener("drop", (event) => { if (!state.busy) addSource([...event.dataTransfer.files]); });
document.addEventListener("securetools:languagechange", () => { render(); if (state.status) setStatus(state.status.key, state.status.values, state.status.tone); });
render();

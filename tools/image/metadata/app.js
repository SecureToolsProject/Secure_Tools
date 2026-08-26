import { t } from "../../../js/i18n.js";
import { formatBytes } from "../../shared/file.js";
import { downloadBlob, requestSaveHandle, writeBlobToHandle } from "../../shared/save.js";
import { buildCleaningModel, buildInspectionModel } from "./model.js";
import { cleanAndVerifyImageMetadata, createCleanOutputPlan, inspectImageMetadata } from "./metadata.js";

const elements = Object.fromEntries([
  "file-input", "drop-zone", "source-empty", "source-summary", "clear-source", "inspection", "coverage",
  "metadata-empty", "metadata-groups", "inspection-diagnostics", "inspection-diagnostic-list", "clean-image",
  "clean-result", "result-summary", "removed-list", "preserved-list", "result-diagnostics",
  "result-diagnostic-list", "tool-status",
].map((id) => [id.replaceAll("-", "_"), document.querySelector(`#${id}`)]));

const state = { source: null, inspection: null, result: null, busy: false, status: null };
const message = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));

function setStatus(key, values = {}, tone = "neutral") {
  state.status = key ? { key, values, tone } : null;
  elements.tool_status.textContent = key ? message(key, values) : "";
  elements.tool_status.dataset.tone = tone;
}

function valueLabels() {
  return { opaque: t("imageMetadata.values.opaque"), bytes: t("imageMetadata.values.bytes"), true: t("imageMetadata.values.true"), false: t("imageMetadata.values.false"), unknown: t("imageMetadata.values.unknown") };
}

function appendItems(list, values) {
  list.replaceChildren();
  const items = values.length ? values : [t("imageMetadata.result.none")];
  items.forEach((value) => { const item = document.createElement("li"); item.textContent = typeof value === "string" ? value : String(value?.name || value?.namespace || value?.id || value); list.append(item); });
}

function renderInspection() {
  elements.metadata_groups.replaceChildren();
  if (!state.inspection) return;
  elements.coverage.textContent = t(state.inspection.coverageKey);
  elements.metadata_empty.hidden = state.inspection.count !== 0;
  state.inspection.groups.forEach((group) => {
    const section = document.createElement("section"); section.className = "metadata-group";
    const heading = document.createElement("h4"); heading.textContent = t(`imageMetadata.groups.${group.key}`); section.append(heading);
    const list = document.createElement("dl");
    group.items.forEach((entry) => {
      const wrapper = document.createElement("div"); wrapper.className = "metadata-entry";
      const term = document.createElement("dt"); term.textContent = entry.name;
      const detail = document.createElement("dd");
      const value = document.createElement("span"); value.className = "metadata-value"; value.textContent = entry.value.text; detail.append(value);
      const context = document.createElement("span"); context.className = "metadata-context"; context.textContent = message("imageMetadata.inspector.namespace", { namespace: entry.namespace }); detail.append(context);
      if (entry.source) { const source = document.createElement("span"); source.className = "metadata-context"; source.textContent = message("imageMetadata.inspector.source", { source: entry.source }); detail.append(source); }
      if (entry.value.opaque) { const opaque = document.createElement("span"); opaque.className = "metadata-flag"; opaque.textContent = t("imageMetadata.inspector.opaque"); detail.append(opaque); }
      if (entry.value.truncated) { const note = document.createElement("span"); note.className = "metadata-context"; note.textContent = t("imageMetadata.inspector.truncated"); detail.append(note); }
      wrapper.append(term, detail); list.append(wrapper);
    });
    section.append(list); elements.metadata_groups.append(section);
  });
  appendItems(elements.inspection_diagnostic_list, state.inspection.diagnostics);
  elements.inspection_diagnostics.hidden = state.inspection.diagnostics.length === 0;
}

function renderResult() {
  elements.clean_result.hidden = !state.result;
  if (!state.result) return;
  elements.result_summary.textContent = message("imageMetadata.result.summary", { name: state.result.filename, count: state.result.checks.length });
  appendItems(elements.removed_list, state.result.removed);
  appendItems(elements.preserved_list, state.result.preserved);
  appendItems(elements.result_diagnostic_list, state.result.diagnostics);
  elements.result_diagnostics.hidden = state.result.diagnostics.length === 0;
}

function render() {
  const hasSource = Boolean(state.source);
  elements.source_empty.hidden = hasSource;
  elements.source_summary.hidden = !hasSource;
  if (hasSource) elements.source_summary.textContent = message("imageMetadata.source.summary", { name: state.source.file.name, size: formatBytes(state.source.file.size), format: state.source.format.toUpperCase(), count: state.inspection.count });
  elements.inspection.hidden = !hasSource;
  elements.file_input.disabled = state.busy;
  elements.clear_source.disabled = state.busy || !hasSource;
  elements.clean_image.disabled = state.busy || !hasSource || !state.inspection?.cleanable;
  renderInspection(); renderResult();
}

function errorKey(error) {
  const code = error?.code;
  if (code === "IMAGE_METADATA_NO_FILE") return "imageMetadata.errors.noFile";
  if (code === "IMAGE_FILE_TOO_LARGE") return "imageMetadata.errors.tooLarge";
  if (code === "IMAGE_SIGNATURE_INVALID" || code === "UNSUPPORTED_IMAGE") return "imageMetadata.errors.signature";
  if (code === "IMAGE_METADATA_UNSUPPORTED") return "imageMetadata.errors.unsupported";
  if (code?.startsWith("IMAGE_METADATA_INCOMPLETE_")) return "imageMetadata.errors.incomplete";
  if (code === "IMAGE_METADATA_INPUT_LIMIT") return "imageMetadata.errors.limit";
  if (code === "IMAGE_METADATA_NOT_CLEANABLE") return "imageMetadata.errors.notCleanable";
  if (code === "IMAGE_METADATA_CLEANING_FAILED") return "imageMetadata.errors.cleaning";
  if (code === "IMAGE_METADATA_VERIFICATION_FAILED") return "imageMetadata.errors.verification";
  return "imageMetadata.errors.inspection";
}

async function addSource(files) {
  if (state.busy || !files.length) return;
  if (files.length !== 1) { setStatus("imageMetadata.errors.oneFile", {}, "error"); return; }
  state.busy = true; state.source = null; state.inspection = null; state.result = null; render(); setStatus("imageMetadata.status.reading");
  try {
    state.source = await inspectImageMetadata(files[0]);
    state.inspection = buildInspectionModel(state.source, valueLabels());
    setStatus(state.inspection.count ? "imageMetadata.status.loaded" : "imageMetadata.status.noneFound", { count: state.inspection.count }, state.inspection.successful ? "success" : "warning");
  } catch (error) {
    console.error("Image metadata inspection failed", error?.code || error?.name || "error"); setStatus(errorKey(error), {}, "error");
  } finally { state.busy = false; elements.file_input.value = ""; render(); }
}

function clearSource() {
  if (state.busy) return;
  state.source = null; state.inspection = null; state.result = null; setStatus("imageMetadata.status.cleared"); render();
}

async function cleanAndSave() {
  if (!state.source || state.busy) return;
  const plan = createCleanOutputPlan(state.source);
  let handle = null;
  if ("showSaveFilePicker" in window) {
    try { handle = await requestSaveHandle(window, { suggestedName: plan.filename, description: t("imageMetadata.clean.imageFile"), mimeType: plan.mimeType, extension: plan.extension }); }
    catch (error) { if (error?.name === "AbortError") setStatus("imageMetadata.status.cancelled"); else setStatus("imageMetadata.errors.save", {}, "error"); return; }
  }
  state.busy = true; state.result = null; render(); setStatus("imageMetadata.status.cleaning");
  try {
    const result = await cleanAndVerifyImageMetadata(state.source);
    if (handle) await writeBlobToHandle(handle, result.blob); else downloadBlob(result.blob, result.plan.filename);
    state.result = buildCleaningModel(result);
    setStatus(handle ? "imageMetadata.status.saved" : "imageMetadata.status.downloaded", { name: result.plan.filename }, "success");
  } catch (error) {
    console.error("Image metadata cleaning failed", error?.code || error?.name || "error");
    setStatus(errorKey(error), {}, "error");
  } finally { state.busy = false; render(); }
}

elements.file_input.addEventListener("change", (event) => addSource([...event.target.files]));
elements.clear_source.addEventListener("click", clearSource);
elements.clean_image.addEventListener("click", cleanAndSave);
for (const type of ["dragenter", "dragover"]) elements.drop_zone.addEventListener(type, (event) => { event.preventDefault(); if (!state.busy) elements.drop_zone.dataset.dragging = "true"; });
for (const type of ["dragleave", "drop"]) elements.drop_zone.addEventListener(type, (event) => { event.preventDefault(); delete elements.drop_zone.dataset.dragging; });
elements.drop_zone.addEventListener("drop", (event) => { if (!state.busy) addSource([...event.dataTransfer.files]); });
document.addEventListener("securetools:languagechange", () => { if (state.source) state.inspection = buildInspectionModel(state.source, valueLabels()); render(); if (state.status) setStatus(state.status.key, state.status.values, state.status.tone); });
render();

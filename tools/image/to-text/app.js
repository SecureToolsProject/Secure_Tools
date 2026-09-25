import { t } from "../../../js/i18n.js";
import { formatBytes } from "../../shared/file.js";
import { createOcrService } from "../../shared/ocr.js";
import { createImageToTextController, defaultOcrLanguage, OCR_UI_STATES } from "./controller.js";
import { copyText, downloadText, textFilename } from "./output.js";
import { preparePreviewSource, releasePreviewSource } from "./preview.js";

const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id.replaceAll("-", "_"), element]));
let state = null;
let transientStatus = null;
const service = createOcrService();

function message(key, values = {}) {
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), t(key));
}

function errorKey(error) {
  const code = error?.code;
  if (code === "IMAGE_FILE_TOO_LARGE") return "imageToText.errors.tooLarge";
  if (code === "IMAGE_SIGNATURE_INVALID" || code === "UNSUPPORTED_IMAGE") return "imageToText.errors.signature";
  if (code === "IMAGE_DECODE_FAILED" || code === "IMAGE_DIMENSION_EXCEEDED" || code === "IMAGE_PIXELS_EXCEEDED") return "imageToText.errors.decode";
  if (code === "OCR_INITIALIZATION_FAILED") return "imageToText.errors.initialization";
  if (code === "OCR_BUSY") return "imageToText.errors.busy";
  if (code === "OCR_RECOGNITION_FAILED") return "imageToText.errors.recognition";
  return "imageToText.errors.generic";
}

function statusForState() {
  if (transientStatus) return transientStatus;
  if (state.phase === OCR_UI_STATES.RECOGNIZING) {
    const stage = state.progress?.stage || "loading-engine";
    const percent = Math.round((state.progress?.progress || 0) * 100);
    return { key: `imageToText.progress.${stage}`, values: { percent } };
  }
  if (state.phase === OCR_UI_STATES.READY) return { key: "imageToText.status.ready" };
  if (state.phase === OCR_UI_STATES.SUCCESS) return { key: "imageToText.status.success", tone: "success" };
  if (state.phase === OCR_UI_STATES.CANCELLED) return { key: "imageToText.status.cancelled", tone: "warning" };
  if (state.phase === OCR_UI_STATES.ERROR) return { key: errorKey(state.error), tone: "error" };
  return null;
}

function render() {
  if (!state) return;
  const hasSource = Boolean(state.source);
  const recognizing = state.phase === OCR_UI_STATES.RECOGNIZING;
  elements.source_empty.hidden = hasSource;
  elements.source_card.hidden = !hasSource;
  if (hasSource) {
    elements.source_preview.src = state.source.previewUrl;
    elements.source_preview.alt = t("imageToText.source.previewAlt");
    elements.source_name.textContent = state.source.file.name;
    const format = (state.source.file.type.split("/")[1] || state.source.previewType.split("/")[1] || "image").toUpperCase();
    elements.source_meta.textContent = message("imageToText.source.meta", { size: formatBytes(state.source.file.size), format });
  } else {
    elements.source_preview.removeAttribute("src");
  }
  elements.file_input.disabled = recognizing;
  elements.replace_source.disabled = recognizing;
  elements.remove_source.disabled = recognizing;
  elements.ocr_language.disabled = recognizing;
  elements.ocr_language.value = state.language;
  elements.recognize.disabled = !hasSource || recognizing;
  elements.recognize.textContent = t(state.phase === OCR_UI_STATES.ERROR || state.phase === OCR_UI_STATES.CANCELLED ? "imageToText.settings.retry" : "imageToText.settings.recognize");
  elements.cancel.hidden = !recognizing;
  elements.ocr_progress.hidden = !recognizing;
  if (recognizing && Number.isFinite(state.progress?.progress)) elements.ocr_progress.value = state.progress.progress;
  else elements.ocr_progress.removeAttribute("value");
  elements.result_panel.hidden = state.phase !== OCR_UI_STATES.SUCCESS;
  if (state.phase === OCR_UI_STATES.SUCCESS && elements.result_text.value !== state.text) elements.result_text.value = state.text;
  const canExport = state.phase === OCR_UI_STATES.SUCCESS && elements.result_text.value.length > 0;
  elements.copy_result.disabled = !canExport;
  elements.download_result.disabled = !canExport;
  const status = statusForState();
  elements.tool_status.textContent = status ? message(status.key, status.values) : "";
  if (status?.tone) elements.tool_status.dataset.tone = status.tone; else delete elements.tool_status.dataset.tone;
}

const controller = createImageToTextController({
  language: defaultOcrLanguage(document.documentElement.lang),
  recognizeImage: service.recognizeImage,
  prepareSource: preparePreviewSource,
  releaseSource: releasePreviewSource,
  dispose: service.dispose,
  onChange(nextState) { state = nextState; transientStatus = null; render(); },
});

async function selectFiles(files) {
  if (files.length !== 1) {
    transientStatus = { key: "imageToText.errors.oneFile", tone: "error" };
    render();
    return;
  }
  transientStatus = { key: "imageToText.status.selecting" };
  render();
  await controller.select(files[0]);
  elements.file_input.value = "";
}

elements.file_input.addEventListener("change", (event) => selectFiles([...event.target.files]));
elements.replace_source.addEventListener("click", () => elements.file_input.click());
elements.remove_source.addEventListener("click", async () => { await controller.remove(); transientStatus = { key: "imageToText.status.removed" }; render(); elements.file_input.focus(); });
elements.ocr_language.addEventListener("change", (event) => controller.setLanguage(event.target.value));
elements.recognize.addEventListener("click", () => controller.recognize());
elements.cancel.addEventListener("click", () => controller.cancel());
elements.result_text.addEventListener("input", (event) => controller.updateText(event.target.value));
elements.copy_result.addEventListener("click", async () => {
  try { await copyText(elements.result_text.value); transientStatus = { key: "imageToText.status.copied", tone: "success" }; }
  catch { transientStatus = { key: "imageToText.errors.copy", tone: "error" }; }
  render();
});
elements.download_result.addEventListener("click", () => {
  try {
    const name = textFilename(state.source.file.name);
    downloadText(elements.result_text.value, state.source.file.name);
    transientStatus = { key: "imageToText.status.downloaded", values: { name }, tone: "success" };
  } catch { transientStatus = { key: "imageToText.errors.download", tone: "error" }; }
  render();
});
for (const type of ["dragenter", "dragover"]) elements.drop_zone.addEventListener(type, (event) => { event.preventDefault(); if (!elements.file_input.disabled) elements.drop_zone.dataset.dragging = "true"; });
for (const type of ["dragleave", "drop"]) elements.drop_zone.addEventListener(type, (event) => { event.preventDefault(); delete elements.drop_zone.dataset.dragging; });
elements.drop_zone.addEventListener("drop", (event) => { if (!elements.file_input.disabled) selectFiles([...event.dataTransfer.files]); });
document.addEventListener("securetools:languagechange", render);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
render();

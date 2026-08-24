import { t } from "../../../js/i18n.js";
import { formatBytes, moveArrayItem } from "../../shared/file.js";
import { ACCEPTED_IMAGE_TYPES, selectImageQueueFiles } from "../../shared/image.js";
import { downloadBlob, requestSaveHandle, writeBlobToHandle } from "../../shared/save.js";
import { createConversionPlan, convertImages, IMAGE_FORMATS } from "./converter.js";

const elements = {
  input: document.querySelector("#file-input"),
  dropZone: document.querySelector("#drop-zone"),
  list: document.querySelector("#image-list"),
  empty: document.querySelector("#queue-empty"),
  count: document.querySelector("#image-count"),
  add: document.querySelector("#add-images"),
  clear: document.querySelector("#clear-images"),
  convert: document.querySelector("#convert-images"),
  form: document.querySelector("#conversion-settings"),
  format: document.querySelector("#output-format"),
  quality: document.querySelector("#quality"),
  qualityField: document.querySelector("#quality-field"),
  qualityValue: document.querySelector("#quality-value"),
  progress: document.querySelector("#conversion-progress"),
  status: document.querySelector("#tool-status"),
};

const state = { items: [], busy: false, status: null };
elements.input.accept = ACCEPTED_IMAGE_TYPES;

const message = (key, values = {}) => Object.entries(values).reduce(
  (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
  t(key),
);

function setStatus(key, values = {}, tone = "neutral") {
  state.status = key ? { key, values, tone } : null;
  elements.status.textContent = key ? message(key, values) : "";
  elements.status.dataset.tone = tone;
}

function rejectionReason(code) {
  const keyByCode = {
    UNSUPPORTED_IMAGE: "imageToPdf.errors.unsupported",
    IMAGE_FILE_TOO_LARGE: "imageToPdf.errors.fileTooLarge",
    IMAGE_QUEUE_FILES_EXCEEDED: "imageToPdf.errors.queueFiles",
    IMAGE_SIGNATURE_INVALID: "imageToPdf.errors.signature",
    IMAGE_QUEUE_BYTES_EXCEEDED: "imageToPdf.errors.queueBytes",
  };
  return message(keyByCode[code] || "imageToPdf.errors.unsupported");
}

function setRejectedStatus(added, rejected) {
  state.status = { added, rejected, tone: "warning" };
  const reasons = rejected.map(({ file, code }) => message("imageToPdf.status.rejectedItem", {
    name: file.name || "file",
    reason: rejectionReason(code),
  })).join("; ");
  elements.status.textContent = message("imageToPdf.status.addedWithReasons", { added, reasons });
  elements.status.dataset.tone = "warning";
}

function createActionButton(action, labelKey, symbol, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `queue-action queue-action--${action}`;
  button.dataset.action = action;
  button.setAttribute("aria-label", t(labelKey));
  button.title = t(labelKey);
  button.textContent = symbol;
  button.disabled = disabled || state.busy;
  return button;
}

function renderQueue() {
  elements.list.replaceChildren();
  elements.empty.hidden = state.items.length > 0;
  elements.count.textContent = message("imageToPdf.queue.count", { count: state.items.length });
  elements.clear.disabled = state.busy || state.items.length === 0;
  elements.convert.disabled = state.busy || state.items.length === 0;
  elements.add.disabled = state.busy;
  elements.input.disabled = state.busy;
  elements.format.disabled = state.busy;
  elements.quality.disabled = state.busy || elements.format.value === "png";

  state.items.forEach((item, index) => {
    const row = document.createElement("li");
    row.className = "queue-item";
    row.dataset.id = item.id;

    const thumbnail = document.createElement("img");
    thumbnail.className = "queue-thumbnail";
    thumbnail.src = item.url;
    thumbnail.alt = message("imageToPdf.queue.previewAlt", { name: item.file.name });

    const details = document.createElement("div");
    details.className = "queue-details";
    const name = document.createElement("strong");
    name.className = "queue-name";
    name.textContent = item.file.name;
    name.title = item.file.name;
    const metadata = document.createElement("span");
    metadata.className = "queue-meta";
    metadata.textContent = message("imageConverter.queue.meta", { size: formatBytes(item.file.size), position: index + 1 });
    details.append(name, metadata);

    const actions = document.createElement("div");
    actions.className = "queue-actions";
    actions.append(
      createActionButton("up", "imageToPdf.queue.moveUp", "↑", index === 0),
      createActionButton("down", "imageToPdf.queue.moveDown", "↓", index === state.items.length - 1),
      createActionButton("remove", "imageToPdf.queue.remove", "×"),
    );
    row.append(thumbnail, details, actions);
    elements.list.append(row);
  });
}

async function addFiles(files) {
  const { accepted, rejected } = await selectImageQueueFiles(state.items.map((item) => item.file), files);
  accepted.forEach((file) => state.items.push({
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    file,
    url: URL.createObjectURL(file),
  }));
  if (rejected.length) setRejectedStatus(accepted.length, rejected);
  else if (accepted.length) setStatus("imageToPdf.status.added", { count: accepted.length }, "success");
  else setStatus("imageToPdf.errors.unsupported", {}, "error");
  renderQueue();
}

function removeItem(index) {
  const [item] = state.items.splice(index, 1);
  if (item) URL.revokeObjectURL(item.url);
  setStatus("imageToPdf.status.removed");
  renderQueue();
}

function moveItem(index, offset) {
  const nextIndex = moveArrayItem(state.items, index, offset);
  if (nextIndex < 0) return;
  setStatus("imageToPdf.status.reordered");
  renderQueue();
  elements.list.querySelector(`[data-id="${state.items[nextIndex].id}"] [data-action="${offset < 0 ? "up" : "down"}"]`)?.focus();
}

function clearItems() {
  state.items.forEach((item) => URL.revokeObjectURL(item.url));
  state.items.length = 0;
  elements.input.value = "";
  setStatus("imageToPdf.status.cleared");
  renderQueue();
}

function updateFormatSettings() {
  const isPng = elements.format.value === "png";
  elements.qualityField.hidden = isPng;
  elements.quality.disabled = state.busy || isPng;
}

function updateQualityValue() {
  elements.qualityValue.textContent = `${Math.round(Number(elements.quality.value) * 100)}%`;
}

function errorMessage(error) {
  const keyByCode = {
    NO_FILES: "imageConverter.errors.noFiles",
    IMAGE_FORMAT_INVALID: "imageConverter.errors.format",
    UNSUPPORTED_IMAGE: "imageToPdf.errors.unsupported",
    IMAGE_FILE_TOO_LARGE: "imageToPdf.errors.fileTooLarge",
    IMAGE_DECODE_FAILED: "imageToPdf.errors.decode",
    IMAGE_DIMENSION_EXCEEDED: "imageToPdf.errors.dimension",
    IMAGE_SIGNATURE_INVALID: "imageToPdf.errors.signature",
    IMAGE_PIXELS_EXCEEDED: "imageToPdf.errors.pixels",
    IMAGE_JOB_PIXELS_EXCEEDED: "imageConverter.errors.jobPixels",
    CANVAS_UNAVAILABLE: "imageConverter.errors.canvas",
    IMAGE_ENCODER_FAILED: "imageConverter.errors.encoder",
    ARCHIVE_LIBRARY_UNAVAILABLE: "imageConverter.errors.archiveLibrary",
    ARCHIVE_GENERATION_FAILED: "imageConverter.errors.archive",
  };
  return message(keyByCode[error.code] || "imageConverter.errors.failure", { name: error.fileName || "" });
}

async function convertQueue() {
  if (!state.items.length || state.busy) {
    setStatus("imageConverter.errors.noFiles", {}, "error");
    return;
  }

  const files = state.items.map((item) => item.file);
  const options = { files, format: elements.format.value, quality: Number(elements.quality.value) };
  let plan;
  try {
    plan = createConversionPlan(options);
  } catch (error) {
    elements.status.textContent = errorMessage(error);
    elements.status.dataset.tone = "error";
    return;
  }

  const multiple = files.length > 1;
  const filename = multiple ? plan.names.archive : plan.names.entries[0];
  const outputType = multiple ? "application/zip" : plan.mimeType;
  const extension = multiple ? ".zip" : `.${IMAGE_FORMATS[plan.format].extension}`;
  let fileHandle = null;
  if ("showSaveFilePicker" in window) {
    try {
      fileHandle = await requestSaveHandle(window, {
        suggestedName: filename,
        description: t(multiple ? "imageConverter.settings.zipFile" : "imageConverter.settings.imageFile"),
        mimeType: outputType,
        extension,
      });
    } catch (error) {
      if (error.name === "AbortError") setStatus("imageConverter.status.saveCancelled");
      else setStatus("imageConverter.errors.save", {}, "error");
      return;
    }
  }

  state.busy = true;
  elements.progress.hidden = false;
  elements.progress.max = files.length;
  elements.progress.value = 0;
  setStatus("imageConverter.status.converting");
  renderQueue();
  let converted = false;

  try {
    const result = await convertImages({
      ...options,
      JSZip: window.JSZip,
      onProgress(completed, total) {
        elements.progress.value = completed;
        setStatus("imageConverter.status.progress", { completed, total });
      },
    });
    converted = true;
    if (result.kind === "zip") setStatus("imageConverter.status.archive");
    if (fileHandle) await writeBlobToHandle(fileHandle, result.blob);
    else downloadBlob(result.blob, result.filename);
    setStatus(fileHandle ? "imageConverter.status.saved" : "imageConverter.status.downloaded", {
      name: result.filename,
      count: result.entries.length,
    }, "success");
  } catch (error) {
    console.error("Image conversion failed", error);
    elements.status.textContent = converted && !error.code ? message("imageConverter.errors.save") : errorMessage(error);
    elements.status.dataset.tone = "error";
    state.status = null;
  } finally {
    state.busy = false;
    elements.progress.hidden = true;
    renderQueue();
    updateFormatSettings();
  }
}

elements.add.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", (event) => {
  void addFiles([...event.target.files]);
  elements.input.value = "";
});
elements.clear.addEventListener("click", clearItems);
elements.convert.addEventListener("click", convertQueue);
elements.format.addEventListener("change", updateFormatSettings);
elements.quality.addEventListener("input", updateQualityValue);

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const index = state.items.findIndex((item) => item.id === button.closest("[data-id]").dataset.id);
  if (button.dataset.action === "remove") removeItem(index);
  if (button.dataset.action === "up") moveItem(index, -1);
  if (button.dataset.action === "down") moveItem(index, 1);
});

["dragenter", "dragover"].forEach((type) => elements.dropZone.addEventListener(type, (event) => {
  event.preventDefault();
  if (!state.busy) elements.dropZone.dataset.dragging = "true";
}));
["dragleave", "drop"].forEach((type) => elements.dropZone.addEventListener(type, (event) => {
  event.preventDefault();
  delete elements.dropZone.dataset.dragging;
}));
elements.dropZone.addEventListener("drop", (event) => {
  if (!state.busy) void addFiles([...event.dataTransfer.files]);
});

document.addEventListener("securetools:languagechange", () => {
  renderQueue();
  if (state.status?.rejected) setRejectedStatus(state.status.added, state.status.rejected);
  else if (state.status) setStatus(state.status.key, state.status.values, state.status.tone);
});
window.addEventListener("beforeunload", () => state.items.forEach((item) => URL.revokeObjectURL(item.url)));

updateQualityValue();
updateFormatSettings();
renderQueue();

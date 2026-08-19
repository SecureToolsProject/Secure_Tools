import { t } from "../../js/i18n.js";
import { ACCEPTED_IMAGE_TYPES, isSupportedImage } from "./image.js";
import { createPdfBlob, sanitizeFilename } from "./pdf.js";

const elements = {
  input: document.querySelector("#file-input"),
  dropZone: document.querySelector("#drop-zone"),
  list: document.querySelector("#image-list"),
  empty: document.querySelector("#queue-empty"),
  count: document.querySelector("#image-count"),
  add: document.querySelector("#add-images"),
  clear: document.querySelector("#clear-images"),
  generate: document.querySelector("#generate-pdf"),
  form: document.querySelector("#pdf-settings"),
  filename: document.querySelector("#filename"),
  progress: document.querySelector("#generation-progress"),
  status: document.querySelector("#tool-status"),
};

const state = {
  items: [],
  busy: false,
  status: null,
};

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

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`;
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
  elements.generate.disabled = state.busy || state.items.length === 0;
  elements.input.disabled = state.busy;

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
    metadata.textContent = message("imageToPdf.queue.meta", {
      size: formatBytes(item.file.size),
      page: index + 1,
    });
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

function addFiles(files) {
  const supported = files.filter(isSupportedImage);
  const rejectedCount = files.length - supported.length;

  supported.forEach((file) => {
    state.items.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
    });
  });

  if (supported.length && rejectedCount) {
    setStatus("imageToPdf.status.addedWithRejected", {
      added: supported.length,
      rejected: rejectedCount,
    }, "warning");
  } else if (supported.length) {
    setStatus("imageToPdf.status.added", { count: supported.length }, "success");
  } else {
    setStatus("imageToPdf.errors.unsupported", {}, "error");
  }
  renderQueue();
}

function removeItem(index) {
  const [item] = state.items.splice(index, 1);
  if (item) URL.revokeObjectURL(item.url);
  setStatus("imageToPdf.status.removed", {}, "neutral");
  renderQueue();
}

function moveItem(index, offset) {
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= state.items.length) return;
  [state.items[index], state.items[nextIndex]] = [state.items[nextIndex], state.items[index]];
  setStatus("imageToPdf.status.reordered", {}, "neutral");
  renderQueue();
  elements.list.querySelector(`[data-id="${state.items[nextIndex].id}"] [data-action="${offset < 0 ? "up" : "down"}"]`)?.focus();
}

function clearItems(statusKey = "imageToPdf.status.cleared") {
  state.items.forEach((item) => URL.revokeObjectURL(item.url));
  state.items.length = 0;
  elements.input.value = "";
  setStatus(statusKey, {}, "neutral");
  renderQueue();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function getOptions() {
  const data = new FormData(elements.form);
  return {
    pageSize: data.get("page-size"),
    orientation: data.get("orientation"),
    margin: Number(data.get("margin")),
    quality: Number(data.get("quality")),
    fillPage: data.get("fit") === "cover",
    autoDownload: data.get("auto-download") === "on",
    clearAfterSave: data.get("clear-after-save") === "on",
  };
}

function errorMessage(error) {
  const keyByCode = {
    NO_FILES: "imageToPdf.errors.noFiles",
    UNSUPPORTED_IMAGE: "imageToPdf.errors.unsupported",
    IMAGE_DECODE_FAILED: "imageToPdf.errors.decode",
    IMAGE_EXPORT_FAILED: "imageToPdf.errors.imageExport",
    CANVAS_UNAVAILABLE: "imageToPdf.errors.canvas",
    PDF_LIBRARY_UNAVAILABLE: "imageToPdf.errors.library",
    PDF_GENERATION_FAILED: "imageToPdf.errors.generation",
  };
  return message(keyByCode[error.code] || "imageToPdf.errors.generation", {
    name: error.fileName || "",
  });
}

async function generatePdf() {
  if (!state.items.length || state.busy) {
    setStatus("imageToPdf.errors.noFiles", {}, "error");
    return;
  }

  const options = getOptions();
  const filename = sanitizeFilename(elements.filename.value);
  let fileHandle = null;

  if (!options.autoDownload && "showSaveFilePicker" in window) {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: t("imageToPdf.settings.pdfFile"),
          accept: { "application/pdf": [".pdf"] },
        }],
      });
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus("imageToPdf.status.saveCancelled", {}, "neutral");
        return;
      }
      console.error("Save picker failed", error);
      setStatus("imageToPdf.errors.save", {}, "error");
      return;
    }
  }

  state.busy = true;
  elements.progress.hidden = false;
  elements.progress.max = state.items.length;
  elements.progress.value = 0;
  setStatus("imageToPdf.status.generating", {}, "neutral");
  renderQueue();

  try {
    const blob = await createPdfBlob({
      files: state.items.map((item) => item.file),
      options,
      JsPDF: window.jspdf?.jsPDF,
      onProgress(completed, total) {
        elements.progress.value = completed;
        setStatus("imageToPdf.status.progress", { completed, total }, "neutral");
      },
    });

    if (fileHandle) {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      setStatus("imageToPdf.status.saved", { count: state.items.length }, "success");
    } else {
      downloadBlob(blob, filename);
      setStatus("imageToPdf.status.downloaded", { name: filename }, "success");
    }

    if (options.clearAfterSave) clearItems("imageToPdf.status.savedAndCleared");
  } catch (error) {
    console.error("PDF generation failed", error);
    state.status = null;
    elements.status.textContent = errorMessage(error);
    elements.status.dataset.tone = "error";
  } finally {
    state.busy = false;
    elements.progress.hidden = true;
    renderQueue();
  }
}

elements.add.addEventListener("click", () => elements.input.click());
elements.input.addEventListener("change", (event) => {
  addFiles([...event.target.files]);
  elements.input.value = "";
});
elements.clear.addEventListener("click", () => clearItems());
elements.generate.addEventListener("click", generatePdf);

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const row = button.closest("[data-id]");
  const index = state.items.findIndex((item) => item.id === row.dataset.id);
  if (button.dataset.action === "remove") removeItem(index);
  if (button.dataset.action === "up") moveItem(index, -1);
  if (button.dataset.action === "down") moveItem(index, 1);
});

["dragenter", "dragover"].forEach((type) => {
  elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    if (!state.busy) elements.dropZone.dataset.dragging = "true";
  });
});

["dragleave", "drop"].forEach((type) => {
  elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    delete elements.dropZone.dataset.dragging;
  });
});

elements.dropZone.addEventListener("drop", (event) => {
  if (!state.busy) addFiles([...event.dataTransfer.files]);
});

document.addEventListener("securetools:languagechange", () => {
  renderQueue();
  if (state.status) setStatus(state.status.key, state.status.values, state.status.tone);
});

window.addEventListener("beforeunload", () => {
  state.items.forEach((item) => URL.revokeObjectURL(item.url));
});

renderQueue();

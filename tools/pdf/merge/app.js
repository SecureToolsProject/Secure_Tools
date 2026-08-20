import { t } from "../../../js/i18n.js";
import { formatBytes, moveArrayItem, sanitizePdfFilename } from "../../shared/file.js";
import { downloadBlob, requestPdfSaveHandle, writeBlobToHandle } from "../../shared/save.js";
import { inspectPdf, isSupportedPdf, mergePdfFiles } from "./pdf.js";

const elements = {
  input: document.querySelector("#file-input"), dropZone: document.querySelector("#drop-zone"),
  list: document.querySelector("#pdf-list"), empty: document.querySelector("#queue-empty"), count: document.querySelector("#pdf-count"),
  add: document.querySelector("#add-pdfs"), clear: document.querySelector("#clear-pdfs"), merge: document.querySelector("#merge-pdfs"),
  filename: document.querySelector("#filename"), form: document.querySelector("#merge-settings"), progress: document.querySelector("#merge-progress"), status: document.querySelector("#tool-status"),
};

const state = { items: [], busy: false, nextId: 1, status: null };
const message = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), t(key));

function setStatus(key, values = {}, tone = "neutral") {
  state.status = { key, values, tone };
  elements.status.textContent = message(key, values);
  elements.status.dataset.tone = tone;
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
  elements.count.textContent = message("mergePdf.queue.count", { count: state.items.length });
  elements.clear.disabled = state.busy || state.items.length === 0;
  elements.merge.disabled = state.busy || state.items.length === 0;
  elements.add.disabled = state.busy;
  elements.input.disabled = state.busy;

  state.items.forEach((item, index) => {
    const row = document.createElement("li");
    row.className = "queue-item pdf-queue-item";
    row.dataset.id = item.id;
    const icon = document.createElement("span");
    icon.className = "pdf-file-icon";
    icon.textContent = "PDF";
    icon.setAttribute("aria-hidden", "true");
    const details = document.createElement("div");
    details.className = "queue-details";
    const name = document.createElement("strong");
    name.className = "queue-name";
    name.textContent = item.file.name;
    const meta = document.createElement("span");
    meta.className = "queue-meta";
    meta.textContent = message("mergePdf.queue.meta", { size: formatBytes(item.file.size), pages: item.pageCount });
    details.append(name, meta);
    const actions = document.createElement("div");
    actions.className = "queue-actions";
    actions.append(
      createActionButton("up", "mergePdf.queue.moveUp", "↑", index === 0),
      createActionButton("down", "mergePdf.queue.moveDown", "↓", index === state.items.length - 1),
      createActionButton("remove", "mergePdf.queue.remove", "×"),
    );
    row.append(icon, details, actions);
    elements.list.append(row);
  });
}

function errorMessage(error) {
  const keyByCode = {
    NO_FILES: "mergePdf.errors.noFiles", UNSUPPORTED_PDF: "mergePdf.errors.unsupported", ENCRYPTED_PDF: "mergePdf.errors.encrypted",
    UNREADABLE_PDF: "mergePdf.errors.unreadable", PDF_LIBRARY_UNAVAILABLE: "mergePdf.errors.library", PDF_GENERATION_FAILED: "mergePdf.errors.generation",
  };
  return message(keyByCode[error?.code] || "mergePdf.errors.generation", { name: error?.fileName || "PDF" });
}

async function addFiles(files) {
  if (state.busy || !files.length) return;
  const candidates = files.filter(isSupportedPdf);
  let rejected = files.length - candidates.length;
  let added = 0;
  let lastError = null;
  state.busy = true;
  setStatus("mergePdf.status.validating", {}, "neutral");
  renderQueue();
  try {
    for (const file of candidates) {
      try {
        const { pageCount } = await inspectPdf(file, window.PDFLib?.PDFDocument);
        state.items.push({ id: state.nextId++, file, pageCount });
        added += 1;
      } catch (error) {
        rejected += 1;
        lastError = error;
      }
    }
  } finally {
    state.busy = false;
    elements.input.value = "";
    renderQueue();
  }
  if (added && rejected) setStatus("mergePdf.status.addedWithRejected", { added, rejected }, "warning");
  else if (added) setStatus("mergePdf.status.added", { count: added }, "success");
  else if (lastError) {
    state.status = null;
    elements.status.textContent = errorMessage(lastError);
    elements.status.dataset.tone = "error";
  } else setStatus("mergePdf.errors.unsupported", {}, "error");
}

function removeItem(index) {
  state.items.splice(index, 1);
  setStatus("mergePdf.status.removed", {}, "neutral");
  renderQueue();
}

function moveItem(index, offset) {
  const nextIndex = moveArrayItem(state.items, index, offset);
  if (nextIndex < 0) return;
  setStatus("mergePdf.status.reordered", {}, "neutral");
  renderQueue();
  elements.list.querySelector(`[data-id="${state.items[nextIndex].id}"] [data-action="${offset < 0 ? "up" : "down"}"]`)?.focus();
}

function clearItems(statusKey = "mergePdf.status.cleared") {
  state.items.length = 0;
  elements.input.value = "";
  setStatus(statusKey, {}, "neutral");
  renderQueue();
}

async function generatePdf() {
  if (!state.items.length || state.busy) {
    setStatus("mergePdf.errors.noFiles", {}, "error");
    return;
  }
  const data = new FormData(elements.form);
  const filename = sanitizePdfFilename(elements.filename.value, "merged-document");
  const autoDownload = data.get("auto-download") === "on";
  const clearAfterSave = data.get("clear-after-save") === "on";
  let fileHandle = null;

  if (!autoDownload && "showSaveFilePicker" in window) {
    try {
      fileHandle = await requestPdfSaveHandle(window, filename, t("mergePdf.settings.pdfFile"));
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus("mergePdf.status.saveCancelled", {}, "neutral");
        return;
      }
      console.error("Save picker failed", error);
      setStatus("mergePdf.errors.save", {}, "error");
      return;
    }
  }

  state.busy = true;
  elements.progress.hidden = false;
  elements.progress.max = state.items.length;
  elements.progress.value = 0;
  setStatus("mergePdf.status.merging", {}, "neutral");
  renderQueue();
  try {
    const { blob, pageCount } = await mergePdfFiles({
      files: state.items.map((item) => item.file), PDFDocument: window.PDFLib?.PDFDocument,
      onProgress(completed, total) {
        elements.progress.value = completed;
        setStatus("mergePdf.status.progress", { completed, total }, "neutral");
      },
    });
    if (fileHandle) {
      await writeBlobToHandle(fileHandle, blob);
      setStatus("mergePdf.status.saved", { pages: pageCount }, "success");
    } else {
      downloadBlob(blob, filename);
      setStatus("mergePdf.status.downloaded", { name: filename, pages: pageCount }, "success");
    }
    if (clearAfterSave) clearItems("mergePdf.status.savedAndCleared");
  } catch (error) {
    console.error("PDF merge failed", error);
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
elements.input.addEventListener("change", (event) => addFiles([...event.target.files]));
elements.clear.addEventListener("click", () => clearItems());
elements.merge.addEventListener("click", generatePdf);
elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const row = button?.closest("[data-id]");
  if (!button || !row || state.busy) return;
  const index = state.items.findIndex((item) => String(item.id) === row.dataset.id);
  if (button.dataset.action === "remove") removeItem(index);
  if (button.dataset.action === "up") moveItem(index, -1);
  if (button.dataset.action === "down") moveItem(index, 1);
});
for (const type of ["dragenter", "dragover"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); if (!state.busy) elements.dropZone.dataset.dragging = "true"; });
for (const type of ["dragleave", "drop"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); delete elements.dropZone.dataset.dragging; });
elements.dropZone.addEventListener("drop", (event) => { if (!state.busy) addFiles([...event.dataTransfer.files]); });
document.addEventListener("securetools:languagechange", () => { renderQueue(); if (state.status) setStatus(state.status.key, state.status.values, state.status.tone); });
renderQueue();

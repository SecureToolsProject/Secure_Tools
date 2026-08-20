import { t } from "../../../js/i18n.js";
import { formatBytes } from "../../shared/file.js";
import { downloadBlob, requestPdfSaveHandle, writeBlobToHandle } from "../../shared/save.js";
import { isSupportedPdf } from "../../shared/pdf.js";
import { createPageState, isDirty, movePage, removePage, resetPages, rotatePage, visiblePages } from "./model.js";
import { organizePdf, organizerFilename, readOrganizerSource } from "./pdf.js";
import { PdfThumbnailRenderer, runRenderQueue } from "./renderer.js";

const elements = {
  input: document.querySelector("#file-input"), dropZone: document.querySelector("#drop-zone"),
  empty: document.querySelector("#source-empty"), summary: document.querySelector("#source-summary"),
  grid: document.querySelector("#page-grid"), reset: document.querySelector("#reset-pages"), clear: document.querySelector("#clear-source"),
  dirty: document.querySelector("#dirty-state"), progress: document.querySelector("#render-progress"),
  filename: document.querySelector("#filename"), export: document.querySelector("#export-pdf"), status: document.querySelector("#tool-status"),
};

const state = { source: null, pages: [], renderer: null, busy: false, status: null, dragged: null };
const message = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));

function setStatus(key, values = {}, tone = "neutral") {
  state.status = key ? { key, values, tone } : null;
  elements.status.textContent = key ? message(key, values) : "";
  elements.status.dataset.tone = tone;
}

function actionButton(action, labelKey, pageNumber, symbol, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `page-action page-action--${action}`;
  button.dataset.action = action;
  button.disabled = state.busy || disabled;
  const label = message(labelKey, { page: pageNumber });
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = symbol;
  return button;
}

function renderState() {
  const hasSource = Boolean(state.source);
  const remaining = visiblePages(state.pages).length;
  elements.empty.hidden = hasSource;
  elements.summary.hidden = !hasSource;
  if (hasSource) elements.summary.textContent = message("organizePdf.workspace.summary", { name: state.source.file.name, pages: remaining, size: formatBytes(state.source.file.size) });
  elements.input.disabled = state.busy;
  elements.reset.disabled = state.busy || !hasSource || !isDirty(state.pages);
  elements.clear.disabled = state.busy || !hasSource;
  elements.filename.disabled = state.busy || !hasSource;
  elements.export.disabled = state.busy || !hasSource || remaining === 0;
  elements.dirty.hidden = !hasSource || !isDirty(state.pages);
}

function renderGrid() {
  const canvases = new Map([...elements.grid.querySelectorAll("canvas[data-original-index]")].map((canvas) => [Number(canvas.dataset.originalIndex), canvas]));
  elements.grid.replaceChildren();
  const active = visiblePages(state.pages);
  active.forEach((page, position) => {
    const item = document.createElement("li");
    item.className = "page-card";
    item.dataset.originalIndex = page.originalIndex;
    item.draggable = !state.busy;
    const preview = document.createElement("div");
    preview.className = "page-preview";
    let canvas = canvases.get(page.originalIndex);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.dataset.originalIndex = page.originalIndex;
    }
    canvas.setAttribute("aria-label", message("organizePdf.page.preview", { page: page.originalIndex + 1 }));
    preview.append(canvas);
    const label = document.createElement("div");
    label.className = "page-label";
    const title = document.createElement("strong");
    title.textContent = message("organizePdf.page.position", { position: position + 1, page: page.originalIndex + 1 });
    const rotation = document.createElement("span");
    rotation.className = "page-rotation";
    rotation.textContent = `${page.rotation}°`;
    label.append(title, rotation);
    const actions = document.createElement("div");
    actions.className = "page-actions";
    actions.append(
      actionButton("earlier", "organizePdf.page.moveEarlier", page.originalIndex + 1, "←", position === 0),
      actionButton("left", "organizePdf.page.rotateLeft", page.originalIndex + 1, "↶"),
      actionButton("right", "organizePdf.page.rotateRight", page.originalIndex + 1, "↷"),
      actionButton("later", "organizePdf.page.moveLater", page.originalIndex + 1, "→", position === active.length - 1),
      actionButton("remove", "organizePdf.page.remove", page.originalIndex + 1, message("organizePdf.page.removeText")),
    );
    item.append(preview, label, actions);
    elements.grid.append(item);
  });
  renderState();
}

async function renderThumbnails(pages = visiblePages(state.pages)) {
  let completed = 0;
  const tasks = pages.map((page) => async () => {
    const canvas = elements.grid.querySelector(`canvas[data-original-index="${page.originalIndex}"]`);
    if (!canvas) return;
    await state.renderer.render(page.originalIndex, page.rotation, canvas);
    completed += 1;
    elements.progress.value = completed;
    setStatus("organizePdf.status.preparing", { completed, total: pages.length });
  });
  elements.progress.hidden = false;
  elements.progress.max = Math.max(1, tasks.length);
  elements.progress.value = 0;
  await runRenderQueue(tasks);
  elements.progress.hidden = true;
}

function sourceBaseName(name) { return String(name || "document").replace(/\.pdf$/i, ""); }

async function destroyCurrent() {
  const renderer = state.renderer;
  state.renderer = null;
  if (renderer) {
    try { await renderer.destroy(); } catch {}
  }
  for (const canvas of elements.grid.querySelectorAll("canvas")) { canvas.width = 1; canvas.height = 1; }
  state.source = null;
  state.pages = [];
  elements.grid.replaceChildren();
}

function errorKey(error) {
  const detail = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
  if (error?.code === "UNSUPPORTED_PDF") return "organizePdf.errors.unsupported";
  if (error?.code === "ENCRYPTED_PDF" || detail.includes("password") || detail.includes("encrypt")) return "organizePdf.errors.protected";
  if (error?.code === "NO_PAGES_REMAIN") return "organizePdf.errors.noPages";
  if (error?.code === "UNREADABLE_PDF") return "organizePdf.errors.unreadable";
  return "organizePdf.errors.failure";
}

async function addSource(files) {
  if (state.busy || !files.length) return;
  if (files.length !== 1) { setStatus("organizePdf.errors.oneFile", {}, "error"); return; }
  const file = files[0];
  if (!isSupportedPdf(file)) { setStatus("organizePdf.errors.unsupported", {}, "error"); return; }
  state.busy = true;
  renderState();
  setStatus("organizePdf.status.loading");
  try {
    await destroyCurrent();
    const source = await readOrganizerSource(file, window.PDFLib?.PDFDocument);
    const renderer = new PdfThumbnailRenderer(source.bytes);
    const renderedPages = await renderer.load();
    if (renderedPages !== source.pageCount) throw new Error("PAGE_COUNT_MISMATCH");
    state.source = { file, bytes: source.bytes };
    state.pages = createPageState(source.pageCount, source.rotations);
    state.renderer = renderer;
    elements.filename.value = `${sourceBaseName(file.name)}_organized`;
    renderGrid();
    await renderThumbnails();
    setStatus("organizePdf.status.ready", { pages: source.pageCount }, "success");
  } catch (error) {
    console.error("PDF Organizer load failed", error?.name || error?.code || "error");
    await destroyCurrent();
    setStatus(errorKey(error), {}, "error");
  } finally {
    state.busy = false;
    elements.input.value = "";
    elements.progress.hidden = true;
    renderGrid();
  }
}

async function applyAction(action, originalIndex) {
  const active = visiblePages(state.pages);
  const position = active.findIndex((page) => page.originalIndex === originalIndex);
  if (action === "earlier" || action === "later") {
    if (movePage(state.pages, originalIndex, action === "earlier" ? -1 : 1) < 0) return;
    renderGrid();
    elements.grid.querySelector(`[data-original-index="${originalIndex}"] [data-action="${action}"]`)?.focus();
    setStatus("organizePdf.status.moved", { page: originalIndex + 1 }, "success");
  } else if (action === "left" || action === "right") {
    rotatePage(state.pages, originalIndex, action === "left" ? -90 : 90);
    renderGrid();
    const page = state.pages.find((item) => item.originalIndex === originalIndex);
    const canvas = elements.grid.querySelector(`canvas[data-original-index="${originalIndex}"]`);
    await state.renderer.render(originalIndex, page.rotation, canvas);
    elements.grid.querySelector(`[data-original-index="${originalIndex}"] [data-action="${action}"]`)?.focus();
    setStatus("organizePdf.status.rotated", { page: originalIndex + 1 }, "success");
  } else if (action === "remove") {
    removePage(state.pages, originalIndex);
    renderGrid();
    setStatus("organizePdf.status.removed", { page: originalIndex + 1 }, "success");
    if (position >= visiblePages(state.pages).length) elements.grid.lastElementChild?.querySelector("button")?.focus();
  }
}

async function resetChanges() {
  state.pages = resetPages(state.pages);
  renderGrid();
  state.busy = true;
  renderGrid();
  try { await renderThumbnails(); setStatus("organizePdf.status.reset", {}, "success"); }
  catch (error) { setStatus(errorKey(error), {}, "error"); }
  finally { state.busy = false; elements.progress.hidden = true; renderGrid(); }
}

async function clearSource() {
  if (state.busy) return;
  await destroyCurrent();
  elements.filename.value = "";
  setStatus("organizePdf.status.cleared");
  renderGrid();
}

async function exportPdf() {
  if (!state.source || state.busy) return;
  if (!visiblePages(state.pages).length) { setStatus("organizePdf.errors.noPages", {}, "error"); return; }
  const filename = organizerFilename(state.source.file.name, elements.filename.value);
  let handle = null;
  if ("showSaveFilePicker" in window) {
    try { handle = await requestPdfSaveHandle(window, filename, t("organizePdf.output.pdfFile")); }
    catch (error) { if (error.name === "AbortError") { setStatus("organizePdf.status.cancelled"); return; } setStatus("organizePdf.errors.save", {}, "error"); return; }
  }
  state.busy = true;
  renderGrid();
  setStatus("organizePdf.status.exporting");
  try {
    const blob = await organizePdf({ sourceBytes: state.source.bytes, pages: state.pages, PDFDocument: window.PDFLib?.PDFDocument, degrees: window.PDFLib?.degrees });
    if (handle) await writeBlobToHandle(handle, blob); else downloadBlob(blob, filename);
    setStatus(handle ? "organizePdf.status.saved" : "organizePdf.status.downloaded", { name: filename }, "success");
  } catch (error) { setStatus(errorKey(error), {}, "error"); }
  finally { state.busy = false; renderGrid(); }
}

elements.input.addEventListener("change", (event) => addSource([...event.target.files]));
elements.reset.addEventListener("click", resetChanges);
elements.clear.addEventListener("click", clearSource);
elements.export.addEventListener("click", exportPdf);
elements.grid.addEventListener("click", (event) => { const button = event.target.closest("button[data-action]"); const card = button?.closest("[data-original-index]"); if (button && card && !state.busy) applyAction(button.dataset.action, Number(card.dataset.originalIndex)); });
for (const type of ["dragenter", "dragover"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); if (!state.busy) elements.dropZone.dataset.dragging = "true"; });
for (const type of ["dragleave", "drop"]) elements.dropZone.addEventListener(type, (event) => { event.preventDefault(); delete elements.dropZone.dataset.dragging; });
elements.dropZone.addEventListener("drop", (event) => { if (!state.busy) addSource([...event.dataTransfer.files]); });
elements.grid.addEventListener("dragstart", (event) => { const card = event.target.closest("[data-original-index]"); if (!card || state.busy) return; state.dragged = Number(card.dataset.originalIndex); card.dataset.dragging = "true"; event.dataTransfer.effectAllowed = "move"; });
elements.grid.addEventListener("dragover", (event) => { const card = event.target.closest("[data-original-index]"); if (!card || state.dragged === null) return; event.preventDefault(); elements.grid.querySelectorAll("[data-drop-target]").forEach((item) => delete item.dataset.dropTarget); card.dataset.dropTarget = "true"; });
elements.grid.addEventListener("drop", (event) => { const card = event.target.closest("[data-original-index]"); if (!card || state.dragged === null) return; event.preventDefault(); const active = visiblePages(state.pages); let from = active.findIndex((page) => page.originalIndex === state.dragged); const to = active.findIndex((page) => page.originalIndex === Number(card.dataset.originalIndex)); while (from !== to) { movePage(state.pages, state.dragged, from < to ? 1 : -1); from += from < to ? 1 : -1; } const moved = state.dragged; state.dragged = null; renderGrid(); setStatus("organizePdf.status.moved", { page: moved + 1 }, "success"); });
elements.grid.addEventListener("dragend", () => { state.dragged = null; elements.grid.querySelectorAll("[data-dragging], [data-drop-target]").forEach((item) => { delete item.dataset.dragging; delete item.dataset.dropTarget; }); });
document.addEventListener("securetools:languagechange", () => { renderGrid(); if (state.status) setStatus(state.status.key, state.status.values, state.status.tone); });
window.addEventListener("beforeunload", () => { state.renderer?.destroy(); state.source = null; });
renderGrid();

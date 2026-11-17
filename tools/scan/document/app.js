import { t } from "../../../js/i18n.js";
import { createScanQueue } from "./state.js";
import { createScanPdf, createScanPdfController } from "./pdf.js";
import { createScanResultPreview } from "./result.js";
import { downloadBlob } from "../../shared/save.js";

const input = document.querySelector("#file-input");
const list = document.querySelector("#page-list");
const mode = document.querySelector("#scan-mode");
const status = document.querySelector("#tool-status");
const add = document.querySelector("#add-images");
const clear = document.querySelector("#clear-images");
const apply = document.querySelector("#apply-mode");
const cancel = document.querySelector("#cancel-scan");
let notice = null;
let noticeValues = {};
let actionVersion = 0;
const message = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(`documentScanner.${key}`));
let queueKey = "";
let pdfVersion = 0;
const queue = createScanQueue({ changed: queueChanged });
const pdf = createScanPdfController((pages, signal, onProgress) => createScanPdf({ pages, signal, onProgress, JsPDF: window.jspdf?.jsPDF }), render);
const resultPreview = createScanResultPreview(document.querySelector("#pdf-preview"), render, () => announce("pdfPreviewError"));
function invalidatePdf() { ++pdfVersion; pdf.invalidate(); resultPreview.clear(); }
function queueChanged() {
  const key = queue.pages.map(page => `${page.id}/${page.mode}`).join(",");
  if (key !== queueKey) { queueKey = key; invalidatePdf(); }
  render();
}

function announce(key, values = {}) { notice = key; noticeValues = values; render(); }
function render() {
  // Keep existing DOM nodes so progress and reorder do not steal keyboard focus.
  const focused = document.activeElement;
  for (const child of [...list.children]) if (!queue.pages.some(page => String(page.id) === child.dataset.id)) child.remove();
  queue.pages.forEach((page, index) => {
    let card = list.querySelector(`[data-id="${page.id}"]`);
    if (!card) {
      card = document.createElement("li"); card.className = "scan-page"; card.dataset.id = String(page.id);
      const image = document.createElement("img"); image.decoding = "async";
      const name = document.createElement("strong"); const details = document.createElement("p");
      const actions = document.createElement("div"); actions.className = "scan-page-actions";
      for (const action of ["up", "down", "remove"]) {
        const button = document.createElement("button"); button.type = "button"; button.className = "button button--secondary"; button.dataset.action = action; actions.append(button);
      }
      card.append(image, name, details, actions);
    }
    const image = card.querySelector("img"); if (image.getAttribute("src") !== page.url) image.src = page.url;
    image.alt = message("preview", { page: index + 1 });
    card.querySelector("strong").textContent = `${index + 1}. ${page.file.name}`;
    card.querySelector("p").textContent = `${page.width} × ${page.height} · ${message(page.mode)}`;
    for (const button of card.querySelectorAll("button")) {
      const action = button.dataset.action;
      button.textContent = message(action); button.setAttribute("aria-label", `${message(action)}: ${page.file.name}`);
      button.disabled = (action === "up" && index === 0) || (action === "down" && index === queue.pages.length - 1);
    }
    // insertBefore avoids detaching nodes already in their correct position.
    if (list.children[index] !== card) list.insertBefore(card, list.children[index] || null);
  });
  if (focused?.isConnected && document.activeElement !== focused) focused.focus();
  document.querySelector("#queue-empty").hidden = queue.pages.length > 0;
  document.querySelector("#page-count").textContent = message("count", { count: queue.pages.length });
  clear.disabled = !queue.pages.length && !queue.busy && !pdf.busy && !pdf.result;
  apply.disabled = !queue.pages.length || queue.busy;
  mode.disabled = queue.busy;
  cancel.hidden = !queue.busy;
  list.setAttribute("aria-busy", String(queue.busy));
  document.querySelector("#create-pdf").disabled = !queue.pages.length || queue.busy || pdf.busy;
  document.querySelector("#cancel-pdf").hidden = !pdf.busy;
  const progress = document.querySelector("#pdf-progress");
  progress.hidden = !pdf.busy; progress.max = pdf.total || 1; progress.value = pdf.progress;
  document.querySelector("#pdf-result").hidden = !pdf.result;
  document.querySelector("#pdf-preview").setAttribute("aria-busy", String(resultPreview.busy));
  document.querySelector("#pdf-page").textContent = resultPreview.busy ? message("pdfLoading") : message("pdfPage", { page: resultPreview.pageNumber, total: resultPreview.pageCount });
  document.querySelector("#pdf-previous").disabled = resultPreview.busy || resultPreview.pageNumber <= 1;
  document.querySelector("#pdf-next").disabled = resultPreview.busy || resultPreview.pageNumber >= resultPreview.pageCount;
  status.textContent = pdf.busy ? message("pdfProgress", { done: pdf.progress, total: pdf.total }) : queue.busy ? message("processing", { count: queue.pages.length }) : notice ? message(notice, noticeValues) : "";
}

async function addFiles(files) {
  if (!files.length) return;
  invalidatePdf();
  const version = ++actionVersion;
  try {
    const result = await queue.add(files, mode.value);
    if (version !== actionVersion) return;
    if (result.cancelled) announce("cancelled");
    else if (result.rejected.length) announce("rejected", { added: result.added, names: result.rejected.map(item => `${item.name}: ${message(errorKey(item.code))}`).join("; ") });
    else announce("added", { count: result.added });
  } catch { if (version === actionVersion) announce("failure"); }
}
function errorKey(code) {
  if (["SCAN_QUEUE_LIMIT", "IMAGE_FILE_TOO_LARGE", "IMAGE_DIMENSION_EXCEEDED", "IMAGE_PIXELS_EXCEEDED"].includes(code)) return "limit";
  if (["UNSUPPORTED_IMAGE", "IMAGE_SIGNATURE_INVALID"].includes(code)) return "unsupported";
  return "decode";
}
add.addEventListener("click", () => input.click());
input.addEventListener("change", () => { void addFiles([...input.files]); input.value = ""; });
const zone = document.querySelector("#drop-zone");
for (const event of ["dragover", "drop"]) zone.addEventListener(event, e => e.preventDefault());
zone.addEventListener("drop", event => { void addFiles([...event.dataTransfer.files]); });
document.addEventListener("paste", event => {
  if (event.target.closest?.("input, textarea, [contenteditable]")) return;
  const files = [...(event.clipboardData?.files || [])];
  if (files.length) { event.preventDefault(); void addFiles(files); }
});
clear.addEventListener("click", () => { ++actionVersion; invalidatePdf(); queue.clear(); announce("cleared"); add.focus(); });
cancel.addEventListener("click", () => { ++actionVersion; queue.cancel(); announce("cancelled"); add.focus(); });
apply.addEventListener("click", async () => {
  invalidatePdf();
  const version = ++actionVersion;
  try { const complete = await queue.setMode(mode.value); if (version === actionVersion) announce(complete ? "applied" : "cancelled"); }
  catch { if (version === actionVersion) announce("failure"); }
  finally { if (version === actionVersion && !queue.busy) apply.focus(); }
});
list.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const card = button.closest("[data-id]"); const id = Number(card.dataset.id);
  if (button.dataset.action === "remove") {
    const index = queue.pages.findIndex(page => page.id === id); queue.remove(id);
    const next = queue.pages[Math.min(index, queue.pages.length - 1)];
    (next ? list.querySelector(`[data-id="${next.id}"] [data-action="remove"]`) : add)?.focus();
    announce("removed");
  } else {
    queue.move(id, button.dataset.action === "up" ? -1 : 1); announce("reordered");
    const target = list.querySelector(`[data-id="${id}"] button:not(:disabled)`); target?.focus();
  }
});
document.addEventListener("securetools:languagechange", render);
document.querySelector("#create-pdf").addEventListener("click", async () => {
  if (queue.busy || pdf.busy || !queue.pages.length) return;
  const version = ++pdfVersion;
  resultPreview.clear();
  const creation = pdf.create(queue.pages);
  document.querySelector("#cancel-pdf").focus();
  try {
    const blob = await creation;
    if (version !== pdfVersion || !blob) return;
    announce("pdfReady");
    void resultPreview.open(blob);
  } catch (error) {
    if (version === pdfVersion) announce(error.code === "SCAN_EXPORT_LIMIT" ? "pdfLimit" : "pdfError");
  } finally {
    if (version === pdfVersion) document.querySelector("#create-pdf").focus();
  }
});
document.querySelector("#cancel-pdf").addEventListener("click", () => { ++actionVersion; invalidatePdf(); announce("pdfCancelled"); document.querySelector("#create-pdf").focus(); });
document.querySelector("#download-pdf").addEventListener("click", () => {
  if (!pdf.result) return;
  try { downloadBlob(pdf.result, "scanned-document.pdf"); announce("pdfDownloaded"); }
  catch { announce("pdfDownloadError"); }
});
async function movePdfPreview(offset) {
  const focused = document.activeElement;
  await resultPreview.move(offset);
  if (!pdf.result || (document.activeElement !== document.body && document.activeElement !== focused)) return;
  const preferred = document.querySelector(offset < 0 ? "#pdf-previous" : "#pdf-next");
  const alternate = document.querySelector(offset < 0 ? "#pdf-next" : "#pdf-previous");
  (preferred.disabled ? alternate : preferred).focus();
}
document.querySelector("#pdf-previous").addEventListener("click", () => { void movePdfPreview(-1); });
document.querySelector("#pdf-next").addEventListener("click", () => { void movePdfPreview(1); });
window.addEventListener("pagehide", event => { ++actionVersion; invalidatePdf(); if (event.persisted) queue.clear(); else queue.dispose(); });
render();

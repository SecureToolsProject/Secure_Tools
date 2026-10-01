import { t } from "../../../js/i18n.js";
import { formatBytes } from "../../shared/file.js";
import { inspectPdf } from "../../shared/pdf.js";
import { PDF_OCR_LARGE_DOCUMENT_THRESHOLD } from "../../shared/pdf-ocr.js";
import { parsePageSelection } from "../split/pdf.js";
import { createPdfToTextController } from "./controller.js";
import type { PdfToTextState } from "./controller.js";
import { copyText, downloadPdfText, formatPdfOcrText, pdfTextFilename } from "./output.js";

declare global { interface Window { PDFLib?: { PDFDocument?: unknown } } }
type ElementMap = Record<string, HTMLElement>;
const byId = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing #${id}`);
  return value as T;
};
const elements: ElementMap & {
  input: HTMLInputElement; language: HTMLSelectElement; range: HTMLInputElement;
  progress: HTMLProgressElement; all: HTMLInputElement; selected: HTMLInputElement;
} = {
  input: byId<HTMLInputElement>("file-input"), language: byId<HTMLSelectElement>("ocr-language"),
  range: byId<HTMLInputElement>("page-range"), progress: byId<HTMLProgressElement>("ocr-progress"),
  all: byId<HTMLInputElement>("pages-all"), selected: byId<HTMLInputElement>("pages-selected"),
  drop: byId("drop-zone"), sourceEmpty: byId("source-empty"), sourceCard: byId("source-card"),
  sourceName: byId("source-name"), sourceMeta: byId("source-meta"), remove: byId("remove-source"),
  replace: byId("replace-source"), warning: byId("large-warning"), rangePanel: byId("range-panel"),
  rangeError: byId("range-error"), recognize: byId("recognize"), cancel: byId("cancel"),
  status: byId("tool-status"), result: byId("result-panel"), pages: byId("result-pages"),
  copyAll: byId("copy-all"), download: byId("download-result"),
};

const template = (key: string, values: Record<string, string | number> = {}) => Object.entries(values).reduce(
  (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key),
);
const codeOf = (error: unknown) => error instanceof Error && "code" in error ? String(error.code) : "PDF_OCR_FAILED";
let latest: PdfToTextState;

function statusKey(state: PdfToTextState): string {
  if (state.phase === "preparing") return "pdfToText.status.preparing";
  if (state.phase === "ready") return "pdfToText.status.ready";
  if (state.phase === "cancelled") return "pdfToText.status.cancelled";
  if (state.phase === "success") return "pdfToText.status.success";
  if (state.phase === "error") return `pdfToText.errors.${codeOf(state.error)}`;
  return "";
}

function renderPages(state: PdfToTextState): void {
  elements.pages.replaceChildren();
  state.pages.forEach((page) => {
    const article = document.createElement("article"); article.className = "page-result surface";
    const header = document.createElement("div"); header.className = "page-result__header";
    const heading = document.createElement("h3"); heading.textContent = template("pdfToText.result.page", { page: page.pageNumber });
    const button = document.createElement("button"); button.className = "button button--secondary"; button.type = "button"; button.textContent = t("pdfToText.result.copyPage");
    const label = document.createElement("label"); const id = `page-text-${page.pageNumber}`; label.htmlFor = id; label.className = "visually-hidden"; label.textContent = template("pdfToText.result.pageLabel", { page: page.pageNumber });
    const field = document.createElement("textarea"); field.id = id; field.rows = 9; field.spellcheck = true; field.value = page.text;
    field.addEventListener("input", () => controller.updatePageText(page.pageNumber, field.value));
    button.addEventListener("click", async () => { try { await copyText(field.value); showTransient("pdfToText.status.pageCopied", { page: page.pageNumber }); } catch { showError("pdfToText.errors.copy"); } });
    header.append(heading, button); article.append(header, label, field); elements.pages.append(article);
  });
}

function progressText(state: PdfToTextState): string {
  const progress = state.progress;
  if (!progress) return t("pdfToText.progress.starting");
  if (progress.phase === "loading-document") return t("pdfToText.progress.loading");
  if (progress.phase === "complete") return t("pdfToText.progress.complete");
  return template(`pdfToText.progress.${progress.phase}`, { page: progress.pageNumber || 1, total: progress.pageCount || state.source?.pageCount || 1, percent: Math.round((progress.pageProgress || 0) * 100) });
}

function render(state: PdfToTextState): void {
  latest = state;
  const hasSource = Boolean(state.source); const busy = state.phase === "preparing" || state.phase === "recognizing";
  elements.sourceEmpty.hidden = hasSource;
  elements.sourceCard.hidden = !hasSource;
  elements.warning.hidden = !state.source || state.source.pageCount < PDF_OCR_LARGE_DOCUMENT_THRESHOLD;
  if (state.source) { elements.sourceName.textContent = state.source.file.name; elements.sourceMeta.textContent = template("pdfToText.source.meta", { pages: state.source.pageCount, size: formatBytes(state.source.file.size) }); }
  elements.input.toggleAttribute("disabled", busy); elements.language.toggleAttribute("disabled", busy);
  elements.all.toggleAttribute("disabled", busy); elements.selected.toggleAttribute("disabled", busy); elements.range.toggleAttribute("disabled", busy || !elements.selected.checked);
  elements.remove.toggleAttribute("disabled", busy); elements.replace.toggleAttribute("disabled", busy);
  elements.recognize.toggleAttribute("disabled", !hasSource || busy); elements.recognize.hidden = state.phase === "recognizing";
  elements.cancel.hidden = state.phase !== "recognizing";
  elements.progress.hidden = state.phase !== "recognizing";
  if (state.phase === "recognizing") {
    const value = state.progress?.overallProgress;
    if (value === null || value === undefined) elements.progress.removeAttribute("value"); else elements.progress.value = value;
    elements.status.textContent = progressText(state);
  } else { elements.status.textContent = statusKey(state) ? t(statusKey(state)) : ""; }
  elements.status.dataset.tone = state.phase === "error" ? "error" : state.phase === "success" ? "success" : state.phase === "cancelled" ? "warning" : "";
  elements.result.hidden = state.pages.length === 0;
  renderPages(state);
}

const controller = createPdfToTextController({
  inspect: (file) => inspectPdf(file, window.PDFLib?.PDFDocument),
  onChange: render,
});

function selectedPages() {
  if (elements.all.checked) return { mode: "all" as const };
  const pageNumbers = parsePageSelection(elements.range.value, latest.source?.pageCount || 0).map((page) => page + 1);
  if (new Set(pageNumbers).size !== pageNumbers.length) throw Object.assign(new Error("PDF_OCR_PAGE_DUPLICATE"), { code: "PDF_OCR_PAGE_DUPLICATE" });
  return { mode: "selected" as const, pageNumbers };
}
function clearRangeError(): void { elements.range.removeAttribute("aria-invalid"); elements.rangeError.textContent = ""; }
function showError(key: string): void { elements.status.textContent = t(key); elements.status.dataset.tone = "error"; }
function showTransient(key: string, values: Record<string, string | number> = {}): void { elements.status.textContent = template(key, values); elements.status.dataset.tone = "success"; }
async function choose(files: FileList | File[]): Promise<void> {
  if (files.length !== 1) { showError("pdfToText.errors.oneFile"); return; }
  clearRangeError(); await controller.select(files[0]); elements.input.value = "";
}

elements.input.addEventListener("change", () => { if (elements.input.files) void choose(elements.input.files); });
elements.replace.addEventListener("click", () => elements.input.click()); elements.remove.addEventListener("click", () => void controller.reset());
elements.cancel.addEventListener("click", () => void controller.cancel());
elements.recognize.addEventListener("click", () => { clearRangeError(); try { void controller.recognize(elements.language.value as "eng" | "kor" | "eng+kor", selectedPages()); } catch (error) { elements.range.setAttribute("aria-invalid", "true"); elements.rangeError.textContent = t(`pdfToText.errors.${codeOf(error)}`); } });
[elements.language, elements.all, elements.selected].forEach((element) => element.addEventListener("change", () => { elements.rangePanel.hidden = !elements.selected.checked; clearRangeError(); controller.invalidateResults(); }));
elements.range.addEventListener("input", () => { clearRangeError(); controller.invalidateResults(); });
elements.copyAll.addEventListener("click", async () => { try { await copyText(formatPdfOcrText(latest.pages)); showTransient("pdfToText.status.copied"); } catch { showError("pdfToText.errors.copy"); } });
elements.download.addEventListener("click", () => { try { downloadPdfText(latest.pages, latest.source?.file.name); showTransient("pdfToText.status.downloaded", { name: pdfTextFilename(latest.source?.file.name) }); } catch { showError("pdfToText.errors.download"); } });
for (const type of ["dragenter", "dragover"]) elements.drop.addEventListener(type, (event) => { event.preventDefault(); elements.drop.dataset.dragging = "true"; });
for (const type of ["dragleave", "drop"]) elements.drop.addEventListener(type, (event) => { event.preventDefault(); delete elements.drop.dataset.dragging; });
elements.drop.addEventListener("drop", (event) => { const data = (event as DragEvent).dataTransfer; if (data) void choose(data.files); });
document.addEventListener("securetools:languagechange", () => render(latest));
window.addEventListener("beforeunload", () => void controller.dispose());
render(controller.getState());

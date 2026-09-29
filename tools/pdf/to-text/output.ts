import { downloadBlob } from "../../shared/save.js";
import type { DownloadEnvironment } from "../../shared/save.js";
import type { CopyEnvironment } from "../../image/to-text/output.js";
import { copyText } from "../../image/to-text/output.js";
import type { PdfOcrPageResult } from "../../shared/pdf-ocr.js";

const ILLEGAL_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;

export function formatPdfOcrText(pages: readonly PdfOcrPageResult[]): string {
  return pages.map(({ pageNumber, text }) => `--- Page ${pageNumber} ---\n${String(text).trimEnd()}`).join("\n\n") + (pages.length ? "\n" : "");
}

export function pdfTextFilename(sourceName: unknown): string {
  const base = String(sourceName || "").replace(/\.pdf$/i, "").trim().replace(ILLEGAL_FILENAME_CHARACTERS, "_").replace(/[. ]+$/g, "");
  return `${base || "recognized-document"}.txt`;
}

export { copyText };
export function downloadPdfText(pages: readonly PdfOcrPageResult[], sourceName: unknown, environment?: DownloadEnvironment): void {
  const blob = new Blob([formatPdfOcrText(pages)], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, pdfTextFilename(sourceName), environment);
}
export type { CopyEnvironment };

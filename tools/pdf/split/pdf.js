import { sanitizePdfFilename } from "../../shared/file.js";
import { createPdfError, loadPdfSource, requirePdfDocument } from "../../shared/pdf.js";

function rangeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function validatePage(page, pageCount) {
  if (!Number.isSafeInteger(page) || page < 1) throw rangeError("PAGE_RANGE_INVALID");
  if (page > pageCount) throw rangeError("PAGE_OUT_OF_RANGE");
}

export function parsePageSelection(value, pageCount) {
  const input = String(value || "").trim();
  if (!input) throw rangeError("PAGE_RANGE_REQUIRED");

  const pages = [];
  for (const rawToken of input.split(",")) {
    const token = rawToken.trim();
    if (!token) throw rangeError("PAGE_RANGE_INVALID");

    const single = token.match(/^(\d+)$/);
    if (single) {
      const page = Number(single[1]);
      validatePage(page, pageCount);
      pages.push(page - 1);
      continue;
    }

    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!range) throw rangeError("PAGE_RANGE_INVALID");
    const start = Number(range[1]);
    const end = Number(range[2]);
    validatePage(start, pageCount);
    validatePage(end, pageCount);
    if (start > end) throw rangeError("PAGE_RANGE_REVERSED");
    for (let page = start; page <= end; page += 1) pages.push(page - 1);
  }
  return pages;
}

export function createPageGroups({ mode, selection, interval, pageCount }) {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw rangeError("PDF_HAS_NO_PAGES");
  if (mode === "extract") return [parsePageSelection(selection, pageCount)];
  if (mode === "every") return Array.from({ length: pageCount }, (_, index) => [index]);
  if (mode === "interval") {
    const size = Number(interval);
    if (!Number.isSafeInteger(size) || size < 1) throw rangeError("INTERVAL_INVALID");
    const groups = [];
    for (let start = 0; start < pageCount; start += size) {
      groups.push(Array.from({ length: Math.min(size, pageCount - start) }, (_, offset) => start + offset));
    }
    return groups;
  }
  throw rangeError("SPLIT_MODE_INVALID");
}

function filenameBase(value, fallback) {
  return sanitizePdfFilename(value, fallback).replace(/\.pdf$/i, "");
}

export function createSplitNames({ mode, groups, baseName, sourceName, pageCount }) {
  const sourceFallback = String(sourceName || "split-document").replace(/\.pdf$/i, "") || "split-document";
  const base = filenameBase(baseName, sourceFallback);
  if (mode === "extract") return { archive: null, entries: [`${base}.pdf`] };

  const width = Math.max(3, String(pageCount).length);
  const pad = (page) => String(page).padStart(width, "0");
  const entries = groups.map((group) => {
    const first = group[0] + 1;
    const last = group[group.length - 1] + 1;
    return mode === "every"
      ? `${base}_${pad(first)}.pdf`
      : `${base}_pages_${pad(first)}-${pad(last)}.pdf`;
  });
  return { archive: `${base}_split.zip`, entries };
}

async function createPdfBytes(source, pages, PDFDocument) {
  try {
    const output = await PDFDocument.create();
    const copiedPages = await output.copyPages(source, pages);
    copiedPages.forEach((page) => output.addPage(page));
    return await output.save();
  } catch (error) {
    throw createPdfError("PDF_GENERATION_FAILED", undefined, error);
  }
}

export async function splitPdfFile({
  file, mode, selection, interval, baseName, PDFDocument, JSZip,
  onPhase = () => {}, onProgress = () => {},
}) {
  requirePdfDocument(PDFDocument);
  onPhase("reading");
  const source = await loadPdfSource(file, PDFDocument);
  const pageCount = source.getPageCount();
  const groups = createPageGroups({ mode, selection, interval, pageCount });
  const names = createSplitNames({ mode, groups, baseName, sourceName: file.name, pageCount });

  onPhase("preparing");
  if (mode === "extract") {
    const bytes = await createPdfBytes(source, groups[0], PDFDocument);
    onProgress(1, 1);
    return {
      kind: "pdf", filename: names.entries[0], entries: names.entries,
      blob: new Blob([bytes], { type: "application/pdf" }), pageCount: groups[0].length,
    };
  }

  if (typeof JSZip !== "function") throw createPdfError("ARCHIVE_LIBRARY_UNAVAILABLE");
  const archive = new JSZip();
  for (let index = 0; index < groups.length; index += 1) {
    const bytes = await createPdfBytes(source, groups[index], PDFDocument);
    archive.file(names.entries[index], bytes);
    onProgress(index + 1, groups.length);
  }

  onPhase("archive");
  try {
    const blob = await archive.generateAsync({ type: "blob", compression: "STORE", streamFiles: true });
    return { kind: "zip", filename: names.archive, entries: names.entries, blob, pageCount };
  } catch (error) {
    throw createPdfError("ARCHIVE_GENERATION_FAILED", undefined, error);
  }
}

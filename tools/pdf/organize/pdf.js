import { sanitizePdfFilename } from "../../shared/file.js";
import { createPdfError, loadPdfSource, requirePdfDocument } from "../../shared/pdf.js";
import { visiblePages } from "./model.js";

export function organizerFilename(sourceName, customValue = "") {
  if (customValue.trim()) return sanitizePdfFilename(customValue, "organized-document");
  const base = String(sourceName || "document").replace(/\.pdf$/i, "");
  return sanitizePdfFilename(`${base}_organized`, "organized-document");
}

export async function readOrganizerSource(file, PDFDocument) {
  requirePdfDocument(PDFDocument);
  const document = await loadPdfSource(file, PDFDocument);
  return {
    bytes: await file.arrayBuffer(),
    pageCount: document.getPageCount(),
    rotations: document.getPages().map((page) => page.getRotation().angle),
  };
}

export async function organizePdf({ sourceBytes, pages, PDFDocument, degrees }) {
  requirePdfDocument(PDFDocument);
  const active = visiblePages(pages);
  if (!active.length) throw createPdfError("NO_PAGES_REMAIN");
  try {
    const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: false, updateMetadata: false });
    const output = await PDFDocument.create();
    const copied = await output.copyPages(source, active.map((page) => page.originalIndex));
    copied.forEach((page, index) => {
      page.setRotation(degrees(active[index].rotation));
      output.addPage(page);
    });
    return new Blob([await output.save()], { type: "application/pdf" });
  } catch (error) {
    if (error?.code) throw error;
    throw createPdfError("ORGANIZE_FAILED", "PDF", error);
  }
}

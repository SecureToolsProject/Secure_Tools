import { sanitizePdfFilename } from "../../shared/file.js";
import { createPdfError, loadPdfSource, requirePdfDocument } from "../../shared/pdf.js";
import { extractMetadata, isSupportedMetadataKey, SUPPORTED_METADATA_FIELDS } from "./model.js";

function pageSnapshot(document) {
  return document.getPages().map((page) => ({
    width: page.getSize().width,
    height: page.getSize().height,
    rotation: page.getRotation().angle,
  }));
}

function samePages(before, after) {
  return before.length === after.length && before.every((page, index) => {
    const candidate = after[index];
    return candidate
      && Math.abs(page.width - candidate.width) < 0.001
      && Math.abs(page.height - candidate.height) < 0.001
      && page.rotation === candidate.rotation;
  });
}

function infoDictionary(document) {
  const infoReference = document.context.trailerInfo.Info;
  if (!infoReference) return null;
  try {
    return document.context.lookup(infoReference);
  } catch {
    return null;
  }
}

export function metadataFilename(sourceName, customValue = "") {
  if (customValue.trim()) return sanitizePdfFilename(customValue, "clean-document");
  const base = String(sourceName || "document").replace(/\.pdf$/i, "");
  return sanitizePdfFilename(`${base}_clean`, "clean-document");
}

export async function readPdfMetadata(file, PDFDocument) {
  requirePdfDocument(PDFDocument);
  const document = await loadPdfSource(file, PDFDocument);
  return {
    bytes: await file.arrayBuffer(),
    fields: extractMetadata(document),
    pages: pageSnapshot(document),
  };
}

export async function cleanPdfMetadata({ sourceBytes, selectedKeys, PDFDocument, PDFName }) {
  requirePdfDocument(PDFDocument);
  if (typeof PDFName?.of !== "function") throw createPdfError("PDF_LIBRARY_UNAVAILABLE");

  const requested = [...new Set(selectedKeys || [])];
  if (!requested.length) throw createPdfError("NO_METADATA_SELECTED");
  if (requested.some((key) => !isSupportedMetadataKey(key))) {
    throw createPdfError("UNSUPPORTED_METADATA_FIELD");
  }

  try {
    const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: false, updateMetadata: false });
    const before = extractMetadata(source);
    const beforePages = pageSnapshot(source);
    const info = infoDictionary(source);
    const definitions = new Map(SUPPORTED_METADATA_FIELDS.map((field) => [field.key, field]));

    if (info && typeof info.delete === "function") {
      requested.forEach((key) => info.delete(PDFName.of(definitions.get(key).pdfName)));
    }

    const bytes = await source.save();
    const verified = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    const after = extractMetadata(verified);
    const afterPages = pageSnapshot(verified);
    if (!samePages(beforePages, afterPages)) throw createPdfError("PAGE_PRESERVATION_FAILED");

    const afterByKey = new Map(after.map((field) => [field.key, field]));
    const cleared = requested.filter((key) => !afterByKey.get(key)?.present);
    const retained = requested.filter((key) => afterByKey.get(key)?.present);
    if (retained.length) throw createPdfError("METADATA_VERIFICATION_FAILED");

    return {
      bytes,
      blob: new Blob([bytes], { type: "application/pdf" }),
      before,
      after,
      requested,
      cleared,
      retained,
      pages: afterPages,
    };
  } catch (error) {
    if (error?.code) throw error;
    const detail = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
    const code = detail.includes("encrypt") || detail.includes("password")
      ? "ENCRYPTED_PDF"
      : "METADATA_CLEAN_FAILED";
    throw createPdfError(code, "PDF", error);
  }
}

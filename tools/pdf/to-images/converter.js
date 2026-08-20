import { sanitizePdfFilename } from "../../shared/file.js";
import { parsePageSelection } from "../split/pdf.js";

export const IMAGE_FORMATS = Object.freeze({
  png: { extension: "png", mimeType: "image/png", label: "PNG" },
  jpeg: { extension: "jpg", mimeType: "image/jpeg", label: "JPEG" },
  webp: { extension: "webp", mimeType: "image/webp", label: "WebP" },
});
export const SCALE_PRESETS = Object.freeze([1, 1.5, 2, 3]);
export const DEFAULT_SCALE = 2;
export const DEFAULT_QUALITY = 0.92;
export const MIN_QUALITY = 0.5;
export const MAX_QUALITY = 1;
export const MAX_RENDER_DIMENSION = 16384;
export const MAX_RENDER_PIXELS = 50_000_000;
export const MAX_CONCURRENT_RENDERS = 2;

function conversionError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function sourceBaseName(value, fallback = "document") {
  return sanitizePdfFilename(value, fallback).replace(/\.pdf$/i, "");
}

export function normalizeFormat(value) {
  const format = String(value || "").toLowerCase();
  if (!IMAGE_FORMATS[format]) throw conversionError("IMAGE_FORMAT_INVALID");
  return format;
}

export function normalizeQuality(format, value = DEFAULT_QUALITY) {
  if (normalizeFormat(format) === "png") return null;
  const quality = Number(value);
  if (!Number.isFinite(quality)) return DEFAULT_QUALITY;
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, quality));
}

export function normalizeScale(value) {
  const scale = Number(value);
  if (!SCALE_PRESETS.includes(scale)) throw conversionError("IMAGE_SCALE_INVALID");
  return scale;
}

export function selectPages({ mode, selection, pageCount }) {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw conversionError("PDF_HAS_NO_PAGES");
  if (mode === "all") return Array.from({ length: pageCount }, (_, index) => index);
  if (mode === "selected") return parsePageSelection(selection, pageCount);
  throw conversionError("PAGE_MODE_INVALID");
}

export function createOutputNames({ pages, pageCount, baseName, sourceName, format }) {
  const normalizedFormat = normalizeFormat(format);
  const base = sourceBaseName(baseName, sourceBaseName(sourceName));
  const width = Math.max(3, String(pageCount).length);
  const occurrences = new Map();
  const entries = pages.map((pageIndex) => {
    const pageNumber = pageIndex + 1;
    const count = (occurrences.get(pageNumber) || 0) + 1;
    occurrences.set(pageNumber, count);
    const duplicate = count > 1 ? `_${count}` : "";
    return `${base}_page_${String(pageNumber).padStart(width, "0")}${duplicate}.${IMAGE_FORMATS[normalizedFormat].extension}`;
  });
  return { archive: `${base}_images.zip`, entries };
}

export function createConversionPlan({ mode, selection, pageCount, format, quality, scale, baseName, sourceName }) {
  const normalizedFormat = normalizeFormat(format);
  const pages = selectPages({ mode, selection, pageCount });
  const names = createOutputNames({ pages, pageCount, baseName, sourceName, format: normalizedFormat });
  return {
    pages,
    names,
    format: normalizedFormat,
    mimeType: IMAGE_FORMATS[normalizedFormat].mimeType,
    quality: normalizeQuality(normalizedFormat, quality),
    scale: normalizeScale(scale),
  };
}

export function validateRenderDimensions(width, height) {
  const roundedWidth = Math.ceil(Number(width));
  const roundedHeight = Math.ceil(Number(height));
  if (!Number.isSafeInteger(roundedWidth) || !Number.isSafeInteger(roundedHeight) || roundedWidth < 1 || roundedHeight < 1) {
    throw conversionError("RENDER_DIMENSIONS_INVALID");
  }
  if (roundedWidth > MAX_RENDER_DIMENSION || roundedHeight > MAX_RENDER_DIMENSION) throw conversionError("RENDER_DIMENSION_EXCEEDED");
  if (roundedWidth * roundedHeight > MAX_RENDER_PIXELS) throw conversionError("RENDER_PIXELS_EXCEEDED");
  return { width: roundedWidth, height: roundedHeight };
}

export function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== mimeType) reject(conversionError("IMAGE_ENCODER_FAILED"));
      else resolve(blob);
    }, mimeType, quality ?? undefined);
  });
}

export async function renderPageImage({ renderer, pageIndex, scale, mimeType, quality, canvasFactory, signal }) {
  if (signal?.aborted) throw conversionError("CONVERSION_CANCELLED");
  const page = await renderer.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const dimensions = validateRenderDimensions(viewport.width, viewport.height);
  const canvas = canvasFactory();
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw conversionError("CANVAS_UNAVAILABLE");
  try {
    await renderer.runRender(page, { canvasContext: context, viewport, background: "#ffffff" });
    if (signal?.aborted) throw conversionError("CONVERSION_CANCELLED");
    return await canvasToBlob(canvas, mimeType, quality);
  } catch (error) {
    if (signal?.aborted) throw conversionError("CONVERSION_CANCELLED", error);
    if (error?.code) throw error;
    throw conversionError("PAGE_RENDER_FAILED", error);
  } finally {
    page.cleanup();
    canvas.width = 1;
    canvas.height = 1;
  }
}

export async function packageRenderedImages({ blobs, names, JSZip }) {
  if (blobs.length !== names.entries.length || blobs.length < 1) throw conversionError("OUTPUT_INVALID");
  if (blobs.length === 1) return { kind: "image", filename: names.entries[0], entries: names.entries, blob: blobs[0] };
  if (typeof JSZip !== "function") throw conversionError("ARCHIVE_LIBRARY_UNAVAILABLE");
  const archive = new JSZip();
  const { LocalPdfRenderer, runRenderQueue } = await import("../../shared/pdf-renderer.js");
  blobs.forEach((blob, index) => archive.file(names.entries[index], blob));
  try {
    const blob = await archive.generateAsync({ type: "blob", compression: "STORE", streamFiles: true });
    return { kind: "zip", filename: names.archive, entries: names.entries, blob };
  } catch (error) {
    throw conversionError("ARCHIVE_GENERATION_FAILED", error);
  }
}

export async function convertPdfToImages({
  sourceBytes, pageCount, mode, selection, format, quality, scale, baseName, sourceName, JSZip,
  canvasFactory = () => document.createElement("canvas"), signal, onPhase = () => {}, onProgress = () => {},
}) {
  const plan = createConversionPlan({ mode, selection, pageCount, format, quality, scale, baseName, sourceName });
  const renderer = new LocalPdfRenderer(sourceBytes);
  const abort = () => { renderer.destroy().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    onPhase("reading");
    const renderedPageCount = await renderer.load();
    if (renderedPageCount !== pageCount) throw conversionError("PAGE_COUNT_MISMATCH");
    onPhase("rendering");
    const blobs = new Array(plan.pages.length);
    let completed = 0;
    const tasks = plan.pages.map((pageIndex, outputIndex) => async () => {
      blobs[outputIndex] = await renderPageImage({
        renderer, pageIndex, scale: plan.scale, mimeType: plan.mimeType, quality: plan.quality, canvasFactory, signal,
      });
      completed += 1;
      onProgress(completed, plan.pages.length, pageIndex + 1);
    });
    await runRenderQueue(tasks, MAX_CONCURRENT_RENDERS);
    if (signal?.aborted) throw conversionError("CONVERSION_CANCELLED");
    onPhase(blobs.length === 1 ? "saving" : "archive");
    return { ...(await packageRenderedImages({ blobs, names: plan.names, JSZip })), plan };
  } catch (error) {
    if (signal?.aborted && error?.code !== "CONVERSION_CANCELLED") throw conversionError("CONVERSION_CANCELLED", error);
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    await renderer.destroy().catch(() => {});
  }
}

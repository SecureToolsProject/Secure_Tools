import { decodeImage } from "../../shared/image.js";

export const IMAGE_FORMATS = Object.freeze({
  jpeg: { extension: "jpg", mimeType: "image/jpeg", label: "JPEG" },
  png: { extension: "png", mimeType: "image/png", label: "PNG" },
  webp: { extension: "webp", mimeType: "image/webp", label: "WebP" },
});
export const DEFAULT_QUALITY = 0.92;
export const MIN_QUALITY = 0.5;
export const MAX_QUALITY = 1;
export const MAX_JOB_PIXELS = 200_000_000;
export const ARCHIVE_FILENAME = "converted_images.zip";

const ILLEGAL_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;
const INPUT_EXTENSION = /\.(?:jpe?g|png|webp)$/i;
export const MAX_BASE_CHARACTERS = 120;
export const MAX_BASE_BYTES = 180;

function conversionError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
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

export function sourceBaseName(value, fallback = "image") {
  const clean = String(value || "")
    .trim()
    .replace(INPUT_EXTENSION, "")
    .replace(ILLEGAL_FILENAME_CHARACTERS, "_")
    .replace(/[. ]+$/g, "");
  const encoder = new TextEncoder();
  const output = [];
  let bytes = 0;
  for (const character of Array.from(clean || fallback).slice(0, MAX_BASE_CHARACTERS)) {
    const characterBytes = encoder.encode(character).length;
    if (bytes + characterBytes > MAX_BASE_BYTES) break;
    output.push(character);
    bytes += characterBytes;
  }
  return output.join("") || fallback;
}

export function createOutputNames(files, format) {
  const normalizedFormat = normalizeFormat(format);
  const extension = IMAGE_FORMATS[normalizedFormat].extension;
  const used = new Set();
  const entries = files.map((file) => {
    const base = sourceBaseName(file?.name);
    let suffix = 1;
    let candidate = `${base}.${extension}`;
    while (used.has(candidate.toLocaleLowerCase("en-US"))) {
      suffix += 1;
      candidate = `${base}_${suffix}.${extension}`;
    }
    used.add(candidate.toLocaleLowerCase("en-US"));
    return candidate;
  });
  return { archive: ARCHIVE_FILENAME, entries };
}

export function createConversionPlan({ files, format, quality }) {
  if (!Array.isArray(files) || files.length < 1) throw conversionError("NO_FILES");
  const normalizedFormat = normalizeFormat(format);
  return {
    format: normalizedFormat,
    mimeType: IMAGE_FORMATS[normalizedFormat].mimeType,
    quality: normalizeQuality(normalizedFormat, quality),
    names: createOutputNames(files, normalizedFormat),
  };
}

export function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== mimeType) reject(conversionError("IMAGE_ENCODER_FAILED"));
      else resolve(blob);
    }, mimeType, quality ?? undefined);
  });
}

export async function renderDecodedImage({ decoded, format, quality, canvasFactory = () => document.createElement("canvas") }) {
  const normalizedFormat = normalizeFormat(format);
  const canvas = canvasFactory();
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const jpeg = normalizedFormat === "jpeg";
  const context = canvas.getContext("2d", { alpha: !jpeg });
  if (!context) throw conversionError("CANVAS_UNAVAILABLE");
  try {
    if (jpeg) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(decoded.source, 0, 0);
    return await canvasToBlob(canvas, IMAGE_FORMATS[normalizedFormat].mimeType, normalizeQuality(normalizedFormat, quality));
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

export async function packageConvertedImages({ blobs, names, JSZip }) {
  if (blobs.length !== names.entries.length || blobs.length < 1) throw conversionError("OUTPUT_INVALID");
  if (blobs.length === 1) return { kind: "image", filename: names.entries[0], entries: names.entries, blob: blobs[0] };
  if (typeof JSZip !== "function") throw conversionError("ARCHIVE_LIBRARY_UNAVAILABLE");
  const archive = new JSZip();
  for (let index = 0; index < blobs.length; index += 1) {
    archive.file(names.entries[index], new Uint8Array(await blobs[index].arrayBuffer()));
  }
  try {
    const blob = await archive.generateAsync({ type: "blob", compression: "STORE", streamFiles: true });
    return { kind: "zip", filename: names.archive, entries: names.entries, blob };
  } catch (error) {
    throw conversionError("ARCHIVE_GENERATION_FAILED", error);
  }
}

export async function convertImages({
  files, format, quality, JSZip, decode = decodeImage,
  canvasFactory = () => document.createElement("canvas"), onProgress = () => {},
}) {
  const plan = createConversionPlan({ files, format, quality });
  const blobs = [];
  let totalPixels = 0;

  for (let index = 0; index < files.length; index += 1) {
    let decoded;
    try {
      decoded = await decode(files[index]);
      totalPixels += decoded.width * decoded.height;
      if (totalPixels > MAX_JOB_PIXELS) throw conversionError("IMAGE_JOB_PIXELS_EXCEEDED");
      blobs.push(await renderDecodedImage({
        decoded,
        format: plan.format,
        quality: plan.quality,
        canvasFactory,
      }));
      onProgress(index + 1, files.length, files[index]);
    } catch (error) {
      if (!error.fileName) error.fileName = files[index]?.name || "";
      throw error;
    } finally {
      decoded?.close();
    }
  }

  return { ...(await packageConvertedImages({ blobs, names: plan.names, JSZip })), plan };
}

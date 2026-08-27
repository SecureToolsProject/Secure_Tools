export const IMAGE_FORMATS = Object.freeze({
  jpeg: { extension: "jpg", mimeType: "image/jpeg", label: "JPEG" },
  png: { extension: "png", mimeType: "image/png", label: "PNG" },
  webp: { extension: "webp", mimeType: "image/webp", label: "WebP" },
});
export const DEFAULT_QUALITY = 0.92;
export const MIN_QUALITY = 0.5;
export const MAX_QUALITY = 1;
export const MAX_BASE_CHARACTERS = 120;
export const MAX_BASE_BYTES = 180;

const ILLEGAL_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;
const INPUT_EXTENSION = /\.(?:jpe?g|png|webp)$/i;

export function imageOutputError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

export function normalizeFormat(value) {
  const format = String(value || "").toLowerCase();
  if (!IMAGE_FORMATS[format]) throw imageOutputError("IMAGE_FORMAT_INVALID");
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

export function createImageOutputNames(files, formats, { suffix = "", archive = "images.zip" } = {}) {
  const formatList = Array.isArray(formats) ? formats : files.map(() => formats);
  if (formatList.length !== files.length) throw imageOutputError("OUTPUT_INVALID");
  const used = new Set();
  const entries = files.map((file, index) => {
    const extension = IMAGE_FORMATS[normalizeFormat(formatList[index])].extension;
    const base = `${sourceBaseName(file?.name)}${suffix}`;
    let collision = 1;
    let candidate = `${base}.${extension}`;
    while (used.has(candidate.toLocaleLowerCase("en-US"))) {
      collision += 1;
      candidate = `${base}_${collision}.${extension}`;
    }
    used.add(candidate.toLocaleLowerCase("en-US"));
    return candidate;
  });
  return { archive, entries };
}

export function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== mimeType) reject(imageOutputError("IMAGE_ENCODER_FAILED"));
      else resolve(blob);
    }, mimeType, quality ?? undefined);
  });
}

export async function renderDecodedImage({ decoded, format, quality, width = null, height = null, canvasFactory = () => document.createElement("canvas") }) {
  const normalizedFormat = normalizeFormat(format);
  const canvas = canvasFactory();
  const outputWidth = width ?? decoded.width;
  const outputHeight = height ?? decoded.height;
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const jpeg = normalizedFormat === "jpeg";
  const context = canvas.getContext("2d", { alpha: !jpeg });
  if (!context) throw imageOutputError("CANVAS_UNAVAILABLE");
  try {
    if (jpeg) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (width === null && height === null) context.drawImage(decoded.source, 0, 0);
    else context.drawImage(decoded.source, 0, 0, outputWidth, outputHeight);
    return await canvasToBlob(canvas, IMAGE_FORMATS[normalizedFormat].mimeType, normalizeQuality(normalizedFormat, quality));
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

export async function packageImageOutputs({ blobs, names, JSZip }) {
  if (blobs.length !== names.entries.length || blobs.length < 1) throw imageOutputError("OUTPUT_INVALID");
  if (blobs.length === 1) return { kind: "image", filename: names.entries[0], entries: names.entries, blob: blobs[0] };
  if (typeof JSZip !== "function") throw imageOutputError("ARCHIVE_LIBRARY_UNAVAILABLE");
  const archive = new JSZip();
  for (let index = 0; index < blobs.length; index += 1) {
    archive.file(names.entries[index], new Uint8Array(await blobs[index].arrayBuffer()));
  }
  try {
    const blob = await archive.generateAsync({ type: "blob", compression: "STORE", streamFiles: true });
    return { kind: "zip", filename: names.archive, entries: names.entries, blob };
  } catch (error) {
    throw imageOutputError("ARCHIVE_GENERATION_FAILED", error);
  }
}

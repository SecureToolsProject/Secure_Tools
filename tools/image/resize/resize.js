import { decodeImage, validateImageDimensions, validateImageSignature } from "../../shared/image.js";
import {
  createImageOutputNames,
  IMAGE_FORMATS,
  normalizeFormat,
  normalizeQuality,
  packageImageOutputs,
  renderDecodedImage,
} from "../../shared/image-output.js";

export const RESIZE_MODES = Object.freeze(["pixels", "percentage"]);
export const OUTPUT_FORMATS = Object.freeze(["original", "jpeg", "png", "webp"]);
export const DEFAULT_PERCENTAGE = 50;
export const MAX_PERCENTAGE = 1000;
export const MAX_OUTPUT_JOB_PIXELS = 200_000_000;
export const ARCHIVE_FILENAME = "resized_images.zip";

function resizeError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function positiveInteger(value, required = true) {
  if (value === "" || value === null || value === undefined) {
    if (required) throw resizeError("RESIZE_DIMENSION_REQUIRED");
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw resizeError("RESIZE_DIMENSION_INVALID");
  return number;
}

export function normalizeResizeMode(value) {
  if (!RESIZE_MODES.includes(value)) throw resizeError("RESIZE_MODE_INVALID");
  return value;
}

export function normalizeOutputFormat(value) {
  const format = String(value || "").toLowerCase();
  if (!OUTPUT_FORMATS.includes(format)) throw resizeError("IMAGE_FORMAT_INVALID");
  return format;
}

export function calculateResizeDimensions({
  sourceWidth, sourceHeight, mode = "pixels", width = null, height = null,
  percentage = DEFAULT_PERCENTAGE, lockAspectRatio = true, allowEnlargement = false,
}) {
  validateImageDimensions(sourceWidth, sourceHeight);
  const normalizedMode = normalizeResizeMode(mode);
  let outputWidth;
  let outputHeight;

  if (normalizedMode === "percentage") {
    const percent = Number(percentage);
    if (!Number.isFinite(percent) || percent <= 0 || percent > MAX_PERCENTAGE) throw resizeError("RESIZE_PERCENTAGE_INVALID");
    const scale = allowEnlargement ? percent / 100 : Math.min(1, percent / 100);
    outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    outputHeight = Math.max(1, Math.round(sourceHeight * scale));
  } else if (lockAspectRatio) {
    const requestedWidth = positiveInteger(width, false);
    const requestedHeight = positiveInteger(height, false);
    if (requestedWidth === null && requestedHeight === null) throw resizeError("RESIZE_DIMENSION_REQUIRED");
    const scales = [];
    if (requestedWidth !== null) scales.push(requestedWidth / sourceWidth);
    if (requestedHeight !== null) scales.push(requestedHeight / sourceHeight);
    let scale = Math.min(...scales);
    if (!allowEnlargement) scale = Math.min(1, scale);
    outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    outputHeight = Math.max(1, Math.round(sourceHeight * scale));
  } else {
    outputWidth = positiveInteger(width);
    outputHeight = positiveInteger(height);
    if (!allowEnlargement) {
      outputWidth = Math.min(sourceWidth, outputWidth);
      outputHeight = Math.min(sourceHeight, outputHeight);
    }
  }

  validateImageDimensions(outputWidth, outputHeight);
  return { width: outputWidth, height: outputHeight };
}

export function resolveOutputFormats(outputFormat, sourceFormats) {
  const normalized = normalizeOutputFormat(outputFormat);
  return sourceFormats.map((sourceFormat) => normalized === "original" ? normalizeFormat(sourceFormat) : normalizeFormat(normalized));
}

export function createResizePlan({ files, sourceFormats, outputFormat, quality, settings }) {
  if (!Array.isArray(files) || files.length < 1) throw resizeError("NO_FILES");
  if (!Array.isArray(sourceFormats) || sourceFormats.length !== files.length) throw resizeError("OUTPUT_INVALID");
  const formats = resolveOutputFormats(outputFormat, sourceFormats);
  return {
    formats,
    qualities: formats.map((format) => normalizeQuality(format, quality)),
    names: createImageOutputNames(files, formats, { suffix: "_resized", archive: ARCHIVE_FILENAME }),
    settings: { ...settings, mode: normalizeResizeMode(settings.mode) },
  };
}

export async function resizeImages({
  files, outputFormat, quality, settings, JSZip, decode = decodeImage,
  identify = validateImageSignature, canvasFactory = () => document.createElement("canvas"), onProgress = () => {},
}) {
  const sourceFormats = [];
  for (const file of files) sourceFormats.push(await identify(file));
  const plan = createResizePlan({ files, sourceFormats, outputFormat, quality, settings });
  const blobs = [];
  const results = [];
  let outputPixels = 0;

  for (let index = 0; index < files.length; index += 1) {
    let decoded;
    try {
      decoded = await decode(files[index]);
      const dimensions = calculateResizeDimensions({
        sourceWidth: decoded.width,
        sourceHeight: decoded.height,
        ...plan.settings,
      });
      outputPixels += dimensions.width * dimensions.height;
      if (outputPixels > MAX_OUTPUT_JOB_PIXELS) throw resizeError("RESIZE_JOB_PIXELS_EXCEEDED");
      blobs.push(await renderDecodedImage({
        decoded,
        format: plan.formats[index],
        quality: plan.qualities[index],
        width: dimensions.width,
        height: dimensions.height,
        canvasFactory,
      }));
      results.push({ original: { width: decoded.width, height: decoded.height }, output: dimensions });
      onProgress(index + 1, files.length, files[index], results.at(-1));
    } catch (error) {
      if (!error.fileName) error.fileName = files[index]?.name || "";
      throw error;
    } finally {
      decoded?.close();
    }
  }

  return { ...(await packageImageOutputs({ blobs, names: plan.names, JSZip })), plan, results };
}

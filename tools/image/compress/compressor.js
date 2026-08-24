import { decodeImage, validateImageSignature } from "../../shared/image.js";
import {
  createImageOutputNames,
  IMAGE_FORMATS,
  normalizeFormat,
  normalizeQuality,
  packageImageOutputs,
  renderDecodedImage,
} from "../../shared/image-output.js";

export const OUTPUT_FORMATS = Object.freeze(["original", "jpeg", "png", "webp"]);
export const MAX_JOB_PIXELS = 200_000_000;
export const ARCHIVE_FILENAME = "compressed_images.zip";

function compressionError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

export function normalizeOutputFormat(value) {
  const format = String(value || "").toLowerCase();
  if (!OUTPUT_FORMATS.includes(format)) throw compressionError("IMAGE_FORMAT_INVALID");
  return format;
}

export function resolveOutputFormats(outputFormat, sourceFormats) {
  const normalized = normalizeOutputFormat(outputFormat);
  return sourceFormats.map((sourceFormat) => normalized === "original" ? normalizeFormat(sourceFormat) : normalizeFormat(normalized));
}

export function calculateCompressionMetrics(originalSize, resultSize) {
  const original = Number(originalSize);
  const result = Number(resultSize);
  if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(result) || result < 0) throw compressionError("COMPRESSION_SIZE_INVALID");
  const difference = original - result;
  const reductionPercent = Math.round((difference / original) * 1000) / 10;
  return { originalSize: original, resultSize: result, difference, reductionPercent, larger: difference < 0 };
}

export function calculateAggregateMetrics(results) {
  if (!Array.isArray(results) || results.length < 1) throw compressionError("OUTPUT_INVALID");
  return calculateCompressionMetrics(
    results.reduce((total, result) => total + result.originalSize, 0),
    results.reduce((total, result) => total + result.resultSize, 0),
  );
}

export function createCompressionPlan({ files, sourceFormats, outputFormat, quality }) {
  if (!Array.isArray(files) || files.length < 1) throw compressionError("NO_FILES");
  if (!Array.isArray(sourceFormats) || sourceFormats.length !== files.length) throw compressionError("OUTPUT_INVALID");
  const formats = resolveOutputFormats(outputFormat, sourceFormats);
  return {
    formats,
    qualities: formats.map((format) => normalizeQuality(format, quality)),
    names: createImageOutputNames(files, formats, { suffix: "_compressed", archive: ARCHIVE_FILENAME }),
  };
}

export async function compressImages({
  files, outputFormat, quality, JSZip, decode = decodeImage, identify = validateImageSignature,
  canvasFactory = () => document.createElement("canvas"), onProgress = () => {},
}) {
  const sourceFormats = [];
  for (const file of files) sourceFormats.push(await identify(file));
  const plan = createCompressionPlan({ files, sourceFormats, outputFormat, quality });
  const blobs = [];
  const results = [];
  let decodedPixels = 0;

  for (let index = 0; index < files.length; index += 1) {
    let decoded;
    try {
      decoded = await decode(files[index]);
      decodedPixels += decoded.width * decoded.height;
      if (decodedPixels > MAX_JOB_PIXELS) throw compressionError("IMAGE_JOB_PIXELS_EXCEEDED");
      const blob = await renderDecodedImage({ decoded, format: plan.formats[index], quality: plan.qualities[index], canvasFactory });
      blobs.push(blob);
      const metrics = calculateCompressionMetrics(files[index].size, blob.size);
      results.push({ name: plan.names.entries[index], width: decoded.width, height: decoded.height, ...metrics });
      onProgress(index + 1, files.length, files[index], results.at(-1));
    } catch (error) {
      if (!error.fileName) error.fileName = files[index]?.name || "";
      throw error;
    } finally {
      decoded?.close();
    }
  }

  return { ...(await packageImageOutputs({ blobs, names: plan.names, JSZip })), plan, results, aggregate: calculateAggregateMetrics(results) };
}

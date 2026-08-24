import { decodeImage } from "../../shared/image.js";
import {
  createImageOutputNames,
  DEFAULT_QUALITY,
  IMAGE_FORMATS,
  MAX_BASE_BYTES,
  MAX_BASE_CHARACTERS,
  normalizeFormat,
  normalizeQuality,
  packageImageOutputs,
  renderDecodedImage,
  sourceBaseName,
} from "../../shared/image-output.js";

export {
  DEFAULT_QUALITY, IMAGE_FORMATS, MAX_BASE_BYTES, MAX_BASE_CHARACTERS,
  normalizeFormat, normalizeQuality, renderDecodedImage, sourceBaseName,
};
export const MAX_JOB_PIXELS = 200_000_000;
export const ARCHIVE_FILENAME = "converted_images.zip";

function conversionError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

export function createOutputNames(files, format) {
  const normalizedFormat = normalizeFormat(format);
  return createImageOutputNames(files, normalizedFormat, { archive: ARCHIVE_FILENAME });
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

export async function packageConvertedImages({ blobs, names, JSZip }) {
  return packageImageOutputs({ blobs, names, JSZip });
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

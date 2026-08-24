const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_DIMENSION = 16384;
export const MAX_PIXELS = 50_000_000;
export const MAX_QUEUE_FILES = 100;
export const MAX_QUEUE_BYTES = 500 * 1024 * 1024;

function imageError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function isSupportedImage(file) {
  if (!(file instanceof Blob)) return false;
  if (SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) return true;
  return !file.type && SUPPORTED_EXTENSIONS.test(file.name || "");
}
export function detectImageFormat(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes || 0);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((value, index) => bytes[index] === value)) return "png";
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "webp";
  return null;
}

export async function validateImageSignature(file) {
  if (!(file instanceof Blob)) throw imageError("UNSUPPORTED_IMAGE");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const format = detectImageFormat(bytes);
  if (!format) throw imageError("IMAGE_SIGNATURE_INVALID");
  return format;
}


export async function selectImageQueueFiles(existingFiles, candidates) {
  const accepted = [];
  const rejected = [];
  let count = existingFiles.length;
  let bytes = existingFiles.reduce((total, file) => total + file.size, 0);

  for (const file of candidates) {
    let code = null;
    if (!(file instanceof Blob)) code = "UNSUPPORTED_IMAGE";
    else if (file.size > MAX_FILE_SIZE) code = "IMAGE_FILE_TOO_LARGE";
    else if (count >= MAX_QUEUE_FILES) code = "IMAGE_QUEUE_FILES_EXCEEDED";
    else if (bytes + file.size > MAX_QUEUE_BYTES) code = "IMAGE_QUEUE_BYTES_EXCEEDED";
    else {
      try { await validateImageSignature(file); }
      catch (error) { code = error.code || "IMAGE_SIGNATURE_INVALID"; }
    }

    if (code) rejected.push({ file, code });
    else {
      accepted.push(file);
      count += 1;
      bytes += file.size;
    }
  }
  return { accepted, rejected };
}

export function validateImageDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw imageError("IMAGE_DECODE_FAILED");
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) throw imageError("IMAGE_DIMENSION_EXCEEDED");
  if (width * height > MAX_PIXELS) throw imageError("IMAGE_PIXELS_EXCEEDED");
  return true;
}

function imageDecodeError(cause) {
  const error = new Error("IMAGE_DECODE_FAILED", { cause });
  error.code = "IMAGE_DECODE_FAILED";
  return error;
}

async function decodeWithImageElement(file) {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = objectUrl;
    });
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    validateImageDimensions(width, height);
    return { source: image, width, height, close() { image.removeAttribute("src"); URL.revokeObjectURL(objectUrl); } };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    if (error.code) throw error;
    throw imageDecodeError(error);
  }
}

export async function decodeImage(file) {
  if (file.size > MAX_FILE_SIZE) throw imageError("IMAGE_FILE_TOO_LARGE");
  await validateImageSignature(file);

  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      try { validateImageDimensions(bitmap.width, bitmap.height); }
      catch (error) { bitmap.close(); throw error; }
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch (error) {
      if (error.code) throw error;
      // Some browsers reject formats they can decode through an HTMLImageElement.
    }
  }
  return decodeWithImageElement(file);
}

export function imageToJpegData(image, quality = 0.92) {
  validateImageDimensions(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw imageError("CANVAS_UNAVAILABLE");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image.source, 0, 0);
  try {
    return canvas.toDataURL("image/jpeg", Math.min(1, Math.max(0.4, quality)));
  } catch (cause) {
    const error = new Error("IMAGE_EXPORT_FAILED", { cause });
    error.code = "IMAGE_EXPORT_FAILED";
    throw error;
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

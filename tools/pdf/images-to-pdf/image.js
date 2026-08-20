const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export function isSupportedImage(file) {
  if (!(file instanceof Blob)) return false;
  if (SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) return true;
  return !file.type && SUPPORTED_EXTENSIONS.test(file.name || "");
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

    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close() {
        image.removeAttribute("src");
        URL.revokeObjectURL(objectUrl);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw imageDecodeError(error);
  }
}

export async function decodeImage(file) {
  if (!isSupportedImage(file)) {
    const error = new Error("UNSUPPORTED_IMAGE");
    error.code = "UNSUPPORTED_IMAGE";
    throw error;
  }

  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      if (!bitmap.width || !bitmap.height) throw new Error("Empty image");
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Some browsers expose createImageBitmap but reject formats they can
      // still decode through an HTMLImageElement.
    }
  }

  return decodeWithImageElement(file);
}

export function imageToJpegData(image, quality = 0.92) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    const error = new Error("CANVAS_UNAVAILABLE");
    error.code = "CANVAS_UNAVAILABLE";
    throw error;
  }

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

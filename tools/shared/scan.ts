import { decodeImage } from "./image.js";
import type { DecodedImage } from "./image.js";

export const SCAN_MODES = ["original", "grayscale", "document"] as const;
export type ScanMode = typeof SCAN_MODES[number];
export const SCAN_PREVIEW_EDGE = 1000;

// Return a copy: callers may safely reuse the original pixels for other modes.
export function preprocessScanPixels(source: Uint8ClampedArray, mode: ScanMode): Uint8ClampedArray {
  if (!SCAN_MODES.includes(mode)) throw new Error("SCAN_MODE_INVALID");
  const output = new Uint8ClampedArray(source);
  if (mode === "original") return output;
  for (let i = 0; i < output.length; i += 4) {
    const gray = Math.round(source[i] * 0.299 + source[i + 1] * 0.587 + source[i + 2] * 0.114);
    const value = mode === "document" ? (gray >= 160 ? 255 : 0) : gray;
    output[i] = output[i + 1] = output[i + 2] = value;
  }
  return output;
}

function checkCancellation(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
}

export interface ScanPreview { blob: Blob; width: number; height: number }
export interface ScanPreviewOptions {
  signal?: AbortSignal;
  decode?: (file: Blob) => Promise<DecodedImage>;
  canvasFactory?: () => HTMLCanvasElement;
}

export interface ScanRasterOptions extends ScanPreviewOptions { maxEdge?: number }

// Only the source File and a bounded preview are retained by the page queue.
// Future exports can decode the source again without exporting thumbnail pixels.
export async function createScanPreview(file: Blob, mode: ScanMode, options: ScanPreviewOptions = {}): Promise<ScanPreview> {
  checkCancellation(options.signal);
  const image = await (options.decode || decodeImage)(file);
  try { return await renderScanImage(image, mode, { ...options, maxEdge: SCAN_PREVIEW_EDGE }); }
  finally { image.close(); }
}

// No maxEdge means full decoded source resolution. Export callers own image.close.
export async function renderScanImage(image: DecodedImage, mode: ScanMode, options: ScanRasterOptions = {}): Promise<ScanPreview> {
  let canvas: HTMLCanvasElement | undefined;
  try {
    checkCancellation(options.signal);
    canvas = (options.canvasFactory || (() => document.createElement("canvas")))();
    const ratio = Math.min(1, (options.maxEdge ?? Infinity) / Math.max(image.width, image.height));
    const width = canvas.width = Math.max(1, Math.round(image.width * ratio));
    const height = canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("CANVAS_UNAVAILABLE");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image.source, 0, 0, width, height);
    if (mode !== "original") {
      // Bounded strips avoid two additional full-resolution pixel buffers.
      for (let y = 0; y < height; y += 64) {
        checkCancellation(options.signal);
        const pixels = context.getImageData(0, y, width, Math.min(64, height - y));
        pixels.data.set(preprocessScanPixels(pixels.data, mode));
        context.putImageData(pixels, 0, y);
        if (y % 1024 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    const blob = await new Promise<Blob>((resolve, reject) => canvas!.toBlob(
      result => result ? resolve(result) : reject(new Error("IMAGE_EXPORT_FAILED")), "image/png",
    ));
    checkCancellation(options.signal);
    return { blob, width, height };
  } finally {
    if (canvas) canvas.width = canvas.height = 1;
  }
}

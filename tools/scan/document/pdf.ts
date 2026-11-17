import { createPdfBlob } from "../../pdf/images-to-pdf/pdf.js";
import { decodeImage } from "../../shared/image.js";
import { renderScanImage } from "../../shared/scan.js";
import type { DecodedImage } from "../../shared/image.js";
import type { ScanMode } from "../../shared/scan.js";

export const SCAN_EXPORT_PAGE_PIXELS = 12_000_000;
export const SCAN_EXPORT_TOTAL_PIXELS = 24_000_000;
export const SCAN_EXPORT_BYTES = 64 * 1024 * 1024;
export interface ScanExportPage { file: File; mode: ScanMode }
interface ExportOptions {
  pages: readonly ScanExportPage[]; JsPDF: unknown; signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  decode?: (file: File) => Promise<DecodedImage>;
  raster?: typeof renderScanImage;
}
function limit(): never { throw Object.assign(new Error("SCAN_EXPORT_LIMIT"), { code: "SCAN_EXPORT_LIMIT" }); }

export async function createScanPdf(options: ExportOptions): Promise<Blob> {
  if (options.pages.length > 20 || options.pages.reduce((n, page) => n + page.file.size, 0) > 200 * 1024 * 1024) limit();
  let totalPixels = 0;
  let totalBytes = 0;
  const blob = await createPdfBlob({
    files: options.pages.map(page => page.file),
    options: { pageSize: "a4", orientation: "auto", margin: 10, fillPage: false, quality: 1 },
    JsPDF: options.JsPDF, signal: options.signal, imageFormat: "PNG", onProgress: options.onProgress,
    decode: async file => {
      const image = await (options.decode || decodeImage)(file);
      const pixels = image.width * image.height;
      if (pixels > SCAN_EXPORT_PAGE_PIXELS || totalPixels + pixels > SCAN_EXPORT_TOTAL_PIXELS) { image.close(); limit(); }
      totalPixels += pixels;
      return image;
    },
    convert: async (image, _quality, index) => {
      const result = await (options.raster || renderScanImage)(image, options.pages[index].mode, { signal: options.signal });
      totalBytes += result.blob.size;
      if (totalBytes > SCAN_EXPORT_BYTES) limit();
      return new Uint8Array(await result.blob.arrayBuffer());
    },
  });
  if (blob.size > SCAN_EXPORT_BYTES) limit();
  return blob;
}

// Serialize native PDF writers, and guard every publication with its generation.
// Results are held as a Blob only; renderer and download URL lifetimes belong to UI.
export function createScanPdfController(build: (pages: readonly ScanExportPage[], signal: AbortSignal, progress: (done: number, total: number) => void) => Promise<Blob>, changed: () => void = () => {}) {
  let revision = 0;
  let job: AbortController | null = null;
  let work: Promise<void> = Promise.resolve();
  let result: Blob | null = null;
  let progress = 0;
  let total = 0;
  function invalidate() { revision++; job?.abort(); job = null; result = null; changed(); }
  return {
    get result() { return result; }, get busy() { return job !== null; },
    get progress() { return progress; }, get total() { return total; }, invalidate,
    async create(pages: readonly ScanExportPage[]) {
      invalidate();
      const version = revision;
      const current = new AbortController(); job = current; progress = 0; total = pages.length; changed();
      const snapshot = pages.map(page => ({ file: page.file, mode: page.mode }));
      const task = work.then(async () => {
        if (current.signal.aborted) return null;
        const blob = await build(snapshot, current.signal, (done, count) => {
          if (version === revision && !current.signal.aborted) { progress = done; total = count; changed(); }
        });
        if (version !== revision || current.signal.aborted) return null;
        result = blob; return blob;
      });
      work = task.then(() => {}, () => {});
      try { return await task; }
      catch (error) { if (version !== revision || current.signal.aborted) return null; throw error; }
      finally { if (version === revision) { job = null; changed(); } }
    },
  };
}

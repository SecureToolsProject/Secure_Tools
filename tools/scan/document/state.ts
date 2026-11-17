import { isSupportedImage, MAX_FILE_SIZE, validateImageSignature } from "../../shared/image.js";
import { createScanPreview } from "../../shared/scan.js";
import type { ScanMode, ScanPreview, ScanPreviewOptions } from "../../shared/scan.js";

export const MAX_SCAN_PAGES = 20;
export const MAX_SCAN_BYTES = 200 * 1024 * 1024;
export interface ScanPage { id: number; file: File; url: string; width: number; height: number; mode: ScanMode }
interface QueueOptions {
  preview?: (file: Blob, mode: ScanMode, options: ScanPreviewOptions) => Promise<ScanPreview>;
  createUrl?: (blob: Blob) => string;
  revokeUrl?: (url: string) => void;
  changed?: () => void;
}

export function createScanQueue(options: QueueOptions = {}) {
  const pages: ScanPage[] = [];
  const preview = options.preview || createScanPreview;
  const createUrl = options.createUrl || (blob => URL.createObjectURL(blob));
  const revokeUrl = options.revokeUrl || (url => URL.revokeObjectURL(url));
  let controller: AbortController | null = null;
  let sequence = 0;
  let disposed = false;
  const changed = () => options.changed?.();

  function cancel() { controller?.abort(); controller = null; changed(); }
  function start() {
    if (disposed) throw new Error("SCAN_DISPOSED");
    cancel();
    const job = new AbortController();
    controller = job;
    changed();
    return job;
  }
  function current(job: AbortController) { return !disposed && controller === job && !job.signal.aborted; }
  function finish(job: AbortController) { if (controller === job) { controller = null; changed(); } }
  function remove(id: number) {
    const index = pages.findIndex(page => page.id === id);
    if (index < 0) return;
    revokeUrl(pages[index].url); pages.splice(index, 1); changed();
  }
  function clear() { cancel(); pages.forEach(page => revokeUrl(page.url)); pages.length = 0; changed(); }

  async function add(files: readonly File[], mode: ScanMode) {
    const job = start();
    const rejected: { name: string; code: string }[] = [];
    let added = 0;
    try {
      for (const file of files) {
        if (!current(job)) break;
        try {
          if (!isSupportedImage(file)) throw new Error("UNSUPPORTED_IMAGE");
          if (file.size > MAX_FILE_SIZE) throw new Error("IMAGE_FILE_TOO_LARGE");
          if (pages.length >= MAX_SCAN_PAGES || pages.reduce((total, page) => total + page.file.size, 0) + file.size > MAX_SCAN_BYTES) throw new Error("SCAN_QUEUE_LIMIT");
          await validateImageSignature(file);
          if (!current(job)) break;
          const result = await preview(file, mode, { signal: job.signal });
          if (!current(job)) break;
          pages.push({ id: ++sequence, file, url: createUrl(result.blob), width: result.width, height: result.height, mode });
          added++; changed();
        } catch (error) {
          if (!current(job)) break;
          rejected.push({ name: file.name, code: error instanceof Error ? error.message : "IMAGE_DECODE_FAILED" });
        }
      }
      return { added, rejected, cancelled: !current(job) };
    } finally { finish(job); }
  }

  async function setMode(mode: ScanMode) {
    const job = start();
    try {
      for (const page of [...pages]) {
        if (!current(job)) return false;
        if (page.mode === mode) continue;
        const result = await preview(page.file, mode, { signal: job.signal });
        if (!current(job)) return false;
        if (!pages.includes(page)) continue;
        const url = createUrl(result.blob);
        revokeUrl(page.url); page.url = url; page.mode = mode; changed();
      }
      return current(job);
    } finally { finish(job); }
  }

  return {
    get pages(): readonly ScanPage[] { return pages; },
    get busy() { return controller !== null; },
    add, setMode, cancel, clear, remove,
    move(id: number, offset: number) {
      const index = pages.findIndex(page => page.id === id);
      const next = index + offset;
      if (index < 0 || next < 0 || next >= pages.length) return false;
      [pages[index], pages[next]] = [pages[next], pages[index]]; changed(); return true;
    },
    dispose() { disposed = true; clear(); },
  };
}

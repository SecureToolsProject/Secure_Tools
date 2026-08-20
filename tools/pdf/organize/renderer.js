import * as pdfjsLib from "../../../assets/vendor/pdfjs/pdf.min.mjs";

const WORKER_URL = new URL("../../../assets/vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;

export const PDFJS_VERSION = pdfjsLib.version;
export const PDFJS_WORKER_URL = WORKER_URL;
export const THUMBNAIL_WIDTH = 200;
export const RENDER_CONCURRENCY = 2;

export class PdfThumbnailRenderer {
  constructor(sourceBytes) {
    this.sourceBytes = sourceBytes;
    this.loadingTask = null;
    this.document = null;
    this.renderTasks = new Set();
    this.destroyed = false;
  }

  async load() {
    this.loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(this.sourceBytes.slice(0)),
      isEvalSupported: false,
      useWorkerFetch: false,
      useWasm: false,
    });
    this.document = await this.loadingTask.promise;
    return this.document.numPages;
  }

  async render(originalIndex, rotation, canvas, cssWidth = THUMBNAIL_WIDTH) {
    if (this.destroyed || !this.document) throw new Error("RENDERER_UNAVAILABLE");
    const page = await this.document.getPage(originalIndex + 1);
    const base = page.getViewport({ scale: 1, rotation });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const scale = Math.min(2, (cssWidth * pixelRatio) / Math.max(1, base.width));
    const viewport = page.getViewport({ scale, rotation });
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("CANVAS_UNAVAILABLE");
    const task = page.render({ canvasContext: context, viewport });
    this.renderTasks.add(task);
    try { await task.promise; }
    finally { this.renderTasks.delete(task); page.cleanup(); }
  }

  async destroy() {
    this.destroyed = true;
    for (const task of this.renderTasks) task.cancel();
    this.renderTasks.clear();
    if (this.loadingTask) await this.loadingTask.destroy();
    else if (this.document) await this.document.destroy();
    this.document = null;
    this.loadingTask = null;
    this.sourceBytes = null;
  }
}

export async function runRenderQueue(tasks, concurrency = RENDER_CONCURRENCY) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (next < tasks.length) {
      const current = tasks[next];
      next += 1;
      await current();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  await Promise.all(workers);
}

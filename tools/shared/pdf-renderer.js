import * as pdfjsLib from "../../assets/vendor/pdfjs/pdf.min.mjs";

export const PDFJS_VERSION = pdfjsLib.version;
export const PDFJS_WORKER_URL = new URL("../../assets/vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
export const PDF_RENDER_CONCURRENCY = 2;

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

export class LocalPdfRenderer {
  constructor(sourceBytes) {
    this.sourceBytes = sourceBytes;
    this.loadingTask = null;
    this.document = null;
    this.renderTasks = new Set();
    this.destroyed = false;
  }

  async load() {
    if (this.destroyed) throw new Error("RENDERER_UNAVAILABLE");
    this.loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(this.sourceBytes.slice(0)),
      isEvalSupported: false,
      useWorkerFetch: false,
      useWasm: false,
    });
    this.document = await this.loadingTask.promise;
    return this.document.numPages;
  }

  async getPage(pageNumber) {
    if (this.destroyed || !this.document) throw new Error("RENDERER_UNAVAILABLE");
    return this.document.getPage(pageNumber);
  }

  async runRender(page, renderContext) {
    if (this.destroyed) throw new Error("RENDERER_UNAVAILABLE");
    const task = page.render(renderContext);
    this.renderTasks.add(task);
    try { await task.promise; }
    finally { this.renderTasks.delete(task); }
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

export async function runRenderQueue(tasks, concurrency = PDF_RENDER_CONCURRENCY) {
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

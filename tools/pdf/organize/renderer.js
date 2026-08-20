import { LocalPdfRenderer, PDFJS_VERSION, PDFJS_WORKER_URL, PDF_RENDER_CONCURRENCY, runRenderQueue } from "../../shared/pdf-renderer.js";

export { PDFJS_VERSION, PDFJS_WORKER_URL, runRenderQueue };
export const THUMBNAIL_WIDTH = 200;
export const RENDER_CONCURRENCY = PDF_RENDER_CONCURRENCY;

export class PdfThumbnailRenderer extends LocalPdfRenderer {
  async render(originalIndex, rotation, canvas, cssWidth = THUMBNAIL_WIDTH) {
    const page = await this.getPage(originalIndex + 1);
    const base = page.getViewport({ scale: 1, rotation });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const scale = Math.min(2, (cssWidth * pixelRatio) / Math.max(1, base.width));
    const viewport = page.getViewport({ scale, rotation });
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("CANVAS_UNAVAILABLE");
    try { await this.runRender(page, { canvasContext: context, viewport }); }
    finally { page.cleanup(); }
  }
}

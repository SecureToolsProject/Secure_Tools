import { LocalPdfRenderer } from "../../shared/pdf-renderer.js";

// Render the generated PDF through the existing local PDF.js service, never an
// iframe/object URL. Keep one bounded canvas and dispose the renderer on reset.
export function createScanResultPreview(canvas, changed, failed) {
  let renderer = null;
  let version = 0;
  let pageNumber = 1;
  let pageCount = 0;
  let busy = false;
  let disposed = Promise.resolve();
  const resetCanvas = () => { canvas.width = canvas.height = 1; };
  function clear() {
    version++; const previous = renderer; renderer = null;
    if (previous) disposed = disposed.then(() => previous.destroy()).catch(() => {});
    pageNumber = 1; pageCount = 0; busy = false; resetCanvas(); changed();
  }
  async function draw(current, revision) {
    let page;
    try {
      page = await current.getPage(pageNumber);
      if (revision !== version) return;
      const size = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(1.5, 900 / Math.max(size.width, size.height)) });
      // A detached canvas prevents an obsolete render from touching live output.
      const buffer = document.createElement("canvas");
      try {
        buffer.width = Math.ceil(viewport.width); buffer.height = Math.ceil(viewport.height);
        await current.runRender(page, { canvasContext: buffer.getContext("2d"), viewport, background: "#ffffff" });
        if (revision !== version) return;
        canvas.width = buffer.width; canvas.height = buffer.height;
        canvas.getContext("2d").drawImage(buffer, 0, 0);
      } finally { buffer.width = buffer.height = 1; }
    } finally { page?.cleanup(); }
  }
  async function open(blob) {
    clear(); const revision = version; busy = true; changed();
    try {
      await disposed;
      const bytes = await blob.arrayBuffer();
      if (revision !== version) return;
      const current = renderer = new LocalPdfRenderer(bytes);
      const count = await current.load();
      if (revision !== version) return;
      pageCount = count;
      await draw(current, revision);
    } catch { if (revision === version) { clear(); failed(); } }
    finally { if (revision === version) { busy = false; changed(); } }
  }
  async function move(offset) {
    if (busy || !renderer || pageNumber + offset < 1 || pageNumber + offset > pageCount) return;
    pageNumber += offset; busy = true; changed(); const revision = version;
    try { await draw(renderer, revision); }
    catch { if (revision === version) { clear(); failed(); } }
    finally { if (revision === version) { busy = false; changed(); } }
  }
  return { clear, open, move, get busy() { return busy; }, get pageNumber() { return pageNumber; }, get pageCount() { return pageCount; } };
}

import assert from "node:assert/strict";
import { PDFLib } from "./fixtures.mjs";

export async function verifyPdf(page, output, source, expected) {
  const document = await PDFLib.PDFDocument.load(new Uint8Array(output));
  assert.equal(document.getPageCount(), expected.length);
  const inspected = await page.evaluate(async ({ output, source }) => {
    const pdfjs = await import("/assets/vendor/pdfjs/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "/assets/vendor/pdfjs/pdf.worker.min.mjs";
    const load = bytes => pdfjs.getDocument({ data: Uint8Array.from(bytes), isEvalSupported: false, useWorkerFetch: false });
    const tasks = [load(output), load(source)];
    const [out, original] = await Promise.all(tasks.map(task => task.promise));
    const pages = [];
    for (let number = 1; number <= out.numPages; number++) {
      const a = await out.getPage(number); const b = await original.getPage(number);
      const text = (await a.getTextContent()).items.map(item => item.str).join(" ").replace(/\s+/g, " ").trim();
      async function raster(p) {
        const viewport = p.getViewport({ scale: 1 });
        const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d"); await p.render({ canvasContext: context, viewport }).promise;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))).map(b => b.toString(16).padStart(2, "0")).join("");
        return { width: canvas.width, height: canvas.height, hash };
      }
      pages.push({ text, output: await raster(a), original: await raster(b) });
    }
    await Promise.all(tasks.map(task => task.destroy())); return pages;
  }, { output: Array.from(output), source: Array.from(source) });
  assert.deepEqual(inspected.map(p => p.text), expected, "Exact extracted page text");
  for (const p of inspected) assert.deepEqual(p.output, p.original, "Original visible raster must be preserved");
  return { bytes: output.length, pages: expected.length, pdfJsParse: true, pdfLibReload: true, extracted: expected, originalPixelsPreserved: true };
}

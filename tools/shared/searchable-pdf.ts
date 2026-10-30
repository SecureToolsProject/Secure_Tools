import type { PdfOcrPageResult } from "./pdf-ocr.js";
import { requirePdfSignature } from "./pdf.js";

type Matrix = readonly [number, number, number, number, number, number];
interface PdfFontLike { widthOfTextAtSize(text: string, size: number): number }
interface PdfPageLike { pushOperators(...operators: unknown[]): void; drawText(text: string, options: { x: number; y: number; size: number; font: PdfFontLike; rotate: unknown; opacity: number }): void }
interface PdfDocumentLike { registerFontkit(value: unknown): void; embedFont(bytes: ArrayBuffer, options: { subset: boolean }): Promise<PdfFontLike>; getPages(): PdfPageLike[]; save(): Promise<Uint8Array> }
export interface PdfLibLike {
  PDFDocument: { load(bytes: ArrayBuffer, options?: { ignoreEncryption?: boolean; updateMetadata?: boolean }): Promise<PdfDocumentLike> };
  degrees(angle: number): unknown;
  pushGraphicsState(): unknown;
  popGraphicsState(): unknown;
  setCharacterSqueeze(percent: number): unknown;
}
export interface SearchablePdfProgress { phase: "building-pdf" | "saving" | "complete"; pageNumber: number | null; pageIndex: number; pageCount: number }
export interface SearchablePdfRequest { sourceBytes: ArrayBuffer; pages: readonly PdfOcrPageResult[]; PDFLib: PdfLibLike; fontkit: unknown; fontBytes: ArrayBuffer; signal?: AbortSignal; onProgress?: (progress: SearchablePdfProgress) => void }

const error = (code: string) => Object.assign(new Error(code), { code });
const abort = (signal?: AbortSignal) => { if (signal?.aborted) throw error("SEARCHABLE_PDF_CANCELLED"); };
export function applyTransform(matrix: Matrix, x: number, y: number): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] });
}
export function searchablePdfFilename(name = "document.pdf"): string {
  const base = name.replace(/\.pdf$/i, "").trim() || "document";
  return `${base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")}-searchable.pdf`;
}

export async function createSearchablePdf(request: SearchablePdfRequest): Promise<Uint8Array> {
  abort(request.signal);
  requirePdfSignature(request.sourceBytes);
  const document = await request.PDFLib.PDFDocument.load(request.sourceBytes.slice(0), { updateMetadata: false });
  const needsFont = request.pages.some((page) => !page.hasMeaningfulText && Boolean(page.lines?.some((line) => line.text.trim())));
  let font: PdfFontLike | null = null;
  if (needsFont) { document.registerFontkit(request.fontkit); font = await document.embedFont(request.fontBytes.slice(0), { subset: true }); }
  const outputPages = document.getPages();
  for (let index = 0; index < request.pages.length; index += 1) {
    abort(request.signal);
    const result = request.pages[index];
    request.onProgress?.({ phase: "building-pdf", pageNumber: result.pageNumber, pageIndex: index + 1, pageCount: request.pages.length });
    if (result.hasMeaningfulText) continue;
    const matrix = result.rasterToPdfTransform;
    if (!matrix || !result.lines || !result.rasterWidth || !result.rasterHeight) throw error("SEARCHABLE_PDF_LAYOUT_REQUIRED");
    const page = outputPages[result.pageNumber - 1];
    if (!page) throw error("SEARCHABLE_PDF_PAGE_OUT_OF_RANGE");
    for (const line of result.lines) {
      if (!line.text.trim()) continue;
      const x0 = Math.max(0, Math.min(result.rasterWidth, line.bbox.x0)); const x1 = Math.max(0, Math.min(result.rasterWidth, line.bbox.x1));
      const y0 = Math.max(0, Math.min(result.rasterHeight, line.bbox.y0)); const y1 = Math.max(0, Math.min(result.rasterHeight, line.bbox.y1));
      const left = applyTransform(matrix, x0, y1);
      const right = applyTransform(matrix, x1, y1);
      const top = applyTransform(matrix, x0, y0);
      const width = Math.hypot(right.x - left.x, right.y - left.y);
      const height = Math.hypot(top.x - left.x, top.y - left.y);
      if (!(width > 0 && height > 0)) continue;
      if (!font) continue;
      const heightSize = Math.max(1, height * 0.82);
      const unitWidth = font.widthOfTextAtSize(line.text, 1);
      const size = unitWidth > 0 ? Math.max(1, Math.min(heightSize, width / unitWidth)) : heightSize;
      const cos = (right.x - left.x) / width; const sin = (right.y - left.y) / width;
      // Fit the OCR line's full width independently of its height. Uniform font
      // sizing alone leaves short invisible lines and shifts later word hits.
      const textWidth = font.widthOfTextAtSize(line.text, size);
      page.pushOperators(request.PDFLib.pushGraphicsState(), request.PDFLib.setCharacterSqueeze(textWidth > 0 ? width / textWidth * 100 : 100));
      page.drawText(line.text, { x: left.x, y: left.y, size, font, rotate: request.PDFLib.degrees(Math.atan2(sin, cos) * 180 / Math.PI), opacity: 0 });
      page.pushOperators(request.PDFLib.popGraphicsState());
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  abort(request.signal);
  request.onProgress?.({ phase: "saving", pageNumber: null, pageIndex: request.pages.length, pageCount: request.pages.length });
  const bytes = await document.save();
  abort(request.signal);
  request.onProgress?.({ phase: "complete", pageNumber: null, pageIndex: request.pages.length, pageCount: request.pages.length });
  return bytes;
}

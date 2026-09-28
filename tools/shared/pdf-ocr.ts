import { createOcrService, resolveOcrLanguage } from "./ocr.js";
import type { OcrLanguage, OcrProgress, OcrService } from "./ocr.js";
import { isSupportedPdf } from "./pdf.js";
import type { PdfFileLike } from "./pdf.js";
import type { LocalPdfRenderer, PdfPageProxy, PdfRenderContext } from "./pdf-renderer.js";

export const PDF_OCR_RENDER_SCALE = 2;
export const PDF_OCR_MAX_RENDER_DIMENSION = 16_384;
export const PDF_OCR_MAX_RENDER_PIXELS = 50_000_000;
export const PDF_OCR_LARGE_DOCUMENT_THRESHOLD = 25;

export type PdfOcrPhase = "loading-document" | "rendering-page" | "recognizing-page" | "complete";

export type PdfOcrPageSelection =
  | { mode: "all" }
  | { mode: "selected"; pageNumbers: readonly number[] };

export interface PdfOcrPageResult {
  pageNumber: number;
  text: string;
}

export interface PdfOcrProgress {
  phase: PdfOcrPhase;
  pageNumber: number | null;
  pageIndex: number;
  pageCount: number;
  documentPageCount: number | null;
  pageProgress: number | null;
  overallProgress: number | null;
  ocrStage: OcrProgress["stage"] | null;
}

export interface PdfOcrDocumentResult {
  pageCount: number;
  selectedPageNumbers: readonly number[];
  pages: readonly PdfOcrPageResult[];
  largeDocument: boolean;
}

export interface PdfOcrRequest {
  sourceBytes: ArrayBuffer;
  language: OcrLanguage;
  selection?: PdfOcrPageSelection;
  signal?: AbortSignal;
  onProgress?: (progress: PdfOcrProgress) => void;
  onPageResult?: (result: PdfOcrPageResult) => void;
}

export interface PdfOcrRenderer {
  load(): Promise<number>;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  runRender(page: PdfPageProxy, renderContext: PdfRenderContext): Promise<void>;
  destroy(): Promise<void>;
}

export interface PdfOcrServiceConfiguration {
  ocrService?: OcrService;
  rendererFactory?: (sourceBytes: ArrayBuffer) => PdfOcrRenderer | Promise<PdfOcrRenderer>;
  canvasFactory?: () => HTMLCanvasElement;
  renderScale?: number;
}

export interface PdfOcrService {
  recognizeDocument(request: PdfOcrRequest): Promise<PdfOcrDocumentResult>;
  cancel(): Promise<boolean>;
  dispose(): Promise<void>;
}

interface ActiveJob {
  generation: number;
  controller: AbortController;
  promise: Promise<PdfOcrDocumentResult>;
}

interface ErrorWithCode extends Error {
  code: string;
}

function pdfOcrError(code: string, cause?: unknown): ErrorWithCode {
  const options = cause === undefined ? undefined : { cause };
  return Object.assign(new Error(code, options), { code });
}

function hasErrorCode(error: unknown): error is ErrorWithCode {
  return error instanceof Error && "code" in error && typeof error.code === "string";
}

function errorCode(error: unknown): string | undefined {
  return hasErrorCode(error) ? error.code : undefined;
}

function errorDetail(error: unknown): string {
  if (!(error instanceof Error)) return "";
  return `${error.name} ${error.message}`.toLowerCase();
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw pdfOcrError("PDF_OCR_CANCELLED");
}

function normalizePipelineError(error: unknown, signal: AbortSignal): ErrorWithCode {
  if (signal.aborted || errorCode(error) === "OCR_CANCELLED") return pdfOcrError("PDF_OCR_CANCELLED", error);
  if (hasErrorCode(error) && error.code.startsWith("PDF_OCR_")) return error;
  const detail = errorDetail(error);
  if (detail.includes("password") || detail.includes("encrypt")) return pdfOcrError("ENCRYPTED_PDF", error);
  if (detail.includes("invalid pdf") || detail.includes("missing pdf") || detail.includes("formaterror")) {
    return pdfOcrError("UNREADABLE_PDF", error);
  }
  return pdfOcrError("PDF_OCR_FAILED", error);
}

function validateRenderDimensions(widthValue: number, heightValue: number): { width: number; height: number } {
  const width = Math.ceil(widthValue);
  const height = Math.ceil(heightValue);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw pdfOcrError("PDF_OCR_RENDER_DIMENSIONS_INVALID");
  }
  if (width > PDF_OCR_MAX_RENDER_DIMENSION || height > PDF_OCR_MAX_RENDER_DIMENSION) {
    throw pdfOcrError("PDF_OCR_RENDER_DIMENSION_EXCEEDED");
  }
  if (width * height > PDF_OCR_MAX_RENDER_PIXELS) throw pdfOcrError("PDF_OCR_RENDER_PIXELS_EXCEEDED");
  return { width, height };
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob?.type === "image/png") resolve(blob);
      else reject(pdfOcrError("PDF_OCR_IMAGE_ENCODING_FAILED"));
    }, "image/png");
  });
}

async function renderPage(
  renderer: PdfOcrRenderer,
  pageNumber: number,
  scale: number,
  canvasFactory: () => HTMLCanvasElement,
  signal: AbortSignal,
): Promise<Blob> {
  throwIfAborted(signal);
  const page = await renderer.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const dimensions = validateRenderDimensions(viewport.width, viewport.height);
  const canvas = canvasFactory();
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    page.cleanup();
    canvas.width = 1;
    canvas.height = 1;
    throw pdfOcrError("CANVAS_UNAVAILABLE");
  }
  try {
    await renderer.runRender(page, { canvasContext: context, viewport, background: "#ffffff" });
    throwIfAborted(signal);
    const blob = await canvasToPngBlob(canvas);
    throwIfAborted(signal);
    return blob;
  } finally {
    page.cleanup();
    canvas.width = 1;
    canvas.height = 1;
  }
}

export function resolvePdfOcrPages(selection: PdfOcrPageSelection | undefined, pageCount: number): number[] {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw pdfOcrError("PDF_HAS_NO_PAGES");
  if (!selection || selection.mode === "all") {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  if (selection.mode !== "selected" || selection.pageNumbers.length < 1) {
    throw pdfOcrError("PDF_OCR_PAGE_SELECTION_REQUIRED");
  }
  const pages: number[] = [];
  const seen = new Set<number>();
  for (const pageNumber of selection.pageNumbers) {
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) throw pdfOcrError("PDF_OCR_PAGE_SELECTION_INVALID");
    if (pageNumber > pageCount) throw pdfOcrError("PDF_OCR_PAGE_OUT_OF_RANGE");
    if (seen.has(pageNumber)) throw pdfOcrError("PDF_OCR_PAGE_DUPLICATE");
    seen.add(pageNumber);
    pages.push(pageNumber);
  }
  return pages;
}

export async function readPdfOcrSource(file: PdfFileLike): Promise<ArrayBuffer> {
  if (!isSupportedPdf(file)) throw pdfOcrError("UNSUPPORTED_PDF");
  return file.arrayBuffer();
}

async function defaultRendererFactory(sourceBytes: ArrayBuffer): Promise<PdfOcrRenderer> {
  const module = await import("./pdf-renderer.js");
  const Renderer: typeof LocalPdfRenderer = module.LocalPdfRenderer;
  return new Renderer(sourceBytes);
}

export function createPdfOcrService(configuration: PdfOcrServiceConfiguration = {}): PdfOcrService {
  const ocrService = configuration.ocrService || createOcrService();
  const rendererFactory = configuration.rendererFactory || defaultRendererFactory;
  const canvasFactory = configuration.canvasFactory || (() => document.createElement("canvas"));
  const renderScale = configuration.renderScale ?? PDF_OCR_RENDER_SCALE;
  if (!Number.isFinite(renderScale) || renderScale <= 0) throw pdfOcrError("PDF_OCR_RENDER_SCALE_INVALID");

  let generation = 0;
  let active: ActiveJob | null = null;
  let disposed = false;

  async function run(request: PdfOcrRequest, jobGeneration: number, signal: AbortSignal): Promise<PdfOcrDocumentResult> {
    const language = resolveOcrLanguage(request.language);
    let sourceBytes = request.sourceBytes.slice(0);
    let renderer: PdfOcrRenderer | null = null;
    let destroying: Promise<void> | null = null;
    const destroyRenderer = (): Promise<void> => {
      if (!renderer) return Promise.resolve();
      destroying ||= renderer.destroy();
      return destroying;
    };
    const emit = (progress: PdfOcrProgress): void => {
      if (!disposed && jobGeneration === generation && !signal.aborted) request.onProgress?.(progress);
    };
    const append = (result: PdfOcrPageResult): void => {
      if (!disposed && jobGeneration === generation && !signal.aborted) request.onPageResult?.(result);
    };
    const abortRenderer = (): void => { void destroyRenderer().catch(() => {}); };
    signal.addEventListener("abort", abortRenderer, { once: true });
    try {
      throwIfAborted(signal);
      emit({ phase: "loading-document", pageNumber: null, pageIndex: 0, pageCount: 0, documentPageCount: null, pageProgress: null, overallProgress: 0, ocrStage: null });
      renderer = await rendererFactory(sourceBytes);
      const documentPageCount = await renderer.load();
      throwIfAborted(signal);
      const selectedPageNumbers = resolvePdfOcrPages(request.selection, documentPageCount);
      const pages: PdfOcrPageResult[] = [];

      for (let index = 0; index < selectedPageNumbers.length; index += 1) {
        const pageNumber = selectedPageNumbers[index];
        emit({
          phase: "rendering-page", pageNumber, pageIndex: index + 1, pageCount: selectedPageNumbers.length,
          documentPageCount, pageProgress: null, overallProgress: index / selectedPageNumbers.length, ocrStage: null,
        });
        const image = await renderPage(renderer, pageNumber, renderScale, canvasFactory, signal);
        throwIfAborted(signal);
        const recognized = await ocrService.recognizeImage(image, {
          language,
          signal,
          onProgress(progress: OcrProgress) {
            const pageProgress = progress.progress;
            emit({
              phase: "recognizing-page", pageNumber, pageIndex: index + 1, pageCount: selectedPageNumbers.length,
              documentPageCount, pageProgress,
              overallProgress: pageProgress === null ? null : (index + pageProgress) / selectedPageNumbers.length,
              ocrStage: progress.stage,
            });
          },
        });
        throwIfAborted(signal);
        const result = Object.freeze({ pageNumber, text: recognized.text });
        pages.push(result);
        append(result);
      }

      emit({
        phase: "complete", pageNumber: selectedPageNumbers.at(-1) ?? null, pageIndex: selectedPageNumbers.length,
        pageCount: selectedPageNumbers.length, documentPageCount, pageProgress: 1, overallProgress: 1, ocrStage: "complete",
      });
      return Object.freeze({
        pageCount: documentPageCount,
        selectedPageNumbers: Object.freeze([...selectedPageNumbers]),
        pages: Object.freeze([...pages]),
        largeDocument: documentPageCount >= PDF_OCR_LARGE_DOCUMENT_THRESHOLD,
      });
    } catch (error: unknown) {
      throw normalizePipelineError(error, signal);
    } finally {
      signal.removeEventListener("abort", abortRenderer);
      await destroyRenderer().catch(() => {});
      sourceBytes = new ArrayBuffer(0);
    }
  }

  async function recognizeDocument(request: PdfOcrRequest): Promise<PdfOcrDocumentResult> {
    if (disposed) throw pdfOcrError("PDF_OCR_DISPOSED");
    if (active) throw pdfOcrError("PDF_OCR_BUSY");
    const jobGeneration = ++generation;
    const controller = new AbortController();
    const forwardAbort = (): void => controller.abort();
    request.signal?.addEventListener("abort", forwardAbort, { once: true });
    if (request.signal?.aborted) controller.abort();
    const promise = run(request, jobGeneration, controller.signal);
    active = { generation: jobGeneration, controller, promise };
    try {
      return await promise;
    } finally {
      request.signal?.removeEventListener("abort", forwardAbort);
      if (active?.generation === jobGeneration) active = null;
    }
  }

  async function cancel(): Promise<boolean> {
    if (!active) return false;
    const current = active;
    generation += 1;
    active = null;
    current.controller.abort();
    try { await current.promise; } catch { /* Cancellation is reported by the active request. */ }
    return true;
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    await cancel();
    disposed = true;
    generation += 1;
    await ocrService.dispose();
  }

  return Object.freeze({ recognizeDocument, cancel, dispose });
}

import { createPdfOcrService, readPdfOcrSource } from "../../shared/pdf-ocr.js";
import type { PdfOcrPageResult, PdfOcrPageSelection, PdfOcrProgress, PdfOcrService } from "../../shared/pdf-ocr.js";
import { createSearchablePdf } from "../../shared/searchable-pdf.js";
import type { PdfLibLike, SearchablePdfProgress, SearchablePdfRequest } from "../../shared/searchable-pdf.js";

export type PdfToTextPhase = "empty" | "preparing" | "ready" | "recognizing" | "building" | "success" | "error" | "cancelled";

export interface PdfToTextSource { file: File; bytes: ArrayBuffer; pageCount: number }
export interface PdfToTextState {
  phase: PdfToTextPhase;
  source: PdfToTextSource | null;
  pages: readonly PdfOcrPageResult[];
  progress: PdfOcrProgress | null;
  searchableProgress: SearchablePdfProgress | null;
  searchableReady: boolean;
  error: unknown;
}
export interface PdfToTextControllerOptions {
  service?: PdfOcrService;
  inspect(file: File): Promise<{ pageCount: number }>;
  onChange?(state: PdfToTextState): void;
  buildSearchablePdf?(request: SearchablePdfRequest): Promise<Uint8Array>;
}

export function createPdfToTextController(options: PdfToTextControllerOptions) {
  const service = options.service || createPdfOcrService();
  let generation = 0;
  let state: PdfToTextState = { phase: "empty", source: null, pages: [], progress: null, searchableProgress: null, searchableReady: false, error: null };
  let buildController: AbortController | null = null;
  const publish = (patch: Partial<PdfToTextState>) => {
    state = Object.freeze({ ...state, ...patch });
    options.onChange?.(state);
  };
  const current = (token: number) => token === generation;

  async function select(file: File): Promise<void> {
    const token = ++generation;
    buildController?.abort(); buildController = null;
    await service.cancel();
    publish({ phase: "preparing", source: null, pages: [], progress: null, searchableProgress: null, searchableReady: false, error: null });
    try {
      const [bytes, details] = await Promise.all([readPdfOcrSource(file), options.inspect(file)]);
      if (!current(token)) return;
      publish({ phase: "ready", source: { file, bytes, pageCount: details.pageCount }, error: null });
    } catch (error) {
      if (!current(token)) return;
      publish({ phase: "error", source: null, error });
    }
  }

  async function recognize(language: "eng" | "kor" | "eng+kor", selection: PdfOcrPageSelection): Promise<void> {
    if (!state.source || state.phase === "recognizing") return;
    const token = ++generation;
    const source = state.source;
    publish({ phase: "recognizing", pages: [], progress: null, searchableProgress: null, searchableReady: false, error: null });
    try {
      const result = await service.recognizeDocument({
        sourceBytes: source.bytes,
        language,
        selection,
        includeLayout: true,
        inspectExistingText: true,
        onProgress(progress) { if (current(token)) publish({ progress }); },
        onPageResult(page) { if (current(token)) publish({ pages: [...state.pages, page] }); },
      });
      if (!current(token)) return;
      publish({ phase: "success", pages: result.pages, searchableReady: true, error: null });
    } catch (error) {
      if (!current(token)) return;
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      publish({ phase: code === "PDF_OCR_CANCELLED" ? "cancelled" : "error", progress: null, searchableReady: false, error });
    }
  }

  async function buildSearchable(PDFLib: PdfLibLike, fontkit: unknown, fontBytes: ArrayBuffer): Promise<Uint8Array | null> {
    if (!state.source || state.pages.length === 0 || !state.searchableReady) return null;
    const token = ++generation;
    buildController = new AbortController();
    const source = state.source; const pages = state.pages;
    publish({ phase: "building", searchableProgress: { phase: "building-pdf", pageNumber: null, pageIndex: 0, pageCount: pages.length }, error: null });
    try {
      const bytes = await (options.buildSearchablePdf || createSearchablePdf)({ sourceBytes: source.bytes, pages, PDFLib, fontkit, fontBytes, signal: buildController.signal, onProgress(progress) { if (current(token)) publish({ searchableProgress: progress }); } });
      if (!current(token)) return null;
      publish({ phase: "success", searchableProgress: { phase: "complete", pageNumber: null, pageIndex: pages.length, pageCount: pages.length }, error: null });
      return bytes;
    } catch (error) {
      if (!current(token)) return null;
      const code = error instanceof Error && "code" in error ? String(error.code) : "SEARCHABLE_PDF_FAILED";
      const normalized = code === "SEARCHABLE_PDF_FAILED" ? Object.assign(new Error(code, { cause: error }), { code }) : error;
      publish({ phase: code === "SEARCHABLE_PDF_CANCELLED" ? "cancelled" : "error", searchableProgress: null, error: normalized });
      return null;
    } finally { if (current(token)) buildController = null; }
  }

  async function cancel(): Promise<void> {
    if (state.phase !== "recognizing" && state.phase !== "building") return;
    generation += 1;
    buildController?.abort(); buildController = null;
    await service.cancel();
    publish({ phase: "cancelled", progress: null, error: null });
  }

  async function reset(): Promise<void> {
    generation += 1;
    buildController?.abort(); buildController = null;
    await service.cancel();
    publish({ phase: "empty", source: null, pages: [], progress: null, searchableProgress: null, searchableReady: false, error: null });
  }

  function invalidateResults(): void {
    if (!state.source || state.phase === "recognizing" || state.phase === "building") return;
    generation += 1; buildController?.abort(); buildController = null;
    publish({ phase: "ready", pages: [], progress: null, searchableProgress: null, searchableReady: false, error: null });
  }

  function updatePageText(pageNumber: number, text: string): void {
    publish({ pages: state.pages.map((page) => page.pageNumber === pageNumber ? { ...page, text } : page) });
  }

  return Object.freeze({ select, recognize, buildSearchable, cancel, reset, invalidateResults, updatePageText, getState: () => state, dispose: async () => { buildController?.abort(); await service.dispose(); } });
}

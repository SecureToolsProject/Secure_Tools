import { createPdfOcrService, readPdfOcrSource } from "../../shared/pdf-ocr.js";
import type { PdfOcrPageResult, PdfOcrPageSelection, PdfOcrProgress, PdfOcrService } from "../../shared/pdf-ocr.js";

export type PdfToTextPhase = "empty" | "preparing" | "ready" | "recognizing" | "success" | "error" | "cancelled";

export interface PdfToTextSource { file: File; bytes: ArrayBuffer; pageCount: number }
export interface PdfToTextState {
  phase: PdfToTextPhase;
  source: PdfToTextSource | null;
  pages: readonly PdfOcrPageResult[];
  progress: PdfOcrProgress | null;
  error: unknown;
}
export interface PdfToTextControllerOptions {
  service?: PdfOcrService;
  inspect(file: File): Promise<{ pageCount: number }>;
  onChange?(state: PdfToTextState): void;
}

export function createPdfToTextController(options: PdfToTextControllerOptions) {
  const service = options.service || createPdfOcrService();
  let generation = 0;
  let state: PdfToTextState = { phase: "empty", source: null, pages: [], progress: null, error: null };
  const publish = (patch: Partial<PdfToTextState>) => {
    state = Object.freeze({ ...state, ...patch });
    options.onChange?.(state);
  };
  const current = (token: number) => token === generation;

  async function select(file: File): Promise<void> {
    const token = ++generation;
    await service.cancel();
    publish({ phase: "preparing", source: null, pages: [], progress: null, error: null });
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
    publish({ phase: "recognizing", pages: [], progress: null, error: null });
    try {
      const result = await service.recognizeDocument({
        sourceBytes: source.bytes,
        language,
        selection,
        onProgress(progress) { if (current(token)) publish({ progress }); },
        onPageResult(page) { if (current(token)) publish({ pages: [...state.pages, page] }); },
      });
      if (!current(token)) return;
      publish({ phase: "success", pages: result.pages, error: null });
    } catch (error) {
      if (!current(token)) return;
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      publish({ phase: code === "PDF_OCR_CANCELLED" ? "cancelled" : "error", progress: null, error });
    }
  }

  async function cancel(): Promise<void> {
    if (state.phase !== "recognizing") return;
    generation += 1;
    await service.cancel();
    publish({ phase: "cancelled", progress: null, error: null });
  }

  async function reset(): Promise<void> {
    generation += 1;
    await service.cancel();
    publish({ phase: "empty", source: null, pages: [], progress: null, error: null });
  }

  function invalidateResults(): void {
    if (!state.source || state.phase === "recognizing") return;
    publish({ phase: "ready", pages: [], progress: null, error: null });
  }

  function updatePageText(pageNumber: number, text: string): void {
    publish({ pages: state.pages.map((page) => page.pageNumber === pageNumber ? { ...page, text } : page) });
  }

  return Object.freeze({ select, recognize, cancel, reset, invalidateResults, updatePageText, getState: () => state, dispose: () => service.dispose() });
}

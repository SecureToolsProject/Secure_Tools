import { OCR_LANGUAGES, resolveOcrLanguage } from "../../shared/ocr.js";
import type { OcrLanguage, OcrProgress } from "../../shared/ocr.js";

export const OCR_UI_STATES = Object.freeze({
  EMPTY: "empty",
  READY: "ready",
  RECOGNIZING: "recognizing",
  SUCCESS: "success",
  ERROR: "error",
  CANCELLED: "cancelled",
} as const);

export type OcrUiState = typeof OCR_UI_STATES[keyof typeof OCR_UI_STATES];

export interface ImageToTextFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

export interface ImageToTextSource {
  readonly file: ImageToTextFile;
  readonly previewUrl: string;
  readonly previewType: string;
}

export interface ImageToTextState {
  phase: OcrUiState;
  source: ImageToTextSource | null;
  language: OcrLanguage;
  text: string;
  progress: OcrProgress | null;
  error: unknown;
}

export interface RecognitionOptions {
  language: OcrLanguage;
  signal: AbortSignal;
  onProgress: (progress: OcrProgress) => void;
}

export interface ImageToTextControllerConfiguration {
  language?: OcrLanguage;
  recognizeImage: (
    file: ImageToTextFile,
    options: RecognitionOptions,
  ) => Promise<{ text: string }>;
  prepareSource: (file: ImageToTextFile) => Promise<ImageToTextSource>;
  releaseSource?: (source: ImageToTextSource) => void;
  onChange?: (state: ImageToTextState) => void;
  dispose?: () => void | Promise<void>;
}

interface ActiveRecognition {
  request: number;
  abortController: AbortController;
  promise: Promise<{ text: string }>;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export function defaultOcrLanguage(uiLanguage: unknown): OcrLanguage {
  return String(uiLanguage || "").toLowerCase().startsWith("ko")
    ? OCR_LANGUAGES.KOREAN_ENGLISH
    : OCR_LANGUAGES.ENGLISH;
}

export function createImageToTextController(configuration: ImageToTextControllerConfiguration) {
  const recognizeImage = configuration.recognizeImage;
  const prepareSource = configuration.prepareSource;
  const releaseSource = configuration.releaseSource || (() => {});
  const onChange = configuration.onChange || (() => {});
  let generation = 0;
  let active: ActiveRecognition | null = null;
  let disposed = false;
  let state: ImageToTextState = {
    phase: OCR_UI_STATES.EMPTY,
    source: null,
    language: resolveOcrLanguage(configuration.language || OCR_LANGUAGES.ENGLISH),
    text: "",
    progress: null,
    error: null,
  };

  function publish(patch: Partial<ImageToTextState>): void {
    state = { ...state, ...patch };
    onChange({ ...state });
  }

  function snapshot(): ImageToTextState {
    return { ...state };
  }

  async function cancel(): Promise<boolean> {
    if (!active) return false;
    const current: ActiveRecognition = active;
    generation += 1;
    active = null;
    current.abortController.abort();
    publish({ phase: OCR_UI_STATES.CANCELLED, progress: null, error: null, text: "" });
    try { await current.promise; } catch { /* The active request reports cancellation itself. */ }
    return true;
  }

  async function select(file: ImageToTextFile): Promise<void> {
    if (disposed) return;
    await cancel();
    const request = ++generation;
    const previous = state.source;
    if (previous) releaseSource(previous);
    publish({ phase: OCR_UI_STATES.EMPTY, source: null, text: "", progress: null, error: null });
    try {
      const source = await prepareSource(file);
      if (disposed || request !== generation) {
        releaseSource(source);
        return;
      }
      publish({ phase: OCR_UI_STATES.READY, source, text: "", progress: null, error: null });
    } catch (error: unknown) {
      if (request === generation && !disposed) {
        publish({ phase: OCR_UI_STATES.ERROR, source: null, text: "", progress: null, error });
      }
    }
  }

  async function remove(): Promise<void> {
    if (disposed) return;
    await cancel();
    generation += 1;
    if (state.source) releaseSource(state.source);
    publish({ phase: OCR_UI_STATES.EMPTY, source: null, text: "", progress: null, error: null });
  }

  async function setLanguage(language: unknown): Promise<void> {
    const nextLanguage = resolveOcrLanguage(language);
    if (nextLanguage === state.language || disposed) return;
    await cancel();
    generation += 1;
    publish({
      language: nextLanguage,
      phase: state.source ? OCR_UI_STATES.READY : OCR_UI_STATES.EMPTY,
      text: "",
      progress: null,
      error: null,
    });
  }

  async function recognize(): Promise<void> {
    if (disposed || !state.source || active) return;
    const request = ++generation;
    const abortController = new AbortController();
    const source = state.source;
    publish({ phase: OCR_UI_STATES.RECOGNIZING, text: "", progress: null, error: null });
    const promise = recognizeImage(source.file, {
      language: state.language,
      signal: abortController.signal,
      onProgress(progress: OcrProgress) {
        if (!disposed && request === generation && active?.request === request) publish({ progress });
      },
    });
    active = { request, abortController, promise };
    try {
      const result = await promise;
      if (!disposed && request === generation && active?.request === request) {
        publish({ phase: OCR_UI_STATES.SUCCESS, text: result.text, progress: null, error: null });
      }
    } catch (error: unknown) {
      if (!disposed && request === generation && active?.request === request) {
        const cancelled = errorCode(error) === "OCR_CANCELLED";
        publish({
          phase: cancelled ? OCR_UI_STATES.CANCELLED : OCR_UI_STATES.ERROR,
          text: "",
          progress: null,
          error: cancelled ? null : error,
        });
      }
    } finally {
      if (active?.request === request) active = null;
    }
  }

  function updateText(text: unknown): void {
    if (state.phase === OCR_UI_STATES.SUCCESS) publish({ text: String(text) });
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    await cancel();
    disposed = true;
    generation += 1;
    if (state.source) releaseSource(state.source);
    state = { ...state, source: null, text: "", progress: null };
    await configuration.dispose?.();
  }

  onChange(snapshot());
  return Object.freeze({ snapshot, select, remove, setLanguage, recognize, cancel, updateText, dispose });
}

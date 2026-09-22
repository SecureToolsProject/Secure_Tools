import { OCR_LANGUAGES, resolveOcrLanguage } from "../../shared/ocr.js";

export const OCR_UI_STATES = Object.freeze({
  EMPTY: "empty",
  READY: "ready",
  RECOGNIZING: "recognizing",
  SUCCESS: "success",
  ERROR: "error",
  CANCELLED: "cancelled",
});

export function defaultOcrLanguage(uiLanguage) {
  return String(uiLanguage || "").toLowerCase().startsWith("ko")
    ? OCR_LANGUAGES.KOREAN_ENGLISH
    : OCR_LANGUAGES.ENGLISH;
}

export function createImageToTextController(configuration) {
  const recognizeImage = configuration.recognizeImage;
  const prepareSource = configuration.prepareSource;
  const releaseSource = configuration.releaseSource || (() => {});
  const onChange = configuration.onChange || (() => {});
  let generation = 0;
  let active = null;
  let disposed = false;
  let state = {
    phase: OCR_UI_STATES.EMPTY,
    source: null,
    language: resolveOcrLanguage(configuration.language || OCR_LANGUAGES.ENGLISH),
    text: "",
    progress: null,
    error: null,
  };

  function publish(patch) {
    state = { ...state, ...patch };
    onChange({ ...state });
  }

  function snapshot() {
    return { ...state };
  }

  async function cancel() {
    if (!active) return false;
    const current = active;
    generation += 1;
    active = null;
    current.abortController.abort();
    publish({ phase: OCR_UI_STATES.CANCELLED, progress: null, error: null, text: "" });
    try { await current.promise; } catch { /* The active request reports cancellation itself. */ }
    return true;
  }

  async function select(file) {
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
    } catch (error) {
      if (request === generation && !disposed) {
        publish({ phase: OCR_UI_STATES.ERROR, source: null, text: "", progress: null, error });
      }
    }
  }

  async function remove() {
    if (disposed) return;
    await cancel();
    generation += 1;
    if (state.source) releaseSource(state.source);
    publish({ phase: OCR_UI_STATES.EMPTY, source: null, text: "", progress: null, error: null });
  }

  async function setLanguage(language) {
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

  async function recognize() {
    if (disposed || !state.source || active) return;
    const request = ++generation;
    const abortController = new AbortController();
    const source = state.source;
    publish({ phase: OCR_UI_STATES.RECOGNIZING, text: "", progress: null, error: null });
    const promise = recognizeImage(source.file, {
      language: state.language,
      signal: abortController.signal,
      onProgress(progress) {
        if (!disposed && request === generation && active?.request === request) publish({ progress });
      },
    });
    active = { request, abortController, promise };
    try {
      const result = await promise;
      if (!disposed && request === generation && active?.request === request) {
        publish({ phase: OCR_UI_STATES.SUCCESS, text: result.text, progress: null, error: null });
      }
    } catch (error) {
      if (!disposed && request === generation && active?.request === request) {
        publish({
          phase: error?.code === "OCR_CANCELLED" ? OCR_UI_STATES.CANCELLED : OCR_UI_STATES.ERROR,
          text: "",
          progress: null,
          error: error?.code === "OCR_CANCELLED" ? null : error,
        });
      }
    } finally {
      if (active?.request === request) active = null;
    }
  }

  function updateText(text) {
    if (state.phase === OCR_UI_STATES.SUCCESS) publish({ text: String(text) });
  }

  async function dispose() {
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

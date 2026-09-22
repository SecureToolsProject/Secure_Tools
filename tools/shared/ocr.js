import { decodeImage, validateImageSignature } from "./image.js";

export const OCR_LANGUAGES = Object.freeze({
  ENGLISH: "eng",
  KOREAN: "kor",
  KOREAN_ENGLISH: "eng+kor",
});

const SUPPORTED_LANGUAGES = new Set(Object.values(OCR_LANGUAGES));

export const OCR_ASSET_PATHS = Object.freeze({
  workerPath: new URL("../../assets/vendor/tesseract/worker/worker.min.js", import.meta.url).href,
  corePath: new URL("../../assets/vendor/tesseract/core/", import.meta.url).href,
  langPath: new URL("../../assets/vendor/tesseract/lang", import.meta.url).href,
});

function ocrError(code, cause) {
  const error = new Error(code, cause === undefined ? undefined : { cause });
  error.code = code;
  return error;
}

function cancellationError() {
  return ocrError("OCR_CANCELLED");
}

export function resolveOcrLanguage(language) {
  if (!SUPPORTED_LANGUAGES.has(language)) throw ocrError("OCR_LANGUAGE_UNSUPPORTED");
  return language;
}

export function normalizeOcrProgress(message) {
  if (!message || typeof message.status !== "string") return null;
  const status = message.status.toLowerCase();
  let stage = null;
  if (status.includes("tesseract core")) stage = "loading-engine";
  else if (status.includes("language") || status.includes("traineddata")) stage = "loading-language";
  else if (status.includes("initializ")) stage = "initializing";
  else if (status.includes("recogniz")) stage = "recognizing";
  if (!stage) return null;

  const numeric = Number(message.progress);
  return {
    stage,
    progress: Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : null,
  };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(ocrError("OCR_IMAGE_PREPARATION_FAILED"));
    }, "image/png");
  });
}

export async function prepareImageForOcr(image, environment = {}) {
  if (!(image instanceof Blob)) throw ocrError("UNSUPPORTED_IMAGE");
  await validateImageSignature(image);
  const decode = environment.decodeImage || decodeImage;
  const documentObject = environment.documentObject || globalThis.document;
  if (!documentObject?.createElement) throw ocrError("OCR_IMAGE_PREPARATION_FAILED");

  const decoded = await decode(image);
  const canvas = documentObject.createElement("canvas");
  try {
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw ocrError("CANVAS_UNAVAILABLE");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0);
    return await canvasToBlob(canvas);
  } catch (error) {
    if (error.code) throw error;
    throw ocrError("OCR_IMAGE_PREPARATION_FAILED", error);
  } finally {
    decoded.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}

export function createOcrService(configuration = {}) {
  const createWorker = configuration.createWorker || globalThis.Tesseract?.createWorker;
  const prepareImage = configuration.prepareImage || prepareImageForOcr;
  const assetPaths = configuration.assetPaths || OCR_ASSET_PATHS;
  let worker = null;
  let workerLanguage = null;
  let initializing = null;
  let activeProgress = null;
  let generation = 0;
  let busy = false;
  let disposed = false;
  let cancelActive = null;

  function emit(progress) {
    if (activeProgress && progress) activeProgress(progress);
  }

  async function discardWorker() {
    generation += 1;
    const current = worker;
    worker = null;
    workerLanguage = null;
    if (current) {
      try { await current.terminate(); }
      catch { /* The worker reference is discarded even if its termination acknowledgement fails. */ }
    }
  }

  async function ensureWorker(language, signal) {
    if (worker && workerLanguage === language) return worker;
    if (worker) await discardWorker();
    if (signal?.aborted) throw cancellationError();
    if (typeof createWorker !== "function") throw ocrError("OCR_INITIALIZATION_FAILED");

    const workerGeneration = ++generation;
    let candidate = null;
    emit({ stage: "loading-engine", progress: null });
    try {
      initializing = createWorker(language, 1, {
        ...assetPaths,
        workerBlobURL: false,
        cacheMethod: "write",
        logger(message) {
          if (workerGeneration !== generation) return;
          emit(normalizeOcrProgress(message));
        },
        errorHandler() {},
      });
      candidate = await initializing;
      if (disposed) {
        const cancelledCandidate = candidate;
        candidate = null;
        await cancelledCandidate.terminate();
        throw ocrError("OCR_DISPOSED");
      }
      if (signal?.aborted || workerGeneration !== generation) {
        const cancelledCandidate = candidate;
        candidate = null;
        await cancelledCandidate.terminate();
        throw cancellationError();
      }
      worker = candidate;
      workerLanguage = language;
      return worker;
    } catch (error) {
      if (candidate && candidate !== worker) {
        try { await candidate.terminate(); } catch { /* Best-effort cleanup after partial initialization. */ }
      }
      if (error?.code === "OCR_CANCELLED" || error?.code === "OCR_DISPOSED") throw error;
      throw ocrError("OCR_INITIALIZATION_FAILED", error);
    } finally {
      initializing = null;
    }
  }

  async function recognizeImage(image, options = {}) {
    if (disposed) throw ocrError("OCR_DISPOSED");
    if (busy || initializing) throw ocrError("OCR_BUSY");
    const language = resolveOcrLanguage(options.language);
    if (options.signal?.aborted) throw cancellationError();

    busy = true;
    const progressCallback = typeof options.onProgress === "function" ? options.onProgress : null;
    activeProgress = progressCallback;
    let preparedImage = null;
    let abortHandler = null;
    try {
      preparedImage = await prepareImage(image);
      if (options.signal?.aborted) throw cancellationError();
      const activeWorker = await ensureWorker(language, options.signal);
      if (options.signal?.aborted) throw cancellationError();

      const recognition = activeWorker.recognize(preparedImage);
      const interruption = new Promise((_, reject) => {
        const cancel = (error) => {
          const cleanup = discardWorker();
          cleanup.finally(() => reject(error));
          return cleanup;
        };
        cancelActive = cancel;
        if (options.signal) {
          abortHandler = () => cancel(cancellationError());
          options.signal.addEventListener("abort", abortHandler, { once: true });
        }
      });
      const result = await Promise.race([recognition, interruption]);
      emit({ stage: "complete", progress: 1 });
      return { text: typeof result?.data?.text === "string" ? result.data.text : "" };
    } catch (error) {
      if (error?.code === "OCR_CANCELLED" || options.signal?.aborted) throw cancellationError();
      if (error?.code && !error.code.startsWith("OCR_")) throw error;
      if (error?.code === "OCR_INITIALIZATION_FAILED" || error?.code === "OCR_DISPOSED" || error?.code === "OCR_LANGUAGE_UNSUPPORTED") throw error;
      await discardWorker();
      throw ocrError("OCR_RECOGNITION_FAILED", error);
    } finally {
      if (abortHandler) options.signal.removeEventListener("abort", abortHandler);
      cancelActive = null;
      if (activeProgress === progressCallback) activeProgress = null;
      preparedImage = null;
      busy = false;
    }
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    activeProgress = null;
    if (cancelActive) await cancelActive(ocrError("OCR_DISPOSED"));
    if (initializing) {
      try { await initializing; } catch { /* ensureWorker reports the controlled initialization error. */ }
    }
    await discardWorker();
  }

  return Object.freeze({ recognizeImage, dispose });
}

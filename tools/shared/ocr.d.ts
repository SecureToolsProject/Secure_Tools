export const OCR_LANGUAGES: Readonly<{
  ENGLISH: "eng";
  KOREAN: "kor";
  KOREAN_ENGLISH: "eng+kor";
}>;

export type OcrLanguage = typeof OCR_LANGUAGES[keyof typeof OCR_LANGUAGES];
export type OcrProgressStage = "loading-engine" | "loading-language" | "initializing" | "recognizing" | "complete";

export interface OcrProgress {
  stage: OcrProgressStage;
  progress: number | null;
}

export interface OcrRecognitionOptions {
  language: OcrLanguage;
  signal?: AbortSignal;
  onProgress?: (progress: OcrProgress) => void;
}

export interface OcrService {
  recognizeImage(image: Blob, options: OcrRecognitionOptions): Promise<{ text: string }>;
  dispose(): Promise<void>;
}

export interface OcrServiceConfiguration {
  prepareImage?: (image: Blob) => Promise<Blob>;
}

export function resolveOcrLanguage(language: unknown): OcrLanguage;
export function prepareImageForOcr(image: Blob): Promise<Blob>;
export function createOcrService(configuration?: OcrServiceConfiguration): OcrService;

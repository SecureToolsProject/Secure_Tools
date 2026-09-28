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

export function resolveOcrLanguage(language: unknown): OcrLanguage;
export function prepareImageForOcr(image: Blob): Promise<Blob>;

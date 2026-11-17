import type { DecodedImage } from "../../shared/image.js";
export interface ImagePdfOptions { pageSize: string; orientation: string; margin: number; quality: number; fillPage: boolean }
export function createPdfBlob(options: {
  files: readonly File[]; options: ImagePdfOptions; JsPDF: unknown;
  signal?: AbortSignal; imageFormat?: string;
  onProgress?: (completed: number, total: number) => void;
  decode?: (file: File) => Promise<DecodedImage>;
  convert?: (image: DecodedImage, quality: number, index: number) => Promise<Uint8Array>;
}): Promise<Blob>;

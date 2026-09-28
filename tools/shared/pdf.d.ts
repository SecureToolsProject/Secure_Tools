export interface PdfFileLike extends Blob {
  readonly name?: string;
}

export function isSupportedPdf(file: unknown): boolean;

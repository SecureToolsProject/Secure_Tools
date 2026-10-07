export interface PdfFileLike extends Blob {
  readonly name?: string;
}

export function isSupportedPdf(file: unknown): boolean;
export function inspectPdf(file: PdfFileLike, PDFDocument: unknown): Promise<{ pageCount: number }>;

export interface PdfFileLike extends Blob {
  readonly name?: string;
}

export function isSupportedPdf(file: unknown): boolean;
export function requirePdfSignature(sourceBytes: ArrayBuffer | ArrayBufferView, fileName?: string): void;
export function readPdfSourceBytes(file: PdfFileLike): Promise<ArrayBuffer>;
export function inspectPdf(file: PdfFileLike, PDFDocument: unknown): Promise<{ pageCount: number }>;

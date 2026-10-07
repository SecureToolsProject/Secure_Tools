export interface PdfViewport {
  readonly width: number;
  readonly height: number;
  readonly transform?: readonly [number, number, number, number, number, number];
}

export interface PdfTextContent { readonly items: readonly unknown[] }

export interface PdfPageProxy {
  getViewport(options: { scale: number }): PdfViewport;
  getTextContent?(): Promise<PdfTextContent>;
  cleanup(): void;
}

export interface PdfRenderContext {
  canvasContext: CanvasRenderingContext2D;
  viewport: PdfViewport;
  background: string;
}

export class LocalPdfRenderer {
  constructor(sourceBytes: ArrayBuffer);
  load(): Promise<number>;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  runRender(page: PdfPageProxy, renderContext: PdfRenderContext): Promise<void>;
  destroy(): Promise<void>;
}

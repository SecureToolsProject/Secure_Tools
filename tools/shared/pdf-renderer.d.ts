export interface PdfViewport {
  readonly width: number;
  readonly height: number;
}

export interface PdfPageProxy {
  getViewport(options: { scale: number }): PdfViewport;
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

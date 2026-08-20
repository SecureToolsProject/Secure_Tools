import { createPdfError, loadPdfSource, requirePdfDocument } from "../../shared/pdf.js";

export { inspectPdf, isSupportedPdf } from "../../shared/pdf.js";

export async function mergePdfFiles({ files, PDFDocument, onProgress = () => {} }) {
  requirePdfDocument(PDFDocument);
  if (!files?.length) throw createPdfError("NO_FILES");

  const output = await PDFDocument.create();
  let pageCount = 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const source = await loadPdfSource(file, PDFDocument);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
    pageCount += pages.length;
    onProgress(index + 1, files.length, pageCount);
  }

  try {
    const bytes = await output.save();
    return { blob: new Blob([bytes], { type: "application/pdf" }), pageCount };
  } catch (error) {
    throw createPdfError("PDF_GENERATION_FAILED", undefined, error);
  }
}

function createPdfError(code, fileName, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  error.fileName = fileName;
  return error;
}

function unreadableError(file, cause) {
  const detail = `${cause?.name || ""} ${cause?.message || ""}`.toLowerCase();
  const code = detail.includes("encrypt") || detail.includes("password")
    ? "ENCRYPTED_PDF"
    : "UNREADABLE_PDF";
  return createPdfError(code, file?.name || "PDF", cause);
}

function requirePdfDocument(PDFDocument) {
  if (!PDFDocument?.load || !PDFDocument?.create) {
    throw createPdfError("PDF_LIBRARY_UNAVAILABLE");
  }
}

export function isSupportedPdf(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  if (type === "application/pdf") return true;
  return type === "" && /\.pdf$/i.test(String(file.name || ""));
}

async function loadSource(file, PDFDocument) {
  if (!isSupportedPdf(file)) throw createPdfError("UNSUPPORTED_PDF", file?.name);
  try {
    const bytes = await file.arrayBuffer();
    return await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    if (error?.code) throw error;
    throw unreadableError(file, error);
  }
}

export async function inspectPdf(file, PDFDocument) {
  requirePdfDocument(PDFDocument);
  const document = await loadSource(file, PDFDocument);
  return { pageCount: document.getPageCount() };
}

export async function mergePdfFiles({ files, PDFDocument, onProgress = () => {} }) {
  requirePdfDocument(PDFDocument);
  if (!files?.length) throw createPdfError("NO_FILES");

  const output = await PDFDocument.create();
  let pageCount = 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const source = await loadSource(file, PDFDocument);
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

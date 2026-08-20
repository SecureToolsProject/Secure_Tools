export function createPdfError(code, fileName, cause) {
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

export function requirePdfDocument(PDFDocument) {
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

export async function loadPdfSource(file, PDFDocument) {
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
  const document = await loadPdfSource(file, PDFDocument);
  return { pageCount: document.getPageCount() };
}

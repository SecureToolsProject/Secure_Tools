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
  // Advisory hint for error messaging only; never authorizes parser entry.
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  if (type === "application/pdf") return true;
  return type === "" && /\.pdf$/i.test(String(file.name || ""));
}

// Require the header at byte zero. Do not scan for a header in arbitrary content.
// This is admission only: the parser must still validate the PDF structure.
export function requirePdfSignature(sourceBytes, fileName) {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const view = ArrayBuffer.isView(sourceBytes)
    ? new Uint8Array(sourceBytes.buffer, sourceBytes.byteOffset, Math.min(5, sourceBytes.byteLength))
    : sourceBytes instanceof ArrayBuffer ? new Uint8Array(sourceBytes, 0, Math.min(5, sourceBytes.byteLength)) : null;
  if (!view || view.length !== 5 || signature.some((byte, index) => view[index] !== byte)) {
    throw createPdfError("UNREADABLE_PDF", fileName);
  }
}

export async function readPdfSourceBytes(file) {
  if (typeof file?.slice !== "function" || typeof file?.arrayBuffer !== "function") {
    throw createPdfError("UNSUPPORTED_PDF", file?.name);
  }
  try {
    // Reject before reading the complete file or starting any parser/worker.
    requirePdfSignature(await file.slice(0, 5).arrayBuffer(), file.name);
  } catch (error) {
    if (error?.code === "UNREADABLE_PDF" && !isSupportedPdf(file)) {
      throw createPdfError("UNSUPPORTED_PDF", file.name, error);
    }
    throw error;
  }
  const bytes = await file.arrayBuffer();
  requirePdfSignature(bytes, file.name);
  return bytes;
}

export async function loadPdfSource(file, PDFDocument) {
  try {
    const bytes = await readPdfSourceBytes(file);
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

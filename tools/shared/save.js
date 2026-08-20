export function downloadBlob(blob, filename, environment = {}) {
  const documentObject = environment.documentObject || document;
  const urlObject = environment.urlObject || URL;
  const schedule = environment.schedule || setTimeout;
  const url = urlObject.createObjectURL(blob);
  const anchor = documentObject.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  documentObject.body.append(anchor);
  anchor.click();
  anchor.remove();
  schedule(() => urlObject.revokeObjectURL(url), 1500);
}

export async function requestSaveHandle(windowObject, { suggestedName, description, mimeType, extension }) {
  if (!("showSaveFilePicker" in windowObject)) return null;
  return windowObject.showSaveFilePicker({
    suggestedName,
    types: [{ description, accept: { [mimeType]: [extension] } }],
  });
}

export function requestPdfSaveHandle(windowObject, suggestedName, description) {
  return requestSaveHandle(windowObject, {
    suggestedName,
    description,
    mimeType: "application/pdf",
    extension: ".pdf",
  });
}

export async function writeBlobToHandle(fileHandle, blob) {
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

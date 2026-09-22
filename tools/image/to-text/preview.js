import { prepareImageForOcr } from "../../shared/ocr.js";

export async function preparePreviewSource(file, environment = {}) {
  const prepareImage = environment.prepareImage || prepareImageForOcr;
  const urlObject = environment.urlObject || URL;
  const previewBlob = await prepareImage(file);
  return {
    file,
    previewUrl: urlObject.createObjectURL(previewBlob),
    previewType: previewBlob.type,
  };
}

export function releasePreviewSource(source, environment = {}) {
  if (source?.previewUrl) (environment.urlObject || URL).revokeObjectURL(source.previewUrl);
}

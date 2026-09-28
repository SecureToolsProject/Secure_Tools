import { prepareImageForOcr } from "../../shared/ocr.js";

export interface PreviewSource {
  readonly file: Blob;
  readonly previewUrl: string;
  readonly previewType: string;
}

export interface PreviewEnvironment {
  prepareImage?: (file: Blob) => Promise<Blob>;
  urlObject?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
}

export async function preparePreviewSource(file: Blob, environment: PreviewEnvironment = {}): Promise<PreviewSource> {
  const prepareImage = environment.prepareImage || prepareImageForOcr;
  const urlObject = environment.urlObject || URL;
  const previewBlob = await prepareImage(file);
  return {
    file,
    previewUrl: urlObject.createObjectURL(previewBlob),
    previewType: previewBlob.type,
  };
}

export function releasePreviewSource(source: PreviewSource | null | undefined, environment: PreviewEnvironment = {}): void {
  if (source?.previewUrl) (environment.urlObject || URL).revokeObjectURL(source.previewUrl);
}

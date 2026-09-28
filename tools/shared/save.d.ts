export interface DownloadEnvironment {
  documentObject?: Document;
  urlObject?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  schedule?: (callback: () => void, delay: number) => unknown;
}

export function downloadBlob(blob: Blob, filename: string, environment?: DownloadEnvironment): void;

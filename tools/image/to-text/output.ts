import { downloadBlob } from "../../shared/save.js";
import type { DownloadEnvironment } from "../../shared/save.js";

const ILLEGAL_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;

export interface CopyEnvironment {
  navigatorObject?: Pick<Navigator, "clipboard">;
  documentObject?: Document;
}

export function textFilename(sourceName: unknown): string {
  const withoutExtension = String(sourceName || "").replace(/\.[^.]+$/, "");
  const clean = withoutExtension.trim().replace(ILLEGAL_FILENAME_CHARACTERS, "_").replace(/[. ]+$/g, "");
  return `${clean || "recognized-text"}.txt`;
}

export function createTextBlob(text: unknown): Blob {
  return new Blob([String(text)], { type: "text/plain;charset=utf-8" });
}

export async function copyText(text: unknown, environment: CopyEnvironment = {}): Promise<void> {
  const navigatorObject = environment.navigatorObject || globalThis.navigator;
  const documentObject = environment.documentObject || globalThis.document;
  if (navigatorObject?.clipboard?.writeText) {
    await navigatorObject.clipboard.writeText(String(text));
    return;
  }
  if (!documentObject?.createElement || typeof documentObject.execCommand !== "function") {
    throw Object.assign(new Error("OCR_COPY_FAILED"), { code: "OCR_COPY_FAILED" });
  }
  const field = documentObject.createElement("textarea");
  field.value = String(text);
  field.setAttribute("readonly", "");
  field.className = "clipboard-fallback";
  documentObject.body.append(field);
  field.select();
  const copied = documentObject.execCommand("copy");
  field.remove();
  if (!copied) throw Object.assign(new Error("OCR_COPY_FAILED"), { code: "OCR_COPY_FAILED" });
}

export function downloadText(text: unknown, sourceName: unknown, environment?: DownloadEnvironment): void {
  downloadBlob(createTextBlob(text), textFilename(sourceName), environment);
}

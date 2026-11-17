export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}
export const ACCEPTED_IMAGE_TYPES: string;
export const MAX_FILE_SIZE: number;
export function decodeImage(file: Blob): Promise<DecodedImage>;
export function isSupportedImage(file: Blob): boolean;
export function validateImageSignature(file: Blob): Promise<string>;
export function validateImageDimensions(width: number, height: number): boolean;

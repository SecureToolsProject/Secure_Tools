import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_DIMENSION, MAX_FILE_SIZE, MAX_PIXELS, MAX_QUEUE_BYTES, MAX_QUEUE_FILES,
  detectImageFormat, selectImageQueueFiles, validateImageDimensions, validateImageSignature,
} from "../tools/pdf/images-to-pdf/image.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new TextEncoder().encode("RIFF0000WEBP");
const file = (bytes, name, type = "", size) => {
  const value = new File([bytes], name, { type });
  if (size !== undefined) Object.defineProperty(value, "size", { value: size });
  return value;
};

assert.equal(detectImageFormat(jpeg), "jpeg");
assert.equal(detectImageFormat(png), "png");
assert.equal(detectImageFormat(webp), "webp");
assert.equal(detectImageFormat(new Uint8Array()), null);
assert.equal(detectImageFormat(new Uint8Array([0xff, 0xd8])), null);
assert.equal(await validateImageSignature(file(png, "photo.jpg", "image/jpeg")), "png");
for (const spoofed of [
  file(new TextEncoder().encode("not an image"), "fake.jpg", "image/jpeg"),
  file(new Uint8Array([0x89, 0x50]), "fake.png", "image/png"),
  file(new TextEncoder().encode("RIFFbad"), "fake.webp", "image/webp"),
  file([], "empty.jpg", "image/jpeg"),
]) await assert.rejects(validateImageSignature(spoofed), (error) => error.code === "IMAGE_SIGNATURE_INVALID");

assert.equal(MAX_FILE_SIZE, 50 * 1024 * 1024);
assert.equal(MAX_DIMENSION, 16384);
assert.equal(MAX_PIXELS, 50_000_000);
assert.equal(MAX_QUEUE_FILES, 100);
assert.equal(MAX_QUEUE_BYTES, 500 * 1024 * 1024);
assert.equal((await selectImageQueueFiles([], [file(jpeg, "boundary.jpg", "image/jpeg", MAX_FILE_SIZE)])).accepted.length, 1);
assert.equal((await selectImageQueueFiles([], [file(jpeg, "large.jpg", "image/jpeg", MAX_FILE_SIZE + 1)])).rejected[0].code, "IMAGE_FILE_TOO_LARGE");
const existingCount = Array.from({ length: MAX_QUEUE_FILES }, (_, index) => file(jpeg, `${index}.jpg`, "image/jpeg"));
assert.equal((await selectImageQueueFiles(existingCount, [file(jpeg, "extra.jpg", "image/jpeg")])).rejected[0].code, "IMAGE_QUEUE_FILES_EXCEEDED");
assert.equal((await selectImageQueueFiles([file(jpeg, "full.jpg", "image/jpeg", MAX_QUEUE_BYTES)], [file(jpeg, "extra.jpg", "image/jpeg")])).rejected[0].code, "IMAGE_QUEUE_BYTES_EXCEEDED");
assert.equal(validateImageDimensions(MAX_DIMENSION, 1), true);
assert.equal(validateImageDimensions(10_000, 5_000), true);
assert.throws(() => validateImageDimensions(MAX_DIMENSION + 1, 1), (error) => error.code === "IMAGE_DIMENSION_EXCEEDED");
assert.throws(() => validateImageDimensions(10_000, 5_001), (error) => error.code === "IMAGE_PIXELS_EXCEEDED");

const vendorPackage = JSON.parse(read("assets/vendor/jspdf/package.json"));
assert.equal(vendorPackage.version, "4.2.1");
assert.doesNotMatch(read("assets/vendor/jspdf/jspdf.umd.min.js").slice(0, 500), /Version 2\.5\.2/);
assert.match(read("assets/vendor/jspdf/README.md"), /Version: `4\.2\.1`[\s\S]*Runtime SHA-256:/);
const imageHtml = read("tools/pdf/images-to-pdf/index.html");
assert.match(imageHtml, /src="\.\.\/\.\.\/\.\.\/assets\/vendor\/jspdf\/jspdf\.umd\.min\.js"/);
assert.doesNotMatch(imageHtml, /(?:unpkg|jsdelivr|cdnjs|https?:\/\/[^"']*jspdf)/i);

const productionHtml = [
  "index.html", "404.html", "about/index.html", "privacy/index.html", "tools/image-to-pdf/index.html",
  "tools/image/index.html", "tools/media/index.html", "tools/pdf/index.html", "tools/privacy/index.html", "tools/scan/index.html",
  "tools/pdf/images-to-pdf/index.html", "tools/pdf/merge/index.html", "tools/pdf/split/index.html", "tools/pdf/organize/index.html", "tools/pdf/to-images/index.html",
];
for (const relative of productionHtml) {
  const html = read(relative);
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] || "";
  for (const directive of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "connect-src 'none'", "object-src 'none'", "frame-src 'none'", "base-uri 'self'", "form-action 'self'"]) assert.match(csp, new RegExp(directive.replaceAll("'", "\\'")), `${relative}: missing ${directive}`);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, `${relative}: inline script`);
  assert.doesNotMatch(html, /<style\b|\sstyle="/i, `${relative}: inline style`);
}
assert.equal(fs.existsSync(path.join(root, "image2pdf_proto.html")), false);

const app = read("tools/pdf/images-to-pdf/app.js");
assert.match(app, /name\.textContent\s*=\s*item\.file\.name/);
assert.doesNotMatch(app, /innerHTML\s*=.*file\.name/);
assert.match(app, /function setStatus[\s\S]*?dataset\.tone = tone;\s*}/);
assert.match(app, /function rejectionReason/);
assert.match(app, /function errorMessage[\s\S]*?IMAGE_DIMENSION_EXCEEDED[\s\S]*?IMAGE_PIXELS_EXCEEDED/);
assert.match(app, /IMAGE_SIGNATURE_INVALID/);
assert.match(app, /setRejectedStatus/);

const firstParty = ["js", "tools"].flatMap((directory) => {
  const walk = (current) => fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(current, entry.name)) : entry.name.endsWith(".js") ? [path.join(current, entry.name)] : []);
  return walk(path.join(root, directory));
});
const networkApi = /\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\s*\(|\bWebSocket\b|\bEventSource\b/;
for (const source of firstParty) assert.doesNotMatch(fs.readFileSync(source, "utf8"), networkApi, `Unexpected network API: ${path.relative(root, source)}`);

console.log("Security hardening checks passed.");

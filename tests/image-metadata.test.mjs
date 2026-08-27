import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanAndVerifyImageMetadata, createCleaningPolicy, createCleanOutputPlan, createVerificationExpectation, inspectImageMetadata, PRIVACY_CLEAN_POLICY } from "../tools/image/metadata/metadata.js";
import { buildCleaningModel, buildInspectionModel, formatMetadataValue, MAX_METADATA_VALUE_LENGTH } from "../tools/image/metadata/model.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const output = new Uint8Array(12 + data.length);
  new DataView(output.buffer).setUint32(0, data.length);
  output.set(typeBytes, 4); output.set(data, 8);
  new DataView(output.buffer).setUint32(output.length - 4, crc32(new Uint8Array([...typeBytes, ...data])));
  return output;
}

function metadataPng() {
  const clean = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const chunks = [pngChunk("tEXt", new TextEncoder().encode("Comment\0private note")), pngChunk("iCCP", new TextEncoder().encode("profile\0\0profile bytes")), pngChunk("tIME", Uint8Array.of(0x07, 0xe8, 1, 2, 3, 4, 5))];
  const iendOffset = clean.length - 12;
  const output = new Uint8Array(clean.length + chunks.reduce((total, chunk) => total + chunk.length, 0));
  output.set(clean.slice(0, iendOffset)); let offset = iendOffset;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  output.set(clean.slice(iendOffset), offset);
  return output;
}

function concatenate(...arrays) {
  const output = new Uint8Array(arrays.reduce((total, bytes) => total + bytes.length, 0));
  let offset = 0; for (const bytes of arrays) { output.set(bytes, offset); offset += bytes.length; } return output;
}

function jpegSegment(marker, payload) {
  const output = new Uint8Array(payload.length + 4); output.set([0xff, marker]);
  new DataView(output.buffer).setUint16(2, payload.length + 2); output.set(payload, 4); return output;
}

function exifPayload() {
  return Uint8Array.of(
    0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 0x2a, 0, 8, 0, 0, 0,
    1, 0, 0x0e, 1, 2, 0, 6, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0,
    0x68, 0x65, 0x6c, 0x6c, 0x6f, 0,
  );
}

function metadataJpeg() {
  const encoder = new TextEncoder();
  return concatenate(
    Uint8Array.of(0xff, 0xd8),
    jpegSegment(0xe1, exifPayload()),
    jpegSegment(0xe2, concatenate(encoder.encode("ICC_PROFILE\0"), Uint8Array.of(1, 1, 9, 8, 7))),
    jpegSegment(0xfe, encoder.encode("private comment")),
    Uint8Array.of(0xff, 0xd9),
  );
}

function webpChunk(type, data) {
  const output = new Uint8Array(8 + data.length + (data.length % 2)); output.set(new TextEncoder().encode(type));
  new DataView(output.buffer).setUint32(4, data.length, true); output.set(data, 8); return output;
}

function metadataWebp() {
  const vp8x = new Uint8Array(10); vp8x[0] = 0x2c;
  const chunks = concatenate(
    webpChunk("VP8X", vp8x),
    webpChunk("ICCP", Uint8Array.of(1, 2, 3, 4)),
    webpChunk("EXIF", exifPayload().slice(6)),
    webpChunk("XMP ", new TextEncoder().encode("<x:xmpmeta>private</x:xmpmeta>")),
    webpChunk("VP8 ", Uint8Array.of(0)),
  );
  const output = new Uint8Array(12 + chunks.length); output.set(new TextEncoder().encode("RIFF"));
  new DataView(output.buffer).setUint32(4, output.length - 8, true); output.set(new TextEncoder().encode("WEBP"), 8); output.set(chunks, 12); return output;
}

const labels = { opaque: "opaque", bytes: "{count} bytes", true: "yes", false: "no", unknown: "unknown" };
assert.deepEqual(formatMetadataValue({ numerator: 3, denominator: 7 }, labels), { text: "3/7", opaque: false, truncated: false });
assert.equal(formatMetadataValue([{ numerator: 1, denominator: 2 }, { numerator: 3, denominator: 4 }], labels).text, "1/2, 3/4");
assert.equal(formatMetadataValue(new Uint8Array(9), labels).text, "9 bytes");
assert.equal(formatMetadataValue(undefined, labels).opaque, true);
assert.equal(formatMetadataValue("x".repeat(MAX_METADATA_VALUE_LENGTH + 1), labels).truncated, true);

const partialModel = buildInspectionModel({ format: "jpeg", file: { size: 10 }, cleanable: true, report: { inspectionStatus: "metadata-partial", entries: [{ id: "x", namespace: "xmp", name: "Creator", category: "author", source: "APP1" }], diagnostics: [] } }, labels);
assert.equal(partialModel.successful, true, "metadata-partial is a successful, explicitly non-exhaustive inspection");
assert.equal(partialModel.cleanable, true);
assert.equal(partialModel.groups[0].items[0].value.opaque, true);
assert.equal(partialModel.decodedCount, 0); assert.equal(partialModel.additionalCount, 1); assert.deepEqual(partialModel.decodedGroups, []);
assert.equal(partialModel.groups[0].key, "xmp", "XMP remains a distinct namespace group");
const categorized = buildInspectionModel({ cleanable: true, report: { inspectionStatus: "metadata-partial", entries: [{ id: "a", namespace: "exif", name: "Software", category: "software", value: "Camera App" }, { id: "b", namespace: "iptc", name: "Caption", category: "description", value: "Decoded caption" }, { id: "c", namespace: "unknown", name: "Tag", category: "not-known" }], diagnostics: [{ severity: "warning", code: "TEST_DIAGNOSTIC", offset: 42, message: "bounded detail" }] } }, labels);
assert.deepEqual(categorized.groups.map(({ key }) => key), ["software", "iptc", "other"]);
assert.deepEqual(categorized.decodedGroups.map(({ key }) => key), ["software", "iptc"]);
assert.equal(categorized.decodedCount, 2); assert.equal(categorized.decodedGroupCount, 2); assert.equal(categorized.additionalCount, 1);
assert.match(categorized.diagnostics[0], /WARNING · TEST_DIAGNOSTIC · byte 42 · bounded detail/);
assert.equal(buildInspectionModel({ report: { inspectionStatus: "format-only", entries: [], diagnostics: [] } }).coverageKey, "imageMetadata.coverage.format-only");
assert.equal(buildInspectionModel({ report: { inspectionStatus: "container-inspected", entries: [], diagnostics: [] } }).count, 0, "No supported metadata is distinct from a claim that no metadata exists");
const incompleteModel = buildInspectionModel({ cleanable: false, report: { inspectionStatus: "container-partial", entries: [], diagnostics: [] } }, labels);
assert.equal(incompleteModel.successful, false); assert.equal(incompleteModel.cleanable, false);

assert.deepEqual(PRIVACY_CLEAN_POLICY, { removeExif: true, removeXmp: true, removeIptc: true, removeComments: true, removeTextMetadata: true, removeTimestamps: true, preserveIcc: true });
const sourceBytes = metadataPng(); const originalSnapshot = sourceBytes.slice();
const file = new File([sourceBytes], "holiday.png", { type: "application/octet-stream" });
const source = await inspectImageMetadata(file);
assert.equal(source.format, "png"); assert.equal(source.mimeType, "image/png"); assert.equal(source.cleanable, true);
assert.ok(source.report.entries.some((entry) => entry.namespace === "png-text" || entry.category === "descriptive"));
assert.deepEqual(createCleanOutputPlan(source), { filename: "holiday_clean.png", format: "png", mimeType: "image/png", extension: ".png" });
const cleaned = await cleanAndVerifyImageMetadata(source);
assert.equal(cleaned.blob.type, "image/png"); assert.equal(cleaned.verification.valid, true);
assert.ok(cleaned.verification.checks.length > 0 && cleaned.verification.checks.every((check) => check.passed));
assert.deepEqual(source.bytes, originalSnapshot, "Inspection and cleaning must not mutate the retained original bytes");
const cleanedReport = await inspectImageMetadata(new File([cleaned.bytes], cleaned.plan.filename, { type: cleaned.plan.mimeType }));
assert.equal(cleanedReport.report.entries.some((entry) => entry.namespace === "png-text"), false);
const resultModel = buildCleaningModel(cleaned); assert.equal(resultModel.valid, true); assert.equal(resultModel.filename, "holiday_clean.png");
assert.ok(cleaned.cleaned.preserved.some((change) => change.namespace === "icc"), "ICC is preserved by the authoritative policy");
const secondClean = await cleanAndVerifyImageMetadata(source); assert.deepEqual(secondClean.bytes, cleaned.bytes, "Cleaning is deterministic");
const customPolicy = createCleaningPolicy({ removeExif: false, removeXmp: false, removeIptc: false, removeComments: false, removeTextMetadata: false, removeTimestamps: true, preserveIcc: false });
assert.deepEqual(createVerificationExpectation(customPolicy, "png"), { requireNoPrivacyRelevantMetadata: false, exif: "ignore", xmp: "ignore", textMetadata: "ignore", timestamps: "absent", icc: "absent" });
assert.deepEqual(createVerificationExpectation(customPolicy, "jpeg"), { requireNoPrivacyRelevantMetadata: false, exif: "ignore", xmp: "ignore", iptc: "ignore", comments: "ignore", icc: "absent" });
assert.deepEqual(createVerificationExpectation(customPolicy, "webp"), { requireNoPrivacyRelevantMetadata: false, exif: "ignore", xmp: "ignore", icc: "absent" });
const customCleaned = await cleanAndVerifyImageMetadata(source, customPolicy);
assert.equal(customCleaned.verification.valid, true); assert.deepEqual(customCleaned.verification.checks.map(({ namespace }) => namespace).sort(), ["icc", "png-time"]);
const customReport = (await inspectImageMetadata(new File([customCleaned.bytes], "custom.png", { type: "image/png" }))).report;
assert.equal(customReport.entries.some((entry) => entry.namespace === "png-text"), true, "Unselected PNG text is preserved");
assert.equal(customReport.entries.some((entry) => entry.namespace === "png-time"), false, "Selected timestamp class is removed");
assert.equal(customReport.entries.some((entry) => entry.namespace === "icc"), false, "Requested ICC removal is verified");

for (const [bytes, name, format, mimeType] of [
  [metadataJpeg(), "camera.jpeg", "jpeg", "image/jpeg"],
  [metadataWebp(), "camera.webp", "webp", "image/webp"],
]) {
  const inspected = await inspectImageMetadata(new File([bytes], name, { type: "" }));
  assert.equal(inspected.format, format); assert.equal(inspected.mimeType, mimeType); assert.equal(inspected.cleanable, true);
  if (format === "jpeg") assert.equal(inspected.report.inspectionStatus, "metadata-partial");
  if (format === "webp") {
    assert.equal(inspected.report.inspectionStatus, "container-inspected");
    const exif = inspected.report.entries.find((entry) => entry.namespace === "exif");
    assert.ok(exif); assert.equal(exif.value, undefined, "WebP EXIF is detected without claiming decoded values");
  }
  const output = await cleanAndVerifyImageMetadata(inspected);
  assert.equal(output.plan.filename, `camera_clean.${format === "jpeg" ? "jpg" : "webp"}`);
  assert.equal(output.blob.type, mimeType); assert.equal(output.verification.valid, true);
  assert.ok(output.cleaned.preserved.some((change) => change.namespace === "icc"));
}

class OversizeBlob extends Blob { get size() { return 50 * 1024 * 1024 + 1; } get name() { return "large.png"; } }
await assert.rejects(inspectImageMetadata(new OversizeBlob([Uint8Array.of(0x89)])), (error) => error.code === "IMAGE_FILE_TOO_LARGE");
await assert.rejects(cleanAndVerifyImageMetadata({ ...source, format: "jpeg" }), (error) => error.code === "IMAGE_METADATA_VERIFICATION_FAILED", "Format mismatch fails closed after verification");

await assert.rejects(inspectImageMetadata(new File(["not an image"], "fake.png", { type: "image/png" })), (error) => error.code === "IMAGE_SIGNATURE_INVALID");
await assert.rejects(cleanAndVerifyImageMetadata({ bytes: sourceBytes, cleanable: false }), (error) => error.code === "IMAGE_METADATA_NOT_CLEANABLE");

const html = read("tools/image/metadata/index.html"); const app = read("tools/image/metadata/app.js"); const adapter = read("tools/image/metadata/metadata.js"); const model = read("tools/image/metadata/model.js"); const category = read("tools/image/index.html");
assert.match(html, /type="file"[^>]*aria-describedby="drop-description"/); assert.doesNotMatch(html, /type="file"[^>]*multiple/);
assert.match(html, /id="source-card" class="source-card"[^>]*data-i18n-aria-label="imageMetadata\.source\.selectedLabel"[^>]*hidden/);
assert.match(html, /id="source-thumbnail" class="queue-thumbnail" alt=""/);
assert.match(html, /id="source-name" class="source-name"/);
assert.match(html, /id="clear-source" class="queue-action queue-action--remove"[^>]*data-i18n-aria-label="imageMetadata\.source\.remove"/);
assert.match(app, /URL\.createObjectURL\(state\.source\.file\)/);
assert.match(app, /URL\.revokeObjectURL\(state\.previewUrl\)/);
assert.match(app, /pagehide[^;]+releasePreview/);
assert.match(app, /releasePreview\(\); resetPolicy\(\); state\.source = null; state\.inspection = null; state\.result = null/);
assert.match(html, /id="inspection-details" class="inspection-details"><summary[^>]*data-i18n="imageMetadata\.inspector\.details"/);
assert.match(html, /id="metadata-groups" class="metadata-groups metadata-groups--primary"[\s\S]*id="additional-notice"[\s\S]*id="metadata-detail-groups"/);
assert.match(html, /id="customize-cleaning" class="clean-customization"[^>]*hidden[\s\S]*<fieldset id="custom-policy-options">/);
assert.equal((html.match(/data-policy-key=/g) || []).length, 7);
assert.match(app, /FORMAT_POLICY_KEYS[\s\S]*jpeg:[^\n]*removeIptc[^\n]*removeComments[\s\S]*png:[^\n]*removeTextMetadata[^\n]*removeTimestamps[\s\S]*webp:/);
assert.match(html, /connect-src 'none'/); assert.match(html, /role="status" aria-live="polite"/);
assert.match(category, /href="\.\/metadata\/"/); assert.equal((category.match(/class="category-tool surface"/g) || []).length, 4);
const requestIndex = app.indexOf("await requestSaveHandle"); const cleanIndex = app.indexOf("await cleanAndVerifyImageMetadata"); const writeIndex = app.indexOf("await writeBlobToHandle");
assert.ok(requestIndex > -1 && requestIndex < cleanIndex, "Save capability is acquired from the click path before asynchronous cleaning");
assert.ok(cleanIndex < writeIndex, "No bytes are written before cleaning and fail-closed verification succeed");
assert.match(app, /verification|Verified|verified/); assert.doesNotMatch(app + adapter + model, /innerHTML|insertAdjacentHTML|document\.write/);
assert.doesNotMatch(app + adapter + model, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//);
assert.doesNotMatch(adapter + model, /createImageBitmap|new Image|createElement\(["']canvas|drawImage|getContext/);
assert.match(adapter, /requestedPolicy = DEFAULT_CLEANING_POLICY/);
assert.match(adapter, /cleanMetadata\(source\.bytes, policy\)/);
assert.match(adapter, /verifyMetadata\(cleaned\.output, expectation\)/);
assert.match(adapter, /verification\.checks\.length > 0/);
const applicationFiles = ["tools/image/metadata/app.js", "tools/image/metadata/model.js", "tools/image/metadata/metadata.js"];
assert.deepEqual(applicationFiles.filter((relative) => read(relative).includes("secure-metadata-0.1.1.browser.js")), ["tools/image/metadata/metadata.js"]);
console.log("Image Metadata inspection, honest coverage, cleaning, verification, output, UI, privacy, and regression contracts passed.");

import { MAX_FILE_SIZE, validateImageSignature } from "../../shared/image.js";
import { createImageOutputNames, IMAGE_FORMATS } from "../../shared/image-output.js";
import { cleanMetadata, DEFAULT_CLEANING_POLICY, inspectMetadata, verifyMetadata } from "../../../assets/vendor/secure-metadata/secure-metadata-0.1.0.browser.js";

export const PRIVACY_CLEAN_POLICY = DEFAULT_CLEANING_POLICY;
export const CLEANING_POLICY_KEYS = Object.freeze(["removeExif", "removeXmp", "removeIptc", "removeComments", "removeTextMetadata", "removeTimestamps", "preserveIcc"]);

function metadataError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined); error.code = code; return error;
}

function mapLibraryError(error, fallback) {
  const code = String(error?.code || error?.name || "").toUpperCase();
  if (code.includes("INPUT_LIMIT") || code.includes("LIMIT_EXCEEDED")) return metadataError("IMAGE_METADATA_INPUT_LIMIT", error);
  if (code.includes("INCOMPLETE_JPEG")) return metadataError("IMAGE_METADATA_INCOMPLETE_JPEG", error);
  if (code.includes("INCOMPLETE_PNG")) return metadataError("IMAGE_METADATA_INCOMPLETE_PNG", error);
  if (code.includes("INCOMPLETE_WEBP")) return metadataError("IMAGE_METADATA_INCOMPLETE_WEBP", error);
  if (code.includes("UNSUPPORTED")) return metadataError("IMAGE_METADATA_UNSUPPORTED", error);
  return metadataError(fallback, error);
}

function assertSupportedReport(report, detectedFormat) {
  if (!report || !IMAGE_FORMATS[report.format] || report.format !== detectedFormat) throw metadataError("IMAGE_METADATA_UNSUPPORTED");
}

export function createCleaningPolicy(values = {}) {
  return Object.freeze(Object.fromEntries(CLEANING_POLICY_KEYS.map((key) => [key, Boolean(values[key] ?? DEFAULT_CLEANING_POLICY[key])])));
}

export function createVerificationExpectation(policy, format) {
  const expectation = { requireNoPrivacyRelevantMetadata: false };
  const absentWhenRemoved = (value) => value ? "absent" : "ignore";
  if (format === "jpeg") Object.assign(expectation, {
    exif: absentWhenRemoved(policy.removeExif), xmp: absentWhenRemoved(policy.removeXmp), iptc: absentWhenRemoved(policy.removeIptc),
    comments: absentWhenRemoved(policy.removeComments), icc: policy.preserveIcc ? "ignore" : "absent",
  });
  if (format === "png") Object.assign(expectation, {
    exif: absentWhenRemoved(policy.removeExif), xmp: absentWhenRemoved(policy.removeXmp), textMetadata: absentWhenRemoved(policy.removeTextMetadata),
    timestamps: absentWhenRemoved(policy.removeTimestamps), icc: policy.preserveIcc ? "ignore" : "absent",
  });
  if (format === "webp") Object.assign(expectation, {
    exif: absentWhenRemoved(policy.removeExif), xmp: absentWhenRemoved(policy.removeXmp), icc: policy.preserveIcc ? "ignore" : "absent",
  });
  return Object.freeze(expectation);
}

export async function inspectImageMetadata(file) {
  if (!(file instanceof Blob) || file.size < 1) throw metadataError("IMAGE_METADATA_NO_FILE");
  if (file.size > MAX_FILE_SIZE) throw metadataError("IMAGE_FILE_TOO_LARGE");
  let detectedFormat;
  try { detectedFormat = await validateImageSignature(file); }
  catch (error) { throw metadataError(error?.code || "IMAGE_SIGNATURE_INVALID", error); }
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const report = inspectMetadata(bytes); assertSupportedReport(report, detectedFormat);
    return Object.freeze({ file, bytes, format: detectedFormat, mimeType: IMAGE_FORMATS[detectedFormat].mimeType, report,
      cleanable: report.inspectionStatus !== "container-partial" && report.metadataTruncated !== true });
  } catch (error) {
    if (error?.code?.startsWith?.("IMAGE_")) throw error;
    throw mapLibraryError(error, "IMAGE_METADATA_INSPECTION_FAILED");
  }
}

export function createCleanOutputPlan(source) {
  if (!source?.file || !IMAGE_FORMATS[source.format]) throw metadataError("IMAGE_METADATA_NO_FILE");
  return { filename: createImageOutputNames([source.file], source.format, { suffix: "_clean" }).entries[0], format: source.format,
    mimeType: IMAGE_FORMATS[source.format].mimeType, extension: `.${IMAGE_FORMATS[source.format].extension}` };
}

export async function cleanAndVerifyImageMetadata(source, requestedPolicy = DEFAULT_CLEANING_POLICY) {
  if (!source?.bytes || !source.cleanable) throw metadataError("IMAGE_METADATA_NOT_CLEANABLE");
  const plan = createCleanOutputPlan(source);
  const policy = requestedPolicy === DEFAULT_CLEANING_POLICY ? DEFAULT_CLEANING_POLICY : createCleaningPolicy(requestedPolicy);
  const expectation = createVerificationExpectation(policy, source.format);
  let cleaned;
  try { cleaned = cleanMetadata(source.bytes, policy); }
  catch (error) { throw mapLibraryError(error, "IMAGE_METADATA_CLEANING_FAILED"); }
  let verification;
  try { verification = verifyMetadata(cleaned.output, expectation); }
  catch (error) { throw mapLibraryError(error, "IMAGE_METADATA_VERIFICATION_FAILED"); }
  const checksPassed = Array.isArray(verification?.checks) && verification.checks.length > 0 && verification.checks.every((check) => check?.passed === true);
  const reportComplete = verification?.report?.inspectionStatus !== "container-partial" && verification?.report?.metadataTruncated !== true;
  if (verification?.valid !== true || !checksPassed || !reportComplete || cleaned?.format !== source.format) throw metadataError("IMAGE_METADATA_VERIFICATION_FAILED");
  return { plan, policy, expectation, blob: new Blob([cleaned.output], { type: plan.mimeType }), bytes: cleaned.output, cleaned, verification };
}

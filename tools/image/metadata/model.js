export const MAX_METADATA_VALUE_LENGTH = 2000;
export const MAX_DIAGNOSTIC_LENGTH = 500;

const GROUPS = Object.freeze(["location", "device", "author", "time", "descriptive", "rights", "technical", "other"]);

function boundedText(value, limit) {
  const text = String(value ?? "").replaceAll("\0", "�");
  return { text: text.length > limit ? `${text.slice(0, limit)}…` : text, truncated: text.length > limit };
}

function rational(value) {
  return value && typeof value === "object" && Number.isFinite(value.numerator) && Number.isFinite(value.denominator);
}

export function formatMetadataValue(value, labels = {}) {
  if (value === undefined || value === null) return { text: labels.opaque || "Detected, payload not decoded", opaque: true, truncated: false };
  if (value instanceof Uint8Array) return { text: (labels.bytes || "Binary payload ({count} bytes)").replace("{count}", String(value.byteLength)), opaque: true, truncated: false };
  if (rational(value)) return { text: `${value.numerator}/${value.denominator}`, opaque: false, truncated: false };
  if (Array.isArray(value)) {
    const formatted = value.map((item) => rational(item) ? `${item.numerator}/${item.denominator}` : String(item)).join(", ");
    return { ...boundedText(formatted, MAX_METADATA_VALUE_LENGTH), opaque: false };
  }
  if (typeof value === "boolean") return { text: value ? (labels.true || "True") : (labels.false || "False"), opaque: false, truncated: false };
  if (typeof value === "number") return { text: Number.isFinite(value) ? String(value) : (labels.opaque || "Detected, payload not decoded"), opaque: !Number.isFinite(value), truncated: false };
  return { ...boundedText(value, MAX_METADATA_VALUE_LENGTH), opaque: false };
}

function groupFor(entry) {
  const namespace = String(entry.namespace || "").toLowerCase();
  const category = String(entry.category || "other").toLowerCase();
  if (namespace === "xmp" || namespace === "iptc") return namespace === "iptc" ? "descriptive" : (GROUPS.includes(category) ? category : "descriptive");
  return GROUPS.includes(category) ? category : "other";
}

export function buildInspectionModel(source, labels = {}) {
  const entries = Array.isArray(source?.report?.entries) ? source.report.entries : [];
  const groups = new Map(GROUPS.map((key) => [key, []]));
  entries.forEach((entry) => groups.get(groupFor(entry)).push({
    id: String(entry.id || `${entry.namespace || "metadata"}:${entry.name || entry.source || "entry"}`),
    namespace: String(entry.namespace || "other"),
    name: String(entry.name || entry.source || entry.id || labels.unknown || "Unknown metadata"),
    category: String(entry.category || "other"),
    source: String(entry.source || ""),
    value: formatMetadataValue(entry.value, labels),
  }));
  const status = source?.report?.inspectionStatus || "container-partial";
  return {
    format: source?.format || source?.report?.format || "",
    size: source?.file?.size || source?.report?.size || 0,
    status,
    coverageKey: `imageMetadata.coverage.${status}`,
    successful: status === "container-inspected" || status === "metadata-partial" || status === "metadata-inspected",
    cleanable: source?.cleanable === true,
    count: entries.length,
    groups: [...groups].filter(([, items]) => items.length).map(([key, items]) => ({ key, items })),
    diagnostics: (source?.report?.diagnostics || []).map((item) => boundedText(item?.message || item?.code || item, MAX_DIAGNOSTIC_LENGTH).text),
  };
}

export function buildCleaningModel(result) {
  const removed = Array.isArray(result?.cleaned?.removed) ? result.cleaned.removed : [];
  const preserved = Array.isArray(result?.cleaned?.preserved) ? result.cleaned.preserved : [];
  const checks = Array.isArray(result?.verification?.checks) ? result.verification.checks : [];
  return {
    filename: result?.plan?.filename || "",
    removed,
    preserved,
    checks,
    valid: result?.verification?.valid === true && checks.length > 0 && checks.every((check) => check?.passed === true),
    diagnostics: [...(result?.cleaned?.diagnostics || []), ...(result?.verification?.diagnostics || [])]
      .map((item) => boundedText(item?.message || item?.code || item, MAX_DIAGNOSTIC_LENGTH).text),
  };
}

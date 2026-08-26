export const MAX_METADATA_VALUE_LENGTH = 2000;
export const MAX_DIAGNOSTIC_LENGTH = 500;

const GROUPS = Object.freeze(["location", "device", "time", "technical", "software", "author", "rights", "descriptive", "xmp", "iptc", "color", "rendering", "other"]);
const CATEGORY_GROUP = Object.freeze({
  location: "location", device: "device", timestamp: "time", technical: "technical", software: "software",
  identity: "author", rights: "rights", description: "descriptive", color: "color", rendering: "rendering",
});

function boundedText(value, limit) {
  const text = String(value ?? "").replaceAll("\0", "�");
  return { text: text.length > limit ? `${text.slice(0, limit)}…` : text, truncated: text.length > limit };
}

function diagnosticText(item) {
  if (!item || typeof item !== "object") return boundedText(item, MAX_DIAGNOSTIC_LENGTH).text;
  const parts = [];
  if (item.severity) parts.push(String(item.severity).toUpperCase());
  if (item.code) parts.push(String(item.code));
  if (Number.isSafeInteger(item.offset)) parts.push(`byte ${item.offset}`);
  if (item.message) parts.push(String(item.message));
  return boundedText(parts.join(" · ") || "Diagnostic", MAX_DIAGNOSTIC_LENGTH).text;
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
  if (namespace === "xmp" || namespace === "iptc") return namespace;
  return CATEGORY_GROUP[category] || "other";
}

function groupedEntries(entries, labels) {
  const groups = new Map(GROUPS.map((key) => [key, []]));
  entries.forEach((entry) => groups.get(groupFor(entry)).push({
    id: String(entry.id || `${entry.namespace || "metadata"}:${entry.name || entry.source || "entry"}`),
    namespace: String(entry.namespace || "other"),
    name: String(entry.name || entry.source || entry.id || labels.unknown || "Unknown metadata"),
    category: String(entry.category || "other"),
    source: String(entry.source || ""),
    value: formatMetadataValue(entry.value, labels),
  }));
  return [...groups].filter(([, items]) => items.length).map(([key, items]) => ({ key, items }));
}

export function buildInspectionModel(source, labels = {}) {
  const entries = Array.isArray(source?.report?.entries) ? source.report.entries : [];
  const groups = groupedEntries(entries, labels);
  const decodedGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.value.opaque) }))
    .filter((group) => group.items.length);
  const decodedCount = decodedGroups.reduce((count, group) => count + group.items.length, 0);
  const status = source?.report?.inspectionStatus || "container-partial";
  return {
    format: source?.format || source?.report?.format || "",
    size: source?.file?.size || source?.report?.size || 0,
    status,
    coverageKey: `imageMetadata.coverage.${status}`,
    successful: status === "container-inspected" || status === "metadata-partial" || status === "metadata-inspected",
    cleanable: source?.cleanable === true,
    count: entries.length,
    decodedCount,
    decodedGroupCount: decodedGroups.length,
    additionalCount: entries.length - decodedCount,
    groups,
    decodedGroups,
    diagnostics: (source?.report?.diagnostics || []).map(diagnosticText),
  };
}

export function buildCleaningModel(result) {
  const removed = Array.isArray(result?.cleaned?.removed) ? result.cleaned.removed : [];
  const preserved = Array.isArray(result?.cleaned?.preserved) ? result.cleaned.preserved : [];
  const checks = Array.isArray(result?.verification?.checks) ? result.verification.checks : [];
  return {
    filename: result?.plan?.filename || "", removed, preserved, checks,
    valid: result?.verification?.valid === true && checks.length > 0 && checks.every((check) => check?.passed === true),
    diagnostics: [...(result?.cleaned?.diagnostics || []), ...(result?.verification?.diagnostics || [])].map(diagnosticText),
  };
}

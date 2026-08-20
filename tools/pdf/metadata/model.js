export const MAX_METADATA_DISPLAY_LENGTH = 2000;

export const SUPPORTED_METADATA_FIELDS = Object.freeze([
  { key: "title", labelKey: "tools.pdfMetadata.fields.title", getter: "getTitle", pdfName: "Title", type: "string" },
  { key: "author", labelKey: "tools.pdfMetadata.fields.author", getter: "getAuthor", pdfName: "Author", type: "string" },
  { key: "subject", labelKey: "tools.pdfMetadata.fields.subject", getter: "getSubject", pdfName: "Subject", type: "string" },
  { key: "keywords", labelKey: "tools.pdfMetadata.fields.keywords", getter: "getKeywords", pdfName: "Keywords", type: "string" },
  { key: "creator", labelKey: "tools.pdfMetadata.fields.creator", getter: "getCreator", pdfName: "Creator", type: "string" },
  { key: "producer", labelKey: "tools.pdfMetadata.fields.producer", getter: "getProducer", pdfName: "Producer", type: "string" },
  { key: "creationDate", labelKey: "tools.pdfMetadata.fields.creationDate", getter: "getCreationDate", pdfName: "CreationDate", type: "date" },
  { key: "modificationDate", labelKey: "tools.pdfMetadata.fields.modificationDate", getter: "getModificationDate", pdfName: "ModDate", type: "date" },
]);

const SUPPORTED_KEYS = new Set(SUPPORTED_METADATA_FIELDS.map(({ key }) => key));

function readRawValue(document, definition) {
  const getter = document?.[definition.getter];
  if (typeof getter !== "function") return undefined;
  try {
    return getter.call(document);
  } catch {
    return undefined;
  }
}

function isPresent(value, type) {
  if (type === "date") return value instanceof Date && !Number.isNaN(value.getTime());
  return typeof value === "string" && value.length > 0;
}

export function metadataDisplayValue(value, limit = MAX_METADATA_DISPLAY_LENGTH) {
  const normalized = String(value ?? "").replaceAll("\0", "�");
  return {
    value: normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized,
    truncated: normalized.length > limit,
  };
}

export function extractMetadata(document) {
  return SUPPORTED_METADATA_FIELDS.map((definition) => {
    const rawValue = readRawValue(document, definition);
    const present = isPresent(rawValue, definition.type);
    return {
      ...definition,
      rawValue: present ? rawValue : null,
      present,
      removable: present,
      selected: false,
      display: metadataDisplayValue(
        present && definition.type === "date" ? rawValue.toISOString() : present ? rawValue : "",
      ),
    };
  });
}

export function selectedMetadataKeys(fields) {
  return fields.filter(({ present, selected }) => present && selected).map(({ key }) => key);
}

export function setMetadataSelected(fields, key, selected) {
  if (!SUPPORTED_KEYS.has(key)) return fields;
  return fields.map((field) => field.key === key && field.present
    ? { ...field, selected: Boolean(selected) }
    : field);
}

export function selectAllPresentMetadata(fields) {
  return fields.map((field) => ({ ...field, selected: field.present }));
}

export function clearMetadataSelection(fields) {
  return fields.map((field) => ({ ...field, selected: false }));
}

export function isSupportedMetadataKey(key) {
  return SUPPORTED_KEYS.has(key);
}

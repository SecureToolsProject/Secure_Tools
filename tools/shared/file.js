const ILLEGAL_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;

export function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

export function sanitizePdfFilename(value, fallback = "document") {
  const clean = String(value || "")
    .trim()
    .replace(ILLEGAL_FILENAME_CHARACTERS, "_")
    .replace(/[. ]+$/g, "");
  const base = clean || fallback;
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

export function moveArrayItem(items, index, offset) {
  const nextIndex = index + offset;
  if (index < 0 || index >= items.length || nextIndex < 0 || nextIndex >= items.length) return -1;
  [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
  return nextIndex;
}

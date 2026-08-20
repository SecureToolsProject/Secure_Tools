export function normalizeRotation(value) {
  return ((Number(value) % 360) + 360) % 360;
}

export function createPageState(pageCount, rotations = []) {
  return Array.from({ length: pageCount }, (_, originalIndex) => {
    const originalRotation = normalizeRotation(rotations[originalIndex] || 0);
    return { originalIndex, originalRotation, rotation: originalRotation, removed: false };
  });
}

export function visiblePages(pages) {
  return pages.filter((page) => !page.removed);
}

export function movePage(pages, originalIndex, offset) {
  const activeIndexes = pages.flatMap((page, index) => page.removed ? [] : [index]);
  const activeIndex = activeIndexes.findIndex((index) => pages[index].originalIndex === originalIndex);
  const targetActiveIndex = activeIndex + offset;
  if (activeIndex < 0 || targetActiveIndex < 0 || targetActiveIndex >= activeIndexes.length) return -1;
  const from = activeIndexes[activeIndex];
  const to = activeIndexes[targetActiveIndex];
  [pages[from], pages[to]] = [pages[to], pages[from]];
  return targetActiveIndex;
}

export function rotatePage(pages, originalIndex, delta) {
  const page = pages.find((item) => item.originalIndex === originalIndex);
  if (!page || page.removed) return false;
  page.rotation = normalizeRotation(page.rotation + delta);
  return true;
}

export function removePage(pages, originalIndex) {
  const page = pages.find((item) => item.originalIndex === originalIndex);
  if (!page || page.removed) return false;
  page.removed = true;
  return true;
}

export function resetPages(pages) {
  return createPageState(pages.length, [...pages]
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map((page) => page.originalRotation));
}

export function isDirty(pages) {
  return pages.some((page, index) => page.removed
    || page.originalIndex !== index
    || page.rotation !== page.originalRotation);
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { translations } from "../js/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function categoryList(html) {
  const list = html.match(/<ul class="category-tool-list">([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(list, "Category tool list is missing");
  return list;
}

function linkedRoutes(list) {
  return [...list.matchAll(/<a class="category-tool surface" href="([^"]+)">/g)].map((match) => match[1]);
}

function assertRoutesExist(categoryPage, routes) {
  const directory = path.dirname(path.join(root, categoryPage));
  for (const route of routes) {
    const target = path.resolve(directory, route, "index.html");
    assert.equal(fs.existsSync(target), true, `${categoryPage} links to missing route ${route}`);
  }
}

const imageHtml = read("tools/image/index.html");
const imageList = categoryList(imageHtml);
const imageRoutes = ["./converter/", "./resize/", "./compress/", "./metadata/"];
assert.equal((imageList.match(/<li>/g) || []).length, 4);
assert.deepEqual(linkedRoutes(imageList), imageRoutes);
assert.equal((imageList.match(/status--available/g) || []).length, 4);
assert.doesNotMatch(imageHtml, /<\/ul>\s*<li>/, "Image metadata card must remain inside the semantic list");
assertRoutesExist("tools/image/index.html", imageRoutes);

const privacyHtml = read("tools/privacy/index.html");
const privacyList = categoryList(privacyHtml);
const privacyRoutes = ["../image/metadata/", "../pdf/metadata/"];
assert.equal((privacyList.match(/<li>/g) || []).length, 2);
assert.deepEqual(linkedRoutes(privacyList), privacyRoutes);
assert.equal((privacyList.match(/status--available/g) || []).length, 2);
assert.doesNotMatch(privacyList, /tools\.comingSoon|<article\b|tools\.metadata(?:Inspector|Cleaner)/);
assert.match(privacyHtml, /data-i18n="privacyHub\.imageDescription"/);
assert.match(privacyHtml, /data-i18n="privacyHub\.pdfDescription"/);
assertRoutesExist("tools/privacy/index.html", privacyRoutes);

const pdfList = categoryList(read("tools/pdf/index.html"));
assert.equal(linkedRoutes(pdfList).length, 6, "Every PDF production card must remain linked");
assert.equal((pdfList.match(/status--available/g) || []).length, 6);

for (const category of ["scan", "media"]) {
  const plannedList = categoryList(read(`tools/${category}/index.html`));
  assert.equal(linkedRoutes(plannedList).length, 0, `${category} must remain planned`);
  assert.equal((plannedList.match(/<article class="category-tool surface">/g) || []).length, 2);
  assert.equal((plannedList.match(/tools\.comingSoon/g) || []).length, 2);
}

assert.equal(translations.en.tools.categoryDescriptions.privacy, "Inspect and clean supported image or PDF metadata.");
for (const [language, catalog] of Object.entries(translations)) {
  assert.equal(typeof catalog.privacyHub.imageDescription, "string", `${language} image scope is missing`);
  assert.equal(typeof catalog.privacyHub.pdfDescription, "string", `${language} PDF scope is missing`);
}

console.log("Category availability, semantic list, production route, and planned-state checks passed.");

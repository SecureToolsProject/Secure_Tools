import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { translations } from "../js/i18n.js";
import { canonicalPages } from "../scripts/site-routes.mjs";

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

function assertPublicRoutesExist(categoryRoute, routes) {
  const publicRoutes = new Set(canonicalPages.map(({ route }) => route));
  for (const route of routes) {
    const target = new URL(route, `https://tools.securetools.app${categoryRoute}`).pathname;
    assert.ok(publicRoutes.has(target), `${categoryRoute} links to missing public route ${target}`);
  }
}

function linkedCard(list, titleKey) {
  return [...list.matchAll(/<a class="category-tool surface" href="([^"]+)">([\s\S]*?)<\/a>/g)]
    .find((match) => match[2].includes(`data-i18n="${titleKey}"`));
}

const imageHtml = read("tools/image/index.html");
const imageList = categoryList(imageHtml);
const imageRoutes = ["./converter/", "./resize/", "./compress/", "./metadata/", "./to-text/"];
assert.equal((imageList.match(/<li>/g) || []).length, 5);
assert.deepEqual(linkedRoutes(imageList), imageRoutes);
assert.equal((imageList.match(/status--available/g) || []).length, 5);
assert.doesNotMatch(imageHtml, /<\/ul>\s*<li>/, "Image metadata card must remain inside the semantic list");
assertRoutesExist("tools/image/index.html", imageRoutes);

const imageOcrCard = linkedCard(imageList, "tools.imageToText");
assert.ok(imageOcrCard, "Image category must link Image to Text");
assert.match(imageOcrCard[2], /status--available/);
assert.doesNotMatch(imageOcrCard[2], /tools\.comingSoon|<article\b/);

const scanHtml = read("tools/scan/index.html");
const scanList = categoryList(scanHtml);
const scanOcrCard = linkedCard(scanList, "tools.imageToText");
assert.ok(scanOcrCard, "Scan and OCR category must link Image to Text");
assert.equal(scanOcrCard[1], "../image/to-text/");
assert.match(scanOcrCard[2], /status--available/);
assert.match(scanOcrCard[2], /data-i18n="categories\.image\.toText"/);
assert.doesNotMatch(scanOcrCard[2], /tools\.comingSoon|<article\b|categories\.scan\.ocr/);
assert.equal(
  path.resolve(root, "tools/image", imageOcrCard[1]),
  path.resolve(root, "tools/scan", scanOcrCard[1]),
  "Image and Scan/OCR entries must resolve to the same route",
);
assertRoutesExist("tools/scan/index.html", [scanOcrCard[1]]);
assert.equal((scanList.match(/<article class="category-tool surface">/g) || []).length, 1);
assert.equal((scanList.match(/tools\.comingSoon/g) || []).length, 1);
assert.match(scanList, /data-i18n="categories\.scan\.documentTitle"/);

const privacyHtml = read("privacy/index.html");
const privacyList = categoryList(privacyHtml);
const privacyRoutes = ["../image/metadata/", "../pdf/metadata/"];
assert.equal((privacyList.match(/<li>/g) || []).length, 2);
assert.deepEqual(linkedRoutes(privacyList), privacyRoutes);
assert.equal((privacyList.match(/status--available/g) || []).length, 2);
assert.doesNotMatch(privacyList, /tools\.comingSoon|<article\b|tools\.metadata(?:Inspector|Cleaner)/);
assert.match(privacyHtml, /data-i18n="privacyHub\.imageDescription"/);
assert.match(privacyHtml, /data-i18n="privacyHub\.pdfDescription"/);
assertPublicRoutesExist("/privacy/", privacyRoutes);

const pdfList = categoryList(read("tools/pdf/index.html"));
assert.equal(linkedRoutes(pdfList).length, 6, "Every PDF production card must remain linked");
assert.equal((pdfList.match(/status--available/g) || []).length, 6);

for (const category of ["pdf", "image", "scan"]) {
  const html = read(`tools/${category}/index.html`);
  assert.match(html, /data-i18n="categories\.localNote">Available tools process file contents locally in browser memory\./);
  assert.doesNotMatch(html, /Planned items are clearly marked/);
}

for (const category of ["media"]) {
  const plannedList = categoryList(read(`tools/${category}/index.html`));
  assert.equal(linkedRoutes(plannedList).length, 0, `${category} must remain planned`);
  assert.equal((plannedList.match(/<article class="category-tool surface">/g) || []).length, 2);
  assert.equal((plannedList.match(/tools\.comingSoon/g) || []).length, 2);
}

assert.equal(translations.en.tools.categoryDescriptions.privacy, "Inspect and clean supported image or PDF metadata.");
for (const [language, catalog] of Object.entries(translations)) {
  assert.doesNotMatch(catalog.categories.localNote, /planned|geplant|prévu|planificad|準備中|준비 중/i, `${language} production category note mentions planned work`);
  assert.equal(typeof catalog.privacyHub.imageDescription, "string", `${language} image scope is missing`);
  assert.equal(typeof catalog.privacyHub.pdfDescription, "string", `${language} PDF scope is missing`);
  assert.equal(typeof catalog.tools.imageToText, "string", `${language} Image to Text title is missing`);
  assert.equal(typeof catalog.categories.image.toText, "string", `${language} Image to Text description is missing`);
  assert.notEqual(catalog.tools.imageToText, "tools.imageToText", `${language} Image to Text title exposes a raw key`);
  assert.notEqual(catalog.categories.image.toText, "categories.image.toText", `${language} Image to Text description exposes a raw key`);
}

console.log("Category availability, semantic list, production route, and planned-state checks passed.");

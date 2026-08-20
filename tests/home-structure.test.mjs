import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const home = read("index.html");

function testCategoryFirstHomepage() {
  assert.doesNotMatch(home, /available-tools|available-tools-title|tools\.available(?:Eyebrow|Title|Description)/);
  assert.equal((home.match(/class="category-card surface"/g) || []).length, 5, "Homepage must retain five category entry points");
  const categoryHrefs = [...home.matchAll(/<a class="category-card surface" href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(categoryHrefs, [
    "./tools/pdf/",
    "./tools/image/",
    "./tools/privacy/",
    "./tools/scan/",
    "./tools/media/",
  ]);

  const flow = [
    'class="hero container"',
    'id="tools"',
    'data-i18n="why.title"',
    'id="verify"',
    'data-i18n="openSource.title"',
  ].map((marker) => home.indexOf(marker));
  assert.ok(flow.every((index) => index >= 0), "Homepage flow is missing a required section");
  assert.deepEqual([...flow].sort((a, b) => a - b), flow, "Homepage sections are out of order");
  assert.equal((home.match(/<h1\b/g) || []).length, 1, "Homepage must expose one primary heading");
  for (const key of ["tools.title", "why.title", "verify.title", "openSource.title"]) {
    assert.match(home, new RegExp(`<h2[^>]*data-i18n="${key}"`), `${key} must remain a level-two section heading`);
  }
}

function testReadySectionCodeIsDeadFree() {
  const retiredKeys = /availableEyebrow|availableTitle|availableDescription/;
  for (const language of ["en", "ko", "ja", "es", "de", "fr"]) {
    assert.doesNotMatch(read(`js/locales/${language}.js`), retiredKeys, `${language} retains a removed Ready-section key`);
  }
  for (const relative of ["css/pages.css", "css/components.css"]) {
    const css = read(relative);
    assert.doesNotMatch(css, /\.available-tools|\.tool-list|\.tool-row/, `${relative} retains Ready-section styles`);
  }
}

testCategoryFirstHomepage();
testReadySectionCodeIsDeadFree();

console.log("Homepage category-first structure and retired Ready-section cleanup checks passed.");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  detectLanguage,
  getStoredLanguage,
  resolveLanguage,
  selectInitialLanguage,
  translations,
} from "../js/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const languageNames = new Map([
  ["en", "English"],
  ["ko", "한국어"],
  ["ja", "日本語"],
  ["es", "Español"],
  ["de", "Deutsch"],
  ["fr", "Français"],
]);

function listFiles(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target, predicate);
    return predicate(target) ? [target] : [];
  });
}

function flatten(value, prefix = "", output = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const qualified = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, qualified, output);
    else output.set(qualified, child);
  }
  return output;
}

function placeholders(value) {
  return [...String(value).matchAll(/\{[A-Za-z][A-Za-z0-9]*\}/g)].map(([match]) => match).sort();
}

function testCatalogParityAndQuality() {
  assert.deepEqual([...Object.keys(translations)], [...languageNames.keys()]);
  const english = flatten(translations.en);
  assert.equal(english.size, 730);

  for (const [language, catalog] of Object.entries(translations)) {
    const flattened = flatten(catalog);
    assert.deepEqual([...flattened.keys()].sort(), [...english.keys()].sort(), `${language} key set differs from English`);
    for (const [key, value] of flattened) {
      assert.equal(typeof value, "string", `${language}.${key} is not a string`);
      assert.notEqual(value.trim(), "", `${language}.${key} is empty`);
      assert.deepEqual(placeholders(value), placeholders(english.get(key)), `${language}.${key} placeholder mismatch`);
      assert.doesNotMatch(value, /\b(?:TODO|TRANSLATE|TBD)\b|\[English\]/, `${language}.${key} contains a draft marker`);
    }
  }
}

function testResolutionDetectionAndPersistence() {
  for (const [input, expected] of [
    ["ja-JP", "ja"], ["es-MX", "es"], ["de-DE", "de"], ["fr-CA", "fr"], ["ko-KR", "ko"], ["pt-BR", "en"],
  ]) {
    assert.equal(resolveLanguage(input), expected);
    assert.equal(detectLanguage({ language: input, languages: [input] }), expected);
  }

  assert.equal(detectLanguage({ language: "pt-BR", languages: ["pt-BR", "fr-CA"] }), "fr");
  const storage = { getItem: (key) => key === "secure-tools-language" ? "de" : null };
  assert.equal(getStoredLanguage(storage), "de");
  assert.equal(selectInitialLanguage({ storage, navigatorObject: { language: "ja-JP", languages: ["ja-JP"] } }), "de");
  assert.equal(getStoredLanguage({ getItem: () => "pt" }), null);
  assert.equal(getStoredLanguage({ getItem: () => { throw new Error("blocked"); } }), null);
}

function testSelectorsAndDocumentTranslation() {
  const pages = listFiles(root, (file) => file.endsWith(".html") && fs.readFileSync(file, "utf8").includes("data-language-select"));
  assert.equal(pages.length, 19, "Every production page with the shared header must expose the language selector");
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const select = html.match(/<select[^>]*data-language-select[^>]*>([\s\S]*?)<\/select>/)?.[1];
    assert.ok(select, `${path.relative(root, file)} is missing its language select body`);
    const options = [...select.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map((match) => [match[1], match[2].trim()]);
    assert.deepEqual(options, [...languageNames], `${path.relative(root, file)} language options differ`);
    assert.doesNotMatch(select, /(?:🇺🇸|🇰🇷|🇯🇵|🇪🇸|🇩🇪|🇫🇷)/, "Language choices must not depend on flags");
    for (const key of ["home", "footerNavigation"]) {
      assert.match(html, new RegExp(`data-i18n-aria-label="common\\.aria\\.${key}"`), `${path.relative(root, file)} is missing localized ${key}`);
    }
    if (html.includes('class="site-nav"')) {
      assert.match(html, /data-i18n-aria-label="common\.aria\.primaryNavigation"/, `${path.relative(root, file)} is missing localized primaryNavigation`);
    }
  }

  for (const [language, catalog] of Object.entries(translations)) {
    for (const key of ["home", "primaryNavigation", "footerNavigation", "toolCategories", "localProcessingSummary"]) {
      assert.ok(catalog.common.aria[key].trim(), `${language}.common.aria.${key} is empty`);
    }
  }

  const source = fs.readFileSync(path.join(root, "js/i18n.js"), "utf8");
  assert.match(source, /document\.documentElement\.lang = currentLanguage/);
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY, currentLanguage\)/);
  assert.match(source, /securetools:languagechange/);
}

function testDynamicToolsAndMetadata() {
  const dynamicApps = [
    "tools/image/converter/app.js",
    "tools/image/resize/app.js",
    "tools/image/compress/app.js",
    "tools/pdf/images-to-pdf/app.js",
    "tools/pdf/merge/app.js",
    "tools/pdf/split/app.js",
    "tools/pdf/organize/app.js",
    "tools/pdf/to-images/app.js",
    "tools/pdf/metadata/app.js",
    "tools/image/metadata/app.js",
  ];
  for (const relative of dynamicApps) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    assert.match(source, /securetools:languagechange/, `${relative} does not re-render on language changes`);
  }

  const metadataKeys = Object.keys(translations.en.metadata);
  for (const [language, catalog] of Object.entries(translations)) {
    assert.deepEqual(Object.keys(catalog.metadata), metadataKeys, `${language} metadata key set differs`);
    for (const page of metadataKeys) {
      assert.ok(catalog.metadata[page].title.trim(), `${language} metadata.${page}.title is empty`);
      assert.ok(catalog.metadata[page].description.trim(), `${language} metadata.${page}.description is empty`);
    }
  }
  assert.match(fs.readFileSync(path.join(root, "tools/pdf/metadata/app.js"), "utf8"), /Intl\.DateTimeFormat/);
}

function testMultilingualLayoutFoundation() {
  const css = ["base.css", "components.css", "pages.css", "categories.css"]
    .map((file) => fs.readFileSync(path.join(root, "css", file), "utf8"))
    .join("\n");
  assert.doesNotMatch(css, /word-break:\s*break-all/);
  assert.match(css, /--font-sans:\s*system-ui/);
  assert.doesNotMatch(css, /\bInter\b|@font-face|fonts\.(?:googleapis|gstatic)\.com/);
  assert.match(css, /html:lang\(ko\)\s*\{[^}]*Malgun Gothic/);
  assert.match(css, /html:lang\(ja\)\s*\{[^}]*Hiragino Sans[^}]*Yu Gothic UI/);
  assert.match(css, /html:lang\(ko\) :is\([^}]+word-break:\s*keep-all/);
  assert.doesNotMatch(css, /html:lang\(ko\) body\s*\{[^}]*word-break:\s*keep-all/);
  assert.match(css, /html:lang\(ja\)\s*\{[^}]*line-break:\s*strict/);
  assert.match(css, /--line-height-heading:/);
  assert.match(css, /--font-weight-bold:/);
  assert.match(css, /body, button, input, select, textarea\s*\{\s*font:\s*inherit/);
  assert.match(css, /min-width:\s*0/);
  assert.match(css, /@media \(max-width:\s*68rem\)/);
  assert.match(css, /control\[data-language-select\][^{]*\{[^}]*width:\s*9rem/);
}

testCatalogParityAndQuality();
testResolutionDetectionAndPersistence();
testSelectorsAndDocumentTranslation();
testDynamicToolsAndMetadata();
testMultilingualLayoutFoundation();

console.log("i18n catalog, detection, selector, metadata, dynamic-state, and layout checks passed.");

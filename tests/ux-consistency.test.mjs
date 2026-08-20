import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const fileTools = [
  ["Images to PDF", "tools/pdf/images-to-pdf/index.html", "tools/pdf/images-to-pdf/app.js", "image/"],
  ["Merge PDF", "tools/pdf/merge/index.html", "tools/pdf/merge/app.js", "pdf"],
  ["Split PDF", "tools/pdf/split/index.html", "tools/pdf/split/app.js", "pdf"],
  ["Organize PDF", "tools/pdf/organize/index.html", "tools/pdf/organize/app.js", "pdf"],
  ["PDF to Images", "tools/pdf/to-images/index.html", "tools/pdf/to-images/app.js", "pdf"],
  ["PDF Metadata", "tools/pdf/metadata/index.html", "tools/pdf/metadata/app.js", "pdf"],
];

const productionPages = [
  "index.html", "404.html", "about/index.html", "privacy/index.html",
  "tools/pdf/index.html", "tools/pdf/images-to-pdf/index.html", "tools/pdf/merge/index.html",
  "tools/pdf/split/index.html", "tools/pdf/organize/index.html", "tools/pdf/to-images/index.html",
  "tools/pdf/metadata/index.html", "tools/image/index.html", "tools/privacy/index.html",
  "tools/scan/index.html", "tools/media/index.html",
];

function testFileInputContract() {
  for (const [name, htmlPath, appPath, acceptedType] of fileTools) {
    const html = read(htmlPath);
    const app = read(appPath);
    const input = html.match(/<input\b[^>]*\bid="file-input"[^>]*>/)?.[0] || "";
    const drop = html.match(/<section\b[^>]*\bid="drop-zone"[\s\S]*?<\/section>/)?.[0] || "";

    assert.match(input, /\btype="file"/, `${name}: missing native file input`);
    assert.match(input, new RegExp(`accept="[^"]*${acceptedType}`), `${name}: accepted file type is not declared`);
    assert.match(input, /aria-describedby="drop-description"/, `${name}: file input description is not associated`);
    assert.match(drop, /<label class="drop-zone__picker" for="file-input">/, `${name}: full-area native label is missing`);
    assert.match(drop, /data-i18n="[^"]+\.drop\.description"/, `${name}: accepted-type instructions are not localized`);
    assert.equal((drop.match(/class="local-note"/g) || []).length, 1, `${name}: expected one input-adjacent privacy note`);
    assert.match(drop, /localTitle[\s\S]*localBody[\s\S]*privacyLink/, `${name}: privacy note is incomplete`);
    assert.match(app, /dragenter[\s\S]*dragover/, `${name}: drag-enter/over behavior is missing`);
    assert.match(app, /dataset\.dragging/, `${name}: visible drag-active state is missing`);
    assert.match(app, /addEventListener\("drop"/, `${name}: drop handling is missing`);
    assert.match(app, /elements\.input\.disabled\s*=/, `${name}: busy/loading input state is not explicit`);
    assert.match(html, /<button[^>]*class="button button--primary"/, `${name}: primary action does not use the shared pattern`);
    assert.match(html, /class="tool-status[^"]*" role="status" aria-live="polite"/, `${name}: shared live status is missing`);
    assert.doesNotMatch(html, /\.\.\/images-to-pdf\/tool\.css|\.\.\/split\/tool\.css/, `${name}: tool imports a sibling's stylesheet`);
    assert.match(html, /\.\.\/\.\.\/shared\/tool\.css/, `${name}: shared tool stylesheet is missing`);
  }
}

function testQueueSourceAndOutputPatterns() {
  const shared = read("tools/shared/tool.css");
  assert.match(shared, /\.queue-empty\[hidden\][^{]*\{\s*display:\s*none/);
  assert.match(shared, /\.source-empty\[hidden\][^{]*\{\s*display:\s*none/);
  assert.match(shared, /\.source-card\[hidden\][^{]*\{\s*display:\s*none/);
  assert.match(shared, /\.source-empty--compact/);
  assert.match(shared, /\.tool-status:empty\s*\{\s*display:\s*none/);
  assert.match(shared, /\.tool-status\[data-tone="error"\][^{]*\{[^}]*border-color:/);
  assert.match(shared, /\.tool-output\s*\{[^}]*grid-template-columns:/);
  assert.match(shared, /@media \(max-width:\s*54rem\)[\s\S]*\.tool-output\s*\{[^}]*grid-template-columns:\s*1fr/);

  for (const relative of ["tools/pdf/images-to-pdf/index.html", "tools/pdf/merge/index.html"]) {
    const html = read(relative);
    assert.match(html, /class="file-list"/);
    assert.match(html, /class="queue-empty"/);
  }
  for (const relative of ["tools/pdf/split/index.html", "tools/pdf/to-images/index.html"]) {
    const html = read(relative);
    assert.match(html, /class="source-card" hidden/);
    assert.match(html, /class="source-empty"/);
  }
  assert.match(read("tools/pdf/organize/index.html"), /class="organizer-output tool-output surface"/);
  assert.match(read("tools/pdf/metadata/index.html"), /class="metadata-output tool-output surface"/);
}

function testSharedChromeAndAccessibility() {
  for (const relative of productionPages) {
    const html = read(relative);
    assert.match(html, /class="skip-link" href="#main"/, `${relative}: skip link missing`);
    assert.match(html, /<main\b[^>]*\bid="main"/, `${relative}: main landmark target missing`);
    for (const brand of html.matchAll(/<a class="brand"[^>]*>/g)) {
      assert.match(brand[0], /aria-label="Secure Tools home"/, `${relative}: brand home link lacks a consistent name`);
    }
    const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)?.[1] || "";
    assert.match(footer, /<nav aria-label="Footer navigation">/, `${relative}: footer navigation missing`);
    const keys = [...footer.matchAll(/data-i18n="(common\.nav\.[^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(keys, ["common.nav.tools", "common.nav.privacy", "common.nav.about", "common.nav.source"], `${relative}: footer links differ`);
  }
}

function testResponsiveThemeAndMotionFoundation() {
  const base = read("css/base.css");
  const components = read("css/components.css");
  const categories = read("css/categories.css");
  const toolCss = ["tools/shared/tool.css", "tools/pdf/merge/tool.css", "tools/pdf/split/tool.css",
    "tools/pdf/organize/tool.css", "tools/pdf/to-images/tool.css", "tools/pdf/metadata/tool.css"]
    .map(read).join("\n");
  const css = `${base}\n${components}\n${categories}\n${toolCss}`;

  assert.doesNotMatch(css, /word-break:\s*break-all/);
  assert.doesNotMatch(css, /\bwidth:\s*100vw\b/);
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /min-width:\s*0/);
  assert.match(base, /prefers-reduced-motion:\s*reduce/);
  assert.match(components, /\.button:disabled\s*\{[^}]*background:[^}]*cursor:\s*not-allowed/);
  assert.match(read("tools/pdf/organize/tool.css"), /background:\s*var\(--preview-backdrop\)/);
  assert.match(base, /data-resolved-theme="dark"[\s\S]*--preview-backdrop:/);
  assert.match(categories, /\.category-tool > \.status\s*\{\s*margin-bottom:\s*auto/);
}

testFileInputContract();
testQueueSourceAndOutputPatterns();
testSharedChromeAndAccessibility();
testResponsiveThemeAndMotionFoundation();

console.log("UX input, queue, source, action, state, chrome, responsive, theme, and accessibility checks passed.");

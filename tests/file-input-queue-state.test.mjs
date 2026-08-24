import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const tools = [
  {
    name: "Image Converter",
    html: read("tools/image/converter/index.html"),
    app: read("tools/image/converter/app.js"),
    chooseKey: "imageToPdf.drop.choose",
    renderCall: "renderQueue()",
    stateRule: /elements\.empty\.hidden\s*=\s*state\.items\.length\s*>\s*0/,
    programmaticPickerCount: 1,
  },
  {
    name: "Images to PDF",
    html: read("tools/pdf/images-to-pdf/index.html"),
    app: read("tools/pdf/images-to-pdf/app.js"),
    chooseKey: "imageToPdf.drop.choose",
    renderCall: "renderQueue()",
    stateRule: /elements\.empty\.hidden\s*=\s*state\.items\.length\s*>\s*0/,
    programmaticPickerCount: 1,
  },
  {
    name: "PDF Merge",
    html: read("tools/pdf/merge/index.html"),
    app: read("tools/pdf/merge/app.js"),
    chooseKey: "mergePdf.drop.choose",
    renderCall: "renderQueue()",
    stateRule: /elements\.empty\.hidden\s*=\s*state\.items\.length\s*>\s*0/,
    programmaticPickerCount: 1,
  },
  {
    name: "PDF Split",
    html: read("tools/pdf/split/index.html"),
    app: read("tools/pdf/split/app.js"),
    chooseKey: "splitPdf.drop.choose",
    renderCall: "renderSource()",
    stateRule: /elements\.sourceEmpty\.hidden\s*=\s*hasSource/,
    programmaticPickerCount: 0,
  },
];

function testNativeDropZoneContract(tool) {
  const input = tool.html.match(/<input\b[^>]*\bid="file-input"[^>]*>/)?.[0] || "";
  assert.match(input, /\btype="file"/, `${tool.name}: real file input is missing`);
  assert.match(input, /\baria-describedby="drop-description"/, `${tool.name}: picker description is not associated`);

  const labels = [...tool.html.matchAll(/<label\b[^>]*\bfor="file-input"[^>]*>[\s\S]*?<\/label>/g)];
  assert.equal(labels.length, 1, `${tool.name}: expected one native label activation target`);
  assert.match(labels[0][0], /class="drop-zone__picker"/, `${tool.name}: label does not cover the drop zone`);
  assert.match(labels[0][0], new RegExp(`data-i18n="${tool.chooseKey.replaceAll(".", "\\.")}"`), `${tool.name}: label lacks its translated name`);

  assert.match(
    tool.html,
    new RegExp(`<span class="button button--primary" aria-hidden="true" data-i18n="${tool.chooseKey.replaceAll(".", "\\.")}"`),
    `${tool.name}: visible picker affordance must be presentational`,
  );
  assert.doesNotMatch(tool.html, /<label class="button button--primary"[^>]*for="file-input"/, `${tool.name}: nested picker control can double-activate`);
  assert.equal((tool.app.match(/elements\.input\.click\(\)/g) || []).length, tool.programmaticPickerCount, `${tool.name}: unexpected picker activation path`);
  assert.doesNotMatch(tool.app, /dropZone\.addEventListener\("click"/, `${tool.name}: drop zone must rely on native label activation`);
  assert.match(tool.app, /dropZone\.addEventListener\("drop"/, `${tool.name}: drag-and-drop handling was removed`);
}

function testStateContract(tool) {
  assert.match(tool.app, tool.stateRule, `${tool.name}: empty-state visibility is not derived from current state`);
  const languageHandler = tool.app.match(/document\.addEventListener\("securetools:languagechange",[\s\S]*?\);/)?.[0] || "";
  assert.match(languageHandler, new RegExp(tool.renderCall.replace(/[()]/g, "\\$&")), `${tool.name}: language changes do not restore state-derived visibility`);
}

for (const tool of tools) {
  testNativeDropZoneContract(tool);
  testStateContract(tool);
}

const sharedCss = read("tools/shared/tool.css");
assert.match(sharedCss, /\.drop-zone__picker\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s, "Picker label does not cover the complete drop zone");
assert.match(sharedCss, /\.drop-zone:has\(#file-input:focus-visible\)\s*\{[^}]*outline:/s, "Keyboard focus is not visible on the drop zone");
assert.match(sharedCss, /\.local-note a\s*\{[^}]*z-index:\s*2;/s, "Privacy link is not isolated from picker activation");
assert.match(sharedCss, /\.queue-empty\[hidden\]\s*\{\s*display:\s*none;/, "Queue hidden state can be overridden by authored display styles");

assert.match(sharedCss, /\.source-empty\[hidden\][^{]*\{\s*display:\s*none;/, "Source hidden state can be overridden by authored display styles");

console.log("File input and queue state regression checks passed.");

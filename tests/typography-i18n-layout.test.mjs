import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function listFiles(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(target, extension) : target.endsWith(extension) ? [target] : [];
  });
}

const cssFiles = [...listFiles(path.join(root, "css"), ".css"), ...listFiles(path.join(root, "tools"), ".css")];
const css = cssFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const base = read("css/base.css");
const components = read("css/components.css");
const categories = read("css/categories.css");
const tools = read("tools/shared/tool.css");
const metadata = read("tools/pdf/metadata/tool.css");

function testSystemFirstTypography() {
  assert.match(base, /--font-sans:\s*system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif/);
  for (const token of [
    "--font-size-xs", "--font-size-base", "--font-size-xl", "--line-height-heading",
    "--line-height-body", "--line-height-control", "--font-weight-normal", "--font-weight-bold",
  ]) assert.match(base, new RegExp(`${token}:`), `Missing typography token ${token}`);
  assert.match(base, /html:lang\(ko\)\s*\{[^}]*Apple SD Gothic Neo[^}]*Malgun Gothic[^}]*Noto Sans KR/);
  assert.match(base, /html:lang\(ja\)\s*\{[^}]*Hiragino Sans[^}]*Yu Gothic UI[^}]*Meiryo[^}]*Noto Sans JP/);
  assert.doesNotMatch(css, /\bInter\b|@font-face|@import\s+url\([^)]*https?:|fonts\.(?:googleapis|gstatic)\.com/);
  assert.doesNotMatch(css, /transform:\s*scale\(/, "Typography must not be normalized with scaling hacks");
  assert.doesNotMatch(css, /font-weight:\s*(?:650|750|780)\b/, "Shared UI must use supported system-font weights");
}

function testLocaleWrappingPolicy() {
  assert.match(base, /html:lang\(ko\) :is\([^}]+word-break:\s*keep-all/);
  assert.doesNotMatch(base, /html:lang\(ko\) body\s*\{[^}]*word-break:\s*keep-all/);
  assert.equal((css.match(/word-break:\s*keep-all/g) || []).length, 1, "Korean keep-all must remain intentionally scoped");
  assert.match(base, /html:lang\(ja\)\s*\{[^}]*line-break:\s*strict/);
  assert.doesNotMatch(css, /word-break:\s*break-all|white-space:\s*nowrap[^;}]*!important/);

  const nowrapRules = [...css.matchAll(/([^{}]+)\{[^{}]*white-space:\s*nowrap/g)].map((match) => match[1].trim());
  for (const selector of nowrapRules) {
    assert.match(selector, /brand|visually-hidden|source-name|queue-name|metadata-table thead/, `Unexpected nowrap rule: ${selector}`);
  }
}

function testControlAndLongCopyLayout() {
  assert.match(base, /body, button, input, select, textarea\s*\{\s*font:\s*inherit/);
  assert.match(components, /\.button\s*\{[^}]*min-width:\s*0[^}]*min-height:\s*2\.75rem[^}]*line-height:\s*var\(--line-height-control\)[^}]*overflow-wrap:\s*anywhere/);
  assert.match(components, /\.site-nav\s*\{[^}]*min-width:\s*0[^}]*flex-wrap:\s*wrap/);
  assert.match(components, /\.header-inner > \*, \.header-controls > \*, \.control-label > span\s*\{\s*min-width:\s*0/);
  assert.match(components, /@media \(max-width:\s*38rem\)[\s\S]*\.site-nav\s*\{[^}]*justify-content:\s*flex-start/);
  assert.match(categories, /\.category-nav__inner\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(categories, /\.category-nav a\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(tools, /\.tool-layout > \*[^}]*min-width:\s*0/);
  assert.match(tools, /\.mode-option strong, \.mode-option span\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(metadata, /\.metadata-value\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*white-space:\s*pre-wrap/);
  assert.match(base, /body\s*\{[^}]*min-width:\s*20rem/);
}

function testNoRemoteFontResources() {
  for (const file of listFiles(root, ".html")) {
    const html = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"[^>]+href="https?:/i, `${path.relative(root, file)} loads a remote stylesheet`);
    assert.doesNotMatch(html, /<script[^>]+src="https?:/i, `${path.relative(root, file)} loads a remote script`);
  }
}

testSystemFirstTypography();
testLocaleWrappingPolicy();
testControlAndLongCopyLayout();
testNoRemoteFontResources();

console.log("System typography, CJK wrapping, long-copy layout, controls, and remote-font checks passed.");

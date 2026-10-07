import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { canonicalPages, legacyRedirects } from "../../scripts/site-routes.mjs";
import { pdfToTextLocales } from "../../js/locales/pdf-to-text.js";
import { createFixtures } from "./fixtures.mjs";
import { auditContext } from "./audit.mjs";
import { verifyPdf } from "./pdf-artifact.mjs";

function origin(value, name) {
  assert.ok(value, `${name} is required`);
  const url = new URL(value);
  assert.ok(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)), `${name} requires HTTPS (or local development HTTP)`);
  assert.equal(url.pathname, "/"); assert.ok(!url.username && !url.password && !url.search && !url.hash);
  return url.origin;
}
const canonical = origin(process.env.PRODUCTION_ORIGIN, "PRODUCTION_ORIGIN");
const immutable = origin(process.env.IMMUTABLE_ORIGIN, "IMMUTABLE_ORIGIN");
const directory = path.resolve(".ts-build/production-smoke");
await fs.mkdir(directory, { recursive: true });
const report = { checkedAt: new Date().toISOString(), runner: process.env.GITHUB_ACTIONS ? "GitHub-hosted Ubuntu" : "local validation", canonical, immutable, gates: [], surfaces: {}, artifacts: [], status: "NO-GO" };
let browser;
const diagnosticError = error => String(error.stack || error).replaceAll(process.cwd(), "<repository>").replaceAll(process.cwd().replaceAll("\\", "/"), "<repository>");
async function gate(name, action, page) {
  try { const value = await action(); report.gates.push({ name, passed: true, value }); console.log(`PASS ${name}`); return true; }
  catch (error) {
    report.gates.push({ name, passed: false, error: diagnosticError(error) }); console.error(`FAIL ${name}: ${error.message}`);
    if (page) {
      await page.screenshot({ path: path.join(directory, `${name.replace(/[^a-z0-9]/gi, "-")}.png`) }).catch(() => {});
      await fs.writeFile(path.join(directory, `${name.replace(/[^a-z0-9]/gi, "-")}.html.txt`), await page.content()).catch(() => {});
    }
    return false;
  }
}
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
async function get(url) { const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(60000) }); assert.equal(r.status, 200, url); return r; }
async function httpSmoke() {
  for (const { route } of canonicalPages) {
    const text = await (await get(canonical + route)).text();
    assert.ok(text.includes(`href="${canonical}${route}"`), `canonical ${route}`);
    assert.ok(text.includes(`content="${canonical}${route}"`), `OG ${route}`);
  }
  for (const { from, to } of legacyRedirects) {
    const query = "?release=2.2&text=hello%20world";
    const r = await fetch(canonical + from + query, { redirect: "manual" });
    assert.equal(r.status, 308); assert.equal(r.headers.get("location"), to + query); await get(canonical + to + query);
  }
  const sitemap = await (await get(canonical + "/sitemap.xml")).text();
  assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]).sort(), canonicalPages.map(p => canonical + p.route).sort());
  assert.ok((await (await get(canonical + "/robots.txt")).text()).includes(canonical + "/sitemap.xml"));
  return { routes: canonicalPages.length, redirects: legacyRedirects.length, sitemap: canonicalPages.length, robots: true };
}
async function assetComparison() {
  const routes = ["/js/main.js", "/js/i18n.js", "/pdf/to-text/app.js", "/image/to-text/app.js", "/shared/pdf-ocr.js", "/css/base.css", "/js/locales/pdf-to-text.js", "/assets/vendor/pdfjs/pdf.min.mjs", "/assets/vendor/pdfjs/pdf.worker.min.mjs", "/assets/vendor/tesseract/engine/tesseract.min.js", "/assets/vendor/tesseract/worker/worker.min.js", "/assets/vendor/tesseract/core/tesseract-core.wasm", "/assets/vendor/tesseract/lang/eng.traineddata.gz", "/assets/vendor/tesseract/lang/kor.traineddata.gz", "/assets/vendor/searchable-pdf/NotoSansKR-400.js"];
  const assets = [];
  for (const route of routes) {
    const pair = await Promise.all([canonical, immutable].map(async o => Buffer.from(await (await get(o + route)).arrayBuffer())));
    assert.deepEqual(pair[0], pair[1], route); assets.push({ route, bytes: pair[0].length, sha256: hash(pair[0]) });
  }
  return assets;
}
async function locales(page, o) {
  await page.goto(o + "/pdf/to-text/");
  const results = [];
  for (const code of ["en", "ko", "ja", "es", "de", "fr"]) {
    await page.locator("[data-language-select]").selectOption(code);
    const expected = pdfToTextLocales[code].copy;
    await page.waitForFunction(title => document.querySelector("h1")?.textContent === title, expected.title);
    for (const [key, text] of [["settings.pages", expected.settings.pages], ["settings.selected", expected.settings.selected], ["result.download", expected.result.download], ["result.downloadSearchable", expected.result.downloadSearchable]]) {
      assert.equal(await page.locator(`[data-i18n="pdfToText.${key}"]`).textContent(), text);
    }
    assert.doesNotMatch(await page.locator("body").innerText(), /pdfToText\.|\{(?:page|pages|total|percent|name|size)\}/);
    results.push({ code, rawKeys: false, title: expected.title });
  }
  await page.locator("[data-language-select]").selectOption("en");
  return results;
}
async function ready(page, fixture) {
  await page.locator("#file-input").setInputFiles(fixture);
  await page.waitForFunction(name => document.querySelector("#source-name")?.textContent === name && !document.querySelector("#recognize")?.disabled, fixture.name);
}
async function recognize(page, language = "eng+kor") {
  await page.locator("#ocr-language").selectOption(language);
  await page.locator("#recognize").click();
  await page.waitForFunction(() => document.querySelector("#tool-status")?.dataset.tone === "success", undefined, { timeout: 180000 });
}
async function download(page, selector, filename, downloads) {
  const start = downloads.length;
  const pending = page.waitForEvent("download", { timeout: 180000 });
  await page.locator(selector).click(); const item = await pending;
  assert.equal(item.suggestedFilename(), filename); assert.equal(await item.failure(), null);
  const destination = path.join(directory, `${report.artifacts.length}-${filename}`); await item.saveAs(destination);
  await page.waitForTimeout(250);
  assert.equal(downloads.length - start, 1, "Exactly one native download per action");
  const bytes = await fs.readFile(destination); assert.ok(bytes.length);
  report.artifacts.push({ filename, bytes: bytes.length, sha256: hash(bytes), count: 1 }); return bytes;
}
function text(bytes) { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
async function noDownload(page, downloads, action) {
  const start = downloads.length; await action(); await page.waitForTimeout(2000);
  assert.equal(downloads.length, start, "No obsolete download");
}
async function drop(page, fixture) {
  await page.evaluate(({ name, mimeType, bytes }) => {
    const file = new File([Uint8Array.from(bytes)], name, { type: mimeType });
    const transfer = new DataTransfer(); transfer.items.add(file);
    document.querySelector("#drop-zone").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, { ...fixture, buffer: undefined, bytes: Array.from(fixture.buffer) });
  await page.waitForFunction(name => document.querySelector("#source-name")?.textContent === name && !document.querySelector("#recognize")?.disabled, fixture.name);
}
async function imageFlow(page, fixtures, downloads) {
  await page.goto(canonical + "/image/to-text/"); await ready(page, fixtures.mixed); await recognize(page);
  assert.equal((await page.locator("#result-text").inputValue()).trim(), "한글 HELLO");
  const bytes = await download(page, "#download-result", "production-mixed.txt", downloads);
  assert.equal(text(bytes), "한글 HELLO\n");
  await ready(page, fixtures.imageLong);
  await noDownload(page, downloads, async () => {
    await page.locator("#recognize").click();
    await page.waitForFunction(() => /Recognizing/i.test(document.querySelector("#tool-status")?.textContent || ""));
    await page.locator("#cancel").click();
    await page.waitForFunction(() => document.querySelector("#tool-status")?.dataset.tone === "warning");
    assert.equal(await page.locator("#result-panel").isVisible(), false);
  });
  // Public Image UI disables replacement while busy: cancel A, then select B.
  await ready(page, fixtures.english); await recognize(page, "eng");
  await ready(page, fixtures.mixed); assert.equal(await page.locator("#result-panel").isVisible(), false); await recognize(page);
  assert.equal(text(await download(page, "#download-result", "production-mixed.txt", downloads)), "한글 HELLO\n");
  return { filename: "production-mixed.txt", bytes: bytes.length, text: text(bytes), count: 1, cancellation: "zero downloads", replacement: "B only; A result cleared" };
}
async function pdfFlow(page, fixtures, downloads) {
  await page.goto(canonical + "/pdf/to-text/"); await ready(page, fixtures.two); await recognize(page);
  const texts = await page.locator("#result-pages textarea").evaluateAll(fields => fields.map(f => f.value.trim()));
  assert.deepEqual(texts, ["HELLO SEARCHABLE PDF", "한글 HELLO"]);
  const expected = "--- Page 1 ---\nHELLO SEARCHABLE PDF\n\n--- Page 2 ---\n한글 HELLO\n";
  const bytes = await download(page, "#download-result", "production-two.txt", downloads); assert.equal(text(bytes), expected);
  const pdf = await download(page, "#download-searchable", "production-two-searchable.pdf", downloads);
  const parsed = await verifyPdf(page, pdf, fixtures.two.buffer, texts);
  report.searchable = { filename: "production-two-searchable.pdf", count: 1, ...parsed };
  await page.locator("#pages-selected").check(); await page.locator("#page-range").fill("2"); await recognize(page);
  assert.equal(text(await download(page, "#download-result", "production-two.txt", downloads)), "--- Page 2 ---\n한글 HELLO\n");
  await ready(page, fixtures.long); await page.locator("#pages-all").check();
  await noDownload(page, downloads, async () => {
    await page.locator("#recognize").click();
    await page.waitForFunction(() => /Recognizing page/i.test(document.querySelector("#tool-status")?.textContent || ""));
    await page.locator("#cancel").click();
    await page.waitForFunction(() => document.querySelector("#tool-status")?.dataset.tone === "warning");
    // Completed partial pages may remain editable under current PDF semantics.
    assert.equal(await page.locator("#download-searchable").isEnabled(), false);
  });
  await noDownload(page, downloads, async () => {
    await page.locator("#recognize").click();
    await page.waitForFunction(() => /Recognizing page/i.test(document.querySelector("#tool-status")?.textContent || ""));
    await drop(page, fixtures.replacement); assert.equal(await page.locator("#result-panel").isVisible(), false);
  });
  await page.locator("#pages-all").check(); await recognize(page, "eng");
  assert.equal(text(await download(page, "#download-result", "production-replacement.txt", downloads)), "--- Page 1 ---\nHELLO SEARCHABLE PDF\n");
  const b = await download(page, "#download-searchable", "production-replacement-searchable.pdf", downloads);
  await verifyPdf(page, b, fixtures.replacement.buffer, ["HELLO SEARCHABLE PDF"]);
  return { filename: "production-two.txt", bytes: bytes.length, pageBoundaries: "exact", selectedPage: "Page 2 only", cancellation: "zero downloads", replacement: "zero A; one B per TXT/PDF action" };
}
async function writerFlow(page, fixtures, downloads) {
  await ready(page, fixtures.long); await page.locator("#pages-all").check(); await recognize(page);
  await noDownload(page, downloads, async () => {
    await page.locator("#download-searchable").click(); await page.locator("#cancel").waitFor({ state: "visible" }); await page.locator("#cancel").click();
    await page.waitForFunction(() => document.querySelector("#tool-status")?.dataset.tone === "warning");
    assert.equal(await page.locator("#download-searchable").isEnabled(), true, "Retry remains available");
  });
  const retry = await download(page, "#download-searchable", "production-long-searchable.pdf", downloads);
  await verifyPdf(page, retry, fixtures.long.buffer, Array(26).fill("한글 HELLO"));
  await noDownload(page, downloads, async () => {
    await page.locator("#download-searchable").click(); await page.locator("#cancel").waitFor({ state: "visible" }); await drop(page, fixtures.replacement);
    assert.equal(await page.locator("#result-panel").isVisible(), false);
  });
  await recognize(page, "eng");
  const replacement = await download(page, "#download-searchable", "production-replacement-searchable.pdf", downloads);
  await verifyPdf(page, replacement, fixtures.replacement.buffer, ["HELLO SEARCHABLE PDF"]);
  await ready(page, fixtures.existing); await recognize(page, "eng");
  const existing = await download(page, "#download-searchable", "production-existing-searchable.pdf", downloads);
  const inspected = await verifyPdf(page, existing, fixtures.existing.buffer, ["EXISTING SELECTABLE TEXT"]);
  return { cancellation: "zero downloads; retry passed", staleReplacement: "zero A; one B", existingText: "exactly once per page", ...inspected };
}
try {
  await gate("HTTP routes and SEO", httpSmoke);
  await gate("Release asset equivalence", assetComparison);
  browser = await chromium.launch({ headless: true, args: ["--disable-extensions"] }); report.browser = browser.version();
  const fixtures = await createFixtures(browser);
  for (const [label, o] of [["canonical", canonical], ["immutable", immutable]]) {
    const result = report.surfaces[label] = {};
    const session = await auditContext(browser, o, directory, result); const { page } = session;
    const downloads = []; page.on("download", value => downloads.push(value));
    await gate(`${label} locales`, () => locales(page, o), page);
    if (label === "canonical") {
      await gate("Image TXT and lifecycle", () => imageFlow(page, fixtures, downloads), page);
      const pdfPassed = await gate("PDF TXT and searchable artifact", () => pdfFlow(page, fixtures, downloads), page);
      if (pdfPassed) await gate("Searchable cancellation and preservation", () => writerFlow(page, fixtures, downloads), page);
      else report.gates.push({ name: "Searchable cancellation and preservation", passed: false, error: "Prerequisite PDF flow failed" });
    }
    await gate(`${label} privacy and CSP`, async () => {
      const external = result.requests.filter(r => !["first-party", "browser-local"].includes(r.classification));
      result.external = external;
      assert.deepEqual(external, [], "Site analytics/telemetry and external runtimes are prohibited, including Cloudflare Insights");
      assert.deepEqual(result.errors, [], "Unexpected console/page/HTTP errors"); assert.deepEqual(result.csp, [], "CSP violations");
      return { thirdPartyRequests: 0, siteAnalytics: 0, violations: 0 };
    }, page);
    await session.finish(report.gates.some(g => !g.passed));
  }
  report.status = report.gates.every(g => g.passed) ? "GO" : "NO-GO";
} catch (error) { report.gates.push({ name: "Infrastructure", passed: false, error: diagnosticError(error) }); }
finally {
  await browser?.close();
  await fs.writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
  const summary = `# Production smoke: ${report.status}\n\nCanonical: ${canonical}\n\nImmutable: ${immutable}\n\n${report.gates.map(g => `- ${g.passed ? "PASS" : "FAIL"} ${g.name}${g.passed ? `: ${JSON.stringify(g.value)}` : `: ${g.error?.split("\n")[0]}`}`).join("\n")}\n`;
  await fs.writeFile(path.join(directory, "summary.md"), summary); console.log(summary);
}
if (report.status !== "GO") process.exitCode = 1;

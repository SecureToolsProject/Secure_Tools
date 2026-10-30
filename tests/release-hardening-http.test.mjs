import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalPages, legacyRedirects, productionOrigin } from "../scripts/site-routes.mjs";
import { assertSecurityHeaders, OCR_WORKER_PATH } from "../scripts/http-security-headers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// CI runs npm test without requiring a production build. Build-site only stages
// already-compiled modules, so this produces the same deployment inventory.
await import("../scripts/build-site.mjs");
const port = 43000 + Math.floor(Math.random() * 10000);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["tests/serve-ocr-smoke.mjs", String(port)], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Hardening HTTP server startup timed out")), 10000);
    server.stdout.once("data", () => { clearTimeout(timeout); resolve(); });
    server.once("error", (error) => { clearTimeout(timeout); reject(error); });
    server.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Hardening server exited: ${code}`)); });
  });
  const checkedAssets = new Set();
  for (const { route } of canonicalPages) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    assert.equal(response.status, 200, `Direct route: ${route}`);
    assertSecurityHeaders(response.headers);
    const html = await response.text();
    assert.match(html, /<title>[^<]+<\/title>/, `Title: ${route}`);
    assert.match(html, /<meta name="description" content="[^"]+"/, `Description: ${route}`);
    assert.ok(html.includes(`href="${productionOrigin}${route}"`), `Canonical: ${route}`);
    assert.ok(html.includes(`content="${productionOrigin}${route}"`), `Open Graph: ${route}`);
    assert.doesNotMatch(html, /rel="canonical"[^>]+\/tools\//, `No legacy canonical: ${route}`);
    assert.match(html, /Content-Security-Policy/, `CSP: ${route}`);
    for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)="([^"]+)"/g)) {
      const url = new URL(match[1], `${origin}${route}`);
      if (url.origin !== origin) continue;
      // Canonical links name the production origin and are not static assets.
      if (checkedAssets.has(url.href)) continue;
      const asset = await fetch(url); assert.equal(asset.status, 200, `Asset ${url.href}`);
      assertSecurityHeaders(asset.headers);
      checkedAssets.add(url.href);
    }
  }
  for (const { from, to } of legacyRedirects) {
    const response = await fetch(`${origin}${from}?release=2.2&text=hello%20world`, { redirect: "manual" });
    assert.equal(response.status, 308, `Redirect status: ${from}`);
    assert.equal(response.headers.get("location"), `${to}?release=2.2&text=hello%20world`, `Redirect/query: ${from}`);
    assert.ok(!to.startsWith("/tools/"));
    assert.equal((await fetch(new URL(response.headers.get("location"), origin), { redirect: "manual" })).status, 200, `One hop: ${from}`);
  }
  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  for (const [route, type] of [["/build-info.json", "application/json"], ["/assets/vendor/tesseract/core/tesseract-core.wasm", "application/wasm"], [OCR_WORKER_PATH, "text/javascript"], ["/assets/vendor/pdfjs/pdf.worker.min.mjs", "text/javascript"], ["/assets/vendor/tesseract/lang/eng.traineddata.gz", "application/gzip"]]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type").startsWith(type), `${route} retains correct MIME`);
    assertSecurityHeaders(response.headers, { ocrWorker: route === OCR_WORKER_PATH });
    if (route === "/build-info.json") assert.ok((await response.json()).commit);
    else await response.body.cancel();
  }
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]).sort();
  assert.deepEqual(locations, canonicalPages.map(({ route }) => `${productionOrigin}${route}`).sort());
  const robots = await (await fetch(`${origin}/robots.txt`)).text();
  assert.ok(robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`));
  assert.equal((await fetch(`${origin}/pdf/searchable/`, { redirect: "manual" })).status, 404);
  assert.equal((await fetch(`${origin}/tools/pdf/searchable/`, { redirect: "manual" })).status, 404);
  const list = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? list(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  for (const file of list(path.join(root, "dist"))) {
    assert.doesNotMatch(file, /(?:\.d)?\.ts$|\.map$|[\\/]\.ts-build[\\/]|[\\/]tests[\\/]/);
    if (/\.(?:js|mjs|html|css|json)$/.test(file)) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /C:\\Users\\|C:\/Users\//);
  }
  assert.equal(canonicalPages.length, 19); assert.equal(legacyRedirects.length, 17);
  console.log(`Release hardening HTTP: all 19 routes, ${checkedAssets.size} linked static assets, 17 single-hop/query-preserving redirects, SEO/sitemap/robots, and production artifact hygiene passed.`);
} finally { server.kill(); }

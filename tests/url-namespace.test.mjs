import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalPages, legacyRedirects, productionOrigin, redirectStatus } from "../scripts/site-routes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routes = new Set(canonicalPages.map(({ route }) => route));

assert.equal(canonicalPages.length, 18);
assert.equal(legacyRedirects.length, 17);
assert.equal(redirectStatus, 308);
assert.ok(routes.has("/image/to-text/"));
assert.ok(routes.has("/image/resize/"));
assert.ok(routes.has("/pdf/merge/"));
assert.equal(new Set(canonicalPages.map(({ source }) => source)).size, canonicalPages.length);
assert.equal(routes.size, canonicalPages.length);

for (const { source, route } of canonicalPages) {
  const html = fs.readFileSync(path.join(root, source), "utf8");
  assert.match(html, new RegExp(`<link rel="canonical" href="${productionOrigin.replaceAll(".", "\\.")}${route}">`));
  assert.match(html, new RegExp(`<meta property="og:url" content="${productionOrigin.replaceAll(".", "\\.")}${route}">`));
  assert.doesNotMatch(html, /(?:href|src)="[^"]*\/tools\//, `${source} contains active legacy navigation`);
}

for (const { from, to } of legacyRedirects) {
  assert.match(from, /^\/tools\//);
  assert.ok(routes.has(to), `${from} targets unknown canonical route ${to}`);
}
assert.equal(new Set(legacyRedirects.map(({ from }) => from)).size, legacyRedirects.length);
assert.deepEqual(
  legacyRedirects.find(({ from }) => from === "/tools/image/to-text/"),
  { from: "/tools/image/to-text/", to: "/image/to-text/" },
);
assert.deepEqual(
  legacyRedirects.find(({ from }) => from === "/tools/privacy/"),
  { from: "/tools/privacy/", to: "/privacy/" },
);

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.deepEqual(sitemapUrls, canonicalPages.map(({ route }) => `${productionOrigin}${route}`));
assert.doesNotMatch(sitemap, /\/tools\//);

console.log("Canonical route manifest, internal navigation, redirects, and sitemap namespace checks passed.");

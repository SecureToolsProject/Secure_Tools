import assert from "node:assert/strict";

import { canonicalPages, legacyRedirects, productionOrigin, redirectStatus } from "../scripts/site-routes.mjs";

const assets = [
  "/css/base.css",
  "/css/components.css",
  "/css/pages.css",
  "/js/theme-bootstrap.js",
  "/js/main.js",
  "/assets/icons/favicon.ico",
  "/assets/vendor/pdf-lib/pdf-lib.min.js",
];

const base = new URL(process.argv[2] || "");
const indexing = process.argv[3] || "noindex";
const canonicalBase = new URL(productionOrigin);
const socialImage = new URL("/assets/images/og-image.png", canonicalBase).href;

assert.equal(base.protocol, "https:", "deployment validation requires HTTPS");
assert.equal(base.pathname, "/", "deployment base URL must not contain a path");
assert.ok(["noindex", "indexable"].includes(indexing), "indexing mode must be noindex or indexable");
if (indexing === "indexable") assert.equal(base.origin, canonicalBase.origin, "indexable validation must target tools.securetools.app");

function metadataValue(html, selectorName, selectorValue, valueName) {
  for (const tag of html.match(/<(?:link|meta)\b[^>]*>/gi) || []) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1].toLowerCase(), match[3]]),
    );
    if (attributes[selectorName] === selectorValue) return attributes[valueName] || "";
  }
  return "";
}

async function request(pathname, options = {}) {
  const url = new URL(pathname, base);
  const response = await fetch(url, { redirect: "manual" });
  if (options.status) assert.equal(response.status, options.status, `${url.href} status`);
  else {
    assert.equal(response.status, 200, `${url.href} must return HTTP 200 without a redirect`);
    assert.equal(
      response.headers.get("x-robots-tag"),
      indexing === "noindex" ? "noindex, nofollow" : null,
      indexing === "noindex" ? `${url.href} must remain non-indexable` : `${url.href} must not inherit the pages.dev noindex header`,
    );
  }
  return response;
}

for (const { route } of canonicalPages) {
  const response = await request(route);
  const html = await response.text();
  const expectedCanonical = new URL(route, canonicalBase).href;
  assert.equal(metadataValue(html, "rel", "canonical", "href"), expectedCanonical, `${route} canonical changed`);
  assert.equal(metadataValue(html, "property", "og:url", "content"), expectedCanonical, `${route} og:url changed`);
  assert.equal(metadataValue(html, "property", "og:image", "content"), socialImage, `${route} og:image changed`);
  assert.equal(metadataValue(html, "name", "twitter:image", "content"), socialImage, `${route} twitter:image changed`);
}

for (const { from, to } of legacyRedirects) {
  const response = await request(`${from}?namespace=legacy`, { status: redirectStatus });
  const location = new URL(response.headers.get("location"), base);
  assert.equal(location.pathname, to, `${from} redirect target`);
  assert.equal(location.search, "?namespace=legacy", `${from} preserves the query string`);
}

for (const asset of assets) {
  const response = await request(asset);
  await response.arrayBuffer();
}

console.log(`Deployment smoke checks passed for ${base.origin}: indexing=${indexing}, ${canonicalPages.length} canonical routes, ${legacyRedirects.length} permanent redirects, and ${assets.length} assets.`);

import assert from "node:assert/strict";

const routes = [
  "/",
  "/privacy/",
  "/about/",
  "/tools/pdf/",
  "/tools/pdf/images-to-pdf/",
  "/tools/pdf/merge/",
  "/tools/pdf/split/",
  "/tools/pdf/organize/",
  "/tools/pdf/to-images/",
  "/tools/pdf/metadata/",
  "/tools/image/",
  "/tools/image/converter/",
  "/tools/image/resize/",
  "/tools/image/compress/",
  "/tools/image/metadata/",
  "/tools/privacy/",
  "/tools/scan/",
  "/tools/media/",
  "/tools/image-to-pdf/",
];

const assets = [
  "/css/base.css",
  "/css/components.css",
  "/css/pages.css",
  "/js/theme-bootstrap.js",
  "/js/main.js",
  "/assets/icons/favicon.ico",
  "/assets/vendor/pdf-lib/pdf-lib.min.js",
];

const canonicalExcludedRoutes = new Set(["/tools/image-to-pdf/"]);

const base = new URL(process.argv[2] || "");
const mode = process.argv[3] || "bridge";
const canonicalBase = new URL("https://securetools.app");

assert.equal(base.protocol, "https:", "deployment validation requires HTTPS");
assert.equal(base.pathname, "/", "deployment base URL must not contain a path");
assert.ok(["bridge", "production"].includes(mode), "deployment mode must be bridge or production");
if (mode === "production") assert.equal(base.origin, canonicalBase.origin, "production validation must target securetools.app");

function metadataValue(html, selectorName, selectorValue, valueName) {
  for (const tag of html.match(/<(?:link|meta)\b[^>]*>/gi) || []) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1].toLowerCase(), match[3]]),
    );
    if (attributes[selectorName] === selectorValue) return attributes[valueName] || "";
  }
  return "";
}

async function request(pathname) {
  const url = new URL(pathname, base);
  const response = await fetch(url, { redirect: "manual" });

  assert.equal(response.status, 200, `${url.href} must return HTTP 200 without a redirect`);
  assert.equal(
    response.headers.get("x-robots-tag"),
    mode === "bridge" ? "noindex, nofollow" : null,
    mode === "bridge" ? `${url.href} must remain non-indexable` : `${url.href} must not inherit the bridge noindex header`,
  );
  return response;
}

for (const route of routes) {
  const response = await request(route);
  const html = await response.text();
  const expectedCanonical = new URL(route, canonicalBase).href;
  const canonical = metadataValue(html, "rel", "canonical", "href");
  const openGraphUrl = metadataValue(html, "property", "og:url", "content");

  if (canonicalExcludedRoutes.has(route)) {
    assert.equal(canonical, "", `${route} must remain outside the canonical inventory`);
    assert.equal(openGraphUrl, "", `${route} must remain outside the Open Graph inventory`);
    assert.match(html, /<meta name="robots" content="noindex">/i, `${route} must retain its source-level noindex`);
  } else {
    assert.equal(canonical, expectedCanonical, `${route} canonical changed`);
    assert.equal(openGraphUrl, expectedCanonical, `${route} og:url changed`);
  }
}

for (const asset of assets) {
  const response = await request(asset);
  await response.arrayBuffer();
}

console.log(`Deployment smoke checks passed for ${base.origin}: mode=${mode}, 19 routes, 7 assets, no redirects, expected indexing header, 18 production canonicals plus the intentional noindex legacy alias.`);

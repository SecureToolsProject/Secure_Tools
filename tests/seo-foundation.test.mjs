import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const origin = "https://securetools.app";

const indexableRoutes = new Map([
  ["index.html", "/"],
  ["about/index.html", "/about/"],
  ["privacy/index.html", "/privacy/"],
  ["tools/pdf/index.html", "/tools/pdf/"],
  ["tools/pdf/images-to-pdf/index.html", "/tools/pdf/images-to-pdf/"],
  ["tools/pdf/merge/index.html", "/tools/pdf/merge/"],
  ["tools/pdf/split/index.html", "/tools/pdf/split/"],
  ["tools/pdf/organize/index.html", "/tools/pdf/organize/"],
  ["tools/pdf/to-images/index.html", "/tools/pdf/to-images/"],
  ["tools/pdf/metadata/index.html", "/tools/pdf/metadata/"],
  ["tools/image/index.html", "/tools/image/"],
  ["tools/image/converter/index.html", "/tools/image/converter/"],
  ["tools/image/resize/index.html", "/tools/image/resize/"],
  ["tools/image/compress/index.html", "/tools/image/compress/"],
  ["tools/image/metadata/index.html", "/tools/image/metadata/"],
  ["tools/privacy/index.html", "/tools/privacy/"],
  ["tools/scan/index.html", "/tools/scan/"],
  ["tools/media/index.html", "/tools/media/"],
]);

const excludedRoutes = ["404.html", "tools/image-to-pdf/index.html"];
const expectedUrls = [...indexableRoutes.values()].map((route) => `${origin}${route}`);
const titles = new Set();
const descriptions = new Set();

function values(html, pattern) {
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

for (const [relativeFile, route] of indexableRoutes) {
  const html = read(relativeFile);
  const expectedUrl = `${origin}${route}`;
  const canonical = values(html, /<link rel="canonical" href="([^"]+)">/g);
  const title = values(html, /<title>([^<]+)<\/title>/g);
  const description = values(html, /<meta name="description" content="([^"]+)">/g);

  assert.deepEqual(canonical, [expectedUrl], `${relativeFile}: one exact canonical URL`);
  assert.equal(title.length, 1, `${relativeFile}: one title`);
  assert.ok(title[0].trim(), `${relativeFile}: non-empty title`);
  assert.equal(description.length, 1, `${relativeFile}: one description`);
  assert.ok(description[0].trim(), `${relativeFile}: non-empty description`);
  assert.deepEqual(values(html, /<meta property="og:type" content="([^"]+)">/g), ["website"], `${relativeFile}: Open Graph type`);
  assert.deepEqual(values(html, /<meta property="og:site_name" content="([^"]+)">/g), ["Secure Tools"], `${relativeFile}: Open Graph site name`);
  assert.deepEqual(values(html, /<meta property="og:url" content="([^"]+)">/g), [expectedUrl], `${relativeFile}: Open Graph URL matches canonical`);
  assert.equal(values(html, /<meta property="og:title" content="([^"]+)">/g).length, 1, `${relativeFile}: one Open Graph title`);
  assert.equal(values(html, /<meta property="og:description" content="([^"]+)">/g).length, 1, `${relativeFile}: one Open Graph description`);
  assert.doesNotMatch(html, /<meta name="robots" content="[^"]*(?:noindex|nofollow)/i, `${relativeFile}: indexable`);
  assert.doesNotMatch(html, /securetoolsproject\.github\.io/i, `${relativeFile}: no legacy canonical host`);
  assert.doesNotMatch(html, /hreflang=/i, `${relativeFile}: no fabricated locale URL`);
  titles.add(title[0]);
  descriptions.add(description[0]);
}

assert.equal(titles.size, indexableRoutes.size, "page titles are unique");
assert.equal(descriptions.size, indexableRoutes.size, "page descriptions are unique");

for (const relativeFile of excludedRoutes) {
  const html = read(relativeFile);
  assert.match(html, /<meta name="robots" content="noindex">/i, `${relativeFile}: intentional noindex`);
  assert.doesNotMatch(html, /rel="canonical"/i, `${relativeFile}: excluded from canonical inventory`);
}

const robots = read("robots.txt");
assert.equal(robots, `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
assert.doesNotMatch(robots, /^Disallow:\s*\/$/im, "robots.txt does not block the site");

const sitemap = read("sitemap.xml");
assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.match(sitemap, /<\/urlset>\s*$/);
assert.doesNotMatch(sitemap, /<(?:lastmod|changefreq|priority)>/);
const sitemapUrls = values(sitemap, /<loc>([^<]+)<\/loc>/g);
assert.deepEqual(sitemapUrls, expectedUrls, "sitemap exactly matches the canonical public route inventory");
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "sitemap URLs are unique");
for (const url of sitemapUrls) assert.ok(url.startsWith(`${origin}/`), `${url}: production origin`);

assert.equal(read("CNAME").trim(), "securetools.app", "GitHub Pages custom domain");

const productionHtml = [...indexableRoutes.keys()].map(read).join("\n");
assert.doesNotMatch(productionHtml, /google-analytics|googletagmanager|gtag\(|meta pixel|facebook\.net\/.*fbevents|session replay/i);
assert.doesNotMatch(productionHtml, /<script[^>]+src="https?:\/\//i, "no remote runtime scripts");
assert.doesNotMatch(productionHtml, /<link[^>]+href="https?:\/\/[^\"]+"[^>]+rel="stylesheet"/i, "no remote stylesheets or fonts");

console.log("SEO route, crawler, canonical, metadata, privacy, and custom-domain checks passed.");

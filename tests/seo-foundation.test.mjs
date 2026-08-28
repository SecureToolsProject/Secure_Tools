import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const readBytes = (relative) => fs.readFileSync(path.join(root, relative));
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
const allHtmlRoutes = [...indexableRoutes.keys(), ...excludedRoutes];
const shareImagePath = "assets/images/og-image.png";
const shareImageUrl = `${origin}/${shareImagePath}`;
const iconLinks = new Map([
  ["assets/icons/favicon.ico", '<link rel="icon" href="/assets/icons/favicon.ico" sizes="any">'],
  ["assets/icons/favicon-32x32.png", '<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32x32.png">'],
  ["assets/icons/favicon-16x16.png", '<link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16x16.png">'],
  ["assets/icons/apple-touch-icon.png", '<link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">'],
]);
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
  const openGraphTitle = values(html, /<meta property="og:title" content="([^"]+)">/g);
  const openGraphDescription = values(html, /<meta property="og:description" content="([^"]+)">/g);
  assert.deepEqual(values(html, /<meta property="og:image" content="([^"]+)">/g), [shareImageUrl], `${relativeFile}: same-origin Open Graph image`);
  assert.deepEqual(values(html, /<meta property="og:image:width" content="([^"]+)">/g), ["1200"], `${relativeFile}: Open Graph image width`);
  assert.deepEqual(values(html, /<meta property="og:image:height" content="([^"]+)">/g), ["630"], `${relativeFile}: Open Graph image height`);
  assert.equal(values(html, /<meta property="og:image:alt" content="([^"]+)">/g).length, 1, `${relativeFile}: Open Graph image alternative`);
  assert.deepEqual(values(html, /<meta name="twitter:card" content="([^"]+)">/g), ["summary_large_image"], `${relativeFile}: Twitter card type`);
  assert.deepEqual(values(html, /<meta name="twitter:title" content="([^"]+)">/g), openGraphTitle, `${relativeFile}: Twitter title matches Open Graph`);
  assert.deepEqual(values(html, /<meta name="twitter:description" content="([^"]+)">/g), openGraphDescription, `${relativeFile}: Twitter description matches Open Graph`);
  assert.deepEqual(values(html, /<meta name="twitter:image" content="([^"]+)">/g), [shareImageUrl], `${relativeFile}: same-origin Twitter image`);
  assert.equal(values(html, /<meta name="twitter:image:alt" content="([^"]+)">/g).length, 1, `${relativeFile}: Twitter image alternative`);
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

for (const relativeFile of allHtmlRoutes) {
  const html = read(relativeFile);
  for (const [asset, markup] of iconLinks) {
    assert.equal(html.split(markup).length - 1, 1, `${relativeFile}: one exact ${asset} link`);
    assert.ok(fs.existsSync(path.join(root, asset)), `${relativeFile}: ${asset} resolves`);
  }
}

function pngDimensions(relativeFile) {
  const bytes = readBytes(relativeFile);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${relativeFile}: PNG signature`);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

assert.deepEqual(pngDimensions("assets/icons/favicon-16x16.png"), [16, 16]);
assert.deepEqual(pngDimensions("assets/icons/favicon-32x32.png"), [32, 32]);
assert.deepEqual(pngDimensions("assets/icons/apple-touch-icon.png"), [180, 180]);
assert.deepEqual(pngDimensions(shareImagePath), [1200, 630]);

const ico = readBytes("assets/icons/favicon.ico");
assert.equal(ico.readUInt16LE(0), 0, "favicon ICO reserved field");
assert.equal(ico.readUInt16LE(2), 1, "favicon ICO image type");
const icoCount = ico.readUInt16LE(4);
assert.equal(icoCount, 3, "favicon ICO image count");
const icoSizes = Array.from({ length: icoCount }, (_, index) => {
  const offset = 6 + (index * 16);
  const width = ico[offset] || 256;
  const height = ico[offset + 1] || 256;
  return `${width}x${height}`;
}).sort();
assert.deepEqual(icoSizes, ["16x16", "32x32", "48x48"]);

const i18nRuntime = read("js/i18n.js");
assert.match(i18nRuntime, /meta\[name="twitter:title"\]/, "i18n updates Twitter title");
assert.match(i18nRuntime, /meta\[name="twitter:description"\]/, "i18n updates Twitter description");

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

console.log("SEO route, branding asset, canonical, metadata, privacy, and custom-domain checks passed.");

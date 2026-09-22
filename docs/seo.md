# Search discovery and metadata

Status: this document describes the prepared H3.5 Web Utilities SEO contract. The H3.4A pull request must remain unmerged until the coordinated production cutover. While the branch is open, live `securetools.app` and `tools.securetools.app` retain their H3.3 behavior.

## Canonical origin

The final Web Utilities canonical origin is `https://tools.securetools.app`. All 18 canonical-bearing pages use self-referencing URLs on that host with their existing paths and trailing slashes.

The root `CNAME` remains `securetools.app` in H3.4A because this preparation task does not change the current GitHub Pages custom domain. H3.5 must coordinate retirement of that legacy production path with the Hub apex cutover before this branch is merged as a production release.

## Crawler discovery

- `/robots.txt` allows public crawling and points to `https://tools.securetools.app/sitemap.xml`.
- `/sitemap.xml` lists exactly the 18 canonical Web Utilities pages intended for indexing.
- The 404 page and legacy `/tools/image-to-pdf/` alias are intentionally `noindex` and absent from the sitemap.
- No Hub, old apex, GitHub Pages, or `pages.dev` URL belongs in the Web Utilities sitemap.
- Static assets, tests, documentation files, and generated user downloads are not sitemap entries.

The sitemap is reviewed static XML. It omits speculative `lastmod`, `changefreq`, and `priority` values. `tests/seo-foundation.test.mjs` keeps it synchronized with the explicit public-route inventory.

## Page metadata contract

Every indexable page has:

- one HTTPS canonical URL on `tools.securetools.app` using the existing directory route and trailing slash;
- one non-empty, page-specific title and meta description;
- `og:type=website`, `og:site_name=Secure Tools`, page-specific Open Graph title and description, and an `og:url` equal to the canonical URL;
- absolute `og:image` and `twitter:image` URLs at `https://tools.securetools.app/assets/images/og-image.png` using the existing reviewed 1200 × 630 asset;
- a Twitter/X `summary_large_image` card that reuses the page title, description, and share image; and
- no accidental page-level `noindex` or `nofollow` directive.

Favicon and Apple touch icon files remain same-origin assets under `/assets/icons/`. No remote image service, runtime generator, manifest, service worker, or install behavior is introduced.

## Pages hostname isolation

The Cloudflare deployment artifact uses absolute hostname patterns in `_headers`:

```text
https://secure-tools-web-bridge.pages.dev/*
  X-Robots-Tag: noindex, nofollow

https://:version.secure-tools-web-bridge.pages.dev/*
  X-Robots-Tag: noindex, nofollow
```

This leaves `tools.securetools.app` without the bridge header while retaining duplicate-host protection on stable, branch, and immutable `pages.dev` URLs. It requires no Worker, Pages Function, redirect, or zone-level Transform Rule. The legacy `/tools/image-to-pdf/` page keeps its independent HTML `noindex` directive on every hostname.

## Language and structured data

All six interface languages share the same routable page URL and switch client-side. Secure Tools does not publish fabricated locale URLs, sitemap entries, or `hreflang` tags. The i18n runtime continues to update visible copy, document language, title, description, and matching Open Graph text without changing canonical identity.

JSON-LD remains intentionally absent. H3.4A does not invent schema, ratings, reviews, FAQs, offers, language routes, feeds, or manifest URLs.

## Privacy boundary

Search discovery uses static text, XML, HTML metadata, and static Pages response headers. It adds no analytics, telemetry, tracker, cookie, verification script, external font, remote SEO runtime, Worker, Pages Function, or file-processing request.

## H3.5 coordinated activation

Do not merge the H3.4A pull request as an ordinary application release. Activate it close to all of these H3.5 operations:

1. Hub apex cutover at `securetools.app`;
2. retirement of the Secure_Tools GitHub Pages apex custom-domain path;
3. legacy Web Utilities path redirects owned by the H3.5 migration plan;
4. Hub canonical activation;
5. deployment of this tools-host canonical, social metadata, sitemap, robots, and hostname-specific indexing contract; and
6. deployed validation that `tools.securetools.app` is indexable while all `pages.dev` aliases remain noindex.

Prolonged partial activation is unsafe because crawlers could see conflicting canonicals, a new sitemap before the intended host is indexable, duplicate content on `pages.dev`, or Web Utilities metadata published from the old apex while the Hub cutover is incomplete.

## Maintenance

When an indexable route is added, renamed, redirected, or retired:

1. update its title, description, canonical, and Open Graph metadata;
2. update the route inventory and sitemap together;
3. keep redirects and error pages out of the sitemap and mark them `noindex` when appropriate;
4. run `node tests/seo-foundation.test.mjs` and `node tests/run-all.mjs`; and
5. inspect the rendered canonical, response headers, console, and Network panel before release.

## Search Console after H3.5

H3.4A performs no Search Console operation. After the coordinated H3.5 cutover:

- the existing `securetools.app` property monitors the Hub;
- a `https://tools.securetools.app/` URL-prefix property monitors Web Utilities;
- submit `https://tools.securetools.app/sitemap.xml` to that URL-prefix property; and
- do not use the root-property Change of Address tool for this partial subdomain migration.

Bing Webmaster Tools should likewise receive the tools-host sitemap only after H3.5 is live and validated.

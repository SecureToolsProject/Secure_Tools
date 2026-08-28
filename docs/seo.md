# Search discovery and metadata

## Production origin

The canonical public origin is `https://securetools.app`. GitHub Pages serves the custom domain recorded in the root `CNAME` file. Canonical and sitemap URLs must never use the legacy GitHub Pages hostname.

## Crawler discovery

- `/robots.txt` allows public crawling and points to `https://securetools.app/sitemap.xml`.
- `/sitemap.xml` lists the 18 real canonical pages intended for indexing.
- The 404 page and the legacy `/tools/image-to-pdf/` redirect are intentionally `noindex` and absent from the sitemap.
- Static assets, tests, documentation files, and generated user downloads are not sitemap entries.

The sitemap is reviewed static XML. It omits speculative `lastmod`, `changefreq`, and `priority` values. `tests/seo-foundation.test.mjs` keeps it synchronized with the explicit public-route inventory.

## Page metadata contract

Every indexable page has:

- one HTTPS canonical URL on `securetools.app` using the directory route's trailing slash;
- one non-empty, page-specific title and meta description;
- `og:type=website`, `og:site_name=Secure Tools`, page-specific Open Graph title and description, an `og:url` equal to the canonical URL, and the reviewed same-origin 1200 × 630 share image;
- a Twitter/X `summary_large_image` card that reuses the page title, description, and share image;
- no accidental `noindex` or `nofollow` directive.

The shared preview is served statically from `https://securetools.app/assets/images/og-image.png`. Favicon and Apple touch icon files are also same-origin assets under `/assets/icons/`; no remote image service, runtime generator, manifest, service worker, or install behavior is involved.

## Language and structured-data decisions

All six interface languages share the same routable page URL and switch client-side. Secure Tools therefore does not publish fabricated locale URLs, sitemap entries, or `hreflang` tags. The existing i18n runtime continues to update the visible copy, document language, title, description, and matching Open Graph text without changing canonical identity.

JSON-LD is intentionally deferred. The current static metadata already describes each page accurately, and this task does not add speculative ratings, reviews, FAQs, paid offers, organization claims, or language routes. A future schema should be introduced only with a clearly represented product model and dedicated validation.

## Privacy boundary

Search discovery is implemented with static text, XML, and HTML metadata. It adds no analytics, telemetry, tracker, cookie, verification script, external font, remote SEO runtime, or processing request. Search Console ownership remains DNS-based.

## Maintenance

When an indexable route is added, renamed, redirected, or retired:

1. update its title, description, canonical, and Open Graph metadata;
2. update the route inventory and sitemap together;
3. keep redirects and error pages out of the sitemap and mark them `noindex` when appropriate;
4. run `node tests/seo-foundation.test.mjs` and `node tests/run-all.mjs`;
5. inspect the rendered canonical, console, and Network panel before release.

## Search engine submission

After the merged GitHub Pages deployment reaches production:

### Google Search Console

1. Open the `securetools.app` Domain property.
2. Open **Sitemaps** and submit `sitemap.xml`.
3. Use URL Inspection for `https://securetools.app/` and request indexing when appropriate.
4. Inspect major PDF, Image, and Metadata tool URLs after sitemap discovery.
5. Monitor Page indexing and sitemap processing over the following days.

DNS ownership is already verified; do not add a Search Console HTML tag or tracking script.

### Bing Webmaster Tools

Configure Bing after the production sitemap is available. Prefer importing the verified Google Search Console property when Bing offers that option; otherwise add `https://securetools.app/sitemap.xml` directly through Bing Webmaster Tools.

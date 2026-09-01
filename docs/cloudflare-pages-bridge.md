# Cloudflare Pages migration bridge

Status: H3.3 is complete. `tools.securetools.app` is active on the Direct Upload Pages project and remains non-indexable under the live H3.3 deployment. H3.4A prepares, but does not activate, the later H3.5 indexing and canonical cutover.

## Deployment identity

| Item | Value |
| --- | --- |
| Cloudflare Pages project | `secure-tools-web-bridge` |
| Production branch | `main` |
| Custom domain | `https://tools.securetools.app` |
| Stable validation URL | `https://secure-tools-web-bridge.pages.dev` |
| Deployment mechanism | GitHub Actions Direct Upload through Wrangler |

The H3.3 architecture remains live while the H3.4A pull request is open:

```text
securetools.app
→ existing GitHub Pages Web Utilities production

tools.securetools.app
→ Cloudflare Pages parallel endpoint
→ X-Robots-Tag: noindex, nofollow
→ canonical securetools.app

secure-tools-web-bridge.pages.dev
→ validation and rollback endpoint
→ X-Robots-Tag: noindex, nofollow
```

No H3.4A feature-branch push deploys to Pages because the workflow deploys only on `main` or explicit manual dispatch.

## Provenance and artifact isolation

```text
Secure_Tools main
→ GitHub Actions validation
→ temporary bridge artifact without repository CNAME
→ GitHub Deployment
→ Cloudflare Pages Direct Upload
```

The required `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` values remain GitHub Actions secrets. The workflow validates the intended project, `main` production branch, custom domain, Direct Upload source, and analytics-disabled state without logging secret values.

The source repository has no `_headers`, `_redirects`, `_worker.js`, or `functions/` deployment behavior. CI creates the Cloudflare-only `_headers` file inside the runner's temporary artifact.

## Prepared H3.5 indexing split

Cloudflare Pages `_headers` supports absolute hostname patterns. H3.4A therefore prepares:

```text
https://secure-tools-web-bridge.pages.dev/*
  X-Robots-Tag: noindex, nofollow

https://:version.secure-tools-web-bridge.pages.dev/*
  X-Robots-Tag: noindex, nofollow
```

Expected H3.5 behavior after coordinated merge and deployment:

```text
tools.securetools.app
→ indexable
→ canonical tools.securetools.app

secure-tools-web-bridge.pages.dev
*.secure-tools-web-bridge.pages.dev
→ X-Robots-Tag: noindex, nofollow
→ canonical tools.securetools.app
```

The static hostname rules are the smallest transparent solution: they preserve `pages.dev` duplicate-host protection without a Worker, Pages Function, redirect, or external zone rule. The workflow verifies all 19 routes, seven representative assets, redirect absence, indexing-header mode, and tools-host canonical/`og:url` values on the immutable URL, stable alias, and custom domain.

## H3.5 activation gate

The H3.4A pull request must not merge independently. H3.5 must coordinate its merge with the Hub apex cutover, legacy path redirects, Hub canonical activation, retirement of the old Secure_Tools GitHub Pages apex path, and Web Utilities indexing activation.

After deployment, require all of the following before treating the SEO cutover as complete:

- `tools.securetools.app` returns HTTP 200 for all 19 routes and has no response-level noindex header;
- stable and immutable `pages.dev` endpoints return exact `X-Robots-Tag: noindex, nofollow`;
- all canonical-bearing pages and `og:url` values identify the tools host;
- social image URLs, sitemap, and robots sitemap declaration use the tools host;
- the legacy alias retains page-level noindex and remains outside the sitemap; and
- the Hub apex, redirect, and Search Console steps are validated by their owning H3.5 work.

## Rollback

If the H3.5 Web Utilities SEO deployment is unhealthy, use the immutable or stable Pages endpoint for diagnosis while keeping those hostnames non-indexable. Coordinate rollback with the Hub/apex migration owner; do not independently create DNS records, change the old apex, or publish conflicting canonical and sitemap states.

H3.4A itself changes no DNS, Cloudflare custom domain, GitHub Pages configuration, Search Console property, redirect, Worker, Pages Function, or application behavior.

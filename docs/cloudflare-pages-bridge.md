# Cloudflare Pages migration bridge

Status: H3.2 is deployed and validated. H3.3 preparation targets a parallel `tools.securetools.app` custom domain, but the preparation pull request must remain unmerged until the activation gate below is satisfied. H3.3 does not authorize an apex migration.

## Deployment identity

| Item | Value |
| --- | --- |
| Cloudflare Pages project | `secure-tools-web-bridge` |
| Production branch | `main` |
| Stable validation URL | `https://secure-tools-web-bridge.pages.dev` |
| Deployment mechanism | GitHub Actions Direct Upload through Wrangler |
| Current custom domains | None before H3.3 activation |
| H3.3 target custom domain | `https://tools.securetools.app` |

The stable Pages hostname is a validated application endpoint and must remain available throughout H3.3 as the rollback and comparison endpoint. `securetools.app` and `www.securetools.app` remain outside the Pages project.

The H3.3 domain contract is:

```text
tools.securetools.app
→ Cloudflare Pages project secure-tools-web-bridge

secure-tools-web-bridge.pages.dev
→ retained validation and rollback endpoint

securetools.app
→ unchanged GitHub Pages production deployment
```

## Provenance and isolation

The bridge workflow is `.github/workflows/deploy-cloudflare-bridge.yml`:

```text
Secure_Tools main
→ GitHub Actions validation
→ temporary bridge artifact
→ GitHub Deployment
→ Cloudflare Pages Direct Upload
```

The existing GitHub Pages production path remains independent:

```text
Secure_Tools main repository root + CNAME
→ GitHub Pages
→ https://securetools.app
```

The workflow copies only application files to `${{ runner.temp }}/secure-tools-web-bridge`. It excludes the repository `CNAME` and injects this bridge-only file into that temporary directory:

```text
/*
  X-Robots-Tag: noindex, nofollow
```

The source artifact therefore retains its current canonical, Open Graph, sitemap, robots, and GitHub Pages behavior. The Pages bridge and H3.3 custom domain remain accessible for QA while their Cloudflare static responses instruct crawlers not to index or follow them.

## Credentials and project contract

The required GitHub Actions secret names are:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Their values remain secret and must never enter source, logs, pull-request text, or untrusted workflows. The token remains limited to the intended Cloudflare account and required Pages permissions.

After H3.3 activation, every deployment queries the authenticated Pages project state and requires the expected name, `main` production branch, stable Pages subdomain, exactly the `tools.securetools.app` custom domain, no Git integration, and no Cloudflare Web Analytics configuration.

## H3.3 manual browser QA gate

Do not attach the custom domain until a human has completed all of these checks against `https://secure-tools-web-bridge.pages.dev`:

- one representative PDF operation;
- one representative image operation;
- one representative metadata operation; and
- browser Network-panel confirmation that selected user files are not uploaded.

Static and contract tests do not satisfy this manual gate. Record the human result on the H3.3 issue before activation.

## Custom-domain activation

After the manual gate has explicit evidence, use this exact order:

1. In Cloudflare, open **Workers & Pages → `secure-tools-web-bridge` → Custom domains → Set up a domain**.
2. Enter `tools.securetools.app`, continue, and activate it through the Pages project.
3. Because `securetools.app` is already a Cloudflare-managed zone, allow Cloudflare Pages to create and manage the associated `tools` DNS record.
4. Wait until the Pages custom domain reports active and its TLS certificate is valid.
5. Validate HTTPS, all 19 routes, representative assets, exact `X-Robots-Tag: noindex, nofollow`, and the existing production SEO inventory with `node tests/deployment-smoke.mjs https://tools.securetools.app`.
6. Revalidate `secure-tools-web-bridge.pages.dev` and `securetools.app`, then merge the prepared pull request. The resulting `main` deployment continuously validates the immutable deployment, stable Pages alias, custom domain, and existing production isolation.

Do not manually create a Pages-target CNAME before associating the hostname with the Pages project. Do not change apex or `www` records. Cloudflare may represent the managed record internally; the invariant is that `tools.securetools.app` resolves through `secure-tools-web-bridge` while apex records remain unchanged.

## Continuous deployment validation

Every `main` push and optional manual dispatch performs:

1. the complete repository test suite;
2. an explicit secret-name prerequisite check;
3. creation of a temporary static artifact without `CNAME`, `_redirects`, Workers, or Pages Functions;
4. injection of the bridge-only `_headers` rule;
5. authenticated verification of project identity, production branch, custom-domain contract, Direct Upload mode, and analytics isolation;
6. Direct Upload with source SHA and branch provenance;
7. the shared deployment smoke contract against the immutable deployment URL, stable Pages alias, H3.3 custom domain, and existing GitHub Pages production;
8. HTTP 200 without redirects for all 19 H3.1 routes on each endpoint;
9. representative CSS, JavaScript, icon, and vendored-library checks;
10. exact `X-Robots-Tag: noindex, nofollow` on Pages routes and assets, plus confirmation that production does not inherit that bridge-only header; and
11. canonical and `og:url` values that intentionally continue to identify `https://securetools.app/...`, while the legacy `/tools/image-to-pdf/` alias retains its existing source-level noindex and stays outside the canonical inventory.

Existing static tests continue to cover representative PDF, image, metadata, privacy, local-processing, dependency-integrity, CSP, and network invariants.

During H3.3, both Pages hostnames remain non-indexable while canonical and `og:url` metadata continue to identify the existing production host. `tools.securetools.app` must not be added to production sitemap files. No Search Console operation belongs to H3.3.

## H3.3 rollback

If `tools.securetools.app` is unhealthy after activation:

1. remove the `tools` DNS record associated with Pages if Cloudflare does not remove it as part of detachment;
2. detach `tools.securetools.app` from the Pages project's Custom domains configuration;
3. confirm `secure-tools-web-bridge.pages.dev` remains healthy and no custom-domain record remains; and
4. leave `securetools.app`, its root `CNAME`, GitHub Pages, apex and `www` DNS, Search Console, redirects, sitemap, and production metadata untouched.

The bridge is additive, so rollback never requires a change to the existing production site. H3.3 does not move the apex, create legacy redirects, begin H3.4, or change application behavior.

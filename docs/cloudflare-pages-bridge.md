# Cloudflare Pages migration bridge

Status: activation prerequisites confirmed on 2026-09-01; the first `main` deployment is pending merge of the reviewed workflow. This document does not authorize H3.3 or a custom-domain migration.

## Deployment identity

| Item | Value |
| --- | --- |
| Cloudflare Pages project | `secure-tools-web-bridge` |
| Production branch | `main` |
| Stable validation URL after activation | `https://secure-tools-web-bridge.pages.dev` |
| Deployment mechanism | GitHub Actions Direct Upload through Wrangler |
| Custom domains | None |

The project hostname resolves, but it is not a validated application endpoint until the first deployment succeeds. No `securetools.app`, `www.securetools.app`, or `tools.securetools.app` custom domain may be attached during H3.2.

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

The workflow copies only application files to `${{ runner.temp }}/secure-tools-web-bridge`. It deliberately excludes the repository `CNAME` and injects this bridge-only file into that temporary directory:

```text
/*
  X-Robots-Tag: noindex, nofollow
```

The source artifact therefore retains its current canonical, Open Graph, sitemap, robots, and GitHub Pages behavior. The deployed bridge remains accessible for QA while its Cloudflare static responses instruct crawlers not to index or follow it.

## Required one-time setup

Before this workflow can safely merge and run on `main`:

1. Create the Direct Upload Pages project `secure-tools-web-bridge` with production branch `main`, for example with an authenticated Wrangler session:

   ```text
   npx wrangler@4 pages project create secure-tools-web-bridge --production-branch main
   ```

2. Add these GitHub Actions repository secrets to `SecureToolsProject/Secure_Tools`:

   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

3. Limit the token to the intended Cloudflare account with only **Account → Cloudflare Pages → Edit**. No zone or DNS permission is required for this bridge. Do not reuse or expose a token value through source, logs, pull-request text, or untrusted workflows.
4. Confirm the project has no custom domains before the first deployment.

Both required secret names and the Direct Upload project were provisioned on 2026-09-01. Before every deployment, the workflow queries the authenticated Pages project state and requires the expected name, `main` production branch, stable Pages subdomain, zero custom domains, no Git integration, and no Cloudflare Web Analytics configuration.

## Deployment validation

Every `main` push and optional manual dispatch performs:

1. the complete repository test suite;
2. an explicit secret-name prerequisite check;
3. creation of a temporary static artifact without `CNAME`, `_redirects`, Workers, or Pages Functions;
4. injection of the bridge-only `_headers` rule;
5. authenticated verification of project identity, production branch, custom-domain isolation, Direct Upload mode, and analytics isolation;
6. Direct Upload with source SHA and branch provenance;
7. HTTP 200 checks for all 19 H3.1 routes;
8. representative CSS, JavaScript, icon, and vendored-library checks;
9. verification of `X-Robots-Tag: noindex, nofollow` on the deployed root response.

Existing static tests continue to cover the representative PDF, image, metadata, privacy, local-processing, dependency-integrity, CSP, and network invariants. Interactive browser QA is still required after the endpoint exists; static tests are not a substitute for rendered or Network-panel evidence.

## Rollback and removal

The bridge is additive. A failed bridge deployment does not require a production rollback because GitHub Pages remains the production origin.

To stop bridge automation, disable the Cloudflare bridge workflow without changing the existing CI or GitHub Pages settings. After H3 migration no longer needs the bridge, remove its Pages project only after preserving any required deployment evidence. Removing the bridge must not delete or modify the root `CNAME`, GitHub Pages configuration, DNS, Search Console, redirects, or production metadata.

import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/deploy-cloudflare-bridge.yml", "utf8");

assert.match(workflow, /^name: Deploy Cloudflare bridge$/m);
assert.match(workflow, /^\s{2}push:\s*$[\s\S]*?^\s{6}- main$/m);
assert.match(workflow, /^\s{2}workflow_dispatch:$/m);
assert.match(workflow, /permissions:\s*\n\s+contents: read\s*\n\s+deployments: write/);
assert.match(workflow, /run: node tests\/run-all\.mjs/);
assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
assert.match(workflow, /secure-tools-web-bridge/);
assert.match(workflow, /pages deploy .* --project-name=secure-tools-web-bridge --branch=main --commit-hash=\$\{\{ github\.sha \}\}/);
assert.match(workflow, /gitHubToken: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
assert.match(workflow, /X-Robots-Tag: noindex, nofollow/);
assert.match(workflow, /https:\/\/secure-tools-web-bridge\.pages\.dev\/\*/);
assert.match(workflow, /https:\/\/:version\.secure-tools-web-bridge\.pages\.dev\/\*/);
assert.doesNotMatch(workflow, /printf '\/\*\\n  X-Robots-Tag/);
assert.match(workflow, /steps\.deploy\.outputs\.deployment-url/);
assert.match(workflow, /api\.cloudflare\.com\/client\/v4\/accounts\/\$\{CLOUDFLARE_ACCOUNT_ID\}\/pages\/projects\/secure-tools-web-bridge/);
assert.match(workflow, /\["tools\.securetools\.app"\]/);
assert.match(workflow, /\$project\.source == null/);
assert.match(workflow, /web_analytics_tag/);
assert.match(workflow, /web_analytics_token/);
assert.match(workflow, /Pages project state:/);
assert.match(workflow, /\[\[ ! -e "\$BRIDGE_DIRECTORY\/CNAME" \]\]/);
assert.match(workflow, /\[\[ ! -e "\$BRIDGE_DIRECTORY\/_redirects" \]\]/);
assert.doesNotMatch(workflow, /securetools\.app\/tools/);
assert.match(workflow, /node tests\/deployment-smoke\.mjs "\$DEPLOYMENT_URL" noindex/);
assert.match(workflow, /node tests\/deployment-smoke\.mjs https:\/\/secure-tools-web-bridge\.pages\.dev noindex/);
assert.match(workflow, /node tests\/deployment-smoke\.mjs https:\/\/tools\.securetools\.app indexable/);
assert.doesNotMatch(workflow, /node tests\/deployment-smoke\.mjs https:\/\/securetools\.app/);

const deploymentSmoke = fs.readFileSync("tests/deployment-smoke.mjs", "utf8");
const routeLines = deploymentSmoke.match(/^  "\/(?:"|[^"].*\/"),$/gm) || [];
assert.equal(routeLines.length, 19, "deployment smoke must validate all 19 H3.1 routes");
assert.match(deploymentSmoke, /redirect: "manual"/);
assert.match(deploymentSmoke, /\["noindex", "indexable"\]/);
assert.match(deploymentSmoke, /"x-robots-tag"/);
assert.match(deploymentSmoke, /"noindex, nofollow"/);
assert.match(deploymentSmoke, /new URL\("https:\/\/tools\.securetools\.app"\)/);
assert.match(deploymentSmoke, /canonicalExcludedRoutes = new Set\(\["\/tools\/image-to-pdf\/"\]\)/);
assert.match(deploymentSmoke, /"canonical"/);
assert.match(deploymentSmoke, /"og:url"/);
assert.match(deploymentSmoke, /"og:image"/);
assert.match(deploymentSmoke, /"twitter:image"/);

assert.equal(fs.readFileSync("CNAME", "utf8").trim(), "securetools.app");
assert.ok(!fs.existsSync("_headers"), "bridge headers must not enter the GitHub Pages artifact");
assert.ok(!fs.existsSync("_redirects"), "H3 must not add production redirects");

console.log("Cloudflare bridge workflow contract checks passed.");

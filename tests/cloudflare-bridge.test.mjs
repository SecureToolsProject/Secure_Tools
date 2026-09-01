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
assert.match(workflow, /steps\.deploy\.outputs\.deployment-url/);
assert.match(workflow, /--max-redirs 0/);
assert.match(workflow, /\[\[ ! -e "\$BRIDGE_DIRECTORY\/CNAME" \]\]/);
assert.match(workflow, /\[\[ ! -e "\$BRIDGE_DIRECTORY\/_redirects" \]\]/);
assert.doesNotMatch(workflow, /tools\.securetools\.app/);
assert.doesNotMatch(workflow, /securetools\.app\/tools/);

const routeLines = workflow.match(/^\s{12}\/(?:$|[^/].*\/$)/gm) || [];
assert.equal(routeLines.length, 19, "the workflow must validate all 19 H3.1 routes");

assert.equal(fs.readFileSync("CNAME", "utf8").trim(), "securetools.app");
assert.ok(!fs.existsSync("_headers"), "bridge headers must not enter the GitHub Pages artifact");
assert.ok(!fs.existsSync("_redirects"), "H3.2 must not add production redirects");

console.log("Cloudflare bridge workflow contract checks passed.");

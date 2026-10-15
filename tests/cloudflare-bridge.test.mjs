import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateBuildProvenance } from "../scripts/build-provenance.mjs";
import { validateHostingHeaders } from "../scripts/http-security-headers.mjs";

const workflow = fs.readFileSync(".github/workflows/deploy-cloudflare-bridge.yml", "utf8");
const headerPolicy = fs.readFileSync("config/cloudflare/_headers", "utf8");

assert.match(workflow, /^name: Deploy Cloudflare bridge$/m);
assert.match(workflow, /^\s{2}push:\s*$[\s\S]*?^\s{6}- main$/m);
assert.match(workflow, /^\s{2}workflow_dispatch:$/m);
assert.match(workflow, /permissions:\s*\n\s+contents: read\s*\n\s+deployments: write/);
const prerequisites = ["run: npm ci --ignore-scripts", "run: npm run prepare:ocr", "run: npm test", "npm run build", "pages deploy "];
const positions = prerequisites.map(command => workflow.indexOf(command));
assert.ok(positions.every(position => position >= 0), "Deployment requires locked install, preparation, compiled tests, build, and upload");
assert.ok(positions.every((position, index) => index === 0 || position > positions[index - 1]), "Deployment prerequisites run before dependent tests/build/upload");
assert.doesNotMatch(workflow, /run: node tests\/run-all\.mjs/, "Use the package test entry point that compiles TypeScript");
const packageScripts = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts;
assert.ok(packageScripts.test.indexOf("npm run typecheck") < packageScripts.test.indexOf("npm run compile:ts"));
assert.ok(packageScripts.test.indexOf("npm run compile:ts") < packageScripts.test.indexOf("node tests/run-all.mjs"));
assert.match(packageScripts["compile:ts"], /tsc.*stage-typescript-test-dependencies/);
assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
assert.match(workflow, /secure-tools-web-bridge/);
assert.match(workflow, /pages deploy .* --project-name=secure-tools-web-bridge --branch=main --commit-hash=\$\{\{ github\.sha \}\}/);
assert.match(workflow, /gitHubToken: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
assert.match(headerPolicy, /X-Robots-Tag: noindex, nofollow/);
assert.match(headerPolicy, /https:\/\/secure-tools-web-bridge\.pages\.dev\/\*/);
assert.match(headerPolicy, /https:\/\/:version\.secure-tools-web-bridge\.pages\.dev\/\*/);
assert.doesNotMatch(workflow, />\s*"\$BRIDGE_DIRECTORY\/_headers"/, "Deployment cannot overwrite the validated header policy");
assert.doesNotMatch(workflow, /printf '\/\*\\n  X-Robots-Tag/);
assert.match(workflow, /steps\.deploy\.outputs\.deployment-url/);
assert.match(workflow, /api\.cloudflare\.com\/client\/v4\/accounts\/\$\{CLOUDFLARE_ACCOUNT_ID\}\/pages\/projects\/secure-tools-web-bridge/);
assert.match(workflow, /\["tools\.securetools\.app"\]/);
assert.match(workflow, /\$project\.source == null/);
assert.match(workflow, /web_analytics_tag/);
assert.match(workflow, /web_analytics_token/);
assert.match(workflow, /Pages project state:/);
assert.match(workflow, /\[\[ ! -e "\$BRIDGE_DIRECTORY\/CNAME" \]\]/);
assert.match(workflow, /npm run build/);
assert.match(workflow, /cp -R dist\/\. "\$BRIDGE_DIRECTORY\/"/);
assert.match(workflow, /node scripts\/validate-build\.mjs "\$BRIDGE_DIRECTORY"/);
assert.doesNotMatch(workflow, /find "\$BRIDGE_DIRECTORY" -name index\.html -type f \| wc -l/);
assert.doesNotMatch(workflow, /securetools\.app\/tools/);
assert.match(workflow, /node tests\/deployment-smoke\.mjs "\$DEPLOYMENT_URL" noindex/);
assert.match(workflow, /smoke_with_retry https:\/\/secure-tools-web-bridge\.pages\.dev noindex/);
assert.match(workflow, /smoke_with_retry https:\/\/tools\.securetools\.app indexable/);
assert.match(workflow, /for attempt in 1 2 3 4 5 6;/);
assert.match(workflow, /Waiting for Cloudflare alias propagation/);
assert.match(workflow, /sleep 10/);
assert.doesNotMatch(workflow, /node tests\/deployment-smoke\.mjs https:\/\/securetools\.app/);

const deploymentSmoke = fs.readFileSync("tests/deployment-smoke.mjs", "utf8");
assert.match(deploymentSmoke, /canonicalPages/);
assert.match(deploymentSmoke, /legacyRedirects/);
assert.match(deploymentSmoke, /redirect: "manual"/);
assert.match(deploymentSmoke, /\["noindex", "indexable"\]/);
assert.match(deploymentSmoke, /"x-robots-tag"/);
assert.match(deploymentSmoke, /"noindex, nofollow"/);
assert.match(deploymentSmoke, /canonicalBase = new URL\(productionOrigin\)/);
assert.match(deploymentSmoke, /"canonical"/);
assert.match(deploymentSmoke, /"og:url"/);
assert.match(deploymentSmoke, /"og:image"/);
assert.match(deploymentSmoke, /"twitter:image"/);

assert.equal(fs.readFileSync("CNAME", "utf8").trim(), "securetools.app");
assert.ok(!fs.existsSync("_headers"), "bridge headers must not enter the GitHub Pages artifact");
assert.ok(!fs.existsSync("_redirects"), "redirects are generated only in the build artifact");

// Execute the real packaging block, preserving its strict isolation assertions.
const preparation = workflow.match(/- name: Prepare isolated bridge artifact[\s\S]*?run: \|\n([\s\S]*?)\n      - name:/)?.[1];
assert.ok(preparation, "Isolated artifact preparation block exists");
const staging = path.resolve(".ts-build");
fs.mkdirSync(staging, { recursive: true });
const artifact = fs.mkdtempSync(path.join(staging, "cloudflare-isolation-"));
assert.equal(path.dirname(artifact), staging);
try {
  const shell = process.platform === "win32" ? path.join(process.env.ProgramFiles, "Git/bin/bash.exe") : "bash";
  const result = spawnSync(shell, ["-e", "-o", "pipefail", "-c", preparation.replace(/^          /gm, "")], {
    env: { ...process.env, BRIDGE_DIRECTORY: process.platform === "win32" ? artifact.replaceAll("\\", "/").replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`) : artifact }, encoding: "utf8",
  });
  assert.equal(result.status, 0, `Actual deployment packaging succeeds: ${result.stdout}\n${result.stderr}`);
  assert.equal(fs.readFileSync("CNAME", "utf8").trim(), "securetools.app");
  assert.equal(fs.readFileSync("dist/CNAME", "utf8").trim(), "securetools.app", "Generic build retains hosting ownership file");
  assert.ok(!fs.existsSync(path.join(artifact, "CNAME")), "Isolated Cloudflare artifact excludes CNAME");
  assert.deepEqual(validateBuildProvenance(artifact), validateBuildProvenance("dist"), "Exact provenance survives isolated deployment packaging");
  assert.ok(!fs.existsSync(path.join(artifact, "_worker.js")) && !fs.existsSync(path.join(artifact, "functions")));
  assert.match(fs.readFileSync(path.join(artifact, "_headers"), "utf8"), /X-Robots-Tag: noindex, nofollow/);
  assert.equal(fs.readFileSync(path.join(artifact, "_headers"), "utf8"), headerPolicy);
  validateHostingHeaders(artifact, { isolated: true });
} finally {
  assert.equal(path.dirname(artifact), staging);
  fs.rmSync(artifact, { recursive: true, force: true });
}

console.log("Cloudflare bridge workflow contract checks passed.");

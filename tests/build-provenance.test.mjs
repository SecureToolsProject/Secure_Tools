import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { buildIdentity, canonicalVersion, provenanceFile, validateBuildInfo, validateBuildProvenance, writeBuildInfo } from "../scripts/build-provenance.mjs";
import { verifyDeployedBuildInfo } from "../scripts/verify-build-provenance.mjs";

const sha = "1234567890abcdef1234567890abcdef12345678";
const env = { ...process.env, CI: "true", GITHUB_ACTIONS: "true", GITHUB_SHA: sha };
const identity = buildIdentity(env, () => { throw new Error("CI must never consult Git fallback"); });
assert.deepEqual(identity, { commit: sha, version: JSON.parse(fs.readFileSync("package.json", "utf8")).version, source: "github-actions" });
assert.equal(buildIdentity({}, () => sha).commit, sha);
assert.equal(buildIdentity({}, () => sha).source, "local");
for (const input of [undefined, "", "1234567", "local", sha.toUpperCase(), "g".repeat(40)]) {
  assert.throws(() => buildIdentity({ CI: "true", GITHUB_SHA: input }, () => sha));
  assert.throws(() => buildIdentity({ GITHUB_ACTIONS: "true", GITHUB_SHA: input }, () => sha));
}
assert.throws(() => buildIdentity({ GITHUB_SHA: "bad" }, () => sha));

const staging = path.resolve(".ts-build");
fs.mkdirSync(staging, { recursive: true });
const directory = fs.mkdtempSync(path.join(staging, "provenance-test-"));
let info;
try {
  assert.throws(() => validateBuildProvenance(directory, identity));
  info = writeBuildInfo(directory, identity);
  const first = fs.readFileSync(path.join(directory, provenanceFile), "utf8");
  writeBuildInfo(directory, identity);
  assert.equal(fs.readFileSync(path.join(directory, provenanceFile), "utf8"), first, "Generation is byte deterministic");
  assert.deepEqual(JSON.parse(first), { schemaVersion: 1, commit: sha, version: canonicalVersion, build: { source: "github-actions" } });
  assert.equal(validateBuildProvenance(directory, identity).commit, sha);
  for (const change of [
    value => { delete value.commit; },
    value => { value.commit = "1234567"; },
    value => { value.commit = "f".repeat(40); },
    value => { value.schemaVersion = 2; },
    value => { value.version = "unexpected"; },
    value => { value.timestamp = "2026-10-07"; },
    value => { value.build.runner = "private-runner"; },
    value => { value.build.source = "local"; },
    value => { value.build = null; },
  ]) {
    const corrupt = structuredClone(info); change(corrupt);
    fs.writeFileSync(path.join(directory, provenanceFile), JSON.stringify(corrupt));
    assert.throws(() => validateBuildProvenance(directory, identity));
  }
  assert.throws(() => validateBuildInfo(null, identity));
  assert.throws(() => validateBuildInfo([], identity));
  // Exercise the real generator and complete production validator with an explicit
  // CI SHA deliberately different from local HEAD; the supplied source must win.
  execFileSync(process.execPath, ["scripts/build-site.mjs"], { env, stdio: "pipe" });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join("dist", provenanceFile), "utf8")), info);
  execFileSync(process.execPath, ["scripts/validate-build.mjs"], { env, stdio: "pipe" });
  fs.unlinkSync(path.join("dist", provenanceFile));
  assert.throws(() => execFileSync(process.execPath, ["scripts/validate-build.mjs"], { env, stdio: "pipe" }));
  writeBuildInfo("dist", identity);
} finally {
  assert.equal(path.dirname(directory), staging);
  fs.rmSync(directory, { recursive: true, force: true });
}

// Use a real HTTP server to cover the live verifier's transport and schema gates.
let status = 200;
let contentType = "application/json";
let body = info;
const server = http.createServer((request, response) => {
  assert.equal(request.url, `/${provenanceFile}`);
  response.writeHead(status, { "content-type": contentType, location: "/" });
  response.end(JSON.stringify(body));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  assert.deepEqual(await verifyDeployedBuildInfo(origin, sha), info);
  await assert.rejects(verifyDeployedBuildInfo(origin, "f".repeat(40)));
  for (const code of [404, 302, 500]) {
    status = code; await assert.rejects(verifyDeployedBuildInfo(origin, sha));
  }
  status = 200; contentType = "text/html";
  await assert.rejects(verifyDeployedBuildInfo(origin, sha));
  contentType = "application/json"; body = { ...info, version: "unexpected" };
  await assert.rejects(verifyDeployedBuildInfo(origin, sha));
  body = { ...info, token: "must-not-leak" };
  await assert.rejects(verifyDeployedBuildInfo(origin, sha));
  await assert.rejects(verifyDeployedBuildInfo(origin, undefined));
} finally {
  await new Promise(resolve => server.close(resolve));
}

const deployment = fs.readFileSync(".github/workflows/deploy-cloudflare-bridge.yml", "utf8");
assert.match(deployment, /verify-build-provenance\.mjs "\$DEPLOYMENT_URL" "\$GITHUB_SHA"/);
assert.match(deployment, /verify-build-provenance\.mjs "\$url" "\$GITHUB_SHA"/);
assert.ok(deployment.indexOf('node scripts/validate-build.mjs "$BRIDGE_DIRECTORY"') < deployment.indexOf("command: pages deploy"));
const smokeWorkflow = fs.readFileSync(".github/workflows/production-smoke.yml", "utf8");
assert.match(smokeWorkflow, /source_commit:[\s\S]*?required: true/);
assert.match(smokeWorkflow, /ref: \$\{\{ inputs\.source_commit \|\| github\.sha \}\}/);
assert.match(smokeWorkflow, /EXPECTED_PRODUCTION_SHA: \$\{\{ inputs\.source_commit \|\| github\.sha \}\}/);
assert.match(smokeWorkflow, /verify-build-provenance\.mjs "\$PRODUCTION_ORIGIN" "\$EXPECTED_PRODUCTION_SHA"/);
assert.match(smokeWorkflow, /verify-build-provenance\.mjs "\$IMMUTABLE_ORIGIN" "\$EXPECTED_PRODUCTION_SHA"/);
assert.match(fs.readFileSync(".github/workflows/ci.yml", "utf8"), /run: node scripts\/validate-build\.mjs/);
console.log("Provenance generator, strict artifact schema, CI identity and live HTTP failure checks passed.");

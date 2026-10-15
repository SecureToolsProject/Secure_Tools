import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadInventory, validateInventory } from "../scripts/security-inventory.mjs";
import { fetchJson, parseOsv, readNpmAudit, scanGithubVendor, scanNpmVendor, scanVendors, validateNpmAudit } from "../scripts/check-security-advisories.mjs";
import { auditActionPins } from "../scripts/validate-action-pins.mjs";

const json = file => JSON.parse(fs.readFileSync(file, "utf8"));
const records = loadInventory();
assert.equal(records.length, 11);
const manifest = json("config/security/vendor-dependencies.json");
const canonical = new Map(records.map(record => [record.name, record]));
const dependencies = json("package.json").dependencies;
const lock = json("package-lock.json");
const validate = (input = manifest, pins = canonical, runtime = dependencies, locked = lock) => validateInventory(input, pins, runtime, locked);
assert.throws(() => validate({ ...manifest, dependencies: manifest.dependencies.slice(1) }), /Every vendored/);
assert.throws(() => validate({ ...manifest, dependencies: [...manifest.dependencies, manifest.dependencies[0]] }), /Duplicate/);
assert.throws(() => validate({ ...manifest, dependencies: [...manifest.dependencies, { name: "unknown", source: "npm" }] }), /Unknown/);
assert.throws(() => validate({ ...manifest, dependencies: manifest.dependencies.map(entry => ({ ...entry, version: "1.0.0" })) }), /deep-equal/);
const drift = new Map(canonical); drift.set("jszip", { ...drift.get("jszip"), version: "3.10.2" });
assert.throws(() => validate(manifest, drift), /Release-gate\/vendor version drift/);
assert.throws(() => validate(manifest, canonical, { ...dependencies, "tesseract.js": "7.0.1" }), /version drift/);
const staleLock = structuredClone(lock); staleLock.packages["node_modules/tesseract.js"].version = "0.0.1";
assert.throws(() => validate(manifest, canonical, dependencies, staleLock), /Lockfile\/vendor drift/);
assert.throws(() => validate(manifest, canonical, { ...dependencies, "new-runtime": "1.0.0" }), /Untracked/);
const fakeNpm = structuredClone(manifest); fakeNpm.dependencies.find(entry => entry.name === "secure-metadata").source = "npm";
assert.throws(() => validate(fakeNpm));

const audit = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } };
validateNpmAudit(audit);
fs.mkdirSync(".ts-build", { recursive: true });
const temporary = fs.mkdtempSync(".ts-build/advisory-test-");
try {
  const input = path.join(temporary, "audit.json");
  fs.writeFileSync(input, JSON.stringify(audit));
  readNpmAudit(input);
  const old = new Date(Date.now() - 7200000); fs.utimesSync(input, old, old);
  assert.throws(() => readNpmAudit(input), /Stale/);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
for (const bad of [{}, { ...audit, error: { code: "ENETUNREACH" } }, { ...audit, vulnerabilities: [] }, { ...audit, metadata: {} }, { ...audit, vulnerabilities: { example: {} } }, { ...audit, metadata: { vulnerabilities: { ...audit.metadata.vulnerabilities, low: 1, total: 1 } } }]) assert.throws(() => validateNpmAudit(bad));

const response = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
const npm = records.find(record => record.name === "jszip");
const vulnerability = { id: "GHSA-test-test-test", modified: "2026-10-01T00:00:00Z", affected: [{ package: { name: npm.name, ecosystem: "npm" } }] };
const npmRequest = (osv = {}, registry = { name: npm.name, version: npm.version }) => async (url, options) => {
  assert.equal(options.cache, "no-store");
  assert.ok(options.signal instanceof AbortSignal);
  if (url.startsWith("https://registry.npmjs.org/")) return response(registry);
  assert.equal(url, "https://api.osv.dev/v1/query");
  const query = JSON.parse(options.body);
  assert.deepEqual(query.package, { ecosystem: "npm", name: npm.name });
  assert.equal(query.version, npm.version);
  return response(osv);
};
assert.equal((await scanNpmVendor(npm, npmRequest())).result, "no-known-advisories");
assert.deepEqual(parseOsv({}, npm.name).active, []); // OSV's documented empty result.
for (const bad of [[], null, { error: "unavailable" }, { vulns: null }, { vulns: {} }, { vulns: [{}] }, { next_page_token: "" }, { vulns: [{ ...vulnerability, affected: [{ package: { name: "wrong", ecosystem: "npm" } }] }] }]) assert.throws(() => parseOsv(bad, npm.name));
await assert.rejects(scanNpmVendor(npm, npmRequest({ vulns: [vulnerability] })), /known OSV advisories/);
await assert.rejects(scanNpmVendor(npm, npmRequest({}, { name: npm.name, version: "99.0.0" })), /PACKAGE_NOT_REPRESENTED/);
await assert.rejects(scanNpmVendor(npm, npmRequest({ next_page_token: "repeat" })), /pagination/);
let pages = 0;
const paginated = npmRequest();
assert.equal((await scanNpmVendor(npm, async (url, options) => {
  if (url.startsWith("https://registry")) return paginated(url, options);
  pages++;
  return response(pages === 1 ? { next_page_token: "second" } : {});
})).result, "no-known-advisories");
assert.equal(pages, 2);
await assert.rejects(fetchJson("https://registry.npmjs.org/missing/1.0.0", {}, async () => response({}, 404)), /PACKAGE_NOT_REPRESENTED/);
await assert.rejects(fetchJson("https://api.osv.dev/v1/query", {}, async () => response({}, 503)), /SCAN_FAILED HTTP 503/);
await assert.rejects(fetchJson("https://api.osv.dev/v1/query", {}, async () => response({}, 200, { Age: "86401" })), /stale/);
await assert.rejects(fetchJson("https://api.osv.dev/v1/query", {}, async () => new Response("oops", { headers: { "Content-Type": "text/html" } })), /non-JSON/);
await assert.rejects(fetchJson("https://api.osv.dev/v1/query", {}, async () => new Response("{", { headers: { "Content-Type": "application/json" } })));
await assert.rejects(scanVendors([npm], async () => { throw new Error("offline"); }), /SCAN_FAILED.*|offline/s);

const github = records.find(record => record.source === "github");
const projectRequest = ({ commit = github.commit, draft = false, advisories = [], secondPage = false } = {}) => async url => {
  assert.ok(url.startsWith(`https://api.github.com/repos/${github.repository}/`), "No fake npm or other repository query");
  if (url.includes("/git/ref/")) return response({ object: { type: "commit", sha: commit } });
  if (url.includes("/releases/")) return response({ tag_name: github.tag, draft, prerelease: false, published_at: "2026-08-27T04:12:48Z", assets: [{ name: `secure-metadata-${github.version}.browser.js` }] });
  return response(secondPage && url.endsWith("page=1") ? [] : advisories, 200, secondPage && url.endsWith("page=1") ? { Link: '<https://api.github.com/next>; rel="next"' } : {});
};
assert.equal((await scanGithubVendor(github, projectRequest())).result, "no-active-public-repository-advisories");
await assert.rejects(scanGithubVendor(github, projectRequest({ commit: "a".repeat(40) })), /commit drift/);
await assert.rejects(scanGithubVendor(github, projectRequest({ draft: true })));
await assert.rejects(scanGithubVendor(github, projectRequest({ advisories: {} })), /Malformed/);
await assert.rejects(scanGithubVendor(github, projectRequest({ secondPage: true, advisories: [{ ghsa_id: "GHSA-test-test-test", state: "published", published_at: "2026-10-01T00:00:00Z", withdrawn_at: null }] })), /applicability needs review/);

const workflow = fs.readFileSync(".github/workflows/security-monitoring.yml", "utf8");
assert.match(workflow, /branches: \[v2\.3, main\]/);
assert.match(workflow, /languages: javascript-typescript\n\s+build-mode: none/);
assert.match(workflow, /security-events: write/);
assert.doesNotMatch(workflow, /contents: write|pull-requests: write|continue-on-error|\|\| true|pull_request_target/);
assert.match(workflow, /npm ci --ignore-scripts/);
assert.match(workflow, /npm audit --json --audit-level=low/);
assert.match(workflow, /node scripts\/check-security-advisories\.mjs/);
assert.match(fs.readFileSync(".github/codeql/config.yml", "utf8"), /assets\/vendor\/\*\*/);
const dependabot = fs.readFileSync(".github/dependabot.yml", "utf8");
assert.match(dependabot, /package-ecosystem: "npm"[\s\S]*?target-branch: "v2\.3"/);
assert.match(dependabot, /package-ecosystem: "github-actions"/);
assert.doesNotMatch(dependabot, /auto-merge/);
auditActionPins();
console.log("Security monitoring: inventory/pin/lock drift, malformed/offline/stale responses, pagination, advisory failures, project release identity, and workflow enforcement passed.");

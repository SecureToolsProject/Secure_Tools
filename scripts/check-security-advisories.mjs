import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadInventory } from "./security-inventory.mjs";

export function validateNpmAudit(report) {
  assert.equal(report?.auditReportVersion, 2, "Unsupported/missing npm audit schema");
  assert.ok(!Object.hasOwn(report, "error"), "npm audit service failed");
  assert.ok(report.vulnerabilities && typeof report.vulnerabilities === "object" && !Array.isArray(report.vulnerabilities));
  const counts = report.metadata?.vulnerabilities;
  for (const key of ["info", "low", "moderate", "high", "critical", "total"]) {
    assert.ok(Number.isSafeInteger(counts?.[key]) && counts[key] >= 0, `Invalid audit count: ${key}`);
  }
  assert.equal(Object.keys(report.vulnerabilities).length, 0, "npm audit returned known advisories; review without auto-fixing");
  assert.ok(Object.values(counts).every(value => value === 0), "npm audit returned known advisories");
}

export function readNpmAudit(file, now = Date.now()) {
  const age = now - fs.statSync(file).mtimeMs;
  assert.ok(age >= -300000 && age <= 3600000, "Stale/future npm audit input; regenerate the report");
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  validateNpmAudit(report);
  return report;
}

export async function fetchJson(url, options = {}, request = fetch) {
  const response = await request(url, { ...options, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (response.status === 404 && url.startsWith("https://registry.npmjs.org/")) throw new Error(`PACKAGE_NOT_REPRESENTED: ${url}; no clean result inferred`);
  assert.equal(response.status, 200, `SCAN_FAILED HTTP ${response.status}: ${url}`);
  const age = response.headers.get("age");
  if (age !== null) assert.ok(/^\d+$/.test(age) && Number(age) <= 86400, `SCAN_FAILED stale advisory response: ${url}`);
  assert.match(response.headers.get("content-type") || "", /\bapplication\/(?:[\w.+-]*\+)?json\b/i, `SCAN_FAILED non-JSON: ${url}`);
  return { value: await response.json(), headers: response.headers };
}

export function parseOsv(response, name) {
  assert.ok(response && typeof response === "object" && !Array.isArray(response), "Malformed OSV response");
  assert.ok(Object.keys(response).every(key => ["vulns", "next_page_token"].includes(key)), "Unexpected OSV response/error");
  if (response.next_page_token !== undefined) assert.ok(typeof response.next_page_token === "string" && response.next_page_token.length > 0);
  const vulnerabilities = Object.hasOwn(response, "vulns") ? response.vulns : [];
  assert.ok(Array.isArray(vulnerabilities));
  for (const vulnerability of vulnerabilities) {
    assert.ok(typeof vulnerability.id === "string" && vulnerability.id.length > 0);
    assert.ok(Number.isFinite(Date.parse(vulnerability.modified)), "Missing OSV modification timestamp");
    assert.ok(Array.isArray(vulnerability.affected) && vulnerability.affected.some(affected => affected.package?.ecosystem === "npm" && affected.package.name === name), "OSV package identity mismatch");
    if (vulnerability.withdrawn !== undefined) assert.ok(Number.isFinite(Date.parse(vulnerability.withdrawn)));
  }
  return { active: vulnerabilities.filter(vulnerability => !vulnerability.withdrawn).map(vulnerability => vulnerability.id), next: response.next_page_token };
}

export async function scanNpmVendor(record, request = fetch) {
  // OSV empty output does not prove registry representation. Confirm exact identity.
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(record.name)}/${encodeURIComponent(record.version)}`;
  const { value: metadata } = await fetchJson(registryUrl, {}, request);
  assert.equal(metadata.name, record.name, "PACKAGE_NOT_REPRESENTED: npm name mismatch");
  assert.equal(metadata.version, record.version, "PACKAGE_NOT_REPRESENTED: npm version mismatch");
  const visited = new Set();
  const ids = [];
  let token;
  do {
    assert.ok(visited.size < 10 && !visited.has(token), "OSV pagination exceeded/repeated; scan incomplete");
    visited.add(token);
    const { value } = await fetchJson("https://api.osv.dev/v1/query", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: { ecosystem: "npm", name: record.name }, version: record.version, ...(token ? { page_token: token } : {}) }),
    }, request);
    const page = parseOsv(value, record.name);
    ids.push(...page.active); token = page.next;
  } while (token);
  assert.equal(ids.length, 0, `${record.name}@${record.version}: known OSV advisories ${ids.join(", ")}; review required`);
  return { name: record.name, version: record.version, source: "npm/OSV", result: "no-known-advisories" };
}

export async function scanGithubVendor(record, request = fetch, token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const api = `https://api.github.com/repos/${record.repository}`;
  const get = async suffix => fetchJson(api + suffix, { headers }, request);
  let { value: reference } = await get(`/git/ref/tags/${record.tag}`);
  let object = reference.object;
  for (let depth = 0; object?.type === "tag" && depth < 3; depth++) ({ value: { object } } = await get(`/git/tags/${object.sha}`));
  assert.equal(object?.type, "commit", "Unresolved project release tag");
  assert.equal(object.sha, record.commit, "Project release tag/commit drift");
  const { value: release } = await get(`/releases/tags/${record.tag}`);
  assert.equal(release.tag_name, record.tag);
  assert.equal(release.draft, false); assert.equal(release.prerelease, false);
  assert.ok(Number.isFinite(Date.parse(release.published_at)));
  assert.ok(Array.isArray(release.assets) && release.assets.some(asset => asset.name === `secure-metadata-${record.version}.browser.js`), "Project runtime asset missing from release");
  let page = 1;
  let more;
  do {
    assert.ok(page <= 10, "Repository advisories pagination exceeded; scan incomplete");
    const { value: advisories, headers: responseHeaders } = await get(`/security-advisories?per_page=100&page=${page++}`);
    assert.ok(Array.isArray(advisories), "Malformed repository advisory response");
    for (const advisory of advisories) {
      assert.match(advisory.ghsa_id || "", /^GHSA-[\w-]+$/);
      assert.equal(advisory.state, "published");
      assert.ok(Number.isFinite(Date.parse(advisory.published_at)));
      if (advisory.withdrawn_at) assert.ok(Number.isFinite(Date.parse(advisory.withdrawn_at)));
      // Conservatively require review of any active public repository advisory;
      // do not invent an npm identity or hand-roll advisory semver evaluation.
      assert.ok(advisory.withdrawn_at, `Project public advisory ${advisory.ghsa_id}: pinned release applicability needs review`);
    }
    more = /rel="next"/.test(responseHeaders.get("link") || "");
  } while (more);
  return { name: record.name, version: record.version, source: record.repository, commit: record.commit, result: "no-active-public-repository-advisories", npm: "not-represented/not-queried" };
}

export async function scanVendors(records, request = fetch) {
  const results = await Promise.allSettled(records.map(record => record.source === "npm" ? scanNpmVendor(record, request) : scanGithubVendor(record, request)));
  const failures = results.flatMap((result, index) => result.status === "rejected" ? [`${records[index].name}: ${result.reason.message}`] : []);
  assert.equal(failures.length, 0, `SCAN_FAILED or advisory review required:\n${failures.join("\n")}`);
  return results.map(result => result.value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    fs.rmSync(path.join(".ts-build", "security-advisories.json"), { force: true });
    readNpmAudit(process.argv[2] || ".ts-build/npm-audit.json");
    const results = await scanVendors(loadInventory());
    fs.mkdirSync(".ts-build", { recursive: true });
    fs.writeFileSync(path.join(".ts-build", "security-advisories.json"), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + "\n");
    console.log("Lockfile and exact vendor queries completed. No known advisories returned at verification time; not proof of safety.");
    console.log(JSON.stringify(results, null, 2));
  } catch (error) { console.error(`SCAN_FAILED: ${error.message}`); process.exitCode = 1; }
}

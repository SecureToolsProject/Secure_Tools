import assert from "node:assert/strict";
import fs from "node:fs";

const audits = JSON.parse(fs.readFileSync(new URL("browser/evidence/gate-network.json", import.meta.url), "utf8"));
const origin = "http://127.0.0.1:4176";
for (const route of ["/image/to-text/", "/pdf/to-text/", "/pdf/merge/", "/image/converter/", "/image/metadata/"]) assert.ok(audits.some(audit => audit.route === route));
assert.ok(audits.some(audit => audit.route === "/image/converter/" && audit.status?.startsWith("Saved image-eng.jpg")), "Actual image conversion completed");
assert.ok(audits.some(audit => audit.route === "/pdf/to-text/" && audit.audit.downloads.length === 1), "Searchable generation was audited");
let applicationApiCalls = 0, sameOriginResources = 0, injectedResources = 0;
for (const { route, audit, scripts } of audits) {
  assert.deepEqual(audit.errors, [], `${route}: application errors`);
  assert.deepEqual(audit.violations, [], `${route}: CSP violations`);
  for (const script of scripts) assert.equal(new URL(script).origin, origin, `${route}: DOM script origin`);
  for (const call of audit.calls) {
    assert.equal(new URL(call.url).origin, origin, `${route}: captured application/worker API request ${call.api}`);
    applicationApiCalls++;
  }
  for (const resource of audit.resources) {
    const url = new URL(resource.url);
    if (url.origin === origin) { sameOriginResources++; continue; }
    // Keep injected traffic visible and classified; do not accept it as product traffic.
    assert.equal(url.origin, "http://local.adguard.org", `${route}: unknown external origin`);
    assert.equal(resource.initiatorType, "script");
    assert.ok(["content-script", "user-script"].includes(url.searchParams.get("type")));
    if (url.searchParams.get("type") === "content-script") assert.equal(url.searchParams.get("app"), "ChatGPT.exe");
    else assert.ok(url.searchParams.getAll("name").every(name => name.startsWith("AdGuard")));
    injectedResources++;
  }
}
function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = `${directory}/${entry.name}`;
    return entry.isDirectory() ? htmlFiles(name) : name.endsWith(".html") ? [name] : [];
  });
}
for (const file of htmlFiles("dist")) assert.ok(!fs.readFileSync(file, "utf8").includes("local.adguard.org"), `${file}: injection absent from served application HTML`);
console.log(JSON.stringify({ applicationApiCalls, sameOriginResources, injectedResources, productThirdPartyRequests: 0, method: "Independent window/worker API tracing plus Resource Timing and served HTML comparison; AdGuard remains enabled" }));

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { canonicalVersion, provenanceFile, requireCommit, validateBuildInfo } from "./build-provenance.mjs";

export async function verifyDeployedBuildInfo(origin, commit, request = fetch) {
  requireCommit(commit);
  const base = new URL(origin);
  assert.ok(base.protocol === "https:" || (base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname)), "Provenance verification requires HTTPS or local test HTTP");
  assert.ok(base.pathname === "/" && !base.username && !base.password && !base.search && !base.hash, "Expected a plain origin");
  const response = await request(new URL(provenanceFile, base), { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, "Provenance endpoint must return HTTP 200 without redirects");
  assert.match(response.headers.get("content-type") || "", /^application\/json(?:\s*;|$)/i, "Provenance must be JSON, not a fallback HTML page");
  return validateBuildInfo(await response.json(), { commit, version: canonicalVersion, source: "github-actions" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyDeployedBuildInfo(process.argv[2], process.argv[3] ?? process.env.GITHUB_SHA);
  console.log("Deployed provenance matches expected source SHA, canonical version, and strict public schema.");
}

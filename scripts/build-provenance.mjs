import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const provenanceFile = "build-info.json";
export const canonicalVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

export function requireCommit(commit) {
  assert.equal(typeof commit, "string", "Source commit is required");
  assert.match(commit, /^[0-9a-f]{40}$/, "Source commit must be a full lowercase Git SHA");
  return commit;
}

export function buildIdentity(env = process.env, gitCommit = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()) {
  const ci = env.GITHUB_ACTIONS === "true" || (Boolean(env.CI) && env.CI !== "false");
  if (ci) assert.ok(env.GITHUB_SHA, "CI requires an explicit GITHUB_SHA; Git fallback is local-only");
  return {
    commit: requireCommit(env.GITHUB_SHA ?? gitCommit()),
    version: canonicalVersion,
    source: env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
  };
}

export function validateBuildInfo(info, expected) {
  assert.ok(info && typeof info === "object" && !Array.isArray(info), "Provenance must be an object");
  assert.deepEqual(Object.keys(info).sort(), ["build", "commit", "schemaVersion", "version"], "Unexpected provenance fields");
  assert.equal(info.schemaVersion, 1, "Unsupported provenance schema");
  requireCommit(info.commit);
  assert.equal(info.commit, requireCommit(expected.commit), "Provenance source SHA mismatch");
  assert.equal(info.version, expected.version, "Provenance canonical version mismatch");
  assert.ok(typeof info.version === "string" && info.version.length > 0, "Canonical version is required");
  assert.ok(info.build && typeof info.build === "object" && !Array.isArray(info.build), "Build source is required");
  assert.deepEqual(Object.keys(info.build), ["source"], "Unexpected build metadata fields");
  assert.ok(["local", "github-actions"].includes(info.build.source), "Unsupported build source");
  assert.equal(info.build.source, expected.source, "Provenance build source mismatch");
  return info;
}

export function writeBuildInfo(directory, identity = buildIdentity()) {
  const info = validateBuildInfo({ schemaVersion: 1, commit: identity.commit, version: identity.version, build: { source: identity.source } }, identity);
  fs.writeFileSync(path.join(directory, provenanceFile), `${JSON.stringify(info, null, 2)}\n`);
  return info;
}

export function validateBuildProvenance(directory, identity = buildIdentity()) {
  return validateBuildInfo(JSON.parse(fs.readFileSync(path.join(directory, provenanceFile), "utf8")), identity);
}

import assert from "node:assert/strict";

import {
  ACTIVE_INTEGRATION_BRANCH,
  run,
  validateBranchPolicy,
  validateDeploymentRecoveryScope,
  validateProductionVerificationScope,
  validateProductionVerificationLock,
} from "../scripts/validate-branch-policy.mjs";

assert.equal(ACTIVE_INTEGRATION_BRANCH, "v2.3");

for (const [headRef, baseRef] of [
  ["feat/example", "v2.3"],
  ["fix/example", "v2.3"],
  ["test/example", "v2.3"],
  ["chore/example", "v2.3"],
  ["v2.3", "main"],
  ["hotfix/example", "main"],
]) {
  assert.deepEqual(validateBranchPolicy(baseRef, headRef), { valid: true, reason: null }, `${headRef} → ${baseRef}`);
  assert.doesNotThrow(() => run([baseRef, headRef]));
}

for (const [headRef, baseRef] of [
  ["feat/example", "main"],
  ["fix/example", "main"],
  ["test/example", "main"],
  ["chore/example", "main"],
  ["v2.1", "main"],
  ["v2.2", "main"],
]) {
  const result = validateBranchPolicy(baseRef, headRef);
  assert.equal(result.valid, false, `${headRef} → ${baseRef}`);
  assert.match(result.reason, /Only v2\.3 release promotion or an explicit hotfix/);
  assert.throws(() => run([baseRef, headRef]), /Only v2\.3 release promotion or an explicit hotfix/);
}

for (const headRef of ["v2.1", "main", "hotfix/example", "feature/example"]) {
  const result = validateBranchPolicy("v2.3", headRef);
  assert.equal(result.valid, false, `${headRef} → v2.3`);
  assert.match(result.reason, /Pull requests into v2\.3 must come from feat\/\*, fix\/\*, test\/\*, or chore\/\*/);
}

for (const base of ["v2.2", "v2.1", "unknown"]) {
  assert.equal(validateBranchPolicy(base, "feat/example").valid, false);
  assert.throws(() => run([base, "feat/example"]), /Unsupported pull request base/);
}
assert.throws(() => run([]), /Usage:/);
assert.equal(validateBranchPolicy("main", "fix/production-deploy-workflow").valid, true);
assert.equal(validateBranchPolicy("main", "fix/production-deploy-workflow-other").valid, false);
assert.doesNotThrow(() => validateDeploymentRecoveryScope([".github/workflows/deploy-cloudflare-bridge.yml", "tests/cloudflare-bridge.test.mjs"]));
assert.throws(() => validateDeploymentRecoveryScope([]), /only its workflow/);
assert.throws(() => validateDeploymentRecoveryScope(["tools/pdf/to-text/app.ts"]), /only its workflow/);
assert.throws(() => validateDeploymentRecoveryScope([".github/workflows/deploy-cloudflare-bridge.yml", "package.json"]), /only its workflow/);

const originalPackage = { dependencies: { runtime: "1.0.0" }, devDependencies: { typescript: "7.0.2" }, scripts: { build: "original" } };
const verificationPackage = structuredClone(originalPackage);
verificationPackage.devDependencies.playwright = "1.63.0";
verificationPackage.scripts["test:production"] = "node tests/production/smoke.mjs";
assert.equal(validateBranchPolicy("main", "test/production-verification").valid, true);
assert.equal(validateBranchPolicy("main", "test/production-verification-other").valid, false);
assert.throws(() => run(["main", "test/production-verification"]), /authorized production baseline/);
assert.doesNotThrow(() => validateProductionVerificationScope(["tests/production/smoke.mjs", "package.json"], originalPackage, verificationPackage));
for (const file of ["tools/pdf/to-text/app.ts", "js/i18n.js", "tests/production/../../tools/app.mjs", ".github/workflows/deploy-cloudflare-bridge.yml"]) {
  assert.throws(() => validateProductionVerificationScope([file], originalPackage, verificationPackage), /only its test/);
}
const changedRuntime = structuredClone(verificationPackage); changedRuntime.dependencies.runtime = "2.0.0";
assert.throws(() => validateProductionVerificationScope(["package.json"], originalPackage, changedRuntime), /preserve production dependencies/);
const changedBuild = structuredClone(verificationPackage); changedBuild.scripts.build = "other";
assert.throws(() => validateProductionVerificationScope(["package.json"], originalPackage, changedBuild), /preserve production dependencies/);
const originalLock = { packages: { "": originalPackage, "node_modules/runtime": { version: "1.0.0" } } };
const verificationLock = structuredClone(originalLock);
verificationLock.packages[""] = verificationPackage;
verificationLock.packages["node_modules/playwright"] = { version: "1.63.0", dev: true };
verificationLock.packages["node_modules/playwright-core"] = { version: "1.63.0", dev: true };
// Lockfile package roots contain dependency declarations, not npm scripts.
delete originalLock.packages[""].scripts; delete verificationLock.packages[""].scripts;
assert.doesNotThrow(() => validateProductionVerificationLock(originalLock, verificationLock));
const changedLock = structuredClone(verificationLock); changedLock.packages["node_modules/runtime"].version = "2.0.0";
assert.throws(() => validateProductionVerificationLock(originalLock, changedLock), /preserve all existing locked/);
const leakedRuntime = structuredClone(verificationLock); leakedRuntime.packages["node_modules/playwright"].dev = false;
assert.throws(() => validateProductionVerificationLock(originalLock, leakedRuntime), /test-only Playwright/);

console.log("v2.3 integration, production promotion, hotfix, and rejection branch-policy checks passed.");

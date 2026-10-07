import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const ACTIVE_INTEGRATION_BRANCH = "v2.2";

const routineBranch = /^(?:feat|fix|test|chore)\/.+$/;
const hotfixBranch = /^hotfix\/.+$/;
const deploymentRecoveryBranch = "fix/production-deploy-workflow";
const productionVerificationBranch = "test/production-verification";
const productionVerificationBaseline = "43979e818468e34511cd6f1e30edfaa7648b0475";
const productionVerificationFiles = new Set([
  ".github/workflows/production-smoke.yml", "package.json", "package-lock.json",
  "scripts/validate-branch-policy.mjs", "tests/branch-policy.test.mjs",
  "docs/production-verification.md",
]);

export function validateProductionVerificationScope(files, beforePackage, afterPackage) {
  if (!files.length || files.some(file => !productionVerificationFiles.has(file) && !/^tests\/production\/[a-z0-9-]+\.mjs$/.test(file))) {
    throw new Error("Production verification may change only its test/workflow infrastructure and scoped policy files.");
  }
  const before = structuredClone(beforePackage); const after = structuredClone(afterPackage);
  const playwright = after.devDependencies?.playwright;
  if (!/^\d+\.\d+\.\d+$/.test(playwright || "") || after.scripts?.["test:production"] !== "node tests/production/smoke.mjs") {
    throw new Error("Production verification requires a pinned test-only Playwright dependency and smoke command.");
  }
  delete before.devDependencies?.playwright; delete after.devDependencies.playwright;
  delete before.scripts?.["test:production"]; delete after.scripts["test:production"];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Production verification must preserve production dependencies and existing package configuration.");
}

export function validateProductionVerificationLock(before, after) {
  const rootBefore = structuredClone(before.packages[""]);
  const rootAfter = structuredClone(after.packages[""]);
  delete rootBefore.devDependencies?.playwright; delete rootAfter.devDependencies?.playwright;
  if (JSON.stringify(rootBefore) !== JSON.stringify(rootAfter)) throw new Error("Production verification must preserve existing lockfile root configuration.");
  for (const [name, entry] of Object.entries(before.packages)) {
    if (name && JSON.stringify(entry) !== JSON.stringify(after.packages[name])) throw new Error("Production verification must preserve all existing locked packages.");
  }
  for (const [name, entry] of Object.entries(after.packages)) {
    if (Object.hasOwn(before.packages, name)) continue;
    if (!["node_modules/playwright", "node_modules/playwright-core"].includes(name) || entry.dev !== true || entry.version !== after.packages[""].devDependencies.playwright) {
      throw new Error("Production verification may add only locked test-only Playwright packages.");
    }
  }
}
const deploymentRecoveryFiles = new Set([
  ".github/workflows/deploy-cloudflare-bridge.yml",
  ".github/workflows/ci.yml",
  "tests/cloudflare-bridge.test.mjs",
  "scripts/validate-branch-policy.mjs",
  "tests/branch-policy.test.mjs",
]);

export function validateDeploymentRecoveryScope(files) {
  if (!files.length || files.some(file => !deploymentRecoveryFiles.has(file))) {
    throw new Error("Deployment recovery may change only its workflow and prerequisite/policy validation files.");
  }
}

export function validateBranchPolicy(baseRef, headRef) {
  if (baseRef === ACTIVE_INTEGRATION_BRANCH) {
    return routineBranch.test(headRef)
      ? { valid: true, reason: null }
      : {
        valid: false,
        reason: `Pull requests into ${ACTIVE_INTEGRATION_BRANCH} must come from feat/*, fix/*, test/*, or chore/* branches.`,
      };
  }

  if (baseRef === "main") {
    return headRef === ACTIVE_INTEGRATION_BRANCH || hotfixBranch.test(headRef) || headRef === deploymentRecoveryBranch || headRef === productionVerificationBranch
      ? { valid: true, reason: null }
      : {
        valid: false,
        reason: `Only ${ACTIVE_INTEGRATION_BRANCH} release promotion or an explicit hotfix/* branch may target main.`,
      };
  }

  return { valid: true, reason: null };
}

export function run([baseRef, headRef] = process.argv.slice(2)) {
  if (!baseRef || !headRef) {
    throw new Error("Usage: node scripts/validate-branch-policy.mjs <base-ref> <head-ref>");
  }
  const result = validateBranchPolicy(baseRef, headRef);
  if (!result.valid) throw new Error(result.reason);
  // Exact user-authorized incident recovery; ordinary fix/* branches stay rejected.
  if (baseRef === "main" && headRef === productionVerificationBranch) {
    const { BASE_SHA, HEAD_SHA } = process.env;
    if (BASE_SHA !== productionVerificationBaseline || !HEAD_SHA) throw new Error("Production verification requires the explicitly authorized production baseline and head SHA.");
    const files = execFileSync("git", ["diff", "--name-only", `${BASE_SHA}...${HEAD_SHA}`], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
    const readPackage = ref => JSON.parse(execFileSync("git", ["show", `${ref}:package.json`], { encoding: "utf8" }));
    validateProductionVerificationScope(files, readPackage(BASE_SHA), readPackage(HEAD_SHA));
    const readLock = ref => JSON.parse(execFileSync("git", ["show", `${ref}:package-lock.json`], { encoding: "utf8" }));
    validateProductionVerificationLock(readLock(BASE_SHA), readLock(HEAD_SHA));
  }
  if (baseRef === "main" && headRef === deploymentRecoveryBranch) {
    const { BASE_SHA, HEAD_SHA } = process.env;
    if (!BASE_SHA || !HEAD_SHA) throw new Error("Deployment recovery requires BASE_SHA and HEAD_SHA for file-scope validation.");
    if (BASE_SHA !== "5cf025092094e79646b765543bc99b382d8a742f") throw new Error("Deployment recovery requires the explicitly authorized incident baseline.");
    const files = execFileSync("git", ["diff", "--name-only", `${BASE_SHA}...${HEAD_SHA}`], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
    validateDeploymentRecoveryScope(files);
  }
  console.log(`Branch policy accepted ${headRef} → ${baseRef}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { run(); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

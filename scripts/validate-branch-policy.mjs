import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const ACTIVE_INTEGRATION_BRANCH = "v2.2";

const routineBranch = /^(?:feat|fix|test|chore)\/.+$/;
const hotfixBranch = /^hotfix\/.+$/;
const deploymentRecoveryBranch = "fix/production-deploy-workflow";
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
    return headRef === ACTIVE_INTEGRATION_BRANCH || hotfixBranch.test(headRef) || headRef === deploymentRecoveryBranch
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

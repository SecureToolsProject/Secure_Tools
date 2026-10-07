import { fileURLToPath } from "node:url";

export const ACTIVE_INTEGRATION_BRANCH = "v2.2";

const routineBranch = /^(?:feat|fix|test|chore)\/.+$/;
const hotfixBranch = /^hotfix\/.+$/;

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
    return headRef === ACTIVE_INTEGRATION_BRANCH || hotfixBranch.test(headRef)
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
  console.log(`Branch policy accepted ${headRef} → ${baseRef}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { run(); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

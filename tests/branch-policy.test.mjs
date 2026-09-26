import assert from "node:assert/strict";

import {
  ACTIVE_INTEGRATION_BRANCH,
  run,
  validateBranchPolicy,
} from "../scripts/validate-branch-policy.mjs";

assert.equal(ACTIVE_INTEGRATION_BRANCH, "v2.2");

for (const [headRef, baseRef] of [
  ["feat/example", "v2.2"],
  ["fix/example", "v2.2"],
  ["test/example", "v2.2"],
  ["chore/example", "v2.2"],
  ["v2.2", "main"],
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
]) {
  const result = validateBranchPolicy(baseRef, headRef);
  assert.equal(result.valid, false, `${headRef} → ${baseRef}`);
  assert.match(result.reason, /Only v2\.2 release promotion or an explicit hotfix/);
  assert.throws(() => run([baseRef, headRef]), /Only v2\.2 release promotion or an explicit hotfix/);
}

for (const headRef of ["v2.1", "main", "hotfix/example", "feature/example"]) {
  const result = validateBranchPolicy("v2.2", headRef);
  assert.equal(result.valid, false, `${headRef} → v2.2`);
  assert.match(result.reason, /Pull requests into v2\.2 must come from feat\/\*, fix\/\*, test\/\*, or chore\/\*/);
}

assert.throws(() => run([]), /Usage:/);

console.log("v2.2 integration, production promotion, hotfix, and rejection branch-policy checks passed.");

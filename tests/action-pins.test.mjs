import assert from "node:assert/strict";
import fs from "node:fs";
import { auditActionPins, auditWorkflowUses, classifyActionReference } from "../scripts/validate-action-pins.mjs";
import { validateBranchPolicy } from "../scripts/validate-branch-policy.mjs";

const pin = `actions/example@${"a".repeat(40)}`;
assert.equal(classifyActionReference(pin, "v4.4.0"), "external-sha");
assert.equal(classifyActionReference("./.github/actions/local"), "repository-local");
for (const ref of ["actions/example@v4", "actions/example@main", "actions/example@abcdef0", `actions/example@${"a".repeat(39)}`, `actions/example@${"A".repeat(40)}`, "docker://example:latest", "${{ inputs.action }}"]) {
  assert.throws(() => classifyActionReference(ref, "v4.4.0"));
}
for (const comment of ["", "v4", "some arbitrary commit"]) assert.throws(() => classifyActionReference(pin, comment));
assert.equal(auditWorkflowUses(`- uses: '${pin}' # v4.4.0`)[0].reference, pin);
assert.equal(auditWorkflowUses(`    uses: ${pin} # v4.4.0`)[0].classification, "external-sha", "Reusable workflow entries are also audited");
assert.equal(auditWorkflowUses("# uses: actions/example@v4").length, 0);
assert.throws(() => auditWorkflowUses("- { uses: actions/example@v4 }"));
assert.throws(() => auditWorkflowUses("- uses: actions/example@v4"));
const references = auditActionPins();
assert.ok(references.every(ref => ref.classification === "external-sha" || ref.classification === "repository-local"));

const dependabot = fs.readFileSync(".github/dependabot.yml", "utf8");
assert.match(dependabot, /^version: 2$/m);
assert.match(dependabot, /package-ecosystem: "github-actions"/);
assert.match(dependabot, /directory: "\/"/);
assert.match(dependabot, /target-branch: "v2\.3"/);
assert.match(dependabot, /interval: "weekly"/);
assert.match(dependabot, /pull-request-branch-name:\s*\n\s+prefix: "chore\/dependabot"/);
assert.match(dependabot, /commit-message:[\s\S]*?prefix: "🔧\[Config\] "/);
assert.equal(validateBranchPolicy("v2.3", "chore/dependabot/github_actions/actions/checkout-4.4.0").valid, true);
assert.doesNotMatch(dependabot, /auto-merge|enable-pull-request-automerge/);
console.log(`Action supply-chain gate passed: ${references.length} references classified; mutable/abbreviated/dynamic refs rejected; reviewed weekly update configuration checked.`);

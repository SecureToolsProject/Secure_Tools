import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
assert.match(workflow, /^name: CI$/m);
assert.match(workflow, /^\s{2}pull_request:$/m);
assert.match(workflow, /^\s{2}push:\s*$[\s\S]*?^\s{6}- main$[\s\S]*?^\s{6}- v2$[\s\S]*?^\s{6}- v2\.1$/m);
assert.match(workflow, /uses: actions\/checkout@v4/);
assert.match(workflow, /uses: actions\/setup-node@v4/);
assert.match(workflow, /node-version: 24/);
assert.match(workflow, /permissions:\s*\n\s+contents: read/);
assert.match(workflow, /name: Enforce pull request branch policy/);
assert.match(workflow, /if: github\.event_name == 'pull_request'/);
assert.match(workflow, /BASE_REF: \$\{\{ github\.base_ref \}\}/);
assert.match(workflow, /HEAD_REF: \$\{\{ github\.head_ref \}\}/);
assert.match(workflow, /\^\(feat\|fix\|test\|chore\)\/\.\+\$/);
assert.match(workflow, /HEAD_REF" == "v2\.1"/);
assert.match(workflow, /\^hotfix\/\.\+\$/);
assert.match(workflow, /Only v2\.1 release promotion or an explicit hotfix/);
assert.match(workflow, /git diff --check/);
assert.match(workflow, /run: npm ci --ignore-scripts/);
assert.match(workflow, /run: npm run build/);
assert.match(workflow, /run: npm test/);
assert.match(workflow, /run: node tests\/ocr-smoke\.test\.mjs/);

console.log("CI workflow contract checks passed.");

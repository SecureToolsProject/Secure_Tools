import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
assert.match(workflow, /^name: CI$/m);
assert.match(workflow, /^\s{2}pull_request:$/m);
assert.match(workflow, /^\s{2}push:\s*$[\s\S]*?^\s{6}- main$[\s\S]*?^\s{6}- v2$/m);
assert.match(workflow, /uses: actions\/checkout@v4/);
assert.match(workflow, /uses: actions\/setup-node@v4/);
assert.match(workflow, /node-version: 24/);
assert.match(workflow, /permissions:\s*\n\s+contents: read/);
assert.match(workflow, /git diff --check/);
assert.match(workflow, /run: node tests\/run-all\.mjs/);
assert.doesNotMatch(workflow, /npm (?:install|ci|run)/);

console.log("CI workflow contract checks passed.");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function classifyActionReference(reference, comment = "") {
  if (/^\.\/[A-Za-z0-9_./-]+$/.test(reference)) return "repository-local";
  assert.match(reference, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+@[0-9a-f]{40}$/, "External Actions require a full lowercase 40-character commit SHA");
  assert.match(comment, /^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?\s*$/, "External Action pin requires an inline upstream release comment");
  return "external-sha";
}

export function auditWorkflowUses(contents, file = "workflow") {
  const references = [];
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    if (/^\s*#/.test(line) || !/\buses\s*:/.test(line)) continue;
    // Require a literal block-style uses entry; unsupported inline/dynamic forms
    // fail closed rather than evade this deliberately small workflow policy.
    const entry = line.match(/^\s*(?:-\s*)?uses:\s*(?:"([^"]+)"|'([^']+)'|([^#\s]+))\s*(?:#\s*(.*))?$/);
    assert.ok(entry, `${file}:${index + 1}: Unsupported uses entry`);
    const reference = entry[1] || entry[2] || entry[3];
    references.push({ file, line: index + 1, reference, release: entry[4], classification: classifyActionReference(reference, entry[4]) });
  }
  return references;
}

export function auditActionPins() {
  const directory = path.join(root, ".github/workflows");
  const files = fs.readdirSync(directory).filter(file => /\.ya?ml$/.test(file));
  assert.ok(files.length > 0, "No workflow files found");
  const references = files.flatMap(file => auditWorkflowUses(fs.readFileSync(path.join(directory, file), "utf8"), `.github/workflows/${file}`));
  assert.ok(references.length > 0, "No Action references found");
  return references;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(auditActionPins(), null, 2));
}

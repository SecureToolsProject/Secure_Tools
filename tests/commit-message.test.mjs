import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CANONICAL_PAIRS, run, validateCommitMessage, validateCommitRange } from "../scripts/validate-commit-message.mjs";

const accepted = [
  "✨[Feat] Add Image to Text OCR",
  "➕[Add] Add local OCR assets",
  "🚀[Deploy] Publish v2.1.0",
  "✅[Test] Cover OCR cancellation",
  "📈[Data] Update language model inventory",
  "🐛[Fix] Prevent stale OCR callbacks",
  "♻️[Refactor] Simplify OCR worker lifecycle",
  "🔧[Config] Enforce protected branch workflow",
  "🚨[Hotfix] Restore production OCR loading",
  "⚙️[Chore] Reinstate commit convention",
  "🎉[Init] Initialize Secure Tools",
  "📄[Docs] Document release workflow",
  "🎀[Style] Align OCR action layout",
  "🚚[Rename] Rename metadata helper",
];

const rejected = [
  "feat: add OCR",
  "✨ feat: add OCR",
  "✨ [Feat] Add OCR",
  "[Feat] ✨ Add OCR",
  "✨[Fix] Add OCR",
  "🐛[Feat] Fix OCR",
  "✨[Feat]",
  "✨[Unknown] Add OCR",
  "Add OCR",
  "✨[Feat]  Add OCR",
  "✨[Feat] feat: add OCR",
];

assert.equal(CANONICAL_PAIRS.length, 14);
for (const message of accepted) assert.deepEqual(validateCommitMessage(message), { valid: true, reason: null }, message);
for (const message of rejected) assert.equal(validateCommitMessage(message).valid, false, message);
assert.doesNotThrow(() => run(["--title", "⚙️[Chore] Reinstate commit convention"]));
assert.throws(
  () => run(["--message", "docs: explain policy"]),
  (error) => /Invalid commit message: docs: explain policy[\s\S]*Expected:[\s\S]*Canonical pairs:/.test(error.message),
);

const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "secure-tools-commit-validator-"));
const git = (...argumentsList) => execFileSync("git", argumentsList, { cwd: temporaryRepository, encoding: "utf8" }).trim();
try {
  git("init", "-q");
  git("config", "user.name", "Secure Tools Test");
  git("config", "user.email", "test@securetools.invalid");
  fs.writeFileSync(path.join(temporaryRepository, "base.txt"), "base\n");
  git("add", "base.txt");
  git("commit", "-q", "-m", "🎉[Init] Initialize validator fixture");
  const base = git("rev-parse", "HEAD");

  git("switch", "-q", "-c", "side");
  fs.writeFileSync(path.join(temporaryRepository, "side.txt"), "side\n");
  git("add", "side.txt");
  git("commit", "-q", "-m", "✅[Test] Add side fixture");

  git("switch", "-q", "-c", "feature", base);
  fs.writeFileSync(path.join(temporaryRepository, "feature.txt"), "feature\n");
  git("add", "feature.txt");
  git("commit", "-q", "-m", "✨[Feat] Add feature fixture");
  git("merge", "-q", "--no-ff", "side", "-m", "Merge side into feature");

  const mergeHead = git("rev-parse", "HEAD");
  const mergeResults = validateCommitRange(base, mergeHead, temporaryRepository);
  assert.equal(mergeResults.length, 2, "the topology-based range excludes the technical merge commit");
  assert.ok(mergeResults.every((result) => result.valid));

  fs.writeFileSync(path.join(temporaryRepository, "invalid.txt"), "invalid\n");
  git("add", "invalid.txt");
  git("commit", "-q", "-m", "test: add invalid fixture");
  const invalidHead = git("rev-parse", "HEAD");
  const failures = validateCommitRange(mergeHead, invalidHead, temporaryRepository).filter((result) => !result.valid);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].subject, "test: add invalid fixture");
  assert.match(failures[0].sha, /^[0-9a-f]{40}$/);
} finally {
  fs.rmSync(temporaryRepository, { recursive: true, force: true });
}

console.log("Commit message accepted, rejected, range, and merge-topology checks passed.");

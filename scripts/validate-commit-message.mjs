import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const CANONICAL_PAIRS = Object.freeze([
  "✨[Feat]",
  "➕[Add]",
  "🚀[Deploy]",
  "✅[Test]",
  "📈[Data]",
  "🐛[Fix]",
  "♻️[Refactor]",
  "🔧[Config]",
  "🚨[Hotfix]",
  "⚙️[Chore]",
  "🎉[Init]",
  "📄[Docs]",
  "🎀[Style]",
  "🚚[Rename]",
]);

const conventionalSubject = /^(?:build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(?:\([^\r\n)]+\))?!?:\s/i;
const escapedPairs = CANONICAL_PAIRS.map((pair) => pair.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const commitPattern = new RegExp(`^(?:${escapedPairs.join("|")}) ([^\\s].*)$`, "u");

export function validateCommitMessage(message) {
  if (typeof message !== "string" || message !== message.trim() || /[\r\n]/.test(message) || !commitPattern.test(message)) {
    return { valid: false, reason: "message must use one exact canonical Gitmoji/action pair followed by one space and a non-empty subject" };
  }

  const subject = message.slice(message.indexOf("]") + 2);
  if (conventionalSubject.test(subject)) {
    return { valid: false, reason: "subject must not repeat Conventional Commit syntax after the action tag" };
  }
  return { valid: true, reason: null };
}

function git(argumentsList, cwd) {
  return execFileSync("git", argumentsList, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function nonMergeCommits(base, head, cwd = process.cwd()) {
  const output = git(["rev-list", "--reverse", "--no-merges", `${base}..${head}`], cwd);
  return output ? output.split(/\r?\n/) : [];
}

export function validateCommitRange(base, head, cwd = process.cwd()) {
  return nonMergeCommits(base, head, cwd).map((sha) => {
    const subject = git(["show", "-s", "--format=%s", sha], cwd);
    return { sha, subject, ...validateCommitMessage(subject) };
  });
}

function failureText(label, subject, reason) {
  return [
    `Invalid ${label}: ${subject || "<empty>"}`,
    `Reason: ${reason}`,
    "Expected: <Gitmoji>[<Action>] <imperative subject>",
    "Examples: ✨[Feat] Add Image to Text OCR | ✅[Test] Cover OCR cancellation | 📄[Docs] Document release workflow",
    `Canonical pairs: ${CANONICAL_PAIRS.join(", ")}`,
  ].join("\n");
}

export function run(argumentsList = process.argv.slice(2), cwd = process.cwd()) {
  const [mode, ...values] = argumentsList;
  if ((mode === "--message" || mode === "--title") && values.length === 1) {
    const result = validateCommitMessage(values[0]);
    if (!result.valid) throw new Error(failureText(mode === "--title" ? "pull request title" : "commit message", values[0], result.reason));
    console.log(`${mode === "--title" ? "Pull request title" : "Commit message"} follows the Secure Tools convention.`);
    return;
  }

  if (mode === "--range" && values.length === 2) {
    const results = validateCommitRange(values[0], values[1], cwd);
    const failures = results.filter((result) => !result.valid);
    if (failures.length) {
      throw new Error(failures.map((failure) => failureText(`commit ${failure.sha}`, failure.subject, failure.reason)).join("\n\n"));
    }
    console.log(`Validated ${results.length} non-merge commit${results.length === 1 ? "" : "s"} in ${values[0]}..${values[1]}.`);
    return;
  }

  throw new Error("Usage: node scripts/validate-commit-message.mjs --message <subject> | --title <title> | --range <base-sha> <head-sha>");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { run(); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

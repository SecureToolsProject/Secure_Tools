import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(target) : [target];
  });
}

function runNode(argumentsList, label) {
  const result = spawnSync(process.execPath, argumentsList, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
}

const sourceFiles = ["js", "tools", "tests"]
  .flatMap((directory) => listFiles(path.join(root, directory)))
  .filter((file) => /\.(?:js|mjs)$/.test(file));

for (const file of sourceFiles) runNode(["--check", file], `Syntax check for ${path.relative(root, file)}`);

for (const test of [
  "tests/image-to-pdf.test.mjs",
  "tests/pdf-merge-and-categories.test.mjs",
  "tests/file-input-queue-state.test.mjs",
  "tests/pdf-split.test.mjs",
  "tests/security-hardening.test.mjs",
  "tests/pdf-to-images.test.mjs",
  "tests/pdf-organizer.test.mjs",
  "tests/ci-foundation.test.mjs",
]) {
  runNode([test], test);
}

console.log("All Secure Tools validation passed.");

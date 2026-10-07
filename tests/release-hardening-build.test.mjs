import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function cleanBuild() {
  for (const name of ["dist", ".ts-build"]) {
    const target = path.resolve(root, name);
    assert.equal(path.dirname(target), root);
    fs.rmSync(target, { recursive: true, force: true });
  }
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npm run build"], { cwd: root, stdio: "inherit" })
    : spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
  assert.equal(result.status, 0, "clean production build succeeds");
  function inventory(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? inventory(file) : [{ path: path.relative(path.join(root, "dist"), file).replaceAll("\\", "/"), sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex") }];
    });
  }
  return inventory(path.join(root, "dist")).sort((a, b) => a.path.localeCompare(b.path));
}
const first = cleanBuild();
const second = cleanBuild();
assert.deepEqual(second, first, "all file names and bytes match across equivalent clean builds");
console.log(`Deterministic clean production builds passed: ${first.length} files with identical SHA-256 hashes.`);

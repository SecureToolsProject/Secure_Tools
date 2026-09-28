import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compiledBrowserModules } from "../scripts/typescript-modules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const packageJson = JSON.parse(read("package.json"));
const typeConfig = JSON.parse(read("tsconfig.json"));
const buildConfig = JSON.parse(read("tsconfig.build.json"));

assert.equal(packageJson.devDependencies.typescript, "7.0.2", "TypeScript is an exact development dependency");
assert.equal(packageJson.scripts.typecheck, "tsc -p tsconfig.json");
assert.match(packageJson.scripts.build, /npm run compile:ts/);
assert.match(packageJson.scripts["compile:ts"], /tsc -p tsconfig\.build\.json/);
assert.match(packageJson.scripts.test, /npm run typecheck/);
assert.equal(typeConfig.compilerOptions.strict, true);
assert.equal(typeConfig.compilerOptions.noEmit, true);
assert.equal(typeConfig.compilerOptions.sourceMap, false);
assert.equal(buildConfig.compilerOptions.outDir, ".ts-build");

assert.equal(compiledBrowserModules.length, 3, "the initial migration remains intentionally bounded");
assert.equal(new Set(compiledBrowserModules.map((module) => module.public)).size, compiledBrowserModules.length);
for (const module of compiledBrowserModules) {
  assert.ok(fs.existsSync(path.join(root, module.source)), `${module.source} exists`);
  assert.ok(fs.existsSync(path.join(root, ".ts-build", module.compiled)), `${module.compiled} was compiled`);
  assert.ok(!fs.existsSync(path.join(root, module.source.replace(/\.ts$/, ".js"))), `${module.source} has no duplicate source JavaScript`);
}

const emittedFiles = fs.readdirSync(path.join(root, ".ts-build"), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath, entry.name));
assert.deepEqual(emittedFiles.filter((file) => /\.(?:ts|tsx|map)$/.test(file)), []);
for (const file of emittedFiles) {
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /sourceMappingURL=|[A-Za-z]:[\\/]Users[\\/]|\/Users\//);
}

console.log("TypeScript strictness, bounded emission, package scripts, and artifact hygiene checks passed.");

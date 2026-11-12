import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = file => JSON.parse(fs.readFileSync(file, "utf8"));
export const exactVersion = value => typeof value === "string" && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value);

export function validateInventory(manifest, canonical, dependencies, lock) {
  assert.deepEqual(Object.keys(manifest).sort(), ["dependencies", "schemaVersion"]);
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(Array.isArray(manifest.dependencies));
  const seen = new Set();
  const records = manifest.dependencies.map(entry => {
    assert.ok(entry && typeof entry.name === "string");
    assert.ok(!seen.has(entry.name), `Duplicate security inventory entry: ${entry.name}`);
    seen.add(entry.name);
    const vendor = canonical.get(entry.name);
    assert.ok(vendor, `Unknown/stale security inventory entry: ${entry.name}`);
    assert.ok(exactVersion(vendor.version), `Non-exact canonical version: ${entry.name}`);
    if (vendor.approvedVersion) assert.equal(vendor.version, vendor.approvedVersion, `Release-gate/vendor version drift: ${entry.name}`);
    const github = entry.name === "secure-metadata";
    assert.deepEqual(Object.keys(entry).sort(), github ? ["name", "repository", "source"] : ["name", "source"]);
    assert.equal(entry.source, github ? "github" : "npm");
    if (github) {
      assert.equal(entry.repository, "SecureToolsProject/Secure_Metadata");
      assert.equal(vendor.repository, entry.repository);
      assert.equal(vendor.tag, `v${vendor.version}`);
      assert.match(vendor.commit, /^[0-9a-f]{40}$/);
    }
    if (Object.hasOwn(dependencies, entry.name)) {
      assert.equal(dependencies[entry.name], vendor.version, `Runtime/manifest version drift: ${entry.name}`);
      assert.equal(lock.packages[`node_modules/${entry.name}`]?.version, vendor.version, `Lockfile/vendor drift: ${entry.name}`);
    }
    return { ...entry, ...vendor };
  });
  assert.deepEqual([...seen].sort(), [...canonical.keys()].sort(), "Every vendored runtime must be monitored");
  for (const name of Object.keys(dependencies)) assert.ok(seen.has(name), `Untracked runtime build input: ${name}`);
  return records;
}

export function loadInventory(root = repositoryRoot) {
  const canonical = new Map();
  const releasePins = json(path.join(root, "config/security/vendor-release-pins.json"));
  const vendorRoot = path.join(root, "assets/vendor");
  const add = (name, record) => {
    assert.ok(!canonical.has(name), `Duplicate canonical vendor ${name}`);
    canonical.set(name, record);
  };
  for (const directory of fs.readdirSync(vendorRoot, { withFileTypes: true })) {
    assert.ok(directory.isDirectory(), "Unexpected vendor root file");
    const base = path.join(vendorRoot, directory.name);
    const metadataFile = path.join(base, "package.json");
    const manifestFile = path.join(base, "manifest.json");
    if (fs.existsSync(metadataFile)) {
      const metadata = json(metadataFile);
      const approved = releasePins[directory.name];
      assert.ok(approved, `Vendor has no approved release pin: ${directory.name}`);
      assert.equal(metadata.name, approved.name, "Release-gate/vendor name drift");
      const record = { version: metadata.version, approvedVersion: approved.version, versionSource: path.relative(root, metadataFile).replaceAll("\\", "/") };
      if (metadata.name === "secure-metadata") {
        const provenance = fs.readFileSync(path.join(base, "README.md"), "utf8");
        record.repository = provenance.match(/Source repository: `([^`]+)`/)?.[1];
        record.tag = provenance.match(/Release tag: `([^`]+)`/)?.[1];
        record.commit = provenance.match(/Release commit: `([^`]+)`/)?.[1];
      }
      add(metadata.name, record);
    } else {
      assert.ok(fs.existsSync(manifestFile), `Vendor has no canonical package/manifest: ${directory.name}`);
      const aggregate = json(manifestFile);
      assert.ok(aggregate.packages && Object.keys(aggregate.packages).length > 0);
      for (const [name, version] of Object.entries(aggregate.packages)) {
        add(name, { version, versionSource: path.relative(root, manifestFile).replaceAll("\\", "/") });
      }
    }
  }
  // Versions are dereferenced, never copied into a second security version source.
  // Existing release/prepared-asset gates independently enforce approved pins/hashes.
  const manifest = json(path.join(root, "config/security/vendor-dependencies.json"));
  return validateInventory(manifest, canonical, json(path.join(root, "package.json")).dependencies, json(path.join(root, "package-lock.json")));
}

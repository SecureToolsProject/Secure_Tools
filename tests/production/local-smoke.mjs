import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// Run the existing complete browser gate against the built artifact, not production.
// CI-produced provenance remains required; do not relax the deployed schema.
assert.equal(process.env.GITHUB_ACTIONS, "true", "Clean artifact browser gate runs on GitHub CI");
assert.match(process.env.GITHUB_SHA || "", /^[0-9a-f]{40}$/);
const port = 43000 + Math.floor(Math.random() * 10000);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["tests/serve-ocr-smoke.mjs", String(port)], { stdio: ["ignore", "pipe", "inherit"] });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Artifact server startup timed out")), 10000);
    server.stdout.once("data", () => { clearTimeout(timer); resolve(); });
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", code => { clearTimeout(timer); reject(new Error(`Artifact server exited: ${code}`)); });
  });
  const runner = spawn(process.execPath, ["tests/production/smoke.mjs"], {
    stdio: "inherit",
    env: { ...process.env, PRODUCTION_ORIGIN: origin, IMMUTABLE_ORIGIN: origin, EXPECTED_PRODUCTION_SHA: process.env.GITHUB_SHA },
  });
  const code = await new Promise((resolve, reject) => { runner.once("error", reject); runner.once("exit", resolve); });
  assert.equal(code, 0, "Clean artifact HTTP/CSP/OCR/download browser gate");
} finally { server.kill(); }

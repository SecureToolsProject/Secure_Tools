import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("browser/evidence/exports/", import.meta.url));
const evidence = JSON.parse(fs.readFileSync(path.join(directory, "evidence.json"), "utf8"));
const state = label => {
  const item = evidence.find(item => item.label === label);
  assert.ok(item, `Missing real UI checkpoint: ${label}`);
  return item;
};
const expectedCounts = {
  "searchable-run-1": 1, "searchable-run-2": 2, "searchable-cancel": 2,
  "searchable-stale-A": 2, "searchable-active-B": 3,
  "pdf-txt-all": 4, "pdf-txt-selected": 5, "pdf-txt-cancel": 5,
  "pdf-txt-stale-A": 5, "pdf-txt-active-B": 6,
  "image-txt-run-1": 1, "image-txt-cancel": 1,
  "image-txt-replacement-ready": 1, "image-txt-active-B": 2,
  "image-late-checkpoint": 2, "image-final-cleanup": 2,
};
for (const [label, count] of Object.entries(expectedCounts)) {
  const item = state(label);
  assert.equal(item.audit.artifacts.length, count, `${label}: exact boundary invocation count`);
  assert.ok(item.audit.artifacts.every(artifact => artifact.state === "complete"));
  assert.deepEqual(item.audit.errors, []);
  assert.deepEqual(item.audit.violations, []);
  assert.equal(new Set(item.audit.artifacts.map(artifact => artifact.action.sequence)).size, count, `${label}: one artifact per explicit action`);
}
for (const label of ["pdf-txt-cancel", "pdf-txt-stale-A", "image-txt-cancel", "image-txt-replacement-ready"]) {
  assert.equal(state(label).resultVisible, false, `${label}: stale results unavailable`);
  assert.equal(state(label).resultVisible && state(label).exportEnabled, false, `${label}: no visible enabled stale export action`);
}
for (const label of ["searchable-cancel", "searchable-stale-A"]) {
  assert.equal(state(label).audit.objectUrls.length, state("searchable-run-2").audit.objectUrls.length, `${label}: cancelled/stale job never creates a download URL`);
  assert.ok(!state(label).status.startsWith("Downloaded"));
}
const pdf = state("pdf-txt-active-B").audit;
const image = state("image-txt-active-B").audit;
assert.equal(state("image-final-cleanup").audit.objectUrls.filter(url => !url.revoked).length, 0, "Final removal releases the preview as well as every export URL");
assert.deepEqual(pdf.artifacts.map(artifact => artifact.action.sequence), [1, 2, 5, 6, 7, 8], "Cancelled/superseded searchable actions 3/4 emit nothing, even at the later checkpoint");
assert.ok(!pdf.artifacts.some(artifact => artifact.source === "pdf-mixed-5.pdf"));
const english = "HELLO SEARCHABLE PDF";
const korean = "검색 가능한 PDF";
const mixed = "HELLO 검색 PDF";
const lines = `${english}\n${korean}\n${mixed}`;
const expectedTxt = new Map([
  ["pdf-to-text-4-pdf-mixed-2.txt", `--- Page 1 ---\n${lines}\n\n--- Page 2 ---\n${lines}\n`],
  ["pdf-to-text-5-pdf-mixed-2.txt", `--- Page 2 ---\n${lines}\n`],
  ["pdf-to-text-6-pdf-eng-1.txt", `--- Page 1 ---\n${english}\n`],
  ["image-to-text-1-image-mixed.txt", `${lines}\n`],
  ["image-to-text-2-image-eng.txt", `${english}\n`],
]);
const verified = [];
for (const audit of [pdf, image]) {
  for (const artifact of audit.artifacts) {
    assert.ok(artifact.action && ["download-result", "download-searchable"].includes(artifact.action.id), "Actual visible export action recorded");
    assert.equal(artifact.action.source, artifact.source);
    assert.ok(!/[\\/:*?"<>|\u0000-\u001f]/.test(artifact.filename), "Safe source-derived filename");
    const file = path.join(directory, artifact.savedFile);
    assert.equal(path.dirname(file), directory.replace(/[\\/]$/, ""));
    const bytes = fs.readFileSync(file);
    assert.ok(bytes.length > 0);
    assert.equal(bytes.length, artifact.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), artifact.sha256, "Captured boundary bytes preserved exactly");
    const url = audit.objectUrls.find(url => url.url === artifact.href);
    assert.ok(url && url.revoked);
    assert.ok(url.createdAt <= artifact.consumedAt && artifact.consumedAt <= artifact.capturedAt && artifact.capturedAt < url.revokedAt, "Creation/click/capture precede eventual revocation");
    assert.ok(url.revokedAt - artifact.consumedAt >= 1400, "Normal 1.5-second lifecycle retained");
    if (artifact.filename.endsWith(".txt")) {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      assert.equal(text, expectedTxt.get(artifact.savedFile), "Exact UTF-8 content, page boundaries/order, and no extra/private metadata");
      assert.equal(artifact.type, "text/plain;charset=utf-8");
    } else {
      const phrases = artifact.sequence === 3 ? [english] : [english, korean, mixed];
      const result = spawnSync(process.execPath, ["tests/verify-hardening-download.mjs", file, "1", ...phrases], { encoding: "utf8" });
      assert.equal(result.status, 0, `${artifact.filename}: PDF.js/pdf-lib/extraction failed: ${result.stdout} ${result.stderr}`);
    }
    verified.push({ filename: artifact.filename, savedFile: artifact.savedFile, bytes: bytes.length, sha256: artifact.sha256 });
  }
  assert.equal(audit.objectUrls.filter(url => audit.downloads.some(download => download.href === url.url) && !url.revoked).length, 0, "No live export URLs accumulate");
}
console.log(JSON.stringify({ captureLevel: "B", verifiedArtifacts: verified, repeatCount: 2, cancelledArtifacts: 0, staleArtifacts: 0, exactUtf8: true, objectUrlLifecycle: "passed" }, null, 2));

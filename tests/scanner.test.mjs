import assert from "node:assert/strict";
import { File } from "node:buffer";
import { createScanQueue, MAX_SCAN_PAGES } from "../.ts-build/tools/scan/document/state.js";
import { createScanPreview, preprocessScanPixels } from "../.ts-build/tools/shared/scan.js";
import { decodeImage } from "../tools/shared/image.js";

const pixels = new Uint8ClampedArray([240, 200, 180, 255, 20, 50, 80, 255]);
const original = pixels.slice();
assert.deepEqual(preprocessScanPixels(pixels, "original"), original);
assert.deepEqual(preprocessScanPixels(pixels, "grayscale"), new Uint8ClampedArray([210,210,210,255,44,44,44,255]));
assert.deepEqual(preprocessScanPixels(pixels, "document"), new Uint8ClampedArray([255,255,255,255,0,0,0,255]));
assert.deepEqual(pixels, original, "Preprocessing never mutates source pixels");
assert.throws(() => preprocessScanPixels(pixels, "invalid"), /SCAN_MODE_INVALID/);

const file = name => new File([Uint8Array.of(137,80,78,71,13,10,26,10,0,0,0,0)], name, { type: "image/png" });
const preview = async () => ({ blob: new Blob(["preview"]), width: 200, height: 400 });
const revoked = []; const created = []; const modes = [];
const config = {
  preview: async (file, mode) => { modes.push(mode); return preview(); },
  createUrl: () => { const url = `blob:test-${created.length}`; created.push(url); return url; },
  revokeUrl: url => revoked.push(url),
};
const queue = createScanQueue(config);
assert.equal((await queue.add([file("one.png"), file("two.png"), file("three.png")], "original")).added, 3);
const ids = queue.pages.map(page => page.id);
queue.move(ids[2], -1);
assert.deepEqual(queue.pages.map(page => page.file.name), ["one.png", "three.png", "two.png"]);
assert.equal(queue.move(ids[0], -1), false);
queue.remove(ids[2]);
assert.deepEqual(queue.pages.map(page => page.file.name), ["one.png", "two.png"]);
await queue.setMode("document");
assert.ok(queue.pages.every(page => page.mode === "document"));
assert.deepEqual(modes, ["original", "original", "original", "document", "document"]);
queue.clear(); assert.equal(queue.pages.length, 0);
assert.deepEqual([...revoked].sort(), [...created].sort(), "Every replaced/removed/cleared URL is revoked once");
const bad = await queue.add([new File(["text"], "bad.gif", { type: "image/gif" }), new File(["broken"], "broken.png", { type: "image/png" })], "original");
assert.equal(bad.added, 0); assert.equal(bad.rejected.length, 2);
assert.equal((await queue.add(Array.from({length: MAX_SCAN_PAGES + 1}, (_, i) => file(`${i}.png`)), "original")).rejected[0].code, "SCAN_QUEUE_LIMIT");
queue.clear();
const broken = createScanQueue({ ...config, preview: async () => { throw new Error("IMAGE_DECODE_FAILED"); } });
assert.equal((await broken.add([file("broken.png")], "original")).rejected[0].code, "IMAGE_DECODE_FAILED");
assert.equal(broken.busy, false);

// Delayed work cannot resurrect pages after clear/cancel/disposal or replacement.
for (const action of ["clear", "cancel", "dispose", "replace"]) {
  let release; let calls = 0;
  const delayed = createScanQueue({ ...config, preview: async () => ++calls === 1 ? new Promise(resolve => { release = resolve; }) : preview() });
  const pending = delayed.add([file("old.png")], "original");
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  if (action === "replace") await delayed.add([file("new.png")], "grayscale"); else delayed[action]();
  release(await preview());
  assert.equal((await pending).cancelled, true);
  assert.deepEqual(delayed.pages.map(page => page.file.name), action === "replace" ? ["new.png"] : []);
  delayed.dispose();
}

// Disposal of a page during a mode update cannot create a leaked preview URL.
let releaseMode;
const modeQueue = createScanQueue({ ...config, preview: async (file, mode) => mode === "original" ? preview() : new Promise(resolve => { releaseMode = resolve; }) });
await modeQueue.add([file("mode.png")], "original");
const change = modeQueue.setMode("grayscale");
modeQueue.remove(modeQueue.pages[0].id);
const before = created.length; releaseMode(await preview()); await change;
assert.equal(created.length, before);

// Canvas and decoded bitmap cleanup on success, failure and mid-decode abort.
for (const outcome of ["success", "encoder", "canvas", "abort"]) {
  let closed = 0; const abort = new AbortController();
  const canvas = { width: 0, height: 0, getContext: () => outcome === "canvas" ? null : ({ fillRect() {}, drawImage() {} }), toBlob(callback) { callback(outcome === "encoder" ? null : new Blob(["png"])); } };
  const options = { signal: abort.signal, canvasFactory: () => canvas, decode: async () => { if (outcome === "abort") abort.abort(); return { width: 4000, height: 6000, source: {}, close() { closed++; } }; } };
  if (outcome === "success") { const result = await createScanPreview(file("x.png"), "original", options); assert.equal(result.width, 667); assert.equal(result.height, 1000); }
  else await assert.rejects(createScanPreview(file("x.png"), "original", options));
  assert.equal(closed, 1);
  if (outcome !== "abort") assert.equal(canvas.width, 1);
}

// Shared decoder must explicitly request EXIF normalization and close bitmaps.
let bitmapOptions; let closed = false;
globalThis.window = { createImageBitmap: true };
globalThis.createImageBitmap = async (source, options) => { bitmapOptions = options; return { width: 30, height: 60, close() { closed = true; } }; };
const decoded = await decodeImage(file("oriented.png"));
assert.deepEqual(bitmapOptions, { imageOrientation: "from-image" });
decoded.close(); assert.equal(closed, true);
delete globalThis.window; delete globalThis.createImageBitmap;
queue.dispose(); modeQueue.dispose(); broken.dispose();
console.log("Scanner state, ordering, limits, pixels, invalid input, stale work, orientation contract and cleanup passed.");

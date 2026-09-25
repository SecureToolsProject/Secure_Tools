import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createWorker } = require("tesseract.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function createTextBmp(text) {
  const glyphs = {
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  };
  const scale = 14;
  const margin = 42;
  const gap = 18;
  const width = margin * 2 + text.length * 5 * scale + (text.length - 1) * gap;
  const height = margin * 2 + 7 * scale;
  const rowBytes = Math.ceil((width * 3) / 4) * 4;
  const pixels = Buffer.alloc(rowBytes * height, 0xff);

  for (let characterIndex = 0; characterIndex < text.length; characterIndex += 1) {
    const glyph = glyphs[text[characterIndex]];
    const originX = margin + characterIndex * (5 * scale + gap);
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") continue;
        for (let y = 0; y < scale; y += 1) {
          for (let x = 0; x < scale; x += 1) {
            const pixelX = originX + column * scale + x;
            const pixelY = margin + row * scale + y;
            const bottomUpRow = height - 1 - pixelY;
            const offset = bottomUpRow * rowBytes + pixelX * 3;
            pixels[offset] = 0;
            pixels[offset + 1] = 0;
            pixels[offset + 2] = 0;
          }
        }
      }
    }
  }

  const header = Buffer.alloc(54);
  header.write("BM", 0, "ascii");
  header.writeUInt32LE(header.length + pixels.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixels.length, 34);
  header.writeInt32LE(2835, 38);
  header.writeInt32LE(2835, 42);
  return Buffer.concat([header, pixels]);
}

async function recognize(language, image) {
  const progress = [];
  const worker = await createWorker(language, 1, {
    langPath: path.join(root, "assets", "vendor", "tesseract", "lang"),
    cacheMethod: "none",
    logger(message) { progress.push(message.status); },
  });

  try {
    const result = await worker.recognize(image);
    return { text: result.data.text.replace(/\s+/g, " ").trim(), progress };
  } finally {
    await worker.terminate();
  }
}

const english = await recognize("eng", createTextBmp("HELLO"));
assert.match(english.text, /HELLO/i);
assert.ok(english.progress.includes("loading tesseract core"));
assert.ok(english.progress.includes("loading language traineddata"));
assert.ok(english.progress.includes("recognizing text"));

const multilingualFixture = Buffer.from(
  fs.readFileSync(path.join(root, "tests", "fixtures", "ocr-korean-english.png.b64"), "utf8").trim(),
  "base64",
);
const korean = await recognize("kor", multilingualFixture);
assert.match(korean.text, /한글/);
const combined = await recognize("eng+kor", multilingualFixture);
assert.match(combined.text, /한글/);
assert.match(combined.text, /HELLO/i);

console.log("Real local English, Korean, and combined OCR smoke tests passed.");

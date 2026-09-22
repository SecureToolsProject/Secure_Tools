import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = path.join(root, "assets", "vendor", "tesseract");
const checkOnly = process.argv.includes("--check");

const assets = [
  ["node_modules/tesseract.js/dist/tesseract.min.js", "engine/tesseract.min.js"],
  ["node_modules/tesseract.js/dist/tesseract.min.js.LICENSE.txt", "engine/tesseract.min.js.LICENSE.txt"],
  ["node_modules/tesseract.js/dist/worker.min.js", "worker/worker.min.js"],
  ["node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt", "worker/worker.min.js.LICENSE.txt"],
  ["node_modules/tesseract.js/LICENSE.md", "licenses/Apache-2.0.txt"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"],
  ["node_modules/@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz", "lang/kor.traineddata.gz"],
];

const coreRoot = path.join(root, "node_modules", "tesseract.js-core");
for (const name of fs.readdirSync(coreRoot).filter((name) => /^tesseract-core.*\.(?:js|wasm)$/.test(name)).sort()) {
  assets.push([`node_modules/tesseract.js-core/${name}`, `core/${name}`]);
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const manifest = {
  generatedBy: "npm run prepare:ocr",
  packages: {
    "@tesseract.js-data/eng": "1.0.0",
    "@tesseract.js-data/kor": "1.0.0",
    "tesseract.js": "7.0.0",
    "tesseract.js-core": "7.0.0",
  },
  assets: {},
};

for (const [sourceRelative, destinationRelative] of assets) {
  const source = path.join(root, sourceRelative);
  const destination = path.join(vendorRoot, destinationRelative);
  if (!fs.existsSync(source)) throw new Error(`Missing installed OCR source asset: ${sourceRelative}`);
  manifest.assets[destinationRelative.replaceAll("\\", "/")] = {
    bytes: fs.statSync(source).size,
    sha256: sha256(source),
  };

  if (checkOnly) {
    if (!fs.existsSync(destination)) throw new Error(`Missing prepared OCR asset: ${destinationRelative}`);
    if (sha256(destination) !== sha256(source)) throw new Error(`Stale prepared OCR asset: ${destinationRelative}`);
  } else {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

const manifestPath = path.join(vendorRoot, "manifest.json");
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
if (checkOnly) {
  if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, "utf8") !== manifestText) {
    throw new Error("OCR asset manifest is missing or stale. Run npm run prepare:ocr.");
  }
} else {
  fs.mkdirSync(vendorRoot, { recursive: true });
  fs.writeFileSync(manifestPath, manifestText);
}

console.log(checkOnly ? "Prepared OCR assets match pinned packages." : "Prepared pinned OCR assets.");

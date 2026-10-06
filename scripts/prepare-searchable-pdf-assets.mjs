import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destinationRoot = path.join(root, "assets", "vendor", "searchable-pdf");
const checkOnly = process.argv.includes("--check");
const assets = [
  ["node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js", "fontkit.umd.min.js"],
  ["node_modules/@fontsource/noto-sans-kr/LICENSE", "NotoSansKR-OFL-1.1.txt"],
];
const digest = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const manifest = { generatedBy: "npm run prepare:ocr", packages: { "@pdf-lib/fontkit": "1.1.1", "@fontsource/noto-sans-kr": "5.3.0" }, assets: {} };
for (const [sourceRelative, destinationRelative] of assets) {
  const source = path.join(root, sourceRelative); const destination = path.join(destinationRoot, destinationRelative);
  if (!fs.existsSync(source)) throw new Error(`Missing searchable PDF source asset: ${sourceRelative}`);
  manifest.assets[destinationRelative] = { bytes: fs.statSync(source).size, sha256: digest(source) };
  if (checkOnly) {
    if (!fs.existsSync(destination) || digest(destination) !== digest(source)) throw new Error(`Missing or stale searchable PDF asset: ${destinationRelative}`);
  } else { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination); }
}
const fontSource = path.join(root, "node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff");
const fontDataRelative = "NotoSansKR-400.js";
const fontData = `globalThis.SecureToolsSearchablePdfFont = "${fs.readFileSync(fontSource).toString("base64")}";\n`;
manifest.assets[fontDataRelative] = { bytes: Buffer.byteLength(fontData), sha256: createHash("sha256").update(fontData).digest("hex") };
const fontDataPath = path.join(destinationRoot, fontDataRelative);
if (checkOnly) {
  if (!fs.existsSync(fontDataPath) || fs.readFileSync(fontDataPath, "utf8") !== fontData) throw new Error(`Missing or stale searchable PDF asset: ${fontDataRelative}`);
} else { fs.mkdirSync(destinationRoot, { recursive: true }); fs.writeFileSync(fontDataPath, fontData); }
const manifestPath = path.join(destinationRoot, "manifest.json");
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
if (checkOnly) {
  if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, "utf8") !== manifestText) throw new Error("Searchable PDF asset manifest is missing or stale. Run npm run prepare:ocr.");
} else { fs.mkdirSync(destinationRoot, { recursive: true }); fs.writeFileSync(manifestPath, manifestText); }
console.log(checkOnly ? "Prepared searchable PDF assets match pinned packages." : "Prepared pinned searchable PDF assets.");

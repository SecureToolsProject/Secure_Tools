import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingDirectory = path.join(root, ".ts-build", "tools", "shared");

fs.mkdirSync(stagingDirectory, { recursive: true });
for (const file of ["image.js", "ocr.js", "pdf.js", "save.js"]) {
  fs.copyFileSync(path.join(root, "tools", "shared", file), path.join(stagingDirectory, file));
}

fs.mkdirSync(path.join(root, ".ts-build/tools/pdf/images-to-pdf"), { recursive: true });
fs.copyFileSync(path.join(root, "tools/pdf/images-to-pdf/pdf.js"), path.join(root, ".ts-build/tools/pdf/images-to-pdf/pdf.js"));
fs.copyFileSync(path.join(root, "tools/shared/file.js"), path.join(stagingDirectory, "file.js"));

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalPages, legacyRedirects, redirectStatus } from "./site-routes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const directory of ["assets", "css", "js"]) {
  fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true });
}
fs.cpSync(path.join(root, "tools", "shared"), path.join(output, "shared"), { recursive: true });

for (const { source, route } of canonicalPages) {
  const destination = route === "/"
    ? path.join(output, "index.html")
    : path.join(output, route.slice(1), "index.html");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, source), destination);

  const sourceDirectory = path.dirname(path.join(root, source));
  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (entry.name === "index.html" || entry.isDirectory()) continue;
    fs.copyFileSync(path.join(sourceDirectory, entry.name), path.join(path.dirname(destination), entry.name));
  }
}

for (const file of ["404.html", "robots.txt", "sitemap.xml"]) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

const redirectFile = `${legacyRedirects.map(({ from, to }) => `${from} ${to} ${redirectStatus}`).join("\n")}\n`;
fs.writeFileSync(path.join(output, "_redirects"), redirectFile);

console.log(`Built ${canonicalPages.length} canonical pages and ${legacyRedirects.length} permanent redirects in dist/.`);

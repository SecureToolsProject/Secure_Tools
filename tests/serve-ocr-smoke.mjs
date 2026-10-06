import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { legacyRedirects, redirectStatus } from "../scripts/site-routes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(root, "dist");
const port = Number.parseInt(process.argv[2] || "4173", 10);
const audit = process.argv.includes("--audit");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gz", "application/gzip"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".pdf", "application/pdf"],
  [".ico", "image/x-icon"],
  [".wasm", "application/wasm"],
]);

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const redirect = legacyRedirects.find(({ from }) => from === pathname);
  if (redirect) {
    const target = new URL(redirect.to, "http://127.0.0.1");
    target.search = new URL(request.url, "http://127.0.0.1").search;
    response.writeHead(redirectStatus, { Location: `${target.pathname}${target.search}` }).end();
    return;
  }
  const requested = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const fileRoot = requested.startsWith("/tests/browser/") ? root : siteRoot;
  const target = path.resolve(fileRoot, `.${decodeURIComponent(requested)}`);
  if (!target.startsWith(`${fileRoot}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(target, (error, body) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Unavailable");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes.get(path.extname(target)) || "application/octet-stream",
    });
    const payload = audit && path.extname(target) === ".html" && fileRoot === siteRoot
      ? body.toString().replace("</head>", '<script defer src="/tests/browser/runtime-audit.js"></script></head>')
      : body;
    response.end(payload);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`OCR browser smoke: http://127.0.0.1:${port}/tests/browser/ocr-smoke.html`);
  console.log(`PDF OCR browser smoke: http://127.0.0.1:${port}/tests/browser/pdf-ocr-smoke.html`);
  console.log(`PDF to Text browser smoke: http://127.0.0.1:${port}/tests/browser/pdf-to-text-smoke.html`);
  console.log(`Image to Text UI QA: http://127.0.0.1:${port}/image/to-text/`);
});

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.argv[2] || "4173", 10);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gz", "application/gzip"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".wasm", "application/wasm"],
]);

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const requested = pathname === "/"
    ? "/tests/browser/ocr-smoke.html"
    : pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const target = path.resolve(root, `.${decodeURIComponent(requested)}`);
  if (!target.startsWith(`${root}${path.sep}`)) {
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
    response.end(body);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`OCR browser smoke: http://127.0.0.1:${port}/tests/browser/ocr-smoke.html`);
  console.log(`Image to Text UI QA: http://127.0.0.1:${port}/tools/image/to-text/`);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export const OCR_WORKER_PATH = "/assets/vendor/tesseract/worker/worker.min.js";
const requiredCsp = new Map([
  ["default-src", "'self'"], ["script-src", "'self'"], ["style-src", "'self'"],
  ["img-src", "'self' blob: data:"], ["font-src", "'self'"], ["worker-src", "'self'"],
  ["connect-src", "'none'"], ["object-src", "'none'"], ["frame-src", "'none'"],
  ["frame-ancestors", "'none'"], ["base-uri", "'self'"], ["form-action", "'self'"],
]);

// This intentionally supports only the small literal/splat policy used here.
// Unsupported syntax fails rather than silently simulating Pages incorrectly.
export function parsePagesHeaders(text) {
  const rules = [];
  let current;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      assert.ok(raw === "/*" || raw === OCR_WORKER_PATH || /^https:\/\/(?:secure-tools-web-bridge|:version\.secure-tools-web-bridge)\.pages\.dev\/\*$/.test(raw), `Unsupported Pages rule: ${raw}`);
      current = { pattern: raw, headers: new Map(), remove: [] };
      rules.push(current);
    } else {
      assert.ok(current, "Header requires a rule");
      const line = raw.trim();
      if (line === "! Content-Security-Policy") { current.remove.push("content-security-policy"); continue; }
      const match = line.match(/^([\w-]+):\s+(.+)$/);
      assert.ok(match, `Invalid header: ${line}`);
      const name = match[1].toLowerCase();
      assert.ok(!current.headers.has(name), `Duplicate header: ${name}`);
      current.headers.set(name, match[2]);
    }
  }
  return rules;
}

export function headersForUrl(rules, value) {
  const url = new URL(value);
  const headers = new Headers();
  for (const rule of rules) {
    const matches = rule.pattern === "/*" || rule.pattern === url.pathname
      || (rule.pattern === "https://secure-tools-web-bridge.pages.dev/*" && url.hostname === "secure-tools-web-bridge.pages.dev")
      || (rule.pattern === "https://:version.secure-tools-web-bridge.pages.dev/*" && /^[^.]+\.secure-tools-web-bridge\.pages\.dev$/.test(url.hostname));
    if (!matches) continue;
    for (const [name, value] of rule.headers) headers.append(name, value);
    for (const name of rule.remove) headers.delete(name);
  }
  return headers;
}

export function assertSecurityHeaders(headers, { ocrWorker = false } = {}) {
  assert.equal(headers.get("referrer-policy"), "no-referrer", "HTTP Referrer-Policy");
  const permissions = new Map();
  for (const part of (headers.get("permissions-policy") || "").split(",")) {
    const match = part.trim().match(/^([a-z-]+)=\(\)$/);
    assert.ok(match, "HTTP Permissions-Policy may contain only capability denials");
    assert.ok(!permissions.has(match[1]), "Duplicate permission directive");
    permissions.set(match[1], true);
  }
  for (const capability of ["camera", "microphone", "geolocation"]) assert.ok(permissions.has(capability), `HTTP Permissions-Policy must deny ${capability}`);
  assert.equal(headers.get("x-content-type-options"), "nosniff", "HTTP nosniff");
  const csp = headers.get("content-security-policy");
  if (ocrWorker) { assert.equal(csp, null, "Only Tesseract's entry preserves its existing worker policy"); return; }
  assert.ok(csp, "HTTP CSP is required");
  const directives = new Map();
  for (const part of csp.split(";").map(value => value.trim()).filter(Boolean)) {
    const [name, ...values] = part.split(/\s+/);
    assert.ok(!directives.has(name), `Duplicate CSP directive ${name}`);
    directives.set(name, values.join(" "));
  }
  assert.deepEqual(directives, requiredCsp, "HTTP CSP must preserve the reviewed local-only policy");
}

export function validateHostingHeaders(directory, { isolated = false } = {}) {
  const rules = parsePagesHeaders(fs.readFileSync(path.join(directory, "_headers"), "utf8"));
  assert.deepEqual(rules.map(rule => rule.pattern), ["/*", OCR_WORKER_PATH, "https://secure-tools-web-bridge.pages.dev/*", "https://:version.secure-tools-web-bridge.pages.dev/*"]);
  assert.deepEqual([...rules[0].headers.keys()], ["content-security-policy", "referrer-policy", "permissions-policy", "x-content-type-options"]);
  assert.deepEqual(rules[0].remove, []);
  assert.equal(rules[0].headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(rules[1].headers.size, 0);
  assert.deepEqual(rules[1].remove, ["content-security-policy"]);
  for (const rule of rules.slice(2)) {
    assert.deepEqual([...rule.headers], [["x-robots-tag", "noindex, nofollow"]]);
    assert.deepEqual(rule.remove, []);
  }
  for (const origin of ["https://tools.securetools.app", "https://secure-tools-web-bridge.pages.dev", "https://test.secure-tools-web-bridge.pages.dev"]) {
    for (const route of ["/", "/pdf/to-text/", "/build-info.json", "/assets/vendor/pdfjs/pdf.worker.min.mjs", OCR_WORKER_PATH]) {
      const headers = headersForUrl(rules, origin + route);
      assertSecurityHeaders(headers, { ocrWorker: route === OCR_WORKER_PATH });
      assert.equal(headers.get("x-robots-tag"), origin.includes("pages.dev") ? "noindex, nofollow" : null);
    }
  }
  if (isolated) assert.ok(!fs.existsSync(path.join(directory, "CNAME")), "Isolated Pages artifact must exclude CNAME");
  return rules;
}

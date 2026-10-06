// Opt-in test-server tracing. Preserve native calls; never ship this instrumentation.
(() => {
  const calls = [], errors = [], violations = [], downloads = [], jobs = [], statuses = [];
  const workers = new Set(), urls = new Map();
  let started = null;
  const absolute = (value) => { try { return new URL(String(value), location.href).href; } catch { return String(value); } };
  function record(api, value) { calls.push({ api, url: absolute(value), stack: new Error().stack }); publish(); }
  const fetchNative = window.fetch;
  window.fetch = function(input, ...args) { record("fetch", input instanceof Request ? input.url : input); return fetchNative.call(this, input, ...args); };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) { record(`XHR ${method}`, url); return open.call(this, method, url, ...args); };
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(url, ...args) {
      record("Worker", url); super(url, ...args); workers.add(this);
      this.addEventListener("message", event => {
        if (event.data?.secureToolsGateRequest) { calls.push(event.data.secureToolsGateRequest); event.stopImmediatePropagation(); publish(); }
      });
      publish();
    }
    terminate() { workers.delete(this); const result = super.terminate(); publish(); return result; }
  };
  for (const name of ["WebSocket", "EventSource"]) {
    const Native = window[name];
    window[name] = class extends Native { constructor(url, ...args) { record(name, url); super(url, ...args); } };
  }
  const beacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function(url, data) { record("sendBeacon", url); return beacon(url, data); };
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = function(blob) { const url = create(blob); urls.set(url, { bytes: blob.size, type: blob.type, revoked: false }); publish(); return url; };
  URL.revokeObjectURL = function(url) {
    const finish = () => { if (urls.has(url)) urls.get(url).revoked = true; revoke(url); publish(); };
    if (document.querySelector("#gate-retain-url")?.checked && urls.get(url)?.type === "application/pdf") { urls.get(url).diagnosticDelay = true; setTimeout(finish, 30000); publish(); return; }
    finish();
  };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() { if (this.download) downloads.push({ filename: this.download, href: this.href, bytes: urls.get(this.href)?.bytes ?? null, milliseconds: performance.now() }); publish(); return click.call(this); };
  window.addEventListener("error", (event) => { errors.push(event.message || "resource error"); publish(); });
  window.addEventListener("unhandledrejection", (event) => { errors.push(String(event.reason)); publish(); });
  document.addEventListener("securitypolicyviolation", (event) => { violations.push({ directive: event.violatedDirective, blockedURI: event.blockedURI }); publish(); });
  document.addEventListener("click", (event) => {
    if (["recognize", "download-searchable"].includes(event.target.closest("button")?.id)) started = { action: event.target.closest("button").id, time: performance.now() };
    if (event.target.closest("button")?.id === "cancel") calls.push({ api: "cancel-click", milliseconds: performance.now(), url: location.href });
  }, true);
  function publish() {
    const status = document.querySelector("#tool-status");
    if (status && statuses.at(-1)?.text !== status.textContent) statuses.push({ text: status.textContent, tone: status.dataset.tone, milliseconds: performance.now() });
    if (started && document.querySelector("#cancel")?.hidden && !document.querySelector("#recognize")?.disabled) {
      jobs.push({ action: started.action, milliseconds: Math.round(performance.now() - started.time), status: status?.textContent, tone: status?.dataset.tone }); started = null;
    }
    const resources = performance.getEntriesByType("resource").map(({ name, initiatorType, responseStatus }) => ({ url: name, origin: new URL(name).origin, initiatorType, responseStatus }));
    document.documentElement.dataset.gateAudit = JSON.stringify({ calls, resources, errors, violations, downloads, jobs, statuses, activeWorkers: workers.size, objectUrls: [...urls].map(([url, state]) => ({ url, ...state })), canvasesInDom: document.querySelectorAll("canvas").length });
  }
  new PerformanceObserver(publish).observe({ type: "resource", buffered: true });
  // Observe product UI only, avoiding a loop from the audit's own data attribute.
  window.addEventListener("DOMContentLoaded", () => { new MutationObserver(publish).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true }); publish(); });
  window.addEventListener("load", publish);
  publish();
})();

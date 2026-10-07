// Opt-in test-server tracing. Preserve native calls; never ship this instrumentation.
(() => {
  const calls = [], errors = [], violations = [], downloads = [], jobs = [], statuses = [];
  const workers = new Set(), urls = new Map();
  const blobs = new Map(), artifacts = [], exportActions = [];
  let activeExport = null;
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
  URL.createObjectURL = function(blob) { const url = create(blob); blobs.set(url, blob); urls.set(url, { bytes: blob.size, type: blob.type, revoked: false, createdAt: performance.now() }); publish(); return url; };
  URL.revokeObjectURL = function(url) {
    const finish = () => { if (urls.has(url)) Object.assign(urls.get(url), { revoked: true, revokedAt: performance.now() }); blobs.delete(url); revoke(url); publish(); };
    if (document.querySelector("#gate-retain-url")?.checked && urls.get(url)?.type === "application/pdf") { urls.get(url).diagnosticDelay = true; setTimeout(finish, 30000); publish(); return; }
    finish();
  };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() {
    if (this.download) {
      const consumedAt = performance.now(), blob = blobs.get(this.href);
      downloads.push({ filename: this.download, href: this.href, bytes: blob?.size ?? null, milliseconds: consumedAt });
      if (urls.has(this.href)) urls.get(this.href).consumedAt = consumedAt;
      if (blob) {
        const artifact = { sequence: artifacts.length + 1, filename: this.download, href: this.href, bytes: blob.size, type: blob.type, action: activeExport, source: document.querySelector("#source-name")?.textContent, route: location.pathname, state: "pending", consumedAt };
        artifacts.push(artifact);
        // Copy the immutable Blob at the real anchor boundary, before native revocation.
        blob.arrayBuffer().then(buffer => {
          const bytes = new Uint8Array(buffer); let binary = "";
          for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
          Object.assign(artifact, { base64: btoa(binary), state: "complete", capturedAt: performance.now() }); publish();
        }).catch(error => { artifact.state = "failed"; artifact.error = String(error); publish(); });
      }
    }
    publish(); return click.call(this);
  };
  window.addEventListener("error", (event) => { errors.push(event.message || "resource error"); publish(); });
  window.addEventListener("unhandledrejection", (event) => { errors.push(String(event.reason)); publish(); });
  document.addEventListener("securitypolicyviolation", (event) => { violations.push({ directive: event.violatedDirective, blockedURI: event.blockedURI }); publish(); });
  document.addEventListener("click", (event) => {
    const actionId = event.target.closest("button")?.id;
    if (["download-result", "download-searchable"].includes(actionId)) {
      activeExport = { sequence: exportActions.length + 1, id: actionId, source: document.querySelector("#source-name")?.textContent, milliseconds: performance.now() };
      exportActions.push(activeExport);
    }
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
    document.documentElement.dataset.gateAudit = JSON.stringify({ calls, resources, errors, violations, downloads, artifacts, exportActions, jobs, statuses, activeWorkers: workers.size, objectUrls: [...urls].map(([url, state]) => ({ url, ...state })), canvasesInDom: document.querySelectorAll("canvas").length });
    document.documentElement.dataset.gateCompletedArtifacts = String(artifacts.filter(artifact => artifact.state === "complete").length);
    document.documentElement.dataset.gateLiveExportUrls = String([...urls].filter(([url, state]) => downloads.some(download => download.href === url) && !state.revoked).length);
  }
  new PerformanceObserver(publish).observe({ type: "resource", buffered: true });
  // Observe product UI only, avoiding a loop from the audit's own data attribute.
  window.addEventListener("DOMContentLoaded", () => { new MutationObserver(publish).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true }); publish(); });
  window.addEventListener("load", publish);
  publish();
})();

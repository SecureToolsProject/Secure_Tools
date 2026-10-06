// Test-server prefix for the unchanged vendored worker entrypoints.
(() => {
  const record = (api, value) => self.postMessage({ secureToolsGateRequest: { api: `worker ${api}`, url: new URL(String(value), location.href).href, stack: new Error().stack } });
  const originalFetch = self.fetch;
  self.fetch = function(input, ...args) { record("fetch", input instanceof Request ? input.url : input); return originalFetch.call(this, input, ...args); };
  if (self.XMLHttpRequest) {
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) { record(`XHR ${method}`, url); return open.call(this, method, url, ...args); };
  }
  if (self.importScripts) {
    const original = self.importScripts;
    self.importScripts = function(...urls) { urls.forEach(url => record("importScripts", url)); return original.apply(this, urls); };
  }
})();

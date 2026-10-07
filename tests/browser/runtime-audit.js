// Opt-in test-server instrumentation; never included in production output.
const errors = [];
const violations = [];
window.addEventListener("error", (event) => { errors.push(event.message || "resource load error"); publish(); });
window.addEventListener("unhandledrejection", (event) => { errors.push(String(event.reason)); publish(); });
document.addEventListener("securitypolicyviolation", (event) => { violations.push({ directive: event.violatedDirective, blockedURI: event.blockedURI }); publish(); });
function publish() {
  const requests = performance.getEntriesByType("resource");
  document.documentElement.dataset.runtimeAudit = JSON.stringify({
    errors, violations,
    external: requests.filter((entry) => new URL(entry.name).origin !== location.origin).map((entry) => entry.name),
    failed: requests.filter((entry) => entry.responseStatus >= 400).map((entry) => ({ url: entry.name, status: entry.responseStatus })),
    requests: requests.map((entry) => entry.name),
  });
}
new PerformanceObserver(publish).observe({ type: "resource", buffered: true });
window.addEventListener("load", publish);
publish();

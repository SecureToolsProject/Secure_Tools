export async function auditContext(browser, origin, directory, result) {
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: "block" });
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(60000);
  const state = await context.storageState({ indexedDB: true });
  if (state.cookies.length || state.origins.length) throw new Error("New context must have empty storage.");
  result.isolation = { freshProcess: true, freshContext: true, extensions: 0, initialStorage: state, serviceWorkers: "blocked", downloads: true };
  result.requests = []; result.initiators = []; result.errors = []; result.workers = []; result.csp = []; result.responses = [];
  const responseTasks = [];
  context.on("request", request => {
    let frame = null; try { frame = request.frame().url(); } catch { /* Dedicated worker requests may lack a frame. */ }
    const url = request.url();
    let classification = "unknown";
    if (url.startsWith(`${origin}/`)) classification = "first-party";
    else if (url.startsWith(`blob:${origin}/`) || /^(?:data:|about:|chrome:)/.test(url)) classification = "browser-local";
    else if (new URL(url).hostname === "static.cloudflareinsights.com") classification = "site-analytics-prohibited";
    if (new URL(url).pathname === "/cdn-cgi/rum") classification = "site-analytics-prohibited";
    result.requests.push({ url, origin: new URL(url).origin, type: request.resourceType(), method: request.method(), frame, classification });
  });
  context.on("response", response => {
    if (response.status() >= 400) result.errors.push({ type: "http", url: response.url(), status: response.status() });
    if (/\/pdf\/to-text\/$|\/js\/i18n.js$|\/js\/locales\/pdf-to-text.js$/.test(response.url())) {
      result.responses.push({ url: response.url(), status: response.status(), headers: response.headers() });
    }
    if (response.request().resourceType() === "document") {
      responseTasks.push(response.text().then(html => {
        const beaconTag = html.match(/<script\b[^>]*cloudflareinsights[^>]*>/i)?.[0] || null;
        result.responses.push({ url: response.url(), navigationBody: true, beaconInResponse: /cloudflareinsights|beacon.min/.test(html), beaconTag, headers: response.headers() });
      }).catch(error => result.errors.push({ type: "response-capture", text: error.message })));
    }
  });
  await context.exposeBinding("recordCspViolation", (_, value) => result.csp.push(value));
  await context.addInitScript(() => document.addEventListener("securitypolicyviolation", event => {
    void window.recordCspViolation({ directive: event.effectiveDirective, blockedURI: event.blockedURI, sourceFile: event.sourceFile });
  }));
  const page = await context.newPage();
  page.on("console", message => { if (message.type() === "error") result.errors.push({ type: "console", text: message.text(), location: message.location() }); });
  page.on("pageerror", error => result.errors.push({ type: "page", text: error.message }));
  page.on("worker", worker => result.workers.push(worker.url()));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  cdp.on("Network.requestWillBeSent", event => result.initiators.push({ url: event.request.url, method: event.request.method, frameId: event.frameId, type: event.type, initiator: event.initiator }));
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  return {
    context, page,
    async finish(failed) {
      await Promise.all(responseTasks);
      result.finalStorage = await context.storageState({ indexedDB: true });
      if (failed) await context.tracing.stop({ path: `${directory}/trace-${new URL(origin).hostname}.zip` });
      else await context.tracing.stop();
      await context.close();
    },
  };
}

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { assertSecurityHeaders } from "../../scripts/http-security-headers.mjs";
import { translations } from "../../js/i18n.js";

const directory = ".ts-build/scanner-qa";
await fs.mkdir(directory, { recursive: true });
const port = 44000 + Math.floor(Math.random() * 9000);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["tests/serve-ocr-smoke.mjs", String(port)], { stdio: ["ignore", "pipe", "inherit"] });
const report = { cases: [], external: [], errors: [], headerErrors: [], status: "FAIL" };
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server timed out")), 10000);
    server.stdout.once("data", () => { clearTimeout(timer); resolve(); });
    server.once("error", reject);
  });
  browser = await chromium.launch();
  const maker = await browser.newPage();
  const images = await maker.evaluate(async () => {
    async function make(width, height, type) {
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const c = canvas.getContext("2d"); c.fillStyle = "white"; c.fillRect(0,0,width,height);
      c.fillStyle = "#e08050"; c.fillRect(0,0,width/2,height/2);
      c.fillStyle = "black"; c.font = "20px sans-serif"; c.fillText("Document 문서", 4, height - 10);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, type));
      const data = [...new Uint8Array(await blob.arrayBuffer())]; canvas.width = canvas.height = 1; return data;
    }
    return { png: await make(180, 300, "image/png"), jpeg: await make(60, 30, "image/jpeg"), webp: await make(300, 180, "image/webp"), large: await make(4000,3000,"image/jpeg") };
  });
  await maker.close();
  // EXIF APP1/TIFF orientation=6: a real JPEG that browsers must rotate 90°.
  const exif = Buffer.from([0xff,0xe1,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  const jpeg = Buffer.from(images.jpeg);
  const rotated = Buffer.concat([jpeg.subarray(0,2), exif, jpeg.subarray(2)]);
  const fixtures = [
    { name: "문서-portrait.png", mimeType: "image/png", buffer: Buffer.from(images.png) },
    { name: "landscape.webp", mimeType: "image/webp", buffer: Buffer.from(images.webp) },
    { name: "rotated-exif.jpg", mimeType: "image/jpeg", buffer: rotated },
  ];
  for (const language of ["en", "ko", "ja", "es", "de", "fr"]) {
    const context = await browser.newContext({ locale: language });
    await context.addInitScript(language => {
      localStorage.setItem("secure-tools-language", language);
      window.scanUrls = { created: [], revoked: [] };
      const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = create(blob); window.scanUrls.created.push(url); return url; };
      URL.revokeObjectURL = url => { window.scanUrls.revoked.push(url); revoke(url); };
      document.addEventListener("securitypolicyviolation", event => console.error(`CSP: ${event.effectiveDirective}`));
    }, language);
    context.on("request", request => { if (!request.url().startsWith(`${origin}/`) && !/^(blob:|data:|about:)/.test(request.url())) report.external.push(request.url()); });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
    const response = await page.goto(`${origin}/scan/document/`);
    assert.equal(response.status(), 200);
    // Check raw server headers; desktop browser middleware may append a second
    // Permissions-Policy value, exposed by Playwright with embedded newlines.
    try { assertSecurityHeaders((await fetch(`${origin}/scan/document/`)).headers); }
    catch (error) { report.headerErrors.push(error.message); }
    await page.setInputFiles("#file-input", fixtures);
    await page.waitForFunction(() => document.querySelectorAll(".scan-page").length === 3 && document.querySelector("#cancel-scan").hidden);
    assert.equal(await page.locator("#cancel-scan").isVisible(), false);
    assert.equal(await page.locator(".scan-page").nth(2).locator("p").innerText(), `30 × 60 · ${translations[language].documentScanner.original}`);
    // Deterministic preprocessing is applied to real encoded thumbnails.
    await page.selectOption("#scan-mode", "grayscale"); await page.click("#apply-mode");
    await page.waitForFunction(() => document.querySelector("#cancel-scan").hidden);
    const grayscale = await page.locator(".scan-page img").first().evaluate(async image => {
      await image.decode(); const c = document.createElement("canvas"); c.width = image.naturalWidth; c.height = image.naturalHeight;
      const ctx = c.getContext("2d"); ctx.drawImage(image,0,0); const data = ctx.getImageData(0,0,c.width,c.height).data;
      return Array.from({length:data.length/4}, (_,i) => data[i*4] === data[i*4+1] && data[i*4] === data[i*4+2]).every(Boolean);
    });
    assert.equal(grayscale, true);
    await page.selectOption("#scan-mode", "document"); await page.click("#apply-mode");
    await page.waitForFunction(() => document.querySelector("#cancel-scan").hidden);
    assert.ok((await page.locator(".scan-page p").allTextContents()).every(text => text.endsWith(translations[language].documentScanner.document)));
    const firstId = await page.locator(".scan-page").first().getAttribute("data-id");
    await page.locator(".scan-page").first().locator('[data-action="down"]').focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator(".scan-page").nth(1).getAttribute("data-id"), firstId);
    assert.ok(await page.locator(".scan-page").nth(1).evaluate(card => card.contains(document.activeElement)));
    for (const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1280,900]]) {
      await page.setViewportSize({width,height});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${language} ${width}: no horizontal overflow`);
      for (const button of await page.locator(".scan-page-actions button").all()) assert.ok((await button.boundingBox()).height >= 44);
      if (language === "ko" && width === 320) await page.screenshot({ path: `${directory}/mobile-ko.png`, fullPage: true });
      if (language === "en" && width === 1280) await page.screenshot({ path: `${directory}/desktop-en.png`, fullPage: true });
      report.cases.push({ language, width, height, pages: 3 });
    }
    await page.locator(".scan-page").first().locator('[data-action="remove"]').click();
    assert.equal(await page.locator(".scan-page").count(), 2);
    await page.click("#clear-images"); assert.equal(await page.locator(".scan-page").count(), 0);
    assert.ok(await page.locator("#add-images").evaluate(el => el === document.activeElement));
    const urls = await page.evaluate(() => window.scanUrls);
    assert.deepEqual([...urls.created].sort(), [...urls.revoked].sort(), "All successful previews are released after clear");
    if (language === "en") {
      await page.setInputFiles("#file-input", [{ name:"broken.png", mimeType:"image/png", buffer:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]) }, {name:"bad.gif",mimeType:"image/gif",buffer:Buffer.from("gif")}]);
      await page.waitForFunction(() => document.querySelector("#cancel-scan").hidden && document.querySelector("#tool-status").textContent.includes("Could not add"));
      assert.equal(await page.locator(".scan-page").count(), 0);
      // Actual drag/drop and paste events exercise the UI's file paths.
      for (const type of ["drop", "paste"]) {
        await page.evaluate(({type, bytes}) => {
          const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)], `${type}.png`, {type:"image/png"}));
          if (type === "drop") document.querySelector("#drop-zone").dispatchEvent(new DragEvent("drop", {bubbles:true,cancelable:true,dataTransfer:transfer}));
          else document.dispatchEvent(new ClipboardEvent("paste", {bubbles:true,cancelable:true,clipboardData:transfer}));
        }, {type, bytes:images.png});
        await page.waitForFunction(count => document.querySelectorAll(".scan-page").length === count && document.querySelector("#cancel-scan").hidden, type === "drop" ? 1 : 2);
      }
      await page.setInputFiles("#file-input", [1,2].map(index => ({name:`large-${index}.jpg`,mimeType:"image/jpeg",buffer:Buffer.from(images.large)})));
      await page.waitForFunction(() => document.querySelectorAll(".scan-page").length === 4 && document.querySelector("#cancel-scan").hidden);
      assert.ok(await page.locator(".scan-page img").evaluateAll(async images => { await Promise.all(images.map(image => image.decode())); return images.every(image => Math.max(image.naturalWidth,image.naturalHeight) <= 1000); }));
      // Trigger large input and clear synchronously before decode may finish.
      await page.evaluate(bytes => {
        const transfer = new DataTransfer(); for(let i=0;i<5;i++) transfer.items.add(new File([new Uint8Array(bytes)], `stale-${i}.jpg`, {type:"image/jpeg"}));
        document.querySelector("#drop-zone").dispatchEvent(new DragEvent("drop", {bubbles:true,cancelable:true,dataTransfer:transfer}));
        document.querySelector("#clear-images").click();
      }, images.large);
      await page.waitForTimeout(300);
      assert.equal(await page.locator(".scan-page").count(), 0);
      const finalUrls = await page.evaluate(() => window.scanUrls);
      assert.deepEqual([...finalUrls.created].sort(), [...finalUrls.revoked].sort());
    }
    await context.close();
  }
  assert.deepEqual(report.headerErrors, []);
  assert.deepEqual(report.external, []); assert.deepEqual(report.errors, []);
  report.status = "PASS";
  console.log("Scanner browser smoke passed: 30 viewport/locale cases; JPEG/PNG/WebP; EXIF; modes; keyboard order; input/drop/paste; large images; cleanup; CSP/network.");
} finally {
  await fs.writeFile(`${directory}/report.json`, JSON.stringify(report,null,2));
  await browser?.close(); server.kill();
}

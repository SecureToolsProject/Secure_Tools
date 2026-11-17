import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { assertSecurityHeaders } from "../../scripts/http-security-headers.mjs";
import { translations } from "../../js/i18n.js";
const { PDFDocument, PDFName } = createRequire(import.meta.url)("../../assets/vendor/pdf-lib/pdf-lib.min.js");
const directory = ".ts-build/scanner-pdf-qa";
await fs.mkdir(directory,{recursive:true});
const port=45000+Math.floor(Math.random()*8000);const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,["tests/serve-ocr-smoke.mjs",String(port)],{stdio:["ignore","pipe","inherit"]});
const report={cases:[],artifacts:[],external:[],mutating:[],errors:[],headerErrors:[],status:"FAIL"};
let browser;
try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Server timeout")),10000);server.stdout.once("data",()=>{clearTimeout(timer);resolve();});server.once("error",reject);});
  browser=await chromium.launch();const maker=await browser.newPage();
  const images=await maker.evaluate(async()=>{
    async function make(w,h,type="image/png") {const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const c=canvas.getContext("2d");c.fillStyle="rgb(200,200,200)";c.fillRect(0,0,w,h);c.fillStyle="rgb(220,40,20)";c.fillRect(0,0,w/2,h);const blob=await new Promise(resolve=>canvas.toBlob(resolve,type));const data=[...new Uint8Array(await blob.arrayBuffer())];canvas.width=canvas.height=1;return data;}
    return {landscape:await make(2000,1200),portrait:await make(1200,2000),rotated:await make(60,30,"image/jpeg"),oversized:await make(4000,3001)};
  });await maker.close();
  const jpeg=Buffer.from(images.rotated);const exif=Buffer.from([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  const rotated=Buffer.concat([jpeg.subarray(0,2),exif,jpeg.subarray(2)]);
  for (const language of ["en","ko"]) {
    const copy=translations[language].documentScanner;
    const context=await browser.newContext({locale:language,acceptDownloads:true});
    await context.addInitScript(language=>{localStorage.setItem("secure-tools-language",language);window.pdfAudit={created:[],revoked:[],workers:0,terminated:0};window.Worker=class extends Worker{constructor(...args){super(...args);window.pdfAudit.workers++;}terminate(){window.pdfAudit.terminated++;return super.terminate();}};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);window.pdfAudit.created.push(url);return url;};URL.revokeObjectURL=url=>{window.pdfAudit.revoked.push(url);revoke(url);};document.addEventListener("securitypolicyviolation",event=>console.error(`CSP: ${event.effectiveDirective}`));},language);
    context.on("request",request=>{if(!request.url().startsWith(origin+"/")&&!/^(blob:|data:|about:)/.test(request.url()))report.external.push(request.url());if(!["GET","HEAD"].includes(request.method()))report.mutating.push(request.url());});
    const page=await context.newPage();page.on("pageerror",error=>report.errors.push(error.message));page.on("console",msg=>{if(msg.type()==="error")report.errors.push(msg.text());});let downloads=0;page.on("download",()=>downloads++);
    await page.goto(origin+"/scan/document/");
    try{assertSecurityHeaders((await fetch(origin+"/scan/document/")).headers);}catch(error){report.headerErrors.push(error.message);}
    async function add(name,data,mode="original",mimeType="image/png") {await page.selectOption("#scan-mode",mode);await page.setInputFiles("#file-input",{name,mimeType,buffer:Buffer.from(data)});await page.waitForFunction(()=>document.querySelector("#cancel-scan").hidden);}
    await add("original.png",images.landscape);await add("gray.png",images.portrait,"grayscale");await add("document.png",images.landscape,"document");await add("exif.jpg",rotated,"original","image/jpeg");
    assert.equal(await page.locator(".scan-page").count(),4);
    await page.locator(".scan-page").first().locator('[data-action="down"]').focus();await page.keyboard.press("Enter");
    await page.locator("#create-pdf").focus();await page.keyboard.press("Enter");
    await page.waitForFunction(()=>!document.querySelector("#pdf-result").hidden&&document.querySelector("#pdf-preview").getAttribute("aria-busy")==="false");
    assert.ok(await page.locator("#create-pdf").evaluate(el=>el===document.activeElement));assert.equal(await page.locator("#cancel-pdf").isVisible(),false);
    for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1280,900]]) {await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok((await page.locator("#download-pdf").boundingBox()).height>=44);report.cases.push({language,width,height});if(width===320)await page.screenshot({path:`${directory}/${language}-mobile.png`,fullPage:true});}
    await page.click("#pdf-next");await page.waitForFunction(()=>document.querySelector("#pdf-preview").getAttribute("aria-busy")==="false");assert.equal(await page.locator("#pdf-page").innerText(),copy.pdfPage.replace("{page}","2").replace("{total}","4"));
    const downloadPromise=page.waitForEvent("download");await page.click("#download-pdf");const download=await downloadPromise;assert.equal(download.suggestedFilename(),"scanned-document.pdf");const path=`${directory}/${language}-scanned.pdf`;await download.saveAs(path);const bytes=await fs.readFile(path);
    const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),4);
    assert.deepEqual(pdf.getPages().map(p=>p.getWidth()>p.getHeight()),[false,true,true,false],"Order and EXIF orientation match current scanner pages");
    const sizes=[];const objects=pdf.getPages()[0].node.Resources().lookup(PDFName.of("XObject"));for(const name of objects.keys()){const image=objects.lookup(name);if(image.dict.get(PDFName.of("Subtype"))?.toString()==="/Image")sizes.push([image.dict.get(PDFName.of("Width")).asNumber(),image.dict.get(PDFName.of("Height")).asNumber()]);}
    assert.ok(sizes.some(([w,h])=>w===2000&&h===1200));assert.ok(sizes.some(([w,h])=>w===1200&&h===2000));assert.ok(sizes.some(([w,h])=>w===30&&h===60));
    const samples=await page.evaluate(async bytes=>{const lib=await import("/assets/vendor/pdfjs/pdf.min.mjs");const task=lib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,useWasm:false});try{const pdf=await task.promise;const samples=[];for(let i=1;i<=3;i++){const page=await pdf.getPage(i);const viewport=page.getViewport({scale:1});const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const c=canvas.getContext("2d");await page.render({canvasContext:c,viewport}).promise;samples.push([...c.getImageData(Math.floor(canvas.width*.25),Math.floor(canvas.height*.5),1,1).data].slice(0,3));canvas.width=canvas.height=1;page.cleanup();}return samples;}finally{await task.destroy();}},[...bytes]);
    assert.ok(samples[0].every(v=>Math.abs(v-92)<=2),`Grayscale exported: ${samples[0]}`);assert.ok(samples[1].every((v,i)=>Math.abs(v-[220,40,20][i])<=2));assert.deepEqual(samples[2],[0,0,0],"Document threshold is represented in actual PDF pixels");
    report.artifacts.push({language,bytes:bytes.length,pages:4,embeddedSizes:sizes,samples});
    await page.locator(".scan-page").first().locator('[data-action="down"]').click();assert.equal(await page.locator("#pdf-result").isVisible(),false);
    // Immediate cancellation and repeated creation must never expose stale output.
    await page.evaluate(()=>{document.querySelector("#create-pdf").click();document.querySelector("#cancel-pdf").click();});assert.equal(await page.locator("#pdf-result").isVisible(),false);assert.ok(await page.locator("#create-pdf").evaluate(el=>el===document.activeElement));
    await page.evaluate(()=>{document.querySelector("#create-pdf").click();document.querySelector(".scan-page [data-action='down']").click();});await page.waitForTimeout(100);assert.equal(await page.locator("#pdf-result").isVisible(),false);
    if(language==="en") {
      await page.evaluate(()=>{window.originalJsPDF=window.jspdf.jsPDF;window.jspdf.jsPDF=function(){throw Error("controlled writer failure");};});await page.click("#create-pdf");await page.waitForFunction(text=>document.querySelector("#tool-status").textContent===text,copy.pdfError);await page.evaluate(()=>{window.jspdf.jsPDF=window.originalJsPDF;delete window.originalJsPDF;});
      await page.click("#create-pdf");await page.waitForFunction(()=>!document.querySelector("#pdf-result").hidden&&document.querySelector("#pdf-preview").getAttribute("aria-busy")==="false");
      await page.selectOption("#scan-mode","grayscale");await page.click("#apply-mode");assert.equal(await page.locator("#pdf-result").isVisible(),false);await page.waitForFunction(()=>document.querySelector("#cancel-scan").hidden);
      await page.click("#clear-images");await add("over-budget.png",images.oversized);await page.click("#create-pdf");await page.waitForFunction(text=>document.querySelector("#tool-status").textContent===text,copy.pdfLimit);assert.equal(await page.locator("#pdf-result").isVisible(),false);
    }
    await page.click("#clear-images");await page.waitForTimeout(1600);assert.equal(downloads,1,"Only an explicit download emits an artifact");const audit=await page.evaluate(()=>window.pdfAudit);assert.deepEqual([...audit.created].sort(),[...audit.revoked].sort());assert.equal(audit.workers,audit.terminated,"PDF preview workers are terminated on reset");await context.close();
  }
  assert.deepEqual(report.headerErrors,[]);assert.deepEqual(report.external,[]);assert.deepEqual(report.mutating,[]);assert.deepEqual(report.errors,[]);report.status="PASS";
  console.log("Scanner PDF browser gate passed: real source-resolution PDF bytes, order, EXIF, modes, preview/download, cancellation/retry/invalidation, budgets, cleanup, responsive keyboard and privacy.");
}finally{await fs.writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));await browser?.close();server.kill();}

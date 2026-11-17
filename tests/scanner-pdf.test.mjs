import assert from "node:assert/strict";
import { File } from "node:buffer";
import { createRequire } from "node:module";
import { createScanPdf, createScanPdfController, SCAN_EXPORT_PAGE_PIXELS, SCAN_EXPORT_TOTAL_PIXELS, SCAN_EXPORT_BYTES } from "../.ts-build/tools/scan/document/pdf.js";
import { createPdfBlob } from "../tools/pdf/images-to-pdf/pdf.js";
import { renderScanImage } from "../.ts-build/tools/shared/scan.js";

const require = createRequire(import.meta.url);
const { jsPDF } = require("../assets/vendor/jspdf/jspdf.umd.min.js");
const { PDFDocument } = require("../assets/vendor/pdf-lib/pdf-lib.min.js");
const png = new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")], {type:"image/png"});
const file = name => new File([png], name, {type:"image/png"});
const pages = [{file:file("landscape.png"),mode:"document"},{file:file("portrait.png"),mode:"grayscale"},{file:file("original.png"),mode:"original"}];
const closed = []; const seen = []; const progress = [];
const decode = async f => ({source:f,width:f.name.startsWith("landscape")?2400:1200,height:f.name.startsWith("landscape")?1200:2400,close(){closed.push(f.name);}});
const raster = async (image,mode) => {seen.push([image.source.name,mode,image.width,image.height]);return {blob:png,width:image.width,height:image.height};};
const blob = await createScanPdf({pages,JsPDF:jsPDF,decode,raster,onProgress:(done,total)=>progress.push([done,total])});
const pdf = await PDFDocument.load(await blob.arrayBuffer());
assert.equal(pdf.getPageCount(),3);
assert.ok(pdf.getPages()[0].getWidth()>pdf.getPages()[0].getHeight());
assert.ok(pdf.getPages()[1].getWidth()<pdf.getPages()[1].getHeight());
assert.deepEqual(seen.map(row=>row.slice(0,2)),pages.map(page=>[page.file.name,page.mode]));
assert.deepEqual(closed,pages.map(page=>page.file.name));
assert.deepEqual(progress,[[1,3],[2,3],[3,3]]);
assert.ok(seen.every(row=>row[2]>1000),"Export decodes source dimensions, never preview URLs");
const base = {pages,JsPDF:jsPDF,decode,raster};
await assert.rejects(createScanPdf({...base,pages:[]}),error=>error.code==="NO_FILES");
await assert.rejects(createScanPdf({...base,JsPDF:null}),error=>error.code==="PDF_LIBRARY_UNAVAILABLE");
let oversizedClosed=0;
await assert.rejects(createScanPdf({...base,decode:async()=>({source:{},width:SCAN_EXPORT_PAGE_PIXELS+1,height:1,close(){oversizedClosed++;}})}),error=>error.code==="SCAN_EXPORT_LIMIT");
assert.equal(oversizedClosed,1);
let budgetClosed=0;
await assert.rejects(createScanPdf({...base,decode:async()=>({source:{},width:4000,height:3000,close(){budgetClosed++;}})}),error=>error.code==="SCAN_EXPORT_LIMIT");
assert.equal(budgetClosed,3); assert.equal(SCAN_EXPORT_TOTAL_PIXELS,24_000_000);
await assert.rejects(createScanPdf({...base,pages:Array(21).fill(pages[0])}),error=>error.code==="SCAN_EXPORT_LIMIT");
await assert.rejects(createScanPdf({...base,raster:async()=>({blob:new Blob([new Uint8Array(SCAN_EXPORT_BYTES+1)]),width:1,height:1})}),error=>error.code==="SCAN_EXPORT_LIMIT");

// Full-resolution strip preprocessing, including mid-strip cancellation/cleanup.
for (const mode of ["original","grayscale","document"]) {
  const widths=[];const stripes=[];const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(){},getImageData(x,y,w,h){widths.push(w);stripes.push(h);return {data:new Uint8ClampedArray(w*h*4).fill(200)};},putImageData(){}}),toBlob(callback){callback(png);}};
  const result=await renderScanImage({source:{},width:2400,height:1600,close(){}},mode,{canvasFactory:()=>canvas});
  assert.equal(result.width,2400);assert.equal(result.height,1600);assert.equal(canvas.width,1);
  assert.ok(stripes.every(height=>height<=64));assert.ok(widths.every(width=>width===2400));
}
const abort=new AbortController(); let cancelClosed=0;
const stripAbort=new AbortController();let strips=0;
const stripCanvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(){},getImageData(){if(++strips===2)stripAbort.abort();return {data:new Uint8ClampedArray(16)};},putImageData(){}})};
await assert.rejects(renderScanImage({source:{},width:2000,height:2000,close(){}},"document",{signal:stripAbort.signal,canvasFactory:()=>stripCanvas}),error=>error.name==="AbortError");
assert.equal(stripCanvas.width,1,"Cancelled preprocessing releases the full-size canvas");
await assert.rejects(createPdfBlob({files:[file("cancel.png")],JsPDF:jsPDF,options:{pageSize:"a4",orientation:"auto",margin:10},signal:abort.signal,decode:async()=>({source:{},width:10,height:20,close(){cancelClosed++;}}),convert:async()=>{abort.abort();return new Uint8Array(await png.arrayBuffer());}}),error=>error.name==="AbortError");
assert.equal(cancelClosed,1);

// A writer that ignores abort must still never publish a stale/cancelled result.
let release;let calls=0;
const controller=createScanPdfController(async()=>{calls++;return new Promise(resolve=>{release=resolve;});});
const old=controller.create(pages);while(!release)await new Promise(resolve=>setTimeout(resolve,0));
const next=controller.create(pages.slice(0,1));assert.equal(calls,1,"Writers are serialized");
release(blob);assert.equal(await old,null);
while(calls<2)await new Promise(resolve=>setTimeout(resolve,0));release(blob);assert.equal(await next,blob);assert.equal(controller.result,blob);
controller.invalidate();assert.equal(controller.result,null);
let fail=true;
const retry=createScanPdfController(async()=>{if(fail)throw new Error("writer failed");return blob;});
await assert.rejects(retry.create(pages));assert.equal(retry.busy,false);fail=false;assert.equal(await retry.create(pages),blob);
console.log("Scanner PDF composition, order/modes, full-resolution raster, page fit, budgets, cancellation, stale output and retry passed.");

import fs from "node:fs";
// Use the same realm as Node arrays; the vendored library checks instanceof.
new Function(fs.readFileSync("assets/vendor/pdf-lib/pdf-lib.min.js", "utf8"))();
export const PDFLib = globalThis.PDFLib;

export async function createFixtures(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const rasterImages = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 960; canvas.height = 300;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "white"; ctx.fillRect(0, 0, 960, 300);
    ctx.fillStyle = "black"; ctx.font = "50px Arial"; ctx.fillText("HELLO SEARCHABLE PDF", 50, 160);
    const english = canvas.toDataURL("image/png").split(",")[1];
    canvas.height = 6400; ctx.fillStyle = "white"; ctx.fillRect(0, 0, 960, 6400);
    ctx.fillStyle = "black"; ctx.font = "50px Arial";
    for (let y = 80; y < 6350; y += 70) ctx.fillText("HELLO SEARCHABLE PDF", 50, y);
    return { english, long: canvas.toDataURL("image/png").split(",")[1] };
  });
  const english = Buffer.from(rasterImages.english, "base64");
  await context.close();
  const mixed = Buffer.from(fs.readFileSync("tests/fixtures/ocr-korean-english.png.b64", "utf8").trim(), "base64");
  async function pdf(images, existing = false) {
    const document = await PDFLib.PDFDocument.create();
    document.setCreationDate(new Date("2026-01-01T00:00:00Z")); document.setModificationDate(new Date("2026-01-01T00:00:00Z"));
    for (const bytes of images) {
      const image = await document.embedPng(new Uint8Array(bytes));
      // OCR render scale is 2: preserve the original deterministic raster pixels.
      const p = document.addPage([image.width / 2, image.height / 2]);
      if (existing) p.drawText("EXISTING SELECTABLE TEXT", { x: 20, y: 50, size: 14 });
      else p.drawImage(image, { x: 0, y: 0, width: image.width / 2, height: image.height / 2 });
    }
    return Buffer.from(await document.save());
  }
  return {
    mixed: { name: "production-mixed.png", mimeType: "image/png", buffer: mixed },
    english: { name: "production-english.png", mimeType: "image/png", buffer: english },
    imageLong: { name: "production-long.png", mimeType: "image/png", buffer: Buffer.from(rasterImages.long, "base64") },
    two: { name: "production-two.pdf", mimeType: "application/pdf", buffer: await pdf([english, mixed]) },
    replacement: { name: "production-replacement.pdf", mimeType: "application/pdf", buffer: await pdf([english]) },
    long: { name: "production-long.pdf", mimeType: "application/pdf", buffer: await pdf(Array(26).fill(mixed)) },
    existing: { name: "production-existing.pdf", mimeType: "application/pdf", buffer: await pdf([english], true) },
  };
}

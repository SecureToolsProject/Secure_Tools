import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { File } from "node:buffer";
import fs from "node:fs";

import { isSupportedImage } from "../tools/pdf/images-to-pdf/image.js";
import {
  createPdfBlob,
  getImagePlacement,
  getPageDimensions,
  sanitizeFilename,
} from "../tools/pdf/images-to-pdf/pdf.js";
import { en } from "../js/locales/en.js";
import { ko } from "../js/locales/ko.js";

const require = createRequire(import.meta.url);

function testSupportedInputs() {
  const jpeg = new File(["jpeg"], "one.jpg", { type: "image/jpeg" });
  const png = new File(["png"], "two.png", { type: "image/png" });
  const webp = new File(["webp"], "three.webp", { type: "image/webp" });
  const gif = new File(["gif"], "animated.gif", { type: "image/gif" });
  const unknown = new File(["text"], "notes.txt", { type: "text/plain" });

  assert.equal(isSupportedImage(jpeg), true);
  assert.equal(isSupportedImage(png), true);
  assert.equal(isSupportedImage(webp), true);
  assert.equal([jpeg, png, webp].filter(isSupportedImage).length, 3);
  assert.equal(isSupportedImage(gif), false);
  assert.equal(isSupportedImage(unknown), false);
}

function testOptions() {
  assert.equal(sanitizeFilename(" family/photos:* "), "family_photos_.pdf");
  assert.equal(sanitizeFilename("ready.PDF"), "ready.PDF");
  assert.equal(sanitizeFilename("   "), "converted-images.pdf");
  assert.deepEqual(getPageDimensions("a4", "auto", { width: 1600, height: 900 }), [297, 210]);
  assert.deepEqual(getPageDimensions("letter", "portrait", { width: 1600, height: 900 }), [215.9, 279.4]);

  const contain = getImagePlacement({ width: 1600, height: 900 }, 210, 297, 10, false);
  assert(contain.width <= 190.001 && contain.height <= 277.001);
  const cover = getImagePlacement({ width: 1600, height: 900 }, 210, 297, 10, true);
  assert(cover.width >= 190 && cover.height >= 277);
}

async function testOrderedGeneration() {
  const instances = [];
  class FakePdf {
    constructor(options) {
      this.constructorOptions = options;
      this.pages = [options.format];
      this.images = [];
      instances.push(this);
    }
    addPage(format, orientation) { this.pages.push({ format, orientation }); }
    addImage(data, type, x, y, width, height) { this.images.push({ data, type, x, y, width, height }); }
    output(type) { assert.equal(type, "blob"); return new Blob(["%PDF-test"], { type: "application/pdf" }); }
  }

  const files = [
    { name: "first.jpg", width: 1200, height: 800 },
    { name: "second.png", width: 800, height: 1200 },
    { name: "third.webp", width: 1000, height: 1000 },
  ];
  const closed = [];
  const progress = [];
  const decode = async (file) => ({ source: file, width: file.width, height: file.height, close: () => closed.push(file.name) });
  const convert = (image) => `jpeg:${image.source.name}`;
  const options = { pageSize: "a4", orientation: "auto", margin: 10, quality: 0.92, fillPage: false };

  const firstBlob = await createPdfBlob({ files, options, JsPDF: FakePdf, decode, convert, onProgress: (done, total) => progress.push([done, total]) });
  assert.equal(firstBlob.type, "application/pdf");
  assert.deepEqual(instances[0].images.map((image) => image.data), ["jpeg:first.jpg", "jpeg:second.png", "jpeg:third.webp"]);
  assert.equal(instances[0].pages.length, 3);
  assert.deepEqual(progress, [[1, 3], [2, 3], [3, 3]]);
  assert.deepEqual(closed, files.map((file) => file.name));

  const secondBlob = await createPdfBlob({ files, options, JsPDF: FakePdf, decode, convert });
  assert.equal(secondBlob.type, "application/pdf");
  assert.equal(instances.length, 2);
  assert.deepEqual(instances[1].images.map((image) => image.data), instances[0].images.map((image) => image.data));

  await assert.rejects(
    createPdfBlob({ files: [], options, JsPDF: FakePdf, decode, convert }),
    (error) => error.code === "NO_FILES",
  );

  const broken = { name: "broken.jpg" };
  await assert.rejects(
    createPdfBlob({
      files: [broken], options, JsPDF: FakePdf, convert,
      decode: async () => { const error = new Error("bad image"); error.code = "IMAGE_DECODE_FAILED"; throw error; },
    }),
    (error) => error.code === "IMAGE_DECODE_FAILED" && error.fileName === "broken.jpg",
  );
}

function testVendoredLibrary() {
  const { jsPDF } = require("../assets/vendor/jspdf/jspdf.umd.min.js");
  const pdf = new jsPDF();
  pdf.text("local dependency test", 10, 10);
  pdf.addPage();
  pdf.text("page two", 10, 10);
  const output = Buffer.from(pdf.output("arraybuffer"));
  assert.equal(output.subarray(0, 5).toString(), "%PDF-");
  assert.equal(pdf.getNumberOfPages(), 2);
}

function testTranslations() {
  const html = fs.readFileSync(new URL("../tools/pdf/images-to-pdf/index.html", import.meta.url), "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)].map((match) => match[1]);
  const lookup = (dictionary, key) => key.split(".").reduce((value, part) => value?.[part], dictionary);
  for (const dictionary of [en, ko]) {
    for (const key of keys) assert.notEqual(lookup(dictionary, key), undefined, `Missing translation: ${key}`);
  }
}

testSupportedInputs();
testOptions();
await testOrderedGeneration();
testVendoredLibrary();
testTranslations();

console.log("Images to PDF checks passed.");

import { decodeImage, imageToJpegData } from "./image.js";

const PAGE_SIZES = {
  a4: [210, 297],
  letter: [215.9, 279.4],
};

const pxToMillimeters = (pixels) => pixels * 25.4 / 96;

export function sanitizeFilename(value) {
  const clean = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .replace(/[. ]+$/g, "");
  const base = clean || "converted-images";
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

export function getPageDimensions(pageSize, orientation, image) {
  const portrait = orientation === "auto"
    ? image.height >= image.width
    : orientation === "portrait";

  if (PAGE_SIZES[pageSize]) {
    const [width, height] = PAGE_SIZES[pageSize];
    return portrait ? [width, height] : [height, width];
  }

  let width = pxToMillimeters(image.width);
  let height = pxToMillimeters(image.height);
  if ((portrait && width > height) || (!portrait && height > width)) {
    [width, height] = [height, width];
  }
  return [width, height];
}

export function getImagePlacement(image, pageWidth, pageHeight, margin, fillPage) {
  const safeMargin = Math.min(
    Math.max(0, Number(margin) || 0),
    Math.max(0, (Math.min(pageWidth, pageHeight) - 1) / 2),
  );
  const availableWidth = Math.max(1, pageWidth - safeMargin * 2);
  const availableHeight = Math.max(1, pageHeight - safeMargin * 2);
  const imageRatio = image.width / image.height;
  const boxRatio = availableWidth / availableHeight;

  let width;
  let height;
  if ((fillPage && imageRatio > boxRatio) || (!fillPage && imageRatio <= boxRatio)) {
    height = availableHeight;
    width = height * imageRatio;
  } else {
    width = availableWidth;
    height = width / imageRatio;
  }

  return {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}

export async function createPdfBlob({ files, options, JsPDF, onProgress = () => {} }) {
  if (!files.length) {
    const error = new Error("NO_FILES");
    error.code = "NO_FILES";
    throw error;
  }
  if (typeof JsPDF !== "function") {
    const error = new Error("PDF_LIBRARY_UNAVAILABLE");
    error.code = "PDF_LIBRARY_UNAVAILABLE";
    throw error;
  }

  let pdf;
  for (let index = 0; index < files.length; index += 1) {
    let image;
    try {
      image = await decodeImage(files[index]);
      const [pageWidth, pageHeight] = getPageDimensions(
        options.pageSize,
        options.orientation,
        image,
      );
      const pageOrientation = pageWidth >= pageHeight ? "landscape" : "portrait";

      if (!pdf) {
        pdf = new JsPDF({
          orientation: pageOrientation,
          unit: "mm",
          format: [pageWidth, pageHeight],
          compress: true,
        });
      } else {
        pdf.addPage([pageWidth, pageHeight], pageOrientation);
      }

      const jpegData = imageToJpegData(image, Number(options.quality) || 0.92);
      const placement = getImagePlacement(
        image,
        pageWidth,
        pageHeight,
        options.margin,
        options.fillPage,
      );
      pdf.addImage(
        jpegData,
        "JPEG",
        placement.x,
        placement.y,
        placement.width,
        placement.height,
        undefined,
        "FAST",
      );
      onProgress(index + 1, files.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    } catch (cause) {
      const error = new Error(cause.code || "PDF_GENERATION_FAILED", { cause });
      error.code = cause.code || "PDF_GENERATION_FAILED";
      error.fileName = files[index]?.name || "";
      throw error;
    } finally {
      image?.close();
    }
  }

  return pdf.output("blob");
}

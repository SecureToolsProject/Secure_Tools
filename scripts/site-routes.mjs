export const productionOrigin = "https://tools.securetools.app";

export const canonicalPages = [
  { source: "index.html", route: "/" },
  { source: "about/index.html", route: "/about/" },
  { source: "privacy/index.html", route: "/privacy/" },
  { source: "tools/pdf/index.html", route: "/pdf/" },
  { source: "tools/pdf/images-to-pdf/index.html", route: "/pdf/images-to-pdf/" },
  { source: "tools/pdf/merge/index.html", route: "/pdf/merge/" },
  { source: "tools/pdf/split/index.html", route: "/pdf/split/" },
  { source: "tools/pdf/organize/index.html", route: "/pdf/organize/" },
  { source: "tools/pdf/to-images/index.html", route: "/pdf/to-images/" },
  { source: "tools/pdf/metadata/index.html", route: "/pdf/metadata/" },
  { source: "tools/image/index.html", route: "/image/" },
  { source: "tools/image/converter/index.html", route: "/image/converter/" },
  { source: "tools/image/resize/index.html", route: "/image/resize/" },
  { source: "tools/image/compress/index.html", route: "/image/compress/" },
  { source: "tools/image/metadata/index.html", route: "/image/metadata/" },
  { source: "tools/image/to-text/index.html", route: "/image/to-text/" },
  { source: "tools/scan/index.html", route: "/scan/" },
  { source: "tools/media/index.html", route: "/media/" },
];

export const legacyRedirects = [
  ...canonicalPages
    .filter(({ source }) => source.startsWith("tools/"))
    .map(({ route }) => ({ from: `/tools${route}`, to: route })),
  { from: "/tools/privacy/", to: "/privacy/" },
  { from: "/tools/image-to-pdf/", to: "/pdf/images-to-pdf/" },
];

export const redirectStatus = 308;

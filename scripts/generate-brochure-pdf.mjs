import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const brochureDirectory = path.join(root, "public", "brochure");
const outputPath = path.join(root, "public", "TULA-Whispers-of-Trees-Brochure.pdf");
// Every PDF page uses this same canvas. Spreads are scaled down and centred
// inside it instead of creating a wider PDF page than the rest of the book.
const pageWidth = 2011;
const pageHeight = 1299;

// These are intentionally single, double-width PDF pages. The source artwork
// spans the centre fold, so emitting its left/right halves as separate PDF
// pages would make the spreads read badly in the downloaded brochure.
const combinedSpreadPageNumbers = new Set([2, 4, 6, 8, 9, 10, 11, 12, 14, 39]);
const brochureEntries = [
  ["Tula_Page_01_Left.jpg"],
  ...Array.from({ length: 39 }, (_, index) => {
    const page = String(index + 2).padStart(2, "0");
    const sources = [`Tula_Page_${page}_Left.jpg`, `Tula_Page_${page}_Right.jpg`];
    return combinedSpreadPageNumbers.has(index + 2) ? [sources] : sources.map((source) => [source]);
  }).flat(),
  ["Last.jpg"],
];

const objects = [];
const addObject = (content) => {
  objects.push(Buffer.isBuffer(content) ? content : Buffer.from(content, "binary"));
  return objects.length;
};

const catalogObject = addObject("");
const pagesObject = addObject("");
const pageObjectIds = [];

for (const sources of brochureEntries) {
  const sourcePaths = sources.map((source) => path.join(brochureDirectory, source));
  sourcePaths.forEach((sourcePath) => {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing brochure page: ${path.basename(sourcePath)}`);
    }
  });

  const isCombinedSpread = sourcePaths.length === 2;
  const sourceImage = isCombinedSpread
    ? await (async () => {
        // Normalise both halves before joining them. This keeps the PDF
        // generation resilient if a supplied page has an EXIF orientation or
        // differs from the brochure frame by a pixel or two.
        const [left, right] = await Promise.all(
          sourcePaths.map((sourcePath) =>
            sharp(sourcePath)
              .rotate()
              .resize({ width: 1400, height: 905, fit: "cover", position: "centre" })
              .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
              .toBuffer(),
          ),
        );

        return sharp({
          create: {
            width: 2800,
            height: 905,
            channels: 3,
            background: "#ffffff",
          },
        }).composite([
          { input: left, left: 0, top: 0 },
          { input: right, left: 1400, top: 0 },
        ]);
      })()
    : sharp(sourcePaths[0]);
  const pdfImage = isCombinedSpread
    ? sourceImage
    : sourceImage.resize({ width: 2011, withoutEnlargement: true });
  const { data, info } = await pdfImage
    .jpeg({ quality: 80, chromaSubsampling: "4:2:0", mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const imageObject = addObject(
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,
        "ascii",
      ),
      data,
      Buffer.from("\nendstream", "ascii"),
    ]),
  );
  const imageHeight = isCombinedSpread ? pageHeight / 2 : pageHeight;
  const imageOffsetY = isCombinedSpread ? pageHeight / 4 : 0;
  const content = `q\n${pageWidth} 0 0 ${imageHeight} 0 ${imageOffsetY} cm\n/Im0 Do\nQ\n`;
  const contentObject = addObject(
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  );
  pageObjectIds.push(
    addObject(
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`,
    ),
  );
}

objects[pagesObject - 1] = Buffer.from(
  `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`,
  "ascii",
);
objects[catalogObject - 1] = Buffer.from(
  `<< /Type /Catalog /Pages ${pagesObject} 0 R /PageLayout /TwoPageRight >>`,
  "ascii",
);

const header = Buffer.from("%PDF-1.7\n%\xFF\xFF\xFF\xFF\n", "binary");
const parts = [header];
const offsets = [0];
let offset = header.length;

objects.forEach((object, index) => {
  offsets.push(offset);
  const prefix = Buffer.from(`${index + 1} 0 obj\n`, "ascii");
  const suffix = Buffer.from("\nendobj\n", "ascii");
  parts.push(prefix, object, suffix);
  offset += prefix.length + object.length + suffix.length;
});

const xrefOffset = offset;
const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
offsets.slice(1).forEach((entry) => xref.push(`${String(entry).padStart(10, "0")} 00000 n `));
const trailer = `${xref.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
parts.push(Buffer.from(trailer, "ascii"));

fs.writeFileSync(outputPath, Buffer.concat(parts));
console.log(`Generated ${outputPath} with ${brochureEntries.length} pages.`);

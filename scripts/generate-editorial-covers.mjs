import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Delivery encoding only: no compositing, cropping, retouching or recoloring.
const sourceDirectory = path.resolve("artifacts/editorial-covers/2026-09-09");
const outputDirectory = path.resolve("public/images/editorial");
const slugs = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
];
await mkdir(outputDirectory, { recursive: true });
const manifest = [];
for (const slug of slugs) {
  const input = await readFile(path.join(sourceDirectory, `${slug}.png`));
  const original = await sharp(input).metadata();
  if (original.width !== 1536 || original.height !== 1024)
    throw new Error(`Unexpected original dimensions for ${slug}`);
  const outputs = [];
  for (const width of [480, 960, 1536]) {
    for (const format of ["avif", "webp"]) {
      const file = `${slug}-${width}.${format}`;
      const bytes = await sharp(input)
        .resize({ width })
        .toFormat(format, { quality: format === "avif" ? 55 : 82 })
        .toBuffer();
      await writeFile(path.join(outputDirectory, file), bytes);
      outputs.push({
        file,
        width,
        height: (width * 2) / 3,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  manifest.push({
    slug,
    originalSha256: createHash("sha256").update(input).digest("hex"),
    outputs,
  });
}
await writeFile(
  path.join(sourceDirectory, "delivery-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`Encoded ${manifest.length} covers and 30 delivery candidates.`);

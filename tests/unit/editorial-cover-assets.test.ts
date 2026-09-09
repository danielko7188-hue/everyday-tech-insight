import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { categorySlugs } from "../../src/data/categories";

describe("editorial cover delivery assets", () => {
  for (const slug of categorySlugs) {
    it(`${slug} ships every correctly sized AVIF and WebP candidate`, async () => {
      for (const width of [480, 960, 1536]) {
        for (const format of ["avif", "webp"]) {
          const file = path.resolve(
            "public/images/editorial",
            `${slug}-${width}.${format}`,
          );
          await expect(stat(file)).resolves.toMatchObject({
            size: expect.any(Number),
          });
          const bytes = await readFile(file);
          expect(bytes.byteLength).toBeLessThan(250_000);
          const metadata = await sharp(bytes).metadata();
          expect(metadata.width).toBe(width);
          expect(metadata.height).toBe((width * 2) / 3);
          expect(metadata.hasAlpha).toBe(false);
          expect(metadata.format).toBe(format === "avif" ? "heif" : format);
        }
      }
    });
  }

  it("uses a distinct full-size illustration for each topic", async () => {
    const hashes = await Promise.all(
      categorySlugs.map(async (slug) =>
        createHash("sha256")
          .update(await readFile(`public/images/editorial/${slug}-1536.webp`))
          .digest("hex"),
      ),
    );
    expect(new Set(hashes).size).toBe(categorySlugs.length);
  });
});

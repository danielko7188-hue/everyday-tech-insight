import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
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
          const decoded = await sharp(bytes)
            .raw()
            .toBuffer({ resolveWithObject: true });
          expect(decoded.info.width).toBe(width);
          expect(decoded.info.height).toBe((width * 2) / 3);
          expect(decoded.data.length).toBe(
            width * ((width * 2) / 3) * decoded.info.channels,
          );
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

  it("binds the exact original and delivery inventory to its provenance hashes", async () => {
    const originalDirectory = "artifacts/editorial-covers/2026-09-09";
    const manifest = JSON.parse(
      await readFile(`${originalDirectory}/delivery-manifest.json`, "utf8"),
    ) as Array<{
      slug: string;
      originalSha256: string;
      outputs: Array<{
        file: string;
        width: number;
        height: number;
        bytes: number;
        sha256: string;
      }>;
    }>;
    expect(manifest.map(({ slug }) => slug).sort()).toEqual(
      [...categorySlugs].sort(),
    );
    const expectedFiles = categorySlugs.flatMap((slug) =>
      [480, 960, 1536].flatMap((width) =>
        ["avif", "webp"].map((format) => `${slug}-${width}.${format}`),
      ),
    );
    // The previous release's six clarity assets remain preserved beside the
    // new covers; they are not part of this generation's provenance manifest.
    const preservedLegacyFiles = [480, 960, 1536].flatMap((width) =>
      ["avif", "webp"].map((format) => `clarity-${width}.${format}`),
    );
    expect((await readdir("public/images/editorial")).sort()).toEqual(
      [...expectedFiles, ...preservedLegacyFiles].sort(),
    );
    expect(
      manifest.flatMap(({ outputs }) => outputs.map(({ file }) => file)).sort(),
    ).toEqual([...expectedFiles].sort());
    for (const row of manifest) {
      const original = await readFile(`${originalDirectory}/${row.slug}.png`);
      expect(createHash("sha256").update(original).digest("hex")).toBe(
        row.originalSha256,
      );
      const decoded = await sharp(original)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(decoded.info).toMatchObject({ width: 1536, height: 1024 });
      expect(row.outputs).toHaveLength(6);
      for (const output of row.outputs) {
        const fileMatch = output.file.match(/-(480|960|1536)\.(avif|webp)$/);
        expect(fileMatch).not.toBeNull();
        expect(output.width).toBe(Number(fileMatch![1]));
        expect(output.height).toBe((output.width * 2) / 3);
        const bytes = await readFile(`public/images/editorial/${output.file}`);
        expect(bytes.length).toBe(output.bytes);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(
          output.sha256,
        );
      }
    }
  });

  it.each([16, 64, 256, 8968])(
    "rejects a truncated AVIF payload missing %i bytes despite valid header metadata",
    async (removedBytes) => {
      const original = await readFile(
        "public/images/editorial/ai-automation-960.avif",
      );
      const truncated = original.subarray(0, original.length - removedBytes);
      await expect(sharp(truncated).metadata()).resolves.toMatchObject({
        width: 960,
        height: 640,
        format: "heif",
      });
      await expect(sharp(truncated).raw().toBuffer()).rejects.toThrow();
    },
  );
});

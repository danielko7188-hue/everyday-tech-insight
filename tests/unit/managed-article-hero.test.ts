import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { resolveManagedArticleHeroImage } from "../../src/utils/managed-article-images.mjs";

const temporaryDirectories: string[] = [];

async function repositoryWithHero() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "eti-managed-hero-"),
  );
  temporaryDirectories.push(repositoryRoot);
  const sourceRoot = path.join(
    repositoryRoot,
    "src",
    "content-assets",
    "articles",
  );
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(
    path.join(sourceRoot, "published-guide-review-workflow.png"),
    await sharp({
      create: {
        width: 24,
        height: 16,
        channels: 3,
        background: "#6d28d9",
      },
    })
      .png()
      .toBuffer(),
  );
  return repositoryRoot;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("managed article hero rendering contract", () => {
  it("returns undefined so the existing editorial visual remains the fallback", async () => {
    await expect(
      resolveManagedArticleHeroImage(
        { slug: "published-guide" },
        { repositoryRoot: process.cwd() },
      ),
    ).resolves.toBeUndefined();
  });

  it("resolves decoded dimensions and preserves truthful optional presentation metadata", async () => {
    const repositoryRoot = await repositoryWithHero();

    await expect(
      resolveManagedArticleHeroImage(
        {
          slug: "published-guide",
          heroImage: "/images/articles/published-guide-review-workflow.png",
          heroImageAlt: "Editors reviewing the publication approval workflow",
          heroImageDecorative: false,
          heroImageCaption: "A review workflow from draft through publication.",
          heroImageCredit: "Example Studio",
          heroImageSourceUrl: "https://example.test/source",
          heroImageLicense: "Licensed for publication",
        },
        { repositoryRoot },
      ),
    ).resolves.toMatchObject({
      alt: "Editors reviewing the publication approval workflow",
      caption: "A review workflow from draft through publication.",
      credit: "Example Studio",
      decorative: false,
      height: 16,
      license: "Licensed for publication",
      publicUrl: "/images/articles/published-guide-review-workflow.png",
      sourceUrl: "https://example.test/source",
      width: 24,
    });
  });

  it("accepts an exactly decorative hero and rejects an invalid tuple", async () => {
    const repositoryRoot = await repositoryWithHero();
    const base = {
      slug: "published-guide",
      heroImage: "/images/articles/published-guide-review-workflow.png",
    };

    await expect(
      resolveManagedArticleHeroImage(
        { ...base, heroImageAlt: "", heroImageDecorative: true },
        { repositoryRoot },
      ),
    ).resolves.toMatchObject({ alt: "", decorative: true });
    await expect(
      resolveManagedArticleHeroImage(
        { ...base, heroImageAlt: "Image", heroImageDecorative: false },
        { repositoryRoot },
      ),
    ).rejects.toThrow(/alternative text/i);
  });

  it("conditionally emits a validated eager raster and retains EditorialVisual fallback markup", async () => {
    const source = await readFile(
      path.resolve(
        import.meta.dirname,
        "../../src/layouts/ArticleLayout.astro",
      ),
      "utf8",
    );

    expect(source).toMatch(/resolveManagedArticleHeroImage/);
    expect(source).toMatch(/managedHeroImage\s*\?/);
    expect(source).toMatch(/<img[\s\S]*loading="eager"[\s\S]*decoding="async"/);
    expect(source).toMatch(/width=\{managedHeroImage\.width\}/);
    expect(source).toMatch(/height=\{managedHeroImage\.height\}/);
    expect(source).toMatch(/<figcaption/);
    expect(source).toMatch(/<EditorialVisual/);
  });
});

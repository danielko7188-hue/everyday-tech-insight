import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  SOCIAL_IMAGE_HEIGHT,
  SOCIAL_IMAGE_RECORDS,
  SOCIAL_IMAGE_WIDTH,
  generateSocialImages,
  renderSocialSvg,
} from "../../scripts/generate-social-images.mjs";

const expectedCategorySlugs = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
];

const currentSocialNames = SOCIAL_IMAGE_RECORDS.map(({ fileName }) => fileName);
const expectedSocialNames = [...currentSocialNames].sort((left, right) =>
  left.localeCompare(right),
);

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

type GeneratedSocialPortfolio = {
  appleIconPath: string;
  manifestPath: string;
  socialImagePaths: string[];
};

type SocialImageManifest = {
  assets: Array<{
    height: number;
    kind: string;
    path: string;
    pngSha256: string;
    sourceSha256: string;
    width: number;
  }>;
  generatorSourceSha256: string;
  schemaVersion: number;
  sharpVersion: string;
};

type SocialImageValidator = {
  validateCommittedSocialImages: (options: {
    manifestPath: string;
    publicRoot: string;
  }) => Promise<{
    appleTouchIcons: number;
    socialImages: number;
    totalAssets: number;
  }>;
};

async function importSocialImageValidator(): Promise<SocialImageValidator> {
  const modulePath = pathToFileURL(
    join(process.cwd(), "scripts", "check-social-images.mjs"),
  ).href;
  return (await import(modulePath)) as SocialImageValidator;
}

function readManifest(manifestPath: string): SocialImageManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as SocialImageManifest;
}

function writeManifest(
  manifestPath: string,
  manifest: SocialImageManifest,
): void {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function generateTemporaryPortfolio(): Promise<{
  result: GeneratedSocialPortfolio;
  root: string;
}> {
  const root = mkdtempSync(join(tmpdir(), "eti-social-images-"));
  temporaryRoots.push(root);
  const result = (await generateSocialImages({
    outputRoot: root,
  })) as GeneratedSocialPortfolio;
  return { result, root };
}

async function importGeneratorWithFixture({
  articleCategory = "ai-automation",
  articleSlug,
  additionalPublishedArticleSlugs = [],
  generatorSourceTransform = (source) => source,
}: {
  articleCategory?: string;
  articleSlug: string;
  additionalPublishedArticleSlugs?: string[];
  generatorSourceTransform?: (source: string) => string;
}): Promise<unknown> {
  const fixtureRoot = mkdtempSync(join(process.cwd(), ".eti-social-fixture-"));
  temporaryRoots.push(fixtureRoot);
  const fixtureScript = join(
    fixtureRoot,
    "scripts",
    "generate-social-images.mjs",
  );
  const fixtureArticles = join(fixtureRoot, "src", "content", "articles");
  const fixtureFonts = join(fixtureRoot, "public", "fonts");
  mkdirSync(join(fixtureRoot, "scripts"), { recursive: true });
  mkdirSync(fixtureArticles, { recursive: true });
  mkdirSync(fixtureFonts, { recursive: true });

  const productionScript = join(
    process.cwd(),
    "scripts",
    "generate-social-images.mjs",
  );
  writeFileSync(
    fixtureScript,
    generatorSourceTransform(readFileSync(productionScript, "utf8")),
  );
  copyFileSync(
    join(
      process.cwd(),
      "public",
      "fonts",
      "source-sans-3-variable-english.woff2",
    ),
    join(fixtureFonts, "source-sans-3-variable-english.woff2"),
  );
  [articleSlug, ...additionalPublishedArticleSlugs].forEach((slug, index) => {
    writeFileSync(
      join(fixtureArticles, `fixture-${index}.md`),
      `---\nstatus: published\ncategory: ${articleCategory}\nslug: ${slug}\ntitle: Fixture article ${index + 1}\nvisual:\n  key: fixture-visual-${index + 1}\n---\nFixture.\n`,
    );
  });

  return import(pathToFileURL(fixtureScript).href);
}

describe("social image portfolio", () => {
  it("derives social records for an additional published guide", async () => {
    const fixtureModule = (await importGeneratorWithFixture({
      articleSlug: "fixture-launch-guide",
      additionalPublishedArticleSlugs: ["fixture-future-published-guide"],
    })) as { SOCIAL_IMAGE_RECORDS: Array<{ fileName: string; kind: string }> };

    expect(
      fixtureModule.SOCIAL_IMAGE_RECORDS.filter(
        ({ kind }) => kind === "article",
      ).map(({ fileName }) => fileName),
    ).toEqual([
      "article-fixture-future-published-guide.png",
      "article-fixture-launch-guide.png",
    ]);
  });

  it("keeps source signatures stable across LF and CRLF worktrees", async () => {
    const lfModule = (await importGeneratorWithFixture({
      articleSlug: "fixture-launch-guide",
    })) as {
      createSocialImageSourceManifest: () => SocialImageManifest;
    };
    const crlfModule = (await importGeneratorWithFixture({
      articleSlug: "fixture-launch-guide",
      generatorSourceTransform: (source) => source.replace(/\r?\n/g, "\r\n"),
    })) as {
      createSocialImageSourceManifest: () => SocialImageManifest;
    };

    expect(crlfModule.createSocialImageSourceManifest()).toEqual(
      lfModule.createSocialImageSourceManifest(),
    );
  });

  it("renders the Purple Signal identity without the retired publication palette", () => {
    const svg = renderSocialSvg(SOCIAL_IMAGE_RECORDS[0]!);

    for (const color of ["#0d0618", "#7c3aed", "#d946ef", "#faf8ff"]) {
      expect(svg.toLowerCase()).toContain(color);
    }
    for (const retired of ["#d84a2f", "#f4efe4", "#fffdf8", "#171918"]) {
      expect(svg.toLowerCase()).not.toContain(retired);
    }
  });

  it("defines a sorted default, five-category, and complete published-article portfolio", () => {
    expect(SOCIAL_IMAGE_RECORDS.map(({ fileName }) => fileName)).toEqual(
      expectedSocialNames,
    );
    expect(expectedSocialNames).toEqual(
      expect.arrayContaining([
        "default.png",
        ...expectedCategorySlugs.map((slug) => `category-${slug}.png`),
      ]),
    );
    expect(
      new Set(SOCIAL_IMAGE_RECORDS.map(({ fileName }) => fileName)).size,
    ).toBe(SOCIAL_IMAGE_RECORDS.length);

    const articleRecords = SOCIAL_IMAGE_RECORDS.filter(
      ({ kind }) => kind === "article",
    );
    for (const record of articleRecords) {
      expect(record.title.trim()).not.toBe("");
      expect(record.categoryName.trim()).not.toBe("");
      expect(record.visualKey.trim()).not.toBe("");
      expect(record.alt.trim()).not.toBe("");
    }
  });

  it("escapes supplied text and embeds only the bundled local publication font", () => {
    const svg = renderSocialSvg({
      accent: "#0f746c",
      alt: "Test alt",
      categoryName: "Research & <testing>",
      fileName: "test.png",
      kind: "article",
      title: `A <script> & "quoted" title`,
      visualKey: "test-visual",
    });

    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;quoted&quot;");
    expect(svg).toContain("Research &amp; &lt;testing&gt;");
    expect(svg).toContain("data:font/woff2;base64,");
    expect(svg).not.toContain("<script>");
    expect(svg).not.toMatch(/Math\.random|Date\.now|url\(https?:/);
  });

  it("keeps every headline line inside the copy column", () => {
    const article = SOCIAL_IMAGE_RECORDS.find(
      ({ fileName }) =>
        fileName ===
        "article-how-to-identify-business-tasks-for-automation.png",
    );
    expect(article).toBeDefined();

    const svg = renderSocialSvg(article!);
    const headlineLines = [
      ...svg.matchAll(/<tspan x="78"[^>]*>([^<]+)<\/tspan>/g),
    ].map((match) => match[1] ?? "");

    expect(headlineLines.length).toBeGreaterThan(1);
    expect(
      Math.max(...headlineLines.map((line) => line.length)),
    ).toBeLessThanOrEqual(20);
    expect(svg).toContain('<rect x="750"');
  });

  it("writes exact-size deterministic PNGs and removes stale social images", async () => {
    const root = mkdtempSync(join(tmpdir(), "eti-social-images-"));
    temporaryRoots.push(root);
    const socialDir = join(root, "social");
    const appleIconPath = join(root, "apple-touch-icon.png");

    const generated = (await generateSocialImages({
      outputRoot: root,
    })) as GeneratedSocialPortfolio;
    writeFileSync(join(socialDir, "stale.png"), "stale");
    const regenerated = (await generateSocialImages({
      outputRoot: root,
    })) as GeneratedSocialPortfolio;

    expect(readdirSync(socialDir).sort()).toEqual(expectedSocialNames);

    const firstHashes = new Map(
      expectedSocialNames.map((name) => [name, sha256(join(socialDir, name))]),
    );
    const firstAppleHash = sha256(appleIconPath);

    for (const name of expectedSocialNames) {
      const metadata = await sharp(join(socialDir, name)).metadata();
      expect(metadata).toMatchObject({
        format: "png",
        height: SOCIAL_IMAGE_HEIGHT,
        width: SOCIAL_IMAGE_WIDTH,
      });
    }
    expect(await sharp(appleIconPath).metadata()).toMatchObject({
      format: "png",
      height: 180,
      width: 180,
    });

    await generateSocialImages({ outputRoot: root });
    expect(
      new Map(
        expectedSocialNames.map((name) => [
          name,
          sha256(join(socialDir, name)),
        ]),
      ),
    ).toEqual(firstHashes);
    expect(sha256(appleIconPath)).toBe(firstAppleHash);
    expect(generated.manifestPath).toBe(
      join(root, "social-images.manifest.json"),
    );
    expect(regenerated.manifestPath).toBe(generated.manifestPath);
    expect(readManifest(generated.manifestPath)).toEqual(
      readManifest(regenerated.manifestPath),
    );
  }, 10_000);

  it("validates committed PNG bytes without regenerating them", async () => {
    const { result, root } = await generateTemporaryPortfolio();
    const before = new Map(
      [result.appleIconPath, ...result.socialImagePaths].map((filePath) => [
        filePath,
        sha256(filePath),
      ]),
    );
    const { validateCommittedSocialImages } =
      await importSocialImageValidator();

    await expect(
      validateCommittedSocialImages({
        manifestPath: result.manifestPath,
        publicRoot: root,
      }),
    ).resolves.toEqual({
      appleTouchIcons: 1,
      socialImages: SOCIAL_IMAGE_RECORDS.length,
      totalAssets: SOCIAL_IMAGE_RECORDS.length + 1,
    });
    expect(
      new Map(
        [result.appleIconPath, ...result.socialImagePaths].map((filePath) => [
          filePath,
          sha256(filePath),
        ]),
      ),
    ).toEqual(before);
  }, 15_000);

  it("rejects a committed manifest whose source signatures are stale", async () => {
    const { result, root } = await generateTemporaryPortfolio();
    const manifest = readManifest(result.manifestPath);
    manifest.assets[0]!.sourceSha256 = "0".repeat(64);
    writeManifest(result.manifestPath, manifest);
    const { validateCommittedSocialImages } =
      await importSocialImageValidator();

    await expect(
      validateCommittedSocialImages({
        manifestPath: result.manifestPath,
        publicRoot: root,
      }),
    ).rejects.toThrow(/source|manifest|generate:social/i);
  }, 15_000);

  it("rejects missing and unexpected social image inventory", async () => {
    const { result, root } = await generateTemporaryPortfolio();
    const { validateCommittedSocialImages } =
      await importSocialImageValidator();
    rmSync(result.socialImagePaths[0]!);

    await expect(
      validateCommittedSocialImages({
        manifestPath: result.manifestPath,
        publicRoot: root,
      }),
    ).rejects.toThrow(/inventory|missing|social/i);

    copyFileSync(result.socialImagePaths[1]!, result.socialImagePaths[0]!);
    writeFileSync(join(root, "social", "unexpected.png"), "unexpected");
    await expect(
      validateCommittedSocialImages({
        manifestPath: result.manifestPath,
        publicRoot: root,
      }),
    ).rejects.toThrow(/inventory|unexpected|social/i);
  }, 15_000);

  it("rejects valid PNG bytes with the wrong committed hash", async () => {
    const { result, root } = await generateTemporaryPortfolio();
    copyFileSync(result.socialImagePaths[1]!, result.socialImagePaths[0]!);
    const { validateCommittedSocialImages } =
      await importSocialImageValidator();

    await expect(
      validateCommittedSocialImages({
        manifestPath: result.manifestPath,
        publicRoot: root,
      }),
    ).rejects.toThrow(/hash|sha-?256|bytes/i);
  }, 15_000);

  it("rejects a hash-matched PNG with invalid dimensions", async () => {
    const { result, root } = await generateTemporaryPortfolio();
    const targetPath = result.socialImagePaths[0]!;
    await sharp({
      create: {
        background: "#000000",
        channels: 4,
        height: 1,
        width: 1,
      },
    })
      .png()
      .toFile(targetPath);
    const manifest = readManifest(result.manifestPath);
    const relativePath = `social/${targetPath.split(/[\\/]/).at(-1)}`;
    const record = manifest.assets.find(
      ({ path: assetPath }) => assetPath === relativePath,
    );
    expect(record).toBeDefined();
    record!.pngSha256 = sha256(targetPath);
    writeManifest(result.manifestPath, manifest);
    const { validateCommittedSocialImages } =
      await importSocialImageValidator();

    await expect(
      validateCommittedSocialImages({
        manifestPath: result.manifestPath,
        publicRoot: root,
      }),
    ).rejects.toThrow(/dimension|1200|630/i);
  }, 15_000);

  it("rejects broad output roots before cleanup", async () => {
    const root = mkdtempSync(join(tmpdir(), "eti-social-safety-"));
    temporaryRoots.push(root);

    await expect(
      generateSocialImages({
        outputRoot: parse(root).root,
      }),
    ).rejects.toThrow(/output root/i);
    await expect(
      generateSocialImages({
        outputRoot: process.cwd(),
      }),
    ).rejects.toThrow(/output root/i);
  });

  it("uses one explicit owned root instead of unrelated output path overrides", async () => {
    const ownedRoot = mkdtempSync(join(tmpdir(), "eti-social-owned-"));
    const unrelatedRoot = mkdtempSync(join(tmpdir(), "eti-social-unrelated-"));
    temporaryRoots.push(ownedRoot, unrelatedRoot);

    const options = {
      outputRoot: ownedRoot,
      socialDir: join(unrelatedRoot, "social"),
      appleIconPath: join(unrelatedRoot, "apple-touch-icon.png"),
    } as unknown as Parameters<typeof generateSocialImages>[0];
    await generateSocialImages(options);

    expect(existsSync(join(ownedRoot, "social", "default.png"))).toBe(true);
    expect(existsSync(join(ownedRoot, "apple-touch-icon.png"))).toBe(true);
    expect(existsSync(join(unrelatedRoot, "social"))).toBe(false);
    expect(existsSync(join(unrelatedRoot, "apple-touch-icon.png"))).toBe(false);
  });

  it("rejects a non-canonical article slug before deriving an output key", async () => {
    await expect(
      importGeneratorWithFixture({ articleSlug: "../../../escaped" }),
    ).rejects.toThrow(/canonical article slug/i);
  });

  it("rejects a non-canonical category slug before deriving an output key", async () => {
    await expect(
      importGeneratorWithFixture({
        articleCategory: "../ai-automation",
        articleSlug: "fixture-article",
        generatorSourceTransform: (source) =>
          source.replace('slug: "ai-automation"', 'slug: "../ai-automation"'),
      }),
    ).rejects.toThrow(/canonical category slug/i);
  });

  it("rejects a social output key unless it resolves to a direct child", async () => {
    const root = mkdtempSync(join(tmpdir(), "eti-social-images-"));
    temporaryRoots.push(root);
    const article = SOCIAL_IMAGE_RECORDS.find(({ kind }) => kind === "article");
    expect(article).toBeDefined();
    const originalFileName = article!.fileName;
    article!.fileName = "article-../../../escaped.png";

    try {
      await expect(generateSocialImages({ outputRoot: root })).rejects.toThrow(
        /direct child/i,
      );
    } finally {
      article!.fileName = originalFileName;
    }

    expect(existsSync(join(root, "escaped.png"))).toBe(false);
  });

  it("rejects an unrelated link anywhere below the output root", async () => {
    const parent = mkdtempSync(join(tmpdir(), "eti-social-tree-link-"));
    temporaryRoots.push(parent);
    const ownedRoot = join(parent, "eti-social-owned-root");
    const nestedRoot = join(ownedRoot, "downloads");
    const outsideTarget = join(parent, "outside-target");
    const linkPath = join(nestedRoot, "outside-file.txt");
    mkdirSync(nestedRoot, { recursive: true });

    if (process.platform === "win32") {
      mkdirSync(outsideTarget);
      writeFileSync(join(outsideTarget, "outside-file.txt"), "outside");
      symlinkSync(outsideTarget, linkPath, "junction");
    } else {
      writeFileSync(outsideTarget, "outside");
      symlinkSync(outsideTarget, linkPath, "file");
    }

    await expect(
      generateSocialImages({ outputRoot: ownedRoot }),
    ).rejects.toThrow(/symbolic link/i);
    expect(existsSync(join(ownedRoot, "social", "default.png"))).toBe(false);
  });

  it("rejects an unexpected directory inside the social output directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "eti-social-directory-"));
    temporaryRoots.push(root);
    const unexpectedDirectory = join(root, "social", "unexpected");
    const sentinelPath = join(unexpectedDirectory, "sentinel.txt");
    mkdirSync(unexpectedDirectory, { recursive: true });
    writeFileSync(sentinelPath, "preserve");

    await expect(generateSocialImages({ outputRoot: root })).rejects.toThrow(
      /non-regular.*social/i,
    );
    expect(readFileSync(sentinelPath, "utf8")).toBe("preserve");
    expect(existsSync(join(root, "social", "default.png"))).toBe(false);
  });

  it("rejects an unexpected link inside the social output directory", async () => {
    const parent = mkdtempSync(join(tmpdir(), "eti-social-entry-link-"));
    temporaryRoots.push(parent);
    const ownedRoot = join(parent, "eti-social-owned-root");
    const socialRoot = join(ownedRoot, "social");
    const outsideTarget = join(parent, "outside-target");
    const linkPath = join(socialRoot, "unexpected.png");
    mkdirSync(socialRoot, { recursive: true });

    if (process.platform === "win32") {
      mkdirSync(outsideTarget);
      writeFileSync(join(outsideTarget, "sentinel.txt"), "outside");
      symlinkSync(outsideTarget, linkPath, "junction");
    } else {
      writeFileSync(outsideTarget, "outside");
      symlinkSync(outsideTarget, linkPath, "file");
    }

    await expect(
      generateSocialImages({ outputRoot: ownedRoot }),
    ).rejects.toThrow(/symbolic link/i);
    expect(existsSync(join(socialRoot, "default.png"))).toBe(false);
  });

  it.each(["root", "social", "apple"] as const)(
    "rejects an existing symlinked %s output before cleanup or writes",
    async (targetKind) => {
      const parent = mkdtempSync(join(tmpdir(), "eti-social-symlink-"));
      temporaryRoots.push(parent);
      const realRoot = join(parent, "eti-social-real-root");
      const ownedRoot =
        targetKind === "root"
          ? join(parent, "eti-social-owned-root")
          : realRoot;
      mkdirSync(realRoot);

      if (targetKind === "root") {
        symlinkSync(realRoot, ownedRoot, "junction");
      } else {
        const target = join(parent, `${targetKind}-target`);
        mkdirSync(target);
        symlinkSync(
          target,
          join(
            ownedRoot,
            targetKind === "social" ? "social" : "apple-touch-icon.png",
          ),
          "junction",
        );
      }

      const options = {
        outputRoot: ownedRoot,
        socialDir: join(ownedRoot, "social"),
        appleIconPath: join(ownedRoot, "apple-touch-icon.png"),
      } as unknown as Parameters<typeof generateSocialImages>[0];
      await expect(generateSocialImages(options)).rejects.toThrow(
        /symbolic link/i,
      );
    },
  );

  it("rejects an existing symlinked social image before writing", async () => {
    const parent = mkdtempSync(join(tmpdir(), "eti-social-file-symlink-"));
    temporaryRoots.push(parent);
    const ownedRoot = join(parent, "eti-social-owned-root");
    const socialRoot = join(ownedRoot, "social");
    const outsideTarget = join(parent, "outside-target");
    const sentinelPath =
      process.platform === "win32"
        ? join(outsideTarget, "sentinel.txt")
        : outsideTarget;
    const sentinel = "outside target must remain unchanged";
    mkdirSync(socialRoot, { recursive: true });
    if (process.platform === "win32") {
      mkdirSync(outsideTarget);
      writeFileSync(sentinelPath, sentinel);
      symlinkSync(outsideTarget, join(socialRoot, "default.png"), "junction");
    } else {
      writeFileSync(sentinelPath, sentinel);
      symlinkSync(outsideTarget, join(socialRoot, "default.png"), "file");
    }

    await expect(
      generateSocialImages({ outputRoot: ownedRoot }),
    ).rejects.toThrow(/symbolic link/i);
    expect(readFileSync(sentinelPath, "utf8")).toBe(sentinel);
  });
});

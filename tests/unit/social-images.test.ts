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

const expectedArticleSlugs = [
  "back-up-business-files-with-the-3-2-1-method",
  "calculate-the-total-cost-of-business-software",
  "create-a-shared-file-and-folder-system",
  "create-a-simple-technology-risk-register",
  "crm-vs-project-management-software",
  "document-a-repetitive-workflow-before-automating",
  "evaluate-ai-output-quality-in-a-small-team-pilot",
  "evaluate-saas-with-a-practical-checklist",
  "how-to-identify-business-tasks-for-automation",
  "onboard-employees-and-contractors-to-business-technology",
  "respond-to-a-suspected-phishing-message",
  "roll-out-mfa-across-a-small-business",
  "run-a-30-day-business-technology-pilot",
  "test-data-export-and-integrations-before-saas-lock-in",
  "write-a-practical-ai-acceptable-use-policy",
];

const expectedSocialNames = [
  "default.png",
  ...expectedCategorySlugs.map((slug) => `category-${slug}.png`),
  ...expectedArticleSlugs.map((slug) => `article-${slug}.png`),
].sort((left, right) => left.localeCompare(right));

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function importGeneratorWithFixture({
  articleCategory = "ai-automation",
  articleSlug,
  generatorSourceTransform = (source) => source,
}: {
  articleCategory?: string;
  articleSlug: string;
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
  writeFileSync(
    join(fixtureArticles, "fixture.md"),
    `---\nstatus: published\ncategory: ${articleCategory}\nslug: ${articleSlug}\ntitle: Fixture article\nvisual:\n  key: fixture-visual\n---\nFixture.\n`,
  );

  return import(pathToFileURL(fixtureScript).href);
}

describe("social image portfolio", () => {
  it("renders the Purple Signal identity without the retired publication palette", () => {
    const svg = renderSocialSvg(SOCIAL_IMAGE_RECORDS[0]!);

    for (const color of ["#0d0618", "#7c3aed", "#d946ef", "#faf8ff"]) {
      expect(svg.toLowerCase()).toContain(color);
    }
    for (const retired of ["#d84a2f", "#f4efe4", "#fffdf8", "#171918"]) {
      expect(svg.toLowerCase()).not.toContain(retired);
    }
  });

  it("defines the fixed sorted default, five-category, and 15-article portfolio", () => {
    expect(SOCIAL_IMAGE_RECORDS).toHaveLength(21);
    expect(SOCIAL_IMAGE_RECORDS.map(({ fileName }) => fileName)).toEqual(
      expectedSocialNames,
    );
    expect(
      new Set(SOCIAL_IMAGE_RECORDS.map(({ fileName }) => fileName)).size,
    ).toBe(21);

    const articleRecords = SOCIAL_IMAGE_RECORDS.filter(
      ({ kind }) => kind === "article",
    );
    expect(articleRecords).toHaveLength(15);
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

    await generateSocialImages({ outputRoot: root });
    writeFileSync(join(socialDir, "stale.png"), "stale");
    await generateSocialImages({ outputRoot: root });

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
  }, 10_000);

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

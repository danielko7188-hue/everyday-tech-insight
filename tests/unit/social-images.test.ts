import { createHash } from "node:crypto";
import {
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

describe("social image portfolio", () => {
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
  });

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

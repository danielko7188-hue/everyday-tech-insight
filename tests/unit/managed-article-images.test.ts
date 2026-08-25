import {
  lstat,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  auditManagedArticleImages,
  classifyManagedArticleSourceFileNames,
  findCaseFoldedDuplicateBasenames,
  inspectManagedArticleImage,
  MANAGED_ARTICLE_IMAGE_MAX_BYTES,
  parseManagedArticleImageUrl,
  scanManagedImagesInMarkdown,
  validateManagedArticleImageMetadata,
} from "../../src/utils/managed-article-images.mjs";

const temporaryDirectories: string[] = [];

async function makeRepository() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "eti-managed-images-"),
  );
  temporaryDirectories.push(repositoryRoot);
  const sourceRoot = path.join(
    repositoryRoot,
    "src",
    "content-assets",
    "articles",
  );
  await mkdir(sourceRoot, { recursive: true });
  return { repositoryRoot, sourceRoot };
}

async function rasterBuffer(
  format: "png" | "webp" | "jpg" | "jpeg",
  { width = 12, height = 8 }: { width?: number; height?: number } = {},
) {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#6d28d9",
    },
  });
  if (format === "png") return image.png().toBuffer();
  if (format === "webp") return image.webp().toBuffer();
  return image.jpeg().toBuffer();
}

function isUnavailableLinkError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    ["EPERM", "EACCES"].includes(String((error as NodeJS.ErrnoException).code))
  );
}

function corruptPngIdat(bytes: Buffer) {
  const corrupted = Buffer.from(bytes);
  let offset = 8;
  while (offset + 12 <= corrupted.length) {
    const chunkLength = corrupted.readUInt32BE(offset);
    const chunkType = corrupted.toString("ascii", offset + 4, offset + 8);
    if (chunkType === "IDAT" && chunkLength > 0) {
      const payloadIndex = offset + 8 + Math.floor(chunkLength / 2);
      corrupted[payloadIndex] = (corrupted[payloadIndex] ?? 0) ^ 0xff;
      return corrupted;
    }
    offset += 12 + chunkLength;
  }
  throw new Error("PNG fixture did not contain an IDAT chunk.");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("managed article image URL policy", () => {
  it.each(["webp", "png", "jpg", "jpeg"])(
    "accepts the exact slug-prefixed flat .%s URL",
    (extension) => {
      expect(
        parseManagedArticleImageUrl(
          `/images/articles/a-practical-guide-decision-flow.${extension}`,
          "a-practical-guide",
        ),
      ).toEqual({
        extension,
        filename: `a-practical-guide-decision-flow.${extension}`,
        mimeType:
          extension === "png"
            ? "image/png"
            : extension === "webp"
              ? "image/webp"
              : "image/jpeg",
        publicUrl: `/images/articles/a-practical-guide-decision-flow.${extension}`,
      });
    },
  );

  it.each([
    "/images/articles/a-practical-guide.png",
    "/images/articles/a-practical-guide-.png",
    "/images/articles/a-practical-guide--flow.png",
    "/images/articles/a-practical-guide_decision.png",
    "/images/articles/a-practical-guide-decision flow.png",
    "/images/articles/A-practical-guide-decision.png",
    "/images/articles/a-practical-guide-decision.PNG",
    "/images/articles/another-guide-decision.png",
    "/images/articles/nested/a-practical-guide-decision.png",
    "/images/articles/../a-practical-guide-decision.png",
    "/images/articles/a-practical-guide-decision.png?download=1",
    "/images/articles/a-practical-guide-decision.png#caption",
    "/images/articles/a-practical-guide-%64ecision.png",
    "\\images\\articles\\a-practical-guide-decision.png",
    "C:\\images\\articles\\a-practical-guide-decision.png",
    "\\\\server\\share\\a-practical-guide-decision.png",
    "//images/articles/a-practical-guide-decision.png",
    "https://example.test/a-practical-guide-decision.png",
    "data:image/png;base64,AAAA",
  ])("rejects an unsafe or incorrectly owned URL: %s", (publicUrl) => {
    expect(() =>
      parseManagedArticleImageUrl(publicUrl, "a-practical-guide"),
    ).toThrow(/exact managed article image URL/i);
  });
});

describe("managed article image inspection", () => {
  it.each(["png", "webp", "jpg", "jpeg"] as const)(
    "decodes a real .%s raster and returns trustworthy response metadata",
    async (extension) => {
      const { repositoryRoot, sourceRoot } = await makeRepository();
      const filename = `a-practical-guide-decision-flow.${extension}`;
      const bytes = await rasterBuffer(extension);
      await writeFile(path.join(sourceRoot, filename), bytes);

      const inspected = await inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: `/images/articles/${filename}`,
        repositoryRoot,
      });

      expect(inspected).toMatchObject({
        byteLength: bytes.byteLength,
        extension,
        filename,
        height: 8,
        mimeType:
          extension === "png"
            ? "image/png"
            : extension === "webp"
              ? "image/webp"
              : "image/jpeg",
        publicUrl: `/images/articles/${filename}`,
        width: 12,
      });
      expect(Buffer.compare(inspected.bytes, bytes)).toBe(0);
    },
  );

  it("rejects a header-valid PNG whose IDAT pixel payload is corrupt", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const filename = "a-practical-guide-corrupt-pixels.png";
    const bytes = corruptPngIdat(await rasterBuffer("png"));
    await expect(sharp(bytes).metadata()).resolves.toMatchObject({
      format: "png",
      width: 12,
      height: 8,
    });
    await writeFile(path.join(sourceRoot, filename), bytes);

    await expect(
      inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: `/images/articles/${filename}`,
        repositoryRoot,
      }),
    ).rejects.toThrow(/fully decoded|pixel/i);
  });

  it("rejects a file that changes after descriptor-backed reading", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const filename = "a-practical-guide-changing-file.png";
    const sourcePath = path.join(sourceRoot, filename);
    await writeFile(sourcePath, await rasterBuffer("png"));

    await expect(
      inspectManagedArticleImage(
        {
          articleSlug: "a-practical-guide",
          publicUrl: `/images/articles/${filename}`,
          repositoryRoot,
        },
        {
          afterRead: async () => {
            await writeFile(
              sourcePath,
              await rasterBuffer("png", { width: 13 }),
            );
          },
        },
      ),
    ).rejects.toThrow(/changed while/i);
  });

  it("caps descriptor reads when a file grows after its initial stat", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const filename = "a-practical-guide-growing-file.png";
    const sourcePath = path.join(sourceRoot, filename);
    await writeFile(sourcePath, await rasterBuffer("png"));
    let maximumObservedRead = 0;
    let observedReadLimit = 0;

    await expect(
      inspectManagedArticleImage(
        {
          articleSlug: "a-practical-guide",
          publicUrl: `/images/articles/${filename}`,
          repositoryRoot,
        },
        {
          afterInitialStat: async () => {
            await writeFile(
              sourcePath,
              Buffer.alloc(MANAGED_ARTICLE_IMAGE_MAX_BYTES + 10_000, 0x61),
            );
          },
          onReadProgress: ({
            readLimit,
            totalBytesRead,
          }: {
            readLimit: number;
            totalBytesRead: number;
          }) => {
            observedReadLimit = readLimit;
            maximumObservedRead = Math.max(maximumObservedRead, totalBytesRead);
          },
        },
      ),
    ).rejects.toThrow(/changed while|byte limit/i);
    expect(observedReadLimit).toBeGreaterThan(0);
    expect(observedReadLimit).toBeLessThanOrEqual(
      MANAGED_ARTICLE_IMAGE_MAX_BYTES + 1,
    );
    expect(maximumObservedRead).toBeLessThanOrEqual(observedReadLimit);
  });

  it("uses orientation-aware dimensions", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const filename = "a-practical-guide-oriented-photo.jpg";
    const bytes = await sharp({
      create: {
        width: 12,
        height: 8,
        channels: 3,
        background: "#6d28d9",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    await writeFile(path.join(sourceRoot, filename), bytes);

    await expect(
      inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: `/images/articles/${filename}`,
        repositoryRoot,
      }),
    ).resolves.toMatchObject({ width: 8, height: 12 });
  });

  it("accepts exact size and dimension boundaries", () => {
    expect(
      validateManagedArticleImageMetadata(
        { format: "png", width: 3_200, height: 3_200, pages: 1 },
        "png",
        MANAGED_ARTICLE_IMAGE_MAX_BYTES,
      ),
    ).toEqual({ format: "png", width: 3_200, height: 3_200 });
  });

  it.each([
    [
      "oversized bytes",
      { format: "png", width: 10, height: 10 },
      "png",
      1_500_001,
      /1,500,000 bytes/,
    ],
    [
      "zero width",
      { format: "png", width: 0, height: 10 },
      "png",
      100,
      /positive decoded dimensions/,
    ],
    [
      "missing height",
      { format: "png", width: 10 },
      "png",
      100,
      /positive decoded dimensions/,
    ],
    [
      "wide raster",
      { format: "png", width: 3_201, height: 10 },
      "png",
      100,
      /3,200 pixels/,
    ],
    [
      "tall raster",
      { format: "png", width: 10, height: 3_201 },
      "png",
      100,
      /3,200 pixels/,
    ],
    [
      "animated raster",
      { format: "webp", width: 10, height: 10, pages: 2 },
      "webp",
      100,
      /single-frame/,
    ],
    [
      "multipage raster",
      { format: "jpeg", width: 10, height: 10, pages: 3 },
      "jpg",
      100,
      /single-frame/,
    ],
    [
      "extension mismatch",
      { format: "jpeg", width: 10, height: 10 },
      "png",
      100,
      /does not match/,
    ],
    [
      "unrecognized format",
      { format: "svg", width: 10, height: 10 },
      "png",
      100,
      /does not match/,
    ],
  ] as const)("rejects %s", (_label, metadata, extension, bytes, message) => {
    expect(() =>
      validateManagedArticleImageMetadata(metadata, extension, bytes),
    ).toThrow(message);
  });

  it.each([
    ["corrupt bytes", Buffer.from("not an image")],
    [
      "disguised HTML",
      Buffer.from("<!doctype html><title>not an image</title>"),
    ],
    [
      "disguised SVG",
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    ],
  ])("rejects %s", async (_label, bytes) => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const filename = "a-practical-guide-decision-flow.png";
    await writeFile(path.join(sourceRoot, filename), bytes);

    await expect(
      inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: `/images/articles/${filename}`,
        repositoryRoot,
      }),
    ).rejects.toThrow(/decode|format|image/i);
  });

  it("rejects decoded content that does not match its extension", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const filename = "a-practical-guide-decision-flow.png";
    await writeFile(path.join(sourceRoot, filename), await rasterBuffer("jpg"));

    await expect(
      inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: `/images/articles/${filename}`,
        repositoryRoot,
      }),
    ).rejects.toThrow(/does not match/);
  });

  it("rejects a nonregular path in place of a source file", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const filename = "a-practical-guide-decision-flow.png";
    await mkdir(path.join(sourceRoot, filename));

    await expect(
      inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: `/images/articles/${filename}`,
        repositoryRoot,
      }),
    ).rejects.toThrow(/regular file/);
  });

  it("rejects a symlinked media root", async (context) => {
    const repositoryRoot = await mkdtemp(
      path.join(os.tmpdir(), "eti-managed-images-root-link-"),
    );
    temporaryDirectories.push(repositoryRoot);
    const realRoot = path.join(repositoryRoot, "real-images");
    const sourceRoot = path.join(
      repositoryRoot,
      "src",
      "content-assets",
      "articles",
    );
    await mkdir(realRoot, { recursive: true });
    await mkdir(path.dirname(sourceRoot), { recursive: true });
    const filename = "a-practical-guide-decision-flow.png";
    await writeFile(path.join(realRoot, filename), await rasterBuffer("png"));
    try {
      await symlink(realRoot, sourceRoot, "junction");
    } catch (error) {
      if (isUnavailableLinkError(error)) return context.skip();
      throw error;
    }

    await expect(
      inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: `/images/articles/${filename}`,
        repositoryRoot,
      }),
    ).rejects.toThrow(/symbolic link|junction/i);
  });

  it("rejects a symlinked repository root", async (context) => {
    const container = await mkdtemp(
      path.join(os.tmpdir(), "eti-managed-images-repository-link-"),
    );
    temporaryDirectories.push(container);
    const repositoryRoot = path.join(container, "linked-repository");
    const realRepositoryRoot = path.join(container, "real-repository");
    const sourceRoot = path.join(
      realRepositoryRoot,
      "src",
      "content-assets",
      "articles",
    );
    await mkdir(sourceRoot, { recursive: true });
    const filename = "a-practical-guide-decision-flow.png";
    await writeFile(path.join(sourceRoot, filename), await rasterBuffer("png"));
    try {
      await symlink(realRepositoryRoot, repositoryRoot, "junction");
    } catch (error) {
      if (isUnavailableLinkError(error)) return context.skip();
      throw error;
    }

    await expect(
      inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: `/images/articles/${filename}`,
        repositoryRoot,
      }),
    ).rejects.toThrow(/symbolic link|junction/i);
  });

  it("rejects a symlinked ancestor below the repository root", async (context) => {
    const repositoryRoot = await mkdtemp(
      path.join(os.tmpdir(), "eti-managed-images-ancestor-link-"),
    );
    temporaryDirectories.push(repositoryRoot);
    const realSourceParent = path.join(repositoryRoot, "real-src");
    await mkdir(path.join(realSourceParent, "content-assets", "articles"), {
      recursive: true,
    });
    const filename = "a-practical-guide-decision-flow.png";
    await writeFile(
      path.join(realSourceParent, "content-assets", "articles", filename),
      await rasterBuffer("png"),
    );
    try {
      await symlink(
        realSourceParent,
        path.join(repositoryRoot, "src"),
        "junction",
      );
    } catch (error) {
      if (isUnavailableLinkError(error)) return context.skip();
      throw error;
    }

    await expect(
      inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: `/images/articles/${filename}`,
        repositoryRoot,
      }),
    ).rejects.toThrow(/symbolic link|junction/i);
  });

  it("rejects a symlinked source file", async (context) => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const target = path.join(repositoryRoot, "outside.png");
    const linked = path.join(sourceRoot, "a-practical-guide-decision-flow.png");
    await writeFile(target, await rasterBuffer("png"));
    try {
      await symlink(target, linked, "file");
    } catch (error) {
      if (isUnavailableLinkError(error)) return context.skip();
      throw error;
    }
    expect((await lstat(linked)).isSymbolicLink()).toBe(true);

    await expect(
      inspectManagedArticleImage({
        articleSlug: "a-practical-guide",
        publicUrl: "/images/articles/a-practical-guide-decision-flow.png",
        repositoryRoot,
      }),
    ).rejects.toThrow(/symbolic link|junction/i);
  });

  it("detects case-folded duplicate basenames independent of host filesystem", () => {
    expect(
      findCaseFoldedDuplicateBasenames([
        "guide-decision.png",
        "guide-decision.PNG",
        "guide-other.webp",
      ]),
    ).toEqual([["guide-decision.png", "guide-decision.PNG"]]);
  });

  it("detects case-fold collisions before rejecting a mixed-case extension", () => {
    expect(
      classifyManagedArticleSourceFileNames([
        "guide-procedure-flow.png",
        "GUIDE-PROCEDURE-FLOW.PNG",
      ]),
    ).toEqual({
      duplicateGroups: [
        ["guide-procedure-flow.png", "GUIDE-PROCEDURE-FLOW.PNG"],
      ],
      rasterFileNames: ["guide-procedure-flow.png"],
      unsupportedFileNames: ["GUIDE-PROCEDURE-FLOW.PNG"],
    });
  });
});

describe("managed Markdown image policy", () => {
  it("resolves direct, full, collapsed, and shortcut image references structurally", () => {
    const body = `
![Decision workflow with review and approval steps](/images/articles/a-practical-guide-direct-flow.png)
![Quality scorecard with weighted review columns][scorecard]
![Collapsed workflow showing the escalation path][]
![Shortcut diagram showing the approval boundary]

[scorecard]: /images/articles/a-practical-guide-quality-scorecard.webp
[Collapsed workflow showing the escalation path]: /images/articles/a-practical-guide-collapsed-flow.jpg
[Shortcut diagram showing the approval boundary]: /images/articles/a-practical-guide-shortcut-flow.jpeg
`;

    const result = scanManagedImagesInMarkdown(body, {
      articleSlug: "a-practical-guide",
      fileName: "a-practical-guide.md",
    });

    expect(result.findings).toEqual([]);
    expect(result.references.map(({ publicUrl }) => publicUrl)).toEqual([
      "/images/articles/a-practical-guide-direct-flow.png",
      "/images/articles/a-practical-guide-quality-scorecard.webp",
      "/images/articles/a-practical-guide-collapsed-flow.jpg",
      "/images/articles/a-practical-guide-shortcut-flow.jpeg",
    ]);
  });

  it("retains duplicate Markdown references for audit context", () => {
    const image =
      "![Decision workflow with approval steps](/images/articles/a-practical-guide-decision-flow.png)";
    const result = scanManagedImagesInMarkdown(`${image}\n\n${image}`, {
      articleSlug: "a-practical-guide",
      fileName: "a-practical-guide.md",
    });

    expect(result.findings).toEqual([]);
    expect(result.references).toHaveLength(2);
  });

  it("rejects ambiguous duplicate definitions used by an image reference", () => {
    const result = scanManagedImagesInMarkdown(
      `![Decision workflow with approval steps][flow]

[flow]: /images/articles/a-practical-guide-first-flow.png
[flow]: /images/articles/a-practical-guide-second-flow.png`,
      {
        articleSlug: "a-practical-guide",
        fileName: "a-practical-guide.md",
      },
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "duplicate-image-definition" }),
    );
  });

  it.each([
    [
      "unresolved reference",
      "![Decision workflow with approval steps][missing]",
      "unresolved-image-reference",
    ],
    [
      "remote image",
      "![Decision workflow with approval steps](https://example.test/image.png)",
      "managed-image-url",
    ],
    [
      "traversal image",
      "![Decision workflow with approval steps](../private.png)",
      "managed-image-url",
    ],
    [
      "wrong slug",
      "![Decision workflow with approval steps](/images/articles/another-guide-flow.png)",
      "managed-image-url",
    ],
    [
      "empty alt",
      "![](/images/articles/a-practical-guide-decision-flow.png)",
      "body-image-alt",
    ],
    [
      "generic alt",
      "![Image](/images/articles/a-practical-guide-decision-flow.png)",
      "body-image-alt",
    ],
    [
      "generic screenshot alt",
      "![A screenshot](/images/articles/a-practical-guide-decision-flow.png)",
      "body-image-alt",
    ],
    [
      "generic software screenshot alt",
      "![Screenshot of software](/images/articles/a-practical-guide-decision-flow.png)",
      "body-image-alt",
    ],
    [
      "filename alt",
      "![a practical guide decision flow](/images/articles/a-practical-guide-decision-flow.png)",
      "body-image-alt",
    ],
  ])("rejects a %s", (_label, body, expectedCode) => {
    const result = scanManagedImagesInMarkdown(body, {
      articleSlug: "a-practical-guide",
      fileName: "a-practical-guide.md",
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: expectedCode,
        location: "a-practical-guide.md",
      }),
    );
  });

  it("allows escaped and inline-code image-like text because neither is an image", () => {
    const result = scanManagedImagesInMarkdown(
      "\\![Not an image][missing]\n\n`![Also not an image][missing]`",
      {
        articleSlug: "a-practical-guide",
        fileName: "a-practical-guide.md",
      },
    );

    expect(result).toEqual({ findings: [], references: [] });
  });

  it.each([
    '<img src="/images/articles/a-practical-guide-flow.png" alt="Decision workflow">',
    '<picture><img src="/images/articles/a-practical-guide-flow.png" alt="Decision workflow"></picture>',
    '<source srcset="/images/articles/a-practical-guide-flow.webp">',
    '<svg><use href="/images/articles/a-practical-guide-flow.png"></use></svg>',
    '<object data="/images/articles/a-practical-guide-flow.png"></object>',
    '<embed src="/images/articles/a-practical-guide-flow.png">',
    '<div style="background-image:url(/images/articles/a-practical-guide-flow.png)">Visual</div>',
    "<!-- /images/articles/a-practical-guide-flow.png -->",
  ])("rejects every raw HTML form: %s", (body) => {
    expect(
      scanManagedImagesInMarkdown(body, {
        articleSlug: "a-practical-guide",
        fileName: "a-practical-guide.md",
      }).findings,
    ).toContainEqual(expect.objectContaining({ code: "raw-html" }));
  });

  it("finds raw HTML below roughly 5,000 nested Markdown nodes without overflowing", () => {
    const body = `${"> ".repeat(6_000)}<!-- hidden image bypass -->`;

    expect(
      scanManagedImagesInMarkdown(body, {
        articleSlug: "a-practical-guide",
        fileName: "a-practical-guide.md",
      }).findings,
    ).toContainEqual(expect.objectContaining({ code: "raw-html" }));
  });
});

describe("managed article image inventory", () => {
  it("validates every lifecycle state but publishes only deduplicated published references", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const articles = [
      {
        fileName: "published-guide.md",
        data: {
          slug: "published-guide",
          status: "published",
          heroImage: "/images/articles/published-guide-hero.png",
          heroImageAlt:
            "Team members reviewing the documented approval workflow",
          heroImageDecorative: false,
        },
        body: "![Decision workflow with approval steps](/images/articles/published-guide-body.webp)\n\n![Decision workflow with approval steps](/images/articles/published-guide-body.webp)",
      },
      ...(["draft", "review", "archived"] as const).map((status) => ({
        fileName: `${status}-guide.md`,
        data: { slug: `${status}-guide`, status },
        body: `![Decision workflow for the ${status} editorial state](/images/articles/${status}-guide-body.jpg)`,
      })),
    ];
    for (const [filename, format] of [
      ["published-guide-hero.png", "png"],
      ["published-guide-body.webp", "webp"],
      ["draft-guide-body.jpg", "jpg"],
      ["review-guide-body.jpg", "jpg"],
      ["archived-guide-body.jpg", "jpg"],
    ] as const) {
      await writeFile(
        path.join(sourceRoot, filename),
        await rasterBuffer(format),
      );
    }

    const audit = await auditManagedArticleImages(articles, { repositoryRoot });

    expect(audit.findings).toEqual([]);
    expect(
      audit.referencedImages.map(({ publicUrl }) => publicUrl).sort(),
    ).toEqual([
      "/images/articles/archived-guide-body.jpg",
      "/images/articles/draft-guide-body.jpg",
      "/images/articles/published-guide-body.webp",
      "/images/articles/published-guide-hero.png",
      "/images/articles/review-guide-body.jpg",
    ]);
    expect(
      audit.publishedImages.map(({ publicUrl }) => publicUrl).sort(),
    ).toEqual([
      "/images/articles/published-guide-body.webp",
      "/images/articles/published-guide-hero.png",
    ]);
  });

  it("handles a zero-reference repository with no source directory", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(os.tmpdir(), "eti-managed-images-empty-"),
    );
    temporaryDirectories.push(repositoryRoot);

    await expect(
      auditManagedArticleImages(
        [
          {
            fileName: "published-guide.md",
            data: { slug: "published-guide", status: "published" },
            body: "No managed image is used.",
          },
        ],
        { repositoryRoot },
      ),
    ).resolves.toEqual({
      findings: [],
      publishedImages: [],
      referencedImages: [],
    });
  });

  it.each(["directory", "file"] as const)(
    "rejects the legacy public media root when it exists as a %s",
    async (kind) => {
      const { repositoryRoot } = await makeRepository();
      const legacyRoot = path.join(
        repositoryRoot,
        "public",
        "images",
        "articles",
      );
      if (kind === "directory") {
        await mkdir(legacyRoot, { recursive: true });
      } else {
        await mkdir(path.dirname(legacyRoot), { recursive: true });
        await writeFile(legacyRoot, "shadow");
      }

      expect(
        (await auditManagedArticleImages([], { repositoryRoot })).findings,
      ).toContainEqual(
        expect.objectContaining({ code: "legacy-public-media-root" }),
      );
    },
  );

  it("rejects the legacy public media root when it is a junction", async (context) => {
    const { repositoryRoot } = await makeRepository();
    const legacyRoot = path.join(
      repositoryRoot,
      "public",
      "images",
      "articles",
    );
    const target = path.join(repositoryRoot, "legacy-public-target");
    await mkdir(path.dirname(legacyRoot), { recursive: true });
    await mkdir(target, { recursive: true });
    try {
      await symlink(target, legacyRoot, "junction");
    } catch (error) {
      if (isUnavailableLinkError(error)) return context.skip();
      throw error;
    }

    expect(
      (await auditManagedArticleImages([], { repositoryRoot })).findings,
    ).toContainEqual(
      expect.objectContaining({ code: "legacy-public-media-root" }),
    );
  });

  it("rejects the legacy public media root when it is a file symlink", async (context) => {
    const { repositoryRoot } = await makeRepository();
    const legacyRoot = path.join(
      repositoryRoot,
      "public",
      "images",
      "articles",
    );
    const target = path.join(repositoryRoot, "legacy-public-target.png");
    await mkdir(path.dirname(legacyRoot), { recursive: true });
    await writeFile(target, await rasterBuffer("png"));
    try {
      await symlink(target, legacyRoot, "file");
    } catch (error) {
      if (isUnavailableLinkError(error)) return context.skip();
      throw error;
    }

    expect(
      (await auditManagedArticleImages([], { repositoryRoot })).findings,
    ).toContainEqual(
      expect.objectContaining({ code: "legacy-public-media-root" }),
    );
  });

  it("rejects a public shadow of a valid repository-tracked managed image", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const filename = "published-guide-decision-flow.png";
    const bytes = await rasterBuffer("png");
    await writeFile(path.join(sourceRoot, filename), bytes);
    const publicRoot = path.join(
      repositoryRoot,
      "public",
      "images",
      "articles",
    );
    await mkdir(publicRoot, { recursive: true });
    await writeFile(path.join(publicRoot, filename), bytes);

    const audit = await auditManagedArticleImages(
      [
        {
          fileName: "published-guide.md",
          data: { slug: "published-guide", status: "published" },
          body: `![Decision workflow with approval steps](/images/articles/${filename})`,
        },
      ],
      { repositoryRoot },
    );

    expect(audit.findings).toContainEqual(
      expect.objectContaining({ code: "legacy-public-media-root" }),
    );
  });

  it("rejects one URL claimed by distinct article slugs", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    const filename = "guide-procedure-flow.png";
    await writeFile(path.join(sourceRoot, filename), await rasterBuffer("png"));

    const audit = await auditManagedArticleImages(
      [
        {
          fileName: "guide.md",
          data: { slug: "guide", status: "draft" },
          body: `![Draft procedure workflow with review steps](/images/articles/${filename})`,
        },
        {
          fileName: "guide-procedure.md",
          data: { slug: "guide-procedure", status: "published" },
          body: `![Published procedure workflow with review steps](/images/articles/${filename})`,
        },
      ],
      { repositoryRoot },
    );

    expect(audit.findings).toContainEqual(
      expect.objectContaining({ code: "ambiguous-managed-image-owner" }),
    );
    expect(audit.publishedImages).toEqual([]);
  });

  it("allows only the exact tracked empty-directory marker as non-media", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    await writeFile(path.join(sourceRoot, ".gitkeep"), "");

    await expect(
      auditManagedArticleImages([], { repositoryRoot }),
    ).resolves.toEqual({
      findings: [],
      publishedImages: [],
      referencedImages: [],
    });

    await writeFile(path.join(sourceRoot, ".gitkeep.png"), "");
    expect(
      (await auditManagedArticleImages([], { repositoryRoot })).findings,
    ).toContainEqual(expect.objectContaining({ code: "orphan-managed-image" }));

    await rm(path.join(sourceRoot, ".gitkeep.png"));
    await writeFile(path.join(sourceRoot, ".gitkeep"), "not empty");
    expect(
      (await auditManagedArticleImages([], { repositoryRoot })).findings,
    ).toContainEqual(
      expect.objectContaining({ code: "invalid-source-marker" }),
    );
  });

  it("rejects orphaned, nested, and non-raster source entries", async () => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    await writeFile(
      path.join(sourceRoot, "orphan-guide-image.png"),
      await rasterBuffer("png"),
    );
    await writeFile(path.join(sourceRoot, "notes.txt"), "not an image");
    await mkdir(path.join(sourceRoot, "nested"));

    const codes = (
      await auditManagedArticleImages([], { repositoryRoot })
    ).findings.map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "orphan-managed-image",
        "unsupported-source-entry",
        "nonregular-source-entry",
      ]),
    );
  });

  it("rejects a missing referenced file", async () => {
    const { repositoryRoot } = await makeRepository();
    const audit = await auditManagedArticleImages(
      [
        {
          fileName: "published-guide.md",
          data: { slug: "published-guide", status: "published" },
          body: "![Decision workflow with approval steps](/images/articles/published-guide-flow.png)",
        },
      ],
      { repositoryRoot },
    );

    expect(audit.findings).toContainEqual(
      expect.objectContaining({ code: "missing-or-invalid-managed-image" }),
    );
    expect(audit.publishedImages).toEqual([]);
  });

  it.each([
    [
      "decorative hero with text",
      { heroImageAlt: "A named decorative image", heroImageDecorative: true },
    ],
    [
      "informative hero without text",
      { heroImageAlt: "", heroImageDecorative: false },
    ],
    [
      "hero without decorative state",
      { heroImageAlt: "Meaningful workflow description" },
    ],
  ])("rejects %s", async (_label, heroMetadata) => {
    const { repositoryRoot, sourceRoot } = await makeRepository();
    await writeFile(
      path.join(sourceRoot, "published-guide-hero.png"),
      await rasterBuffer("png"),
    );
    const audit = await auditManagedArticleImages(
      [
        {
          fileName: "published-guide.md",
          data: {
            slug: "published-guide",
            status: "published",
            heroImage: "/images/articles/published-guide-hero.png",
            ...heroMetadata,
          },
          body: "No body image.",
        },
      ],
      { repositoryRoot },
    );

    expect(audit.findings).toContainEqual(
      expect.objectContaining({ code: "hero-image-alt" }),
    );
  });
});

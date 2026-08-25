import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import rehypeManagedArticleImages from "../../src/utils/rehype-managed-article-images.mjs";

const temporaryDirectories: string[] = [];

async function managedFixture() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "eti-rehype-image-"),
  );
  temporaryDirectories.push(repositoryRoot);
  const sourceRoot = path.join(
    repositoryRoot,
    "src",
    "content-assets",
    "articles",
  );
  await mkdir(sourceRoot, { recursive: true });
  const filename = "a-practical-guide-decision-flow.png";
  await writeFile(
    path.join(sourceRoot, filename),
    await sharp({
      create: {
        width: 17,
        height: 11,
        channels: 3,
        background: "#6d28d9",
      },
    })
      .png()
      .toBuffer(),
  );
  return {
    file: {
      cwd: repositoryRoot,
      path: path.join(
        repositoryRoot,
        "src",
        "content",
        "articles",
        "a-practical-guide.md",
      ),
    },
    repositoryRoot,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("managed article image rehype transformer", () => {
  it("overwrites intrinsic dimensions and lazy decoding attributes from decoded bytes", async () => {
    const { file } = await managedFixture();
    const image = {
      type: "element",
      tagName: "img",
      properties: {
        alt: "Decision workflow with approval and review steps",
        className: ["article-diagram"],
        decoding: "sync",
        height: 999,
        loading: "eager",
        src: "/images/articles/a-practical-guide-decision-flow.png",
        width: 999,
      },
      children: [],
    };
    const tree = { type: "root", children: [image] };

    await rehypeManagedArticleImages()(tree, file);

    expect(image.properties).toEqual({
      alt: "Decision workflow with approval and review steps",
      className: ["article-diagram"],
      decoding: "async",
      height: 11,
      loading: "lazy",
      src: "/images/articles/a-practical-guide-decision-flow.png",
      width: 17,
    });
  });

  it("fails on missing, malformed, wrong-owner, or generic-alt managed images", async () => {
    const { file } = await managedFixture();

    for (const [src, alt] of [
      [
        "/images/articles/a-practical-guide-missing.png",
        "Decision workflow with approval steps",
      ],
      [
        "/images/articles/a-practical-guide-../private.png",
        "Decision workflow with approval steps",
      ],
      [
        "/images/articles/another-guide-decision.png",
        "Decision workflow with approval steps",
      ],
      ["/images/articles/a-practical-guide-decision-flow.png", "Image"],
    ]) {
      const tree = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "img",
            properties: { alt, src },
            children: [],
          },
        ],
      };

      await expect(
        rehypeManagedArticleImages()(tree, file),
        src,
      ).rejects.toThrow(/managed|image|alternative text/i);
    }
  });

  it("leaves engineering SVG, social, favicon, remote, and non-image AST nodes unchanged", async () => {
    const { file } = await managedFixture();
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "svg",
          properties: { viewBox: "0 0 10 10" },
          children: [],
        },
        {
          type: "element",
          tagName: "img",
          properties: { src: "/social/article-guide.png", alt: "Preview" },
          children: [],
        },
        {
          type: "element",
          tagName: "img",
          properties: { src: "/favicon.svg", alt: "" },
          children: [],
        },
        {
          type: "element",
          tagName: "img",
          properties: {
            src: "/images/articles-visuals/example.svg",
            alt: "Engineering diagram",
          },
          children: [],
        },
        {
          type: "element",
          tagName: "img",
          properties: { src: "https://example.test/image.png", alt: "Remote" },
          children: [],
        },
        { type: "text", value: "Article prose" },
      ],
    };
    const before = structuredClone(tree);

    await rehypeManagedArticleImages()(tree, file);

    expect(tree).toEqual(before);
  });

  it("is registered after the existing table transformer", async () => {
    const config = await import("../../astro.config.mjs");
    const markdown = config.default.markdown;
    if (!markdown?.processor) {
      throw new Error("Astro Markdown processor is not configured.");
    }
    const processor = markdown.processor as typeof markdown.processor & {
      options: { rehypePlugins: Array<{ name?: string }> };
    };

    expect(
      processor.options.rehypePlugins.map(
        (plugin: { name?: string }) => plugin.name,
      ),
    ).toEqual(["rehypeWrapTables", "rehypeManagedArticleImages"]);
  });
});

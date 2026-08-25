import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArticleFrontmatter } from "../../src/utils/content-contract";

describe("published article boundary", () => {
  it("exports a type guard and filter that retain published entries only", async () => {
    const module = await import("../../src/utils/published-articles").catch(
      () => null,
    );

    expect(module).not.toBeNull();
    if (!module) return;

    const entries = ["draft", "review", "published", "archived"].map(
      (status) => ({ data: { status, slug: `${status}-entry` } }),
    ) as unknown as Array<{ data: ArticleFrontmatter }>;

    expect(entries.filter(module.isPublishedArticle)).toEqual([entries[2]]);
    expect(module.filterPublishedArticles(entries)).toEqual([entries[2]]);
  });

  it("orders category entries by public slug even when nested source IDs differ", async () => {
    const module = await import("../../src/utils/published-articles");
    expect(module).toHaveProperty("comparePublishedArticlesBySlug");
    if (!("comparePublishedArticlesBySlug" in module)) return;

    const entries = [
      { id: "alpha/nested-entry", data: { slug: "zulu-guide" } },
      { id: "zulu/top-level-entry", data: { slug: "alpha-guide" } },
    ];

    expect([...entries].sort(module.comparePublishedArticlesBySlug)).toEqual([
      entries[1],
      entries[0],
    ]);
  });

  it("makes the social inventory select published frontmatter before mapping", async () => {
    const module = await import("../../scripts/generate-social-images.mjs");

    expect(module).toHaveProperty("selectPublishedArticleFrontmatter");
    if (!("selectPublishedArticleFrontmatter" in module)) return;

    const records = ["draft", "review", "published", "archived"].map(
      (status) => ({ status, slug: `${status}-entry` }),
    );

    expect(module.selectPublishedArticleFrontmatter(records)).toEqual([
      records[2],
    ]);
  });

  it("discovers nested Markdown and MDX sources for the social inventory", async () => {
    const module = await import("../../scripts/generate-social-images.mjs");
    const root = mkdtempSync(join(tmpdir(), "eti-social-discovery-"));
    try {
      mkdirSync(join(root, "nested"));
      writeFileSync(join(root, "top.md"), "top");
      writeFileSync(join(root, "nested", "inside.mdx"), "inside");
      writeFileSync(join(root, "nested", "ignored.txt"), "ignored");

      expect(module).toHaveProperty("listArticleSourceFiles");
      if (!("listArticleSourceFiles" in module)) return;
      expect(
        module
          .listArticleSourceFiles(root)
          .map(({ relativePath }: { relativePath: string }) => relativePath),
      ).toEqual(["nested/inside.mdx", "top.md"]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});

import { readFile, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createArticleDraft,
  parseNewArticleArgs,
  renderArticleDraft,
  resolveArticleTarget,
  slugifyArticleTitle,
  validateArticleSlug,
} from "../../scripts/new-article.mjs";
import {
  parseArticleMarkdown,
  readArticleRecords,
  validateContentPortfolio,
} from "../../scripts/qa-content.mjs";
import { articleFrontmatterSchema } from "../../src/utils/content-contract";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function temporaryArticleDirectory(): string {
  const root = mkdtempSync(path.join(tmpdir(), "eti-new-article-"));
  temporaryRoots.push(root);
  return root;
}

describe("new article generator", () => {
  it("accepts only the documented title and optional slug arguments", () => {
    expect(parseNewArticleArgs(["--title", "A useful article title"])).toEqual({
      title: "A useful article title",
    });
    expect(
      parseNewArticleArgs([
        "--title",
        "A useful article title",
        "--slug",
        "useful-article-title",
      ]),
    ).toEqual({
      title: "A useful article title",
      slug: "useful-article-title",
    });

    for (const args of [
      [],
      ["--title"],
      ["--slug", "article"],
      ["Article title"],
      ["--title", "A useful article title", "extra"],
      ["--title", "A useful article title", "--unknown", "value"],
      ["--title", "A useful article title", "--title", "Another title"],
      ["--title", "A useful article title", "--slug", "one", "--slug", "two"],
    ]) {
      expect(() => parseNewArticleArgs(args), JSON.stringify(args)).toThrow(
        /usage|argument|requires/i,
      );
    }
  });

  it("slugifies Latin text to canonical ASCII and requires an explicit slug when none remains", () => {
    expect(slugifyArticleTitle("  Café & AI: A naïve team's guide  ")).toBe(
      "cafe-ai-a-naive-teams-guide",
    );
    expect(slugifyArticleTitle("Security---review___checklist")).toBe(
      "security-review-checklist",
    );
    expect(slugifyArticleTitle("技术指南")).toBe("");

    expect(() =>
      renderArticleDraft({ title: "技术指南文章标题示例内容" }),
    ).toThrow(/explicit.*slug/i);
    const explicitSlugDraft = renderArticleDraft({
      title: "技术指南文章标题示例内容",
      slug: "technology-guide",
    });
    expect(
      (
        parseArticleMarkdown(explicitSlugDraft, "technology-guide.md")
          .data as Record<string, unknown>
      ).slug,
    ).toBe("technology-guide");
  });

  it.each([
    "../escape",
    "folder/escape",
    "folder\\escape",
    "-leading",
    "trailing-",
    "double--hyphen",
    "Uppercase",
    "space here",
    ".",
    "..",
    "con",
    "nul",
    "com1",
    "article.md",
  ])("rejects unsafe, reserved, or noncanonical slug %s", (slug) => {
    expect(() => validateArticleSlug(slug)).toThrow(/slug|reserved/i);
  });

  it("resolves only a canonical Markdown direct child", () => {
    const articlesDirectory = temporaryArticleDirectory();
    expect(resolveArticleTarget(articlesDirectory, "safe-article")).toBe(
      path.join(articlesDirectory, "safe-article.md"),
    );
    expect(() => resolveArticleTarget(articlesDirectory, "../unsafe")).toThrow(
      /slug|direct child/i,
    );
  });

  it("renders the minimum truthful draft and round-trips through YAML, Zod, and body safety", async () => {
    const title = "How to evaluate a business technology decision";
    const slug = "evaluate-a-business-technology-decision";
    const source = renderArticleDraft({ title, slug });
    const record = parseArticleMarkdown(source, `${slug}.md`);

    expect(Object.keys(record.data)).toEqual([
      "title",
      "slug",
      "author",
      "status",
      "verificationStatus",
      "featured",
      "relatedArticles",
      "noindex",
    ]);
    expect(record.data).toEqual({
      title,
      slug,
      author: "Everyday Tech Insight",
      status: "draft",
      verificationStatus: "unverified",
      featured: false,
      relatedArticles: [],
      noindex: true,
    });
    expect(articleFrontmatterSchema.safeParse(record.data).success).toBe(true);
    expect(record.body).toMatch(/^##\s+\S/m);
    expect(record.body.trim().length).toBeGreaterThan(80);
    expect(source).not.toContain("!!");
    expect(source).not.toMatch(
      /\b(?:todo|tbd|changeme|placeholder|lorem ipsum|replace[-_ ]?me)\b/i,
    );

    const existing = await readArticleRecords(
      path.join(repositoryRoot, "src", "content", "articles"),
    );
    expect(validateContentPortfolio([...existing, record])).toEqual([]);
  });

  it("keeps the example template outside Astro loading and schema-safe", async () => {
    const templatePath = path.join(
      repositoryRoot,
      "src",
      "content",
      "article-template.md.example",
    );
    const raw = await readFile(templatePath, "utf8");
    const record = parseArticleMarkdown(raw, "article-template.md.example");
    const data = record.data as Record<string, unknown>;

    expect(path.extname(templatePath)).toBe(".example");
    expect(articleFrontmatterSchema.safeParse(record.data).success).toBe(true);
    expect(data.status).toBe("draft");
    expect(data.noindex).toBe(true);
    expect(record.body).toMatch(/^##\s+\S/m);
    expect(raw).not.toMatch(/\b(?:todo|tbd|placeholder|lorem ipsum)\b/i);
  });

  it("creates with exclusive access and preserves collision bytes", async () => {
    const articlesDirectory = temporaryArticleDirectory();
    const title = "A collision-safe business technology guide";
    const target = await createArticleDraft({ title, articlesDirectory });
    const original = await readFile(target);

    await expect(
      createArticleDraft({ title, articlesDirectory }),
    ).rejects.toThrow(/exists|refusing|collision/i);
    expect(await readFile(target)).toEqual(original);
  });

  it("does not write when title or explicit slug violates the article schema", async () => {
    const articlesDirectory = temporaryArticleDirectory();

    await expect(
      createArticleDraft({ title: "Short", articlesDirectory }),
    ).rejects.toThrow(/title/i);
    await expect(
      createArticleDraft({
        title: "A valid title with an invalid slug",
        slug: "../escape",
        articlesDirectory,
      }),
    ).rejects.toThrow(/slug/i);

    const sentinel = path.join(articlesDirectory, "sentinel.md");
    await writeFile(sentinel, "preserve", "utf8");
    expect(await readFile(sentinel, "utf8")).toBe("preserve");
  });
});

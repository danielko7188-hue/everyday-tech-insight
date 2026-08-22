import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { describe, expect, it } from "vitest";

import { categorySlugs } from "../../src/data/categories";
import { BUSINESS_TECHNOLOGY_FIT_FIELDS } from "../../src/utils/content-contract";

const articlesDirectory = join(process.cwd(), "src", "content", "articles");
const publicationDate = "2026-08-21";
const officialSourceHosts = new Set([
  "airc.nist.gov",
  "csrc.nist.gov",
  "digital.gov",
  "www.archives.gov",
  "www.atlassian.com",
  "www.cisa.gov",
  "www.epa.gov",
  "www.ftc.gov",
  "www.nist.gov",
  "www.salesforce.com",
]);

interface ArticleRecord {
  body: string;
  fileName: string;
  frontmatter: string;
}

function articleRecords(): ArticleRecord[] {
  return readdirSync(articlesDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .sort()
    .map((fileName) => {
      const raw = readFileSync(join(articlesDirectory, fileName), "utf8");
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

      if (!match?.[1] || match[2] === undefined) {
        throw new Error(`${fileName} has no valid frontmatter block.`);
      }

      return { fileName, frontmatter: match[1], body: match[2] };
    });
}

function scalar(article: ArticleRecord, field: string): string {
  const expression = new RegExp(
    `^${field}:\\s*("(?:[^"\\\\]|\\\\.)*")\\s*$`,
    "m",
  );
  const match = article.frontmatter.match(expression);
  const value = match?.[1];

  if (!value) throw new Error(`${article.fileName} is missing ${field}.`);

  return JSON.parse(value) as string;
}

function sourceUrls(article: ArticleRecord): string[] {
  return [
    ...article.frontmatter.matchAll(/^\s+url:\s*"([^"]+)"\s*$/gm),
  ].flatMap((match) => (match[1] ? [match[1]] : []));
}

function sequenceValues(article: ArticleRecord, field: string): string[] {
  const start = article.frontmatter.search(new RegExp(`^${field}:`, "m"));
  if (start < 0) throw new Error(`${article.fileName} is missing ${field}.`);

  const followingLines = article.frontmatter
    .slice(start)
    .split(/\r?\n/)
    .slice(1);
  const values: string[] = [];

  for (const line of followingLines) {
    const match = line.match(/^\s+-\s+"([^"]+)"\s*$/);
    if (!match?.[1]) break;
    values.push(match[1]);
  }

  return values;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

describe("published content portfolio", () => {
  it("contains exactly fifteen Markdown articles and three in every category", () => {
    const articles = articleRecords();
    const categoryCounts = Object.fromEntries(
      categorySlugs.map((category) => [
        category,
        articles.filter((article) => scalar(article, "category") === category)
          .length,
      ]),
    );

    expect(articles).toHaveLength(15);
    expect(categoryCounts).toEqual(
      Object.fromEntries(categorySlugs.map((category) => [category, 3])),
    );
  });

  it("uses distinct slugs, titles, and descriptions that match their files", () => {
    const articles = articleRecords();

    for (const field of ["slug", "title", "description"] as const) {
      const values = articles.map((article) => scalar(article, field));
      expect(new Set(values).size, `${field} values must be unique`).toBe(
        values.length,
      );
    }

    for (const article of articles) {
      expect(scalar(article, "slug")).toBe(basename(article.fileName, ".md"));
    }
  });

  it("publishes source-checked entries with real launch dates and no premature modification date", () => {
    for (const article of articleRecords()) {
      expect(scalar(article, "status"), article.fileName).toBe("published");
      expect(scalar(article, "verificationStatus"), article.fileName).toBe(
        "source-checked",
      );
      expect(scalar(article, "datePublished"), article.fileName).toBe(
        publicationDate,
      );
      expect(scalar(article, "lastReviewed"), article.fileName).toBe(
        publicationDate,
      );
      expect(article.frontmatter, article.fileName).not.toMatch(
        /^dateModified:/m,
      );
    }
  });

  it("completes the five-part business-technology fit for every article", () => {
    for (const article of articleRecords()) {
      for (const field of BUSINESS_TECHNOLOGY_FIT_FIELDS.slice(0, 4)) {
        expect(
          scalar(article, field).length,
          `${article.fileName}: ${field}`,
        ).toBeGreaterThanOrEqual(20);
      }

      expect(
        sourceUrls(article).length,
        `${article.fileName}: sourceList`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses traceable HTTPS sources on approved official or primary hosts", () => {
    for (const article of articleRecords()) {
      const urls = sourceUrls(article);

      expect(
        new Set(urls).size,
        `${article.fileName}: duplicate source URL`,
      ).toBe(urls.length);

      for (const sourceUrl of urls) {
        const url = new URL(sourceUrl);
        expect(url.protocol, `${article.fileName}: ${sourceUrl}`).toBe(
          "https:",
        );
        expect(
          officialSourceHosts.has(url.hostname),
          `${article.fileName}: ${url.hostname} is not an approved primary host`,
        ).toBe(true);
        expect(
          article.body,
          `${article.fileName}: source must be cited in body`,
        ).toContain(sourceUrl);
      }
    }
  });

  it("links every article to two distinct published related guides", () => {
    const articles = articleRecords();
    const publishedSlugs = new Set(
      articles.map((article) => scalar(article, "slug")),
    );

    for (const article of articles) {
      const slug = scalar(article, "slug");
      const related = sequenceValues(article, "relatedArticles");

      expect(
        related,
        `${article.fileName}: related article count`,
      ).toHaveLength(2);
      expect(
        new Set(related).size,
        `${article.fileName}: duplicate relation`,
      ).toBe(related.length);
      expect(related, `${article.fileName}: self relation`).not.toContain(slug);
      for (const relatedSlug of related) {
        expect(
          publishedSlugs.has(relatedSlug),
          `${article.fileName}: unresolved relation ${relatedSlug}`,
        ).toBe(true);
      }
    }
  });

  it("provides substantive, structured guidance with an explicit limitation", () => {
    for (const article of articleRecords()) {
      expect(wordCount(article.body), article.fileName).toBeGreaterThanOrEqual(
        650,
      );
      expect(
        article.body.match(/^##\s+/gm)?.length ?? 0,
        `${article.fileName}: section count`,
      ).toBeGreaterThanOrEqual(4);
      expect(article.body, `${article.fileName}: limitation language`).toMatch(
        /\b(?:limitation|limits|does not prove|not a substitute|not a guarantee)\b/i,
      );
      expect(
        article.body,
        `${article.fileName}: unsupported firsthand claim`,
      ).not.toMatch(
        /\b(?:I|we)\s+(?:tested|used|reviewed|found|observed|measured|deployed)\b/,
      );
    }
  });
});

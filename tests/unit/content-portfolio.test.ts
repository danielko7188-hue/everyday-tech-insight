import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { describe, expect, it } from "vitest";

import { todayInPublicationTimeZone } from "../../scripts/qa-content.mjs";
import { siteConfig } from "../../site.config.mjs";
import { categorySlugs } from "../../src/data/categories";
import { BUSINESS_TECHNOLOGY_FIT_FIELDS } from "../../src/utils/content-contract";

const articlesDirectory = join(process.cwd(), "src", "content", "articles");
const contentAuditPath = join(process.cwd(), "docs", "CONTENT_AUDIT.md");
const launchArticleSlugs = [
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
] as const;

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

function articleBySlug(slug: string): ArticleRecord {
  const article = articleRecords().find(
    (candidate) => scalar(candidate, "slug") === slug,
  );

  if (!article) throw new Error(`Missing article: ${slug}`);

  return article;
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

function optionalScalar(
  article: ArticleRecord,
  field: string,
): string | undefined {
  const expression = new RegExp(
    `^${field}:\\s*("(?:[^"\\\\]|\\\\.)*")\\s*$`,
    "m",
  );
  const value = article.frontmatter.match(expression)?.[1];
  return value ? (JSON.parse(value) as string) : undefined;
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

function whitespaceTokenCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

describe("published content portfolio", () => {
  it("contains at least fifteen Markdown articles and three in every category", () => {
    const articles = articleRecords();
    const categoryCounts = Object.fromEntries(
      categorySlugs.map((category) => [
        category,
        articles.filter((article) => scalar(article, "category") === category)
          .length,
      ]),
    );

    expect(articles.length).toBeGreaterThanOrEqual(15);
    for (const category of categorySlugs) {
      expect(categoryCounts[category]).toBeGreaterThanOrEqual(3);
    }
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

  it("keeps publication evidence ordered from launch through the current date", () => {
    const today = todayInPublicationTimeZone();
    for (const article of articleRecords()) {
      expect(scalar(article, "status"), article.fileName).toBe("published");
      expect(scalar(article, "verificationStatus"), article.fileName).toBe(
        "source-checked",
      );
      const published = scalar(article, "datePublished");
      const reviewed = scalar(article, "lastReviewed");
      const modified = optionalScalar(article, "dateModified");
      expect(
        published.localeCompare(siteConfig.launchDate),
        article.fileName,
      ).toBeGreaterThanOrEqual(0);
      expect(
        published.localeCompare(today),
        article.fileName,
      ).toBeLessThanOrEqual(0);
      expect(
        reviewed.localeCompare(published),
        article.fileName,
      ).toBeGreaterThanOrEqual(0);
      expect(
        reviewed.localeCompare(today),
        article.fileName,
      ).toBeLessThanOrEqual(0);
      if (modified) {
        expect(
          modified.localeCompare(published),
          article.fileName,
        ).toBeGreaterThan(0);
        expect(
          modified.localeCompare(today),
          article.fileName,
        ).toBeLessThanOrEqual(0);
      }
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
          article.body,
          `${article.fileName}: source must be cited in body`,
        ).toContain(sourceUrl);
      }
    }
  });

  it("links related guides only to distinct published articles", () => {
    const articles = articleRecords();
    const publishedSlugs = new Set(
      articles.map((article) => scalar(article, "slug")),
    );

    for (const article of articles) {
      const slug = scalar(article, "slug");
      const related = sequenceValues(article, "relatedArticles");

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
      expect(
        whitespaceTokenCount(article.body),
        article.fileName,
      ).toBeGreaterThanOrEqual(650);
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

  it("distinguishes literal two-media 3-2-1 from an all-cloud resilience adaptation", () => {
    const article = articleBySlug(
      "back-up-business-files-with-the-3-2-1-method",
    );

    expect(article.body).toMatch(
      /literal[\s\S]{0,240}two different media types/i,
    );
    expect(article.body).toMatch(/\b(?:tape|optical media)\b/i);
    expect(article.body).toMatch(
      /all-cloud[\s\S]{0,240}(?:resilience adaptation|not literal 3-2-1)/i,
    );
  });

  it("keeps contingent exit exposure outside a total unless exit occurs within the horizon", () => {
    const article = articleBySlug(
      "calculate-the-total-cost-of-business-software",
    );

    expect(scalar(article, "summary")).toMatch(/contingent exit exposure/i);
    expect(article.body).toMatch(
      /include[\s\S]{0,160}exit cost[\s\S]{0,160}total only when[\s\S]{0,160}within the (?:chosen )?horizon/i,
    );
    expect(article.body).toMatch(
      /contingent exit exposure[\s\S]{0,160}(?:separately|outside the total)/i,
    );
  });

  it("maps the pilot summary to the four weekly stages in the article", () => {
    const summary = scalar(
      articleBySlug("run-a-30-day-business-technology-pilot"),
      "summary",
    );

    expect(summary).toMatch(
      /week 1[\s\S]*week 2[\s\S]*week 3[\s\S]*(?:exceptions|failure)[\s\S]*week 4[\s\S]*(?:export|decision)/i,
    );
  });

  it("reports current whitespace-delimited Markdown token totals without calling them words", () => {
    const audit = readFileSync(contentAuditPath, "utf8");
    const totalPattern =
      /\|\s*Total article body whitespace-delimited Markdown tokens\s*\|\s*([\d,]+)\s*\|/;
    const rangePattern =
      /\|\s*Body whitespace-token range\s*\|\s*([\d,]+)–([\d,]+)\s*\|/;

    expect(audit).toMatch(totalPattern);
    expect(audit).toMatch(rangePattern);
    expect(audit).not.toMatch(/\b(?:body words|word-count|word counts)\b/i);

    const totalMatch = audit.match(totalPattern);
    const rangeMatch = audit.match(rangePattern);
    if (!totalMatch?.[1] || !rangeMatch?.[1] || !rangeMatch[2]) return;

    const tokenCounts = launchArticleSlugs.map((slug) =>
      whitespaceTokenCount(articleBySlug(slug).body),
    );
    const parseNumber = (value: string) => Number(value.replaceAll(",", ""));

    expect(parseNumber(totalMatch[1])).toBe(
      tokenCounts.reduce((total, count) => total + count, 0),
    );
    expect(parseNumber(rangeMatch[1])).toBe(Math.min(...tokenCounts));
    expect(parseNumber(rangeMatch[2])).toBe(Math.max(...tokenCounts));
  });
});

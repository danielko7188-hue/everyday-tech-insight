import { readFileSync } from "node:fs";

import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

import { readArticleRecords } from "../../scripts/qa-content.mjs";
import { articleFrontmatterSchema } from "../../src/utils/content-contract";

type EditorialOperations = {
  qualityRecords: Array<{
    slug: string;
    humanEditorialReview: string;
    reviewedBy: string | null;
    reviewedAt: string | null;
  }>;
};

function editorialOperations(): EditorialOperations {
  return load(
    readFileSync(
      new URL("../../docs/editorial-operations.yml", import.meta.url),
      "utf8",
    ),
  ) as EditorialOperations;
}

describe("ISSUE-003 review-date evidence boundary", () => {
  it("withholds lastReviewed when the authoritative human review is unresolved", async () => {
    const articles = await readArticleRecords();
    const bySlug = new Map(
      articles.map((article) => [article.data.slug, article.data]),
    );

    for (const record of editorialOperations().qualityRecords) {
      if (
        record.humanEditorialReview === "OWNER REVIEW REQUIRED" &&
        record.reviewedBy === null &&
        record.reviewedAt === null
      ) {
        expect(
          bySlug.get(record.slug)?.lastReviewed,
          record.slug,
        ).toBeUndefined();
      }
    }
  });

  it("allows published content to omit a review date until a real review exists", async () => {
    const [article] = await readArticleRecords();
    const candidate = { ...article!.data } as Record<string, unknown>;
    delete candidate.lastReviewed;

    expect(articleFrontmatterSchema.safeParse(candidate).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  partitionCategoryEdition,
  selectCategoryLayout,
} from "../../src/utils/category-edition";

describe("category layout selection", () => {
  it.each([
    [0, "compact"],
    [3, "compact"],
    [6, "editorial"],
    [11, "editorial"],
    [12, "archive"],
  ] as const)("selects %s articles as %s", (count, expected) => {
    expect(selectCategoryLayout(count)).toBe(expected);
  });

  it("returns all compact articles once without manufacturing a lead", () => {
    expect(partitionCategoryEdition([])).toEqual({
      layout: "compact",
      articles: [],
    });
    const articles = ["first", "second", "third"];
    expect(partitionCategoryEdition(articles)).toEqual({
      layout: "compact",
      articles,
    });
  });

  it.each([6, 11])(
    "uses one lead, two features, and an ordered remainder for %s articles",
    (count) => {
      const articles = Array.from({ length: count }, (_, index) => index + 1);
      const edition = partitionCategoryEdition(articles);

      expect(edition).toEqual({
        layout: "editorial",
        lead: 1,
        features: [2, 3],
        remainder: articles.slice(3),
      });
    },
  );

  it("uses the first three featured, next three recent, and the ordered archive at twelve", () => {
    const articles = Array.from({ length: 12 }, (_, index) => index + 1);
    const edition = partitionCategoryEdition(articles);

    expect(edition).toEqual({
      layout: "archive",
      featured: [1, 2, 3],
      recent: [4, 5, 6],
      archive: [7, 8, 9, 10, 11, 12],
    });
  });

  it.each([0, 3, 6, 11, 12])(
    "preserves membership and stable order at %s articles",
    (count) => {
      const articles = Array.from(
        { length: count },
        (_, index) => `guide-${index + 1}`,
      );
      const edition = partitionCategoryEdition(articles);
      const flattened =
        edition.layout === "compact"
          ? edition.articles
          : edition.layout === "editorial"
            ? [edition.lead, ...edition.features, ...edition.remainder]
            : [...edition.featured, ...edition.recent, ...edition.archive];

      expect(flattened).toEqual(articles);
      expect(new Set(flattened).size).toBe(articles.length);
    },
  );
});

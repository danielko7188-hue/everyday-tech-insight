import { describe, expect, it } from "vitest";

import { partitionCategoryEdition } from "../../src/utils/category-edition";

describe("category edition partition", () => {
  it("returns empty branches for an empty category", () => {
    expect(partitionCategoryEdition([])).toEqual({
      lead: undefined,
      features: [],
      remainder: [],
    });
  });

  it("keeps a single article as the lead without manufacturing support", () => {
    expect(partitionCategoryEdition(["lead"])).toEqual({
      lead: "lead",
      features: [],
      remainder: [],
    });
  });

  it("uses one lead and two features for the current three-article edition", () => {
    expect(
      partitionCategoryEdition(["lead", "feature-1", "feature-2"]),
    ).toEqual({
      lead: "lead",
      features: ["feature-1", "feature-2"],
      remainder: [],
    });
  });

  it("preserves every 4+ article once and in stable order", () => {
    const articles = ["lead", "feature-1", "feature-2", "more-1", "more-2"];
    const edition = partitionCategoryEdition(articles);
    const flattened = [
      ...(edition.lead === undefined ? [] : [edition.lead]),
      ...edition.features,
      ...edition.remainder,
    ];

    expect(edition).toEqual({
      lead: "lead",
      features: ["feature-1", "feature-2"],
      remainder: ["more-1", "more-2"],
    });
    expect(flattened).toEqual(articles);
    expect(new Set(flattened).size).toBe(articles.length);
  });
});

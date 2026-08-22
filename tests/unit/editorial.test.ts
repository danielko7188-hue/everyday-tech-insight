import { describe, expect, it } from "vitest";

import {
  categories,
  categoryAccents,
  type CategorySlug,
} from "../../src/data/categories";
import {
  homepageCuration,
  resolveHomepageCuration,
} from "../../src/data/editorial";

interface TestArticle {
  data: {
    slug: string;
    status: "draft" | "published";
  };
}

const configuredSlugs = Object.values(homepageCuration).flat();
const publishedArticles = configuredSlugs.map((slug) => ({
  data: { slug, status: "published" as const },
}));

describe("homepage editorial curation", () => {
  it("resolves every configured slug without substituting another article", () => {
    const resolved = resolveHomepageCuration(publishedArticles);

    expect(
      Object.fromEntries(
        Object.entries(resolved).map(([section, articles]) => [
          section,
          articles.map((article) => article.data.slug),
        ]),
      ),
    ).toEqual(homepageCuration);
  });

  it("rejects a configured slug that does not exist", () => {
    expect(() => resolveHomepageCuration(publishedArticles.slice(1))).toThrow(
      /does not exist/i,
    );
  });

  it("rejects a configured article that is not published", () => {
    const articles: TestArticle[] = publishedArticles.map((article, index) => ({
      data: {
        slug: article.data.slug,
        status: index === 0 ? "draft" : "published",
      },
    }));

    expect(() => resolveHomepageCuration(articles)).toThrow(/not published/i);
  });

  it("rejects a slug reused across curation sections", () => {
    const duplicateCuration = {
      ...homepageCuration,
      briefing: [
        homepageCuration.lead[0],
        ...homepageCuration.briefing.slice(1),
      ],
    };

    expect(() =>
      resolveHomepageCuration(publishedArticles, duplicateCuration),
    ).toThrow(/more than once/i);
  });
});

describe("category accents", () => {
  it("uses one exact accent registry for every category record", () => {
    expect(categoryAccents).toEqual({
      "ai-automation": "#0f746c",
      "business-software": "#315f98",
      "cybersecurity-data-protection": "#a83d3a",
      "digital-operations": "#397143",
      "technology-strategy": "#9a5b13",
    } satisfies Record<CategorySlug, string>);
    expect(
      Object.fromEntries(categories.map(({ slug, accent }) => [slug, accent])),
    ).toEqual(categoryAccents);
  });
});

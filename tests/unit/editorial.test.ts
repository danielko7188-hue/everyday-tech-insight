import { describe, expect, it } from "vitest";

import {
  categories,
  categoryAccents,
  type CategorySlug,
} from "../../src/data/categories";
import {
  allocateHomepageEdition,
  homepageCuration,
  resolveHomepageCuration,
  type HomepageCurationConfig,
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

  it("assigns every published article exactly once across the homepage edition", () => {
    const extras = Array.from({ length: 6 }, (_, index) => ({
      data: { slug: `extra-${index + 1}`, status: "published" as const },
    }));
    const articles = [...publishedArticles, ...extras];

    const edition = allocateHomepageEdition(articles);
    const assignedSlugs = [
      ...edition.lead,
      ...edition.features,
      ...edition.briefing,
      ...edition.startHere,
      ...edition.moreGuides,
    ].map((article) => article.data.slug);

    expect(assignedSlugs).toHaveLength(articles.length);
    expect(new Set(assignedSlugs).size).toBe(articles.length);
    expect(new Set(assignedSlugs)).toEqual(
      new Set(articles.map((article) => article.data.slug)),
    );
  });

  it("fills a short features section from the first unassigned published article", () => {
    const curation = {
      ...homepageCuration,
      features: [homepageCuration.features[1]],
    } satisfies HomepageCurationConfig;
    const fallbackFirst = {
      data: { slug: "fallback-first", status: "published" as const },
    };
    const fallbackLater = {
      data: { slug: "fallback-later", status: "published" as const },
    };

    const edition = allocateHomepageEdition(
      [fallbackFirst, ...publishedArticles, fallbackLater],
      curation,
    );

    expect(edition.features.map((article) => article.data.slug)).toEqual([
      homepageCuration.features[1],
      fallbackFirst.data.slug,
    ]);
  });

  it("preserves published input order in more guides", () => {
    const firstExtra = {
      data: { slug: "extra-z", status: "published" as const },
    };
    const secondExtra = {
      data: { slug: "extra-a", status: "published" as const },
    };
    const thirdExtra = {
      data: { slug: "extra-m", status: "published" as const },
    };
    const articles = [
      firstExtra,
      publishedArticles[0]!,
      secondExtra,
      ...publishedArticles.slice(1),
      thirdExtra,
    ];

    const edition = allocateHomepageEdition(articles);

    expect(edition.moreGuides.map((article) => article.data.slug)).toEqual([
      firstExtra.data.slug,
      secondExtra.data.slug,
      thirdExtra.data.slug,
    ]);
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

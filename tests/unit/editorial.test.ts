import { describe, expect, it } from "vitest";

import {
  categories,
  categoryAccents,
  type CategorySlug,
} from "../../src/data/categories";
import {
  allocateHomepageEdition,
  homepageCuration,
  homepageMoreGuidesLimit,
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

  it("keeps the homepage edition unique while capping the additional guides", () => {
    const extras = Array.from({ length: 9 }, (_, index) => ({
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

    expect(edition.moreGuides).toHaveLength(homepageMoreGuidesLimit);
    expect(new Set(assignedSlugs).size).toBe(assignedSlugs.length);
    expect(
      assignedSlugs.every((slug) =>
        articles.some((article) => article.data.slug === slug),
      ),
    ).toBe(true);
    expect(assignedSlugs).not.toContain("extra-7");
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

  it("fills around a missing configured article", () => {
    const missingSlug = homepageCuration.features[0];
    const fallback = {
      data: { slug: "missing-config-fallback", status: "published" as const },
    };
    const articles = [
      fallback,
      ...publishedArticles.filter(
        (article) => article.data.slug !== missingSlug,
      ),
    ];

    const edition = allocateHomepageEdition(articles);

    expect(edition.features.map((article) => article.data.slug)).toEqual([
      homepageCuration.features[1],
      fallback.data.slug,
    ]);
  });

  it("fills around a draft configured article", () => {
    const draftSlug = homepageCuration.lead[0];
    const fallback: TestArticle = {
      data: { slug: "draft-config-fallback", status: "published" },
    };
    const articles: TestArticle[] = [
      fallback,
      ...publishedArticles.map<TestArticle>((article) => ({
        data: {
          slug: article.data.slug,
          status: article.data.slug === draftSlug ? "draft" : "published",
        },
      })),
    ];

    const edition = allocateHomepageEdition(articles);

    expect(edition.lead.map((article) => article.data.slug)).toEqual([
      fallback.data.slug,
    ]);
  });

  it("reserves later configured articles before filling an earlier section", () => {
    const protectedSlug = homepageCuration.briefing[0];
    const protectedArticle = publishedArticles.find(
      (article) => article.data.slug === protectedSlug,
    )!;
    const fallbackFirst = {
      data: { slug: "reserved-fallback-1", status: "published" as const },
    };
    const fallbackSecond = {
      data: { slug: "reserved-fallback-2", status: "published" as const },
    };
    const curation = {
      ...homepageCuration,
      features: [],
    } satisfies HomepageCurationConfig;
    const articles = [
      protectedArticle,
      fallbackFirst,
      fallbackSecond,
      ...publishedArticles.filter(
        (article) => article.data.slug !== protectedSlug,
      ),
    ];

    const edition = allocateHomepageEdition(articles, curation);

    expect(edition.features.map((article) => article.data.slug)).toEqual([
      fallbackFirst.data.slug,
      fallbackSecond.data.slug,
    ]);
    expect(edition.briefing[0]!.data.slug).toBe(protectedSlug);
  });

  it("caps every section at its exact target size", () => {
    const overflowArticles = {
      lead: {
        data: { slug: "lead-overflow", status: "published" as const },
      },
      features: {
        data: { slug: "features-overflow", status: "published" as const },
      },
      briefing: {
        data: { slug: "briefing-overflow", status: "published" as const },
      },
      startHere: {
        data: { slug: "start-here-overflow", status: "published" as const },
      },
    };
    const curation = {
      lead: [...homepageCuration.lead, overflowArticles.lead.data.slug],
      features: [
        ...homepageCuration.features,
        overflowArticles.features.data.slug,
      ],
      briefing: [
        ...homepageCuration.briefing,
        overflowArticles.briefing.data.slug,
      ],
      startHere: [
        ...homepageCuration.startHere,
        overflowArticles.startHere.data.slug,
      ],
    } satisfies HomepageCurationConfig;

    const edition = allocateHomepageEdition(
      [...publishedArticles, ...Object.values(overflowArticles)],
      curation,
    );

    expect({
      lead: edition.lead.length,
      features: edition.features.length,
      briefing: edition.briefing.length,
      startHere: edition.startHere.length,
    }).toEqual({ lead: 1, features: 2, briefing: 3, startHere: 3 });
    expect(edition.moreGuides.map((article) => article.data.slug)).toEqual(
      Object.values(overflowArticles).map((article) => article.data.slug),
    );
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

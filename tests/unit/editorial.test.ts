import { describe, expect, it } from "vitest";

import {
  categories,
  categoryAccents,
  type CategorySlug,
} from "../../src/data/categories";
import {
  homepageCuration,
  resolveHomepageCuration,
  selectFeaturedToolkitResource,
  toolkitResourceHasPublishedGuide,
} from "../../src/data/editorial";
import { toolkitResources } from "../../src/data/toolkit";

interface TestArticle {
  data: {
    slug: string;
    status: "archived" | "draft" | "published";
  };
}

const configuredSlugs = Object.values(homepageCuration).flat();
const publishedArticles = configuredSlugs.map((slug) => ({
  data: { slug, status: "published" as const },
}));
const fallbackArticles = Array.from({ length: 4 }, (_, index) => ({
  data: { slug: `fallback-guide-${index + 1}`, status: "published" as const },
}));

describe("homepage editorial curation", () => {
  it("keeps the approved nine-guide allocation exactly", () => {
    expect(homepageCuration).toEqual({
      lead: ["how-to-identify-business-tasks-for-automation"],
      features: [
        "calculate-the-total-cost-of-business-software",
        "roll-out-mfa-across-a-small-business",
      ],
      briefing: [
        "evaluate-saas-with-a-practical-checklist",
        "create-a-shared-file-and-folder-system",
        "create-a-simple-technology-risk-register",
      ],
      startHere: [
        "back-up-business-files-with-the-3-2-1-method",
        "document-a-repetitive-workflow-before-automating",
        "run-a-30-day-business-technology-pilot",
      ],
    });
    expect(configuredSlugs).toHaveLength(9);
    expect(new Set(configuredSlugs).size).toBe(9);
  });

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
    expect(resolved).not.toHaveProperty("moreGuides");
  });

  it("rejects a configured slug that does not exist", () => {
    expect(() => resolveHomepageCuration(publishedArticles.slice(1))).toThrow(
      /does not exist/i,
    );
  });

  it.each([
    ["lead", homepageCuration.lead[0]],
    ["features", homepageCuration.features[0]],
    ["briefing", homepageCuration.briefing[0]],
    ["startHere", homepageCuration.startHere[0]],
  ] as const)(
    "fills an archived %s selection deterministically without duplicate links",
    (section, archivedSlug) => {
      const articles: TestArticle[] = [
        ...publishedArticles.map((article): TestArticle => ({
          data: {
            slug: article.data.slug,
            status:
              article.data.slug === archivedSlug ? "archived" : "published",
          },
        })),
        ...fallbackArticles,
      ];
      const resolved = resolveHomepageCuration(articles);
      const slugs = Object.values(resolved).flatMap((items) =>
        items.map((article) => article.data.slug),
      );

      expect(resolved[section]).toHaveLength(homepageCuration[section].length);
      expect(slugs).not.toContain(archivedSlug);
      expect(slugs).toHaveLength(configuredSlugs.length);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(slugs).toContain("fallback-guide-1");
    },
  );

  it("omits an unpublished curation record when no fallback exists", () => {
    const articles: TestArticle[] = publishedArticles.map((article, index) => ({
      data: {
        slug: article.data.slug,
        status: index === 0 ? "archived" : "published",
      },
    }));

    const resolved = resolveHomepageCuration(articles);
    expect(resolved.lead).toEqual([]);
    expect(Object.values(resolved).flat()).toHaveLength(8);
  });

  it("matches the homepage call contract by retaining nonpublished records after ordered published candidates", () => {
    const archivedSlug = homepageCuration.lead[0];
    const fullCollection: TestArticle[] = [
      ...publishedArticles.map((article): TestArticle => ({
        data: {
          slug: article.data.slug,
          status: article.data.slug === archivedSlug ? "archived" : "published",
        },
      })),
      ...fallbackArticles,
    ];
    const homepageCandidates = [
      ...fullCollection.filter(({ data }) => data.status === "published"),
      ...fullCollection.filter(({ data }) => data.status !== "published"),
    ];

    const resolved = resolveHomepageCuration(homepageCandidates);
    const resolvedSlugs = Object.values(resolved).flatMap((articles) =>
      articles.map(({ data }) => data.slug),
    );
    expect(resolved.lead[0]?.data.slug).toBe("fallback-guide-1");
    expect(resolvedSlugs).not.toContain(archivedSlug);
    expect(new Set(resolvedSlugs).size).toBe(resolvedSlugs.length);
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

describe("homepage Toolkit selection", () => {
  it("chooses the first Toolkit whose guide remains published", () => {
    const articles = publishedArticles.map((article) => ({
      data: {
        ...article.data,
        status:
          article.data.slug === toolkitResources[0].articleSlug
            ? "archived"
            : "published",
      },
    }));

    expect(selectFeaturedToolkitResource(articles, toolkitResources)).toBe(
      toolkitResources[1],
    );
    expect(
      toolkitResourceHasPublishedGuide(toolkitResources[0], articles),
    ).toBe(false);
    expect(
      toolkitResourceHasPublishedGuide(toolkitResources[1], articles),
    ).toBe(true);
  });
});

describe("category accents", () => {
  it("uses one exact accent registry for every category record", () => {
    expect(categoryAccents).toEqual({
      "ai-automation": "#6d28d9",
      "business-software": "#4338ca",
      "cybersecurity-data-protection": "#a21caf",
      "digital-operations": "#5b21b6",
      "technology-strategy": "#be185d",
    } satisfies Record<CategorySlug, string>);
    expect(
      Object.fromEntries(categories.map(({ slug, accent }) => [slug, accent])),
    ).toEqual(categoryAccents);
  });
});

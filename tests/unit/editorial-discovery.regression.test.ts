import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import * as editorial from "../../src/data/editorial";

interface DiscoveryArticle {
  data: {
    slug: string;
    status: "archived" | "draft" | "published";
    featured?: boolean;
    datePublished?: string;
    dateModified?: string;
    title?: string;
  };
}

type EditorialDiscoveryApi = {
  partitionCategoryEdition?: <T>(articles: readonly T[]) => unknown;
  selectCategoryLayout?: (count: number) => unknown;
  selectLatestPublishedArticles?: <T extends DiscoveryArticle>(
    articles: readonly T[],
    limit?: number,
    excludedSlugs?: ReadonlySet<string>,
  ) => T[];
};

const discoveryApi = editorial as EditorialDiscoveryApi;

const article = (
  slug: string,
  overrides: Partial<DiscoveryArticle["data"]> = {},
): DiscoveryArticle => ({
  data: {
    slug,
    status: "published",
    featured: false,
    datePublished: "2026-08-21",
    title: slug,
    ...overrides,
  },
});

describe("chronological homepage discovery", () => {
  it("orders latest published guides by the newest substantive article event", () => {
    expect(discoveryApi.selectLatestPublishedArticles).toBeTypeOf("function");
    if (!discoveryApi.selectLatestPublishedArticles) return;

    const articles = [
      article("published-newer", { datePublished: "2026-08-24" }),
      article("modified-latest", {
        datePublished: "2026-08-20",
        dateModified: "2026-08-25",
      }),
      article("older", { datePublished: "2026-08-22" }),
      article("excluded", { datePublished: "2026-08-26" }),
      article("draft-future", {
        status: "draft",
        datePublished: "2026-08-27",
      }),
    ];

    const selected = discoveryApi.selectLatestPublishedArticles(
      articles,
      3,
      new Set(["excluded"]),
    );

    expect(selected.map(({ data }) => data.slug)).toEqual([
      "modified-latest",
      "published-newer",
      "older",
    ]);
  });

  it("uses featured metadata for the three-story opening with a deterministic fallback", () => {
    const configured = Object.values(editorial.homepageCuration).flat();
    const articles = configured.map((slug) =>
      article(slug, {
        featured: [
          "calculate-the-total-cost-of-business-software",
          "roll-out-mfa-across-a-small-business",
        ].includes(slug),
      }),
    );
    articles.push(
      article("new-featured-guide", {
        featured: true,
        datePublished: "2026-08-23",
      }),
      article("new-latest-guide", {
        datePublished: "2026-08-24",
      }),
    );

    const resolved = editorial.resolveHomepageCuration(articles);
    const opening = [...resolved.lead, ...resolved.features].map(
      ({ data }) => data.slug,
    );

    expect(opening).toEqual([
      "calculate-the-total-cost-of-business-software",
      "roll-out-mfa-across-a-small-business",
      "new-featured-guide",
    ]);
    expect(resolved.briefing[0]?.data.slug).toBe("new-latest-guide");
    expect(
      new Set(
        Object.values(resolved).flatMap((items) =>
          items.map(({ data }) => data.slug),
        ),
      ).size,
    ).toBe(Object.values(resolved).flat().length);
  });
});

describe("count-aware category discovery", () => {
  it.each([
    [0, "compact"],
    [3, "compact"],
    [5, "compact"],
    [6, "editorial"],
    [11, "editorial"],
    [12, "archive"],
  ] as const)("selects the %s-guide category as %s", (count, layout) => {
    expect(discoveryApi.selectCategoryLayout).toBeTypeOf("function");
    if (!discoveryApi.selectCategoryLayout) return;

    expect(discoveryApi.selectCategoryLayout(count)).toBe(layout);
  });

  it("orders every category edition by featured status, substantive date, title, and slug", () => {
    expect(discoveryApi.partitionCategoryEdition).toBeTypeOf("function");
    if (!discoveryApi.partitionCategoryEdition) return;

    const guides = [
      article("plain-old", {
        datePublished: "2026-08-20",
        title: "Plain old",
      }),
      article("same-title-z", {
        datePublished: "2026-08-24",
        title: "Same title",
      }),
      article("featured-old", {
        featured: true,
        datePublished: "2026-08-21",
        title: "Featured old",
      }),
      article("title-first", {
        datePublished: "2026-08-24",
        title: "A title",
      }),
      article("same-title-a", {
        datePublished: "2026-08-24",
        title: "Same title",
      }),
      article("featured-updated", {
        featured: true,
        datePublished: "2026-08-19",
        dateModified: "2026-08-25",
        title: "Featured updated",
      }),
    ];

    const edition = discoveryApi.partitionCategoryEdition(guides) as {
      layout: "editorial";
      lead: DiscoveryArticle;
      features: DiscoveryArticle[];
      remainder: DiscoveryArticle[];
    };

    expect(
      [edition.lead, ...edition.features, ...edition.remainder].map(
        ({ data }) => data.slug,
      ),
    ).toEqual([
      "featured-updated",
      "featured-old",
      "title-first",
      "same-title-a",
      "same-title-z",
      "plain-old",
    ]);
  });

  it("fills fixed archive opening and recent groups after semantic ordering", () => {
    expect(discoveryApi.partitionCategoryEdition).toBeTypeOf("function");
    if (!discoveryApi.partitionCategoryEdition) return;

    const guides = Array.from({ length: 12 }, (_, index) =>
      article(`guide-${String(index + 1).padStart(2, "0")}`, {
        featured: index === 2 || index === 8,
        datePublished: `2026-08-${String(index + 1).padStart(2, "0")}`,
        title: `Guide ${String(index + 1).padStart(2, "0")}`,
      }),
    ).reverse();

    const edition = discoveryApi.partitionCategoryEdition(guides) as {
      layout: "archive";
      featured: DiscoveryArticle[];
      recent: DiscoveryArticle[];
      archive: DiscoveryArticle[];
    };

    expect(edition.featured.map(({ data }) => data.slug)).toEqual([
      "guide-09",
      "guide-03",
      "guide-12",
    ]);
    expect(edition.recent.map(({ data }) => data.slug)).toEqual([
      "guide-11",
      "guide-10",
      "guide-08",
    ]);
    expect(edition.archive.map(({ data }) => data.slug)).toEqual([
      "guide-07",
      "guide-06",
      "guide-05",
      "guide-04",
      "guide-02",
      "guide-01",
    ]);
  });

  it.each([3, 6, 11, 12, 16])(
    "partitions %s guides without duplication or omission",
    (count) => {
      expect(discoveryApi.partitionCategoryEdition).toBeTypeOf("function");
      if (!discoveryApi.partitionCategoryEdition) return;

      const guides = Array.from({ length: count }, (_, index) =>
        article(`guide-${index + 1}`, {
          title: `Guide ${String(index + 1).padStart(2, "0")}`,
        }),
      );
      const edition = discoveryApi.partitionCategoryEdition(guides) as
        | { layout: "compact"; articles: DiscoveryArticle[] }
        | {
            layout: "editorial";
            lead: DiscoveryArticle;
            features: DiscoveryArticle[];
            remainder: DiscoveryArticle[];
          }
        | {
            layout: "archive";
            featured: DiscoveryArticle[];
            recent: DiscoveryArticle[];
            archive: DiscoveryArticle[];
          };
      const flattened =
        edition.layout === "compact"
          ? edition.articles
          : edition.layout === "editorial"
            ? [edition.lead, ...edition.features, ...edition.remainder]
            : [...edition.featured, ...edition.recent, ...edition.archive];

      expect(flattened.map(({ data }) => data.slug)).toEqual(
        guides.map(({ data }) => data.slug),
      );
      expect(new Set(flattened).size).toBe(guides.length);
    },
  );

  it("renders the selected server-side category branch", async () => {
    const routeSource = await readFile(
      new URL("../../src/pages/categories/[slug].astro", import.meta.url),
      "utf8",
    );

    expect(routeSource).toContain("partitionCategoryEdition");
    expect(routeSource).toContain("data-layout={categoryEdition.layout}");
    expect(routeSource).toContain('categoryEdition.layout === "compact"');
    expect(routeSource).toContain('categoryEdition.layout === "editorial"');
    expect(routeSource).toContain('class="category-archive"');
    expect(routeSource).toContain("Featured lead guide");
    expect(routeSource).toContain("Latest guide");
    expect(routeSource).toContain("Featured and latest guides");
    expect(routeSource).toContain("Latest guides");
    expect(routeSource).toContain('id="category-featured-label"');
    expect(routeSource).toContain('id="category-recent-label"');
    expect(routeSource).toContain("categoryEdition.featured.length > 0");
    expect(routeSource).toContain("categoryEdition.recent.length > 0");
  });
});

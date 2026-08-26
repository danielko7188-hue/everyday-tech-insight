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

  it.each([3, 6, 11, 12, 16])(
    "partitions %s guides without duplication or omission",
    (count) => {
      expect(discoveryApi.partitionCategoryEdition).toBeTypeOf("function");
      if (!discoveryApi.partitionCategoryEdition) return;

      const guides = Array.from({ length: count }, (_, index) => index + 1);
      const edition = discoveryApi.partitionCategoryEdition(guides) as
        | { layout: "compact"; articles: number[] }
        | {
            layout: "editorial";
            lead: number;
            features: number[];
            remainder: number[];
          }
        | {
            layout: "archive";
            featured: number[];
            recent: number[];
            archive: number[];
          };
      const flattened =
        edition.layout === "compact"
          ? edition.articles
          : edition.layout === "editorial"
            ? [edition.lead, ...edition.features, ...edition.remainder]
            : [...edition.featured, ...edition.recent, ...edition.archive];

      expect(flattened).toEqual(guides);
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
  });
});

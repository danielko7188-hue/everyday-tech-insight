export const homepageCuration = {
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
} as const;

export const homepageCurationSections = [
  "lead",
  "features",
  "briefing",
  "startHere",
] as const;

export type HomepageCurationSection = (typeof homepageCurationSections)[number];
export type HomepageCurationConfig = Record<
  HomepageCurationSection,
  readonly string[]
>;

interface CuratableArticle {
  data: {
    slug: string;
    status: string;
  };
}

type PublishedCuratableArticle<T extends CuratableArticle> = T & {
  data: T["data"] & { status: "published" };
};

function isPublishedCuratableArticle<T extends CuratableArticle>(
  article: T,
): article is PublishedCuratableArticle<T> {
  return article.data.status === "published";
}

interface ToolkitLinkedResource {
  articleSlug: string;
}

export function toolkitResourceHasPublishedGuide<
  TArticle extends CuratableArticle,
  TResource extends ToolkitLinkedResource,
>(resource: TResource, articles: readonly TArticle[]): boolean {
  return articles.some(
    ({ data }) =>
      data.slug === resource.articleSlug && data.status === "published",
  );
}

export function selectFeaturedToolkitResource<
  TArticle extends CuratableArticle,
  TResource extends ToolkitLinkedResource,
>(
  articles: readonly TArticle[],
  resources: readonly TResource[],
): TResource | undefined {
  return resources.find((resource) =>
    toolkitResourceHasPublishedGuide(resource, articles),
  );
}

export function resolveHomepageCuration<T extends CuratableArticle>(
  articles: readonly T[],
  curation: HomepageCurationConfig = homepageCuration,
): Record<HomepageCurationSection, PublishedCuratableArticle<T>[]> {
  const articlesBySlug = new Map(
    articles.map((article) => [article.data.slug, article]),
  );
  const firstSectionBySlug = new Map<string, HomepageCurationSection>();
  const resolved: Record<
    HomepageCurationSection,
    PublishedCuratableArticle<T>[]
  > = {
    lead: [],
    features: [],
    briefing: [],
    startHere: [],
  };

  for (const section of homepageCurationSections) {
    for (const slug of curation[section]) {
      const firstSection = firstSectionBySlug.get(slug);
      if (firstSection) {
        throw new Error(
          `Homepage curation slug "${slug}" appears more than once (${firstSection} and ${section}).`,
        );
      }
      firstSectionBySlug.set(slug, section);

      const article = articlesBySlug.get(slug);
      if (!article) {
        throw new Error(
          `Homepage curation slug "${slug}" in ${section} does not exist.`,
        );
      }
      if (isPublishedCuratableArticle(article)) {
        resolved[section].push(article);
      }
    }
  }

  const selectedSlugs = new Set(
    Object.values(resolved).flatMap((sectionArticles) =>
      sectionArticles.map(({ data }) => data.slug),
    ),
  );
  const fallbackArticles = articles
    .filter(isPublishedCuratableArticle)
    .filter(({ data }) => !selectedSlugs.has(data.slug));
  let fallbackIndex = 0;

  for (const section of homepageCurationSections) {
    const targetSize = curation[section].length;
    while (
      resolved[section].length < targetSize &&
      fallbackIndex < fallbackArticles.length
    ) {
      const fallback = fallbackArticles[fallbackIndex];
      fallbackIndex += 1;
      if (!fallback || selectedSlugs.has(fallback.data.slug)) continue;
      resolved[section].push(fallback);
      selectedSlugs.add(fallback.data.slug);
    }
  }

  return resolved;
}

export const homepageSectionSizes = {
  lead: 1,
  features: 2,
  briefing: 3,
  startHere: 3,
} as const satisfies Record<HomepageCurationSection, number>;

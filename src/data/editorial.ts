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
    featured?: boolean;
    datePublished?: string;
    dateModified?: string;
    title?: string;
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

function compareByHomepageChronology<T extends CuratableArticle>(
  left: T,
  right: T,
): number {
  const leftDate = left.data.dateModified ?? left.data.datePublished ?? "";
  const rightDate = right.data.dateModified ?? right.data.datePublished ?? "";
  const dateOrder = rightDate.localeCompare(leftDate, "en");
  if (dateOrder !== 0) return dateOrder;

  const leftBriefingPriority = homepageCuration.briefing.indexOf(
    left.data.slug as (typeof homepageCuration.briefing)[number],
  );
  const rightBriefingPriority = homepageCuration.briefing.indexOf(
    right.data.slug as (typeof homepageCuration.briefing)[number],
  );
  const normalizedLeftPriority =
    leftBriefingPriority === -1
      ? Number.POSITIVE_INFINITY
      : leftBriefingPriority;
  const normalizedRightPriority =
    rightBriefingPriority === -1
      ? Number.POSITIVE_INFINITY
      : rightBriefingPriority;
  const briefingOrder = normalizedLeftPriority - normalizedRightPriority;
  if (briefingOrder !== 0) return briefingOrder;

  return (
    (left.data.title ?? left.data.slug).localeCompare(
      right.data.title ?? right.data.slug,
      "en",
    ) || left.data.slug.localeCompare(right.data.slug, "en")
  );
}

export function selectLatestPublishedArticles<T extends CuratableArticle>(
  articles: readonly T[],
  limit: number = homepageCuration.briefing.length,
  excludedSlugs: ReadonlySet<string> = new Set(),
): PublishedCuratableArticle<T>[] {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("Latest article limit must be a non-negative integer.");
  }

  return articles
    .filter(isPublishedCuratableArticle)
    .filter(({ data }) => !excludedSlugs.has(data.slug))
    .sort(compareByHomepageChronology)
    .slice(0, limit);
}

export type CategoryLayout = "compact" | "editorial" | "archive";

export type CategoryEdition<T> =
  | {
      layout: "compact";
      articles: T[];
    }
  | {
      layout: "editorial";
      lead: T;
      features: T[];
      remainder: T[];
    }
  | {
      layout: "archive";
      featured: T[];
      recent: T[];
      archive: T[];
    };

export function selectCategoryLayout(count: number): CategoryLayout {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Category article count must be a non-negative integer.");
  }
  if (count < 6) return "compact";
  if (count < 12) return "editorial";
  return "archive";
}

export function partitionCategoryEdition<T>(
  articles: readonly T[],
): CategoryEdition<T> {
  const layout = selectCategoryLayout(articles.length);

  if (layout === "compact") {
    return { layout, articles: [...articles] };
  }
  if (layout === "editorial") {
    return {
      layout,
      lead: articles[0]!,
      features: articles.slice(1, 3),
      remainder: articles.slice(3),
    };
  }
  return {
    layout,
    featured: articles.slice(0, 3),
    recent: articles.slice(3, 6),
    archive: articles.slice(6),
  };
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

  const hasDiscoveryMetadata = articles.some(
    ({ data }) =>
      typeof data.featured === "boolean" ||
      data.datePublished !== undefined ||
      data.dateModified !== undefined,
  );

  if (hasDiscoveryMetadata) {
    const publishedArticles = articles.filter(isPublishedCuratableArticle);
    const selectedSlugs = new Set<string>();
    const openingSlugs = [...curation.lead, ...curation.features];
    const openingPriorityBySlug = new Map(
      openingSlugs.map((slug, index) => [slug, index]),
    );
    const compareOpeningPriority = (
      left: PublishedCuratableArticle<T>,
      right: PublishedCuratableArticle<T>,
    ) => {
      const leftPriority =
        openingPriorityBySlug.get(left.data.slug) ?? Number.POSITIVE_INFINITY;
      const rightPriority =
        openingPriorityBySlug.get(right.data.slug) ?? Number.POSITIVE_INFINITY;
      return (
        leftPriority - rightPriority || compareByHomepageChronology(left, right)
      );
    };
    const configuredPublished = (slugs: readonly string[]) =>
      slugs
        .map((slug) => articlesBySlug.get(slug))
        .filter(
          (article): article is PublishedCuratableArticle<T> =>
            article !== undefined && isPublishedCuratableArticle(article),
        );
    const appendUnique = (
      target: PublishedCuratableArticle<T>[],
      candidates: readonly PublishedCuratableArticle<T>[],
      targetSize: number,
    ) => {
      for (const candidate of candidates) {
        if (target.length >= targetSize) break;
        if (selectedSlugs.has(candidate.data.slug)) continue;
        target.push(candidate);
        selectedSlugs.add(candidate.data.slug);
      }
    };

    const opening: PublishedCuratableArticle<T>[] = [];
    const openingTargetSize = curation.lead.length + curation.features.length;
    appendUnique(
      opening,
      publishedArticles
        .filter(({ data }) => data.featured === true)
        .sort(compareOpeningPriority),
      openingTargetSize,
    );
    appendUnique(opening, configuredPublished(openingSlugs), openingTargetSize);
    appendUnique(
      opening,
      [...publishedArticles].sort(compareByHomepageChronology),
      openingTargetSize,
    );

    resolved.lead = opening.slice(0, curation.lead.length);
    resolved.features = opening.slice(curation.lead.length, openingTargetSize);
    resolved.startHere = [];
    appendUnique(
      resolved.startHere,
      configuredPublished(curation.startHere),
      curation.startHere.length,
    );
    appendUnique(
      resolved.startHere,
      [...publishedArticles].sort(compareByHomepageChronology),
      curation.startHere.length,
    );
    resolved.briefing = selectLatestPublishedArticles(
      publishedArticles,
      curation.briefing.length,
      selectedSlugs,
    );

    return resolved;
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

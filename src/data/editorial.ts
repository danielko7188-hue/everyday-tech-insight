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

export function resolveHomepageCuration<T extends CuratableArticle>(
  articles: readonly T[],
  curation: HomepageCurationConfig = homepageCuration,
): Record<HomepageCurationSection, T[]> {
  const articlesBySlug = new Map(
    articles.map((article) => [article.data.slug, article]),
  );
  const firstSectionBySlug = new Map<string, HomepageCurationSection>();
  const resolved: Record<HomepageCurationSection, T[]> = {
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
      if (article.data.status !== "published") {
        throw new Error(
          `Homepage curation slug "${slug}" in ${section} is not published.`,
        );
      }

      resolved[section].push(article);
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

export const homepageMoreGuidesLimit = 6;

export interface HomepageEdition<T> {
  lead: T[];
  features: T[];
  briefing: T[];
  startHere: T[];
  moreGuides: T[];
}

export function allocateHomepageEdition<T extends CuratableArticle>(
  articles: readonly T[],
  curation: HomepageCurationConfig = homepageCuration,
): HomepageEdition<T> {
  const published = articles.filter(
    (article) => article.data.status === "published",
  );
  const publishedBySlug = new Map(
    published.map((article) => [article.data.slug, article]),
  );
  const assigned = new Set<string>();
  const edition: HomepageEdition<T> = {
    lead: [],
    features: [],
    briefing: [],
    startHere: [],
    moreGuides: [],
  };

  for (const section of homepageCurationSections) {
    const target = edition[section];
    for (const slug of curation[section]) {
      if (target.length >= homepageSectionSizes[section]) break;
      const article = publishedBySlug.get(slug);
      if (article && !assigned.has(slug)) {
        target.push(article);
        assigned.add(slug);
      }
    }
  }

  for (const section of homepageCurationSections) {
    const target = edition[section];
    for (const article of published) {
      if (target.length >= homepageSectionSizes[section]) break;
      if (!assigned.has(article.data.slug)) {
        target.push(article);
        assigned.add(article.data.slug);
      }
    }
  }

  edition.moreGuides = published
    .filter((article) => !assigned.has(article.data.slug))
    .slice(0, homepageMoreGuidesLimit);
  return edition;
}

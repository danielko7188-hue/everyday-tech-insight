export const categorySlugs = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
] as const;

export type CategorySlug = (typeof categorySlugs)[number];

export const categoryAccents = {
  "ai-automation": "#6d28d9",
  "business-software": "#4338ca",
  "cybersecurity-data-protection": "#a21caf",
  "digital-operations": "#5b21b6",
  "technology-strategy": "#be185d",
} as const satisfies Record<CategorySlug, string>;

export interface CategoryRecord {
  slug: CategorySlug;
  name: string;
  description: string;
  accent: (typeof categoryAccents)[CategorySlug];
}

export const categories = [
  {
    slug: "ai-automation",
    name: "AI & Automation",
    description:
      "Practical ways to assess, govern, and apply AI and workflow automation in a small business.",
    accent: categoryAccents["ai-automation"],
  },
  {
    slug: "business-software",
    name: "Business Software & SaaS",
    description:
      "Decision frameworks for selecting, comparing, and managing the software services a business relies on.",
    accent: categoryAccents["business-software"],
  },
  {
    slug: "cybersecurity-data-protection",
    name: "Cybersecurity & Data Protection",
    description:
      "Plain-language guidance for reducing security risk and protecting business information.",
    accent: categoryAccents["cybersecurity-data-protection"],
  },
  {
    slug: "digital-operations",
    name: "Digital Operations & Productivity",
    description:
      "Reliable processes for collaboration, documentation, continuity, and day-to-day digital work.",
    accent: categoryAccents["digital-operations"],
  },
  {
    slug: "technology-strategy",
    name: "Technology Decisions & Strategy",
    description:
      "Structured approaches to technology planning, budgeting, procurement, and lifecycle decisions.",
    accent: categoryAccents["technology-strategy"],
  },
] as const satisfies readonly CategoryRecord[];

export const categoriesBySlug = new Map(
  categories.map((category) => [category.slug, category]),
);

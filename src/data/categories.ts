export const categorySlugs = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
] as const;

export type CategorySlug = (typeof categorySlugs)[number];

export interface CategoryRecord {
  slug: CategorySlug;
  name: string;
  description: string;
  accent: string;
}

export const categories = [
  {
    slug: "ai-automation",
    name: "AI & Automation",
    description:
      "Practical ways to assess, govern, and apply AI and workflow automation in a small business.",
    accent: "#0f746c",
  },
  {
    slug: "business-software",
    name: "Business Software & SaaS",
    description:
      "Decision frameworks for selecting, comparing, and managing the software services a business relies on.",
    accent: "#315f98",
  },
  {
    slug: "cybersecurity-data-protection",
    name: "Cybersecurity & Data Protection",
    description:
      "Plain-language guidance for reducing security risk and protecting business information.",
    accent: "#a83d3a",
  },
  {
    slug: "digital-operations",
    name: "Digital Operations & Productivity",
    description:
      "Reliable processes for collaboration, documentation, continuity, and day-to-day digital work.",
    accent: "#397143",
  },
  {
    slug: "technology-strategy",
    name: "Technology Decisions & Strategy",
    description:
      "Structured approaches to technology planning, budgeting, procurement, and lifecycle decisions.",
    accent: "#9a5b13",
  },
] as const satisfies readonly CategoryRecord[];

export const categoriesBySlug = new Map(
  categories.map((category) => [category.slug, category]),
);

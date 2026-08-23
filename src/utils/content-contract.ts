import { z } from "zod";

import { categorySlugs } from "../data/categories";
import { site } from "../data/site";

export const ARTICLE_STATUSES = ["draft", "review", "published"] as const;
export const CONTENT_TYPES = [
  "guide",
  "checklist",
  "framework",
  "comparison",
] as const;
export const EDITORIAL_VISUAL_TYPES = [
  "workflow",
  "decision-tree",
  "comparison",
  "cost-stack",
  "security-boundary",
  "backup-topology",
  "process-lane",
  "risk-matrix",
  "checklist",
  "timeline",
  "data-flow",
  "governance",
  "information-architecture",
] as const;
export const EDITORIAL_VISUAL_KEYS = [
  "automation-candidate-screen",
  "ai-quality-scorecard",
  "ai-use-governance",
  "saas-evidence-checklist",
  "work-object-comparison",
  "saas-exit-data-flow",
  "mfa-rollout-boundary",
  "phishing-response-workflow",
  "three-two-one-topology",
  "shared-file-architecture",
  "workflow-exception-lane",
  "access-onboarding-checklist",
  "technology-risk-matrix",
  "software-cost-stack",
  "thirty-day-pilot-timeline",
] as const;
export const VERIFICATION_STATUSES = [
  "unverified",
  "source-checked",
  "tested",
] as const;

export const BUSINESS_TECHNOLOGY_FIT_FIELDS = [
  "businessProblem",
  "technologyFocus",
  "intendedAudience",
  "readerOutcome",
  "sourceList",
] as const;

const PLACEHOLDER_PATTERN =
  /\b(?:todo|tbd|changeme|placeholder|your[-_ ]?(?:name|email|id)|lorem ipsum)\b/i;
const TRACKING_IDENTIFIER_PATTERN =
  /(?:\b(?:ca-)?pub-\d{10,}\b|\bUA-\d{4,}-\d+\b|\bG-[A-Z0-9]{6,}\b|\bGTM-[A-Z0-9]{4,}\b)/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function containsForbiddenMetadata(value: string): boolean {
  return (
    PLACEHOLDER_PATTERN.test(value) || TRACKING_IDENTIFIER_PATTERN.test(value)
  );
}

function requiredText(minimumLength: number, maximumLength = 500) {
  return z
    .string()
    .trim()
    .min(minimumLength)
    .max(maximumLength)
    .refine((value) => !containsForbiddenMetadata(value), {
      message: "Value must be complete and contain no tracking identifiers.",
    });
}

function isRealCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function currentDateInPublicationTimeZone(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: site.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

const dateOnlySchema = z
  .string()
  .regex(ISO_DATE_PATTERN, "Use an ISO date in YYYY-MM-DD form.")
  .refine(isRealCalendarDate, "Date must be a real calendar date.")
  .refine(
    (value) => value <= currentDateInPublicationTimeZone(),
    "Date must not be in the future.",
  );

const publicationEraDateSchema = dateOnlySchema.refine(
  (value) => value >= site.launchDate,
  `Date must not precede the ${site.launchDate} publication launch.`,
);

const httpsUrlSchema = z
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "URL must use HTTPS.",
  });

const configuredSiteOrigin = new URL(site.url).origin;
const canonicalOverrideSchema = httpsUrlSchema.refine(
  (value) => {
    const url = new URL(value);
    return (
      url.origin === configuredSiteOrigin && !url.username && !url.password
    );
  },
  {
    message: "Canonical override must use the configured site origin.",
  },
);

const slugSchema = z.string().trim().min(1).max(120).regex(SLUG_PATTERN);

export const articleVisualSchema = z
  .object({
    type: z.enum(EDITORIAL_VISUAL_TYPES),
    key: z.enum(EDITORIAL_VISUAL_KEYS),
    alt: requiredText(10, 240),
    caption: requiredText(10, 300).optional(),
    decorative: z.literal(false),
  })
  .strict();

export const sourceSchema = z
  .object({
    title: requiredText(3, 200),
    url: httpsUrlSchema,
    publisher: requiredText(2, 120),
    accessed: publicationEraDateSchema,
  })
  .strict();

type FitInput = {
  businessProblem?: unknown;
  technologyFocus?: unknown;
  intendedAudience?: unknown;
  readerOutcome?: unknown;
  sourceList?: unknown;
};

export function assessBusinessTechnologyFit(input: FitInput): {
  passes: boolean;
  missing: Array<(typeof BUSINESS_TECHNOLOGY_FIT_FIELDS)[number]>;
} {
  const missing: Array<(typeof BUSINESS_TECHNOLOGY_FIT_FIELDS)[number]> = [];

  for (const field of BUSINESS_TECHNOLOGY_FIT_FIELDS.slice(0, 4)) {
    const value = input[field];
    if (
      typeof value !== "string" ||
      value.trim().length < 20 ||
      containsForbiddenMetadata(value)
    ) {
      missing.push(field);
    }
  }

  if (!Array.isArray(input.sourceList) || input.sourceList.length === 0) {
    missing.push("sourceList");
  }

  return { passes: missing.length === 0, missing };
}

export const articleFrontmatterSchema = z
  .object({
    title: requiredText(10, 100),
    description: requiredText(50, 180),
    slug: slugSchema,
    category: z.enum(categorySlugs),
    author: z.literal(site.publicationByline),
    status: z.enum(ARTICLE_STATUSES),
    contentType: z.enum(CONTENT_TYPES),
    businessProblem: requiredText(20, 500),
    technologyFocus: requiredText(20, 500),
    intendedAudience: requiredText(20, 300),
    readerOutcome: requiredText(20, 500),
    verificationStatus: z.enum(VERIFICATION_STATUSES),
    datePublished: publicationEraDateSchema,
    dateModified: publicationEraDateSchema.optional(),
    lastReviewed: publicationEraDateSchema,
    featured: z.boolean().default(false),
    summary: requiredText(40, 500),
    visual: articleVisualSchema,
    sourceList: z.array(sourceSchema),
    relatedArticles: z.array(slugSchema).default([]),
    heroImage: z
      .string()
      .trim()
      .min(1)
      .refine(
        (value) => value.startsWith("/") && !value.startsWith("//"),
        "Hero image must be a root-relative local path.",
      )
      .optional(),
    heroImageAlt: requiredText(10, 240).optional(),
    canonicalOverride: canonicalOverrideSchema.optional(),
    noindex: z.boolean().default(false),
  })
  .strict()
  .superRefine((article, context) => {
    if (article.status === "published") {
      const fit = assessBusinessTechnologyFit(article);
      for (const field of fit.missing) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Published content must pass the five-part fit.",
        });
      }

      if (article.sourceList.length < 2) {
        context.addIssue({
          code: "too_small",
          origin: "array",
          minimum: 2,
          inclusive: true,
          path: ["sourceList"],
          message: "Published content requires at least two HTTPS sources.",
        });
      }

      if (article.noindex) {
        context.addIssue({
          code: "custom",
          path: ["noindex"],
          message: "Published content cannot be excluded from indexing.",
        });
      }

      if (article.verificationStatus === "unverified") {
        context.addIssue({
          code: "custom",
          path: ["verificationStatus"],
          message: "Published content must be source-checked or tested.",
        });
      }
    }

    if (Boolean(article.heroImage) !== Boolean(article.heroImageAlt)) {
      context.addIssue({
        code: "custom",
        path: article.heroImage ? ["heroImageAlt"] : ["heroImage"],
        message: "Hero image and alternative text must be supplied together.",
      });
    }

    if (article.dateModified && article.dateModified <= article.datePublished) {
      context.addIssue({
        code: "custom",
        path: ["dateModified"],
        message: "Modification date must be later than publication date.",
      });
    }

    if (article.lastReviewed < article.datePublished) {
      context.addIssue({
        code: "custom",
        path: ["lastReviewed"],
        message: "Review date cannot precede publication date.",
      });
    }

    if (TRACKING_IDENTIFIER_PATTERN.test(JSON.stringify(article))) {
      context.addIssue({
        code: "custom",
        path: [],
        message:
          "Content metadata must not contain advertising or analytics IDs.",
      });
    }
  });

export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>;
export type ArticleSource = z.infer<typeof sourceSchema>;
export type ArticleVisual = z.infer<typeof articleVisualSchema>;

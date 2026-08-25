import { z } from "zod";

import { categorySlugs } from "../data/categories";
import { site } from "../data/site";
import { isPublicEvidenceUrl } from "./public-evidence-url.mjs";

export const ARTICLE_STATUSES = [
  "draft",
  "review",
  "published",
  "archived",
] as const;
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
export const EDITORIAL_VISUAL_TYPE_BY_KEY = {
  "automation-candidate-screen": "decision-tree",
  "ai-quality-scorecard": "comparison",
  "ai-use-governance": "governance",
  "saas-evidence-checklist": "checklist",
  "work-object-comparison": "comparison",
  "saas-exit-data-flow": "data-flow",
  "mfa-rollout-boundary": "security-boundary",
  "phishing-response-workflow": "workflow",
  "three-two-one-topology": "backup-topology",
  "shared-file-architecture": "information-architecture",
  "workflow-exception-lane": "process-lane",
  "access-onboarding-checklist": "checklist",
  "technology-risk-matrix": "risk-matrix",
  "software-cost-stack": "cost-stack",
  "thirty-day-pilot-timeline": "timeline",
} as const satisfies Record<
  (typeof EDITORIAL_VISUAL_KEYS)[number],
  (typeof EDITORIAL_VISUAL_TYPES)[number]
>;
export const VERIFICATION_STATUSES = [
  "unverified",
  "source-checked",
  "tested",
] as const;

const PUBLICATION_VERIFICATION_STATUSES = ["source-checked", "tested"] as const;

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
const HERO_IMAGE_PATTERN =
  /^\/images\/articles\/(?![^/]*\.\.)[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|png|jpe?g)$/;

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

function normalizeEmptyOptional(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function optionalCmsValue<T extends z.ZodType>(schema: T) {
  return z.preprocess(normalizeEmptyOptional, schema.optional());
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

const httpsUrlSchema = z.url().refine(
  (value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "URL must use HTTPS." },
);

const publicEvidenceUrlSchema = z.string().refine(isPublicEvidenceUrl, {
  message:
    "URL must be a safe public HTTPS URL without credentials, secret query keys, reserved hosts, ports, or fragments.",
});

const configuredSiteOrigin = new URL(site.url).origin;
const canonicalOverrideSchema = httpsUrlSchema.refine(
  (value) => {
    try {
      const url = new URL(value);
      return (
        url.origin === configuredSiteOrigin && !url.username && !url.password
      );
    } catch {
      return false;
    }
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
  .strict()
  .superRefine((visual, context) => {
    const expectedType = EDITORIAL_VISUAL_TYPE_BY_KEY[visual.key];
    if (visual.type !== expectedType) {
      context.addIssue({
        code: "custom",
        path: ["type"],
        message: `Visual ${visual.key} must use type ${expectedType}.`,
      });
    }
  });

export const sourceSchema = z
  .object({
    title: requiredText(3, 200),
    url: publicEvidenceUrlSchema,
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

const identityShape = {
  title: requiredText(10, 100),
  slug: slugSchema,
  author: z.literal(site.publicationByline),
} as const;

const explanationShape = {
  guidePromise: requiredText(90, 180),
  deliverable: requiredText(20, 150),
  whenToUse: requiredText(40, 180),
} as const;

const fitShape = {
  businessProblem: requiredText(20, 500),
  technologyFocus: requiredText(20, 500),
  intendedAudience: requiredText(20, 300),
  readerOutcome: requiredText(20, 500),
} as const;

const heroShape = {
  heroImage: optionalCmsValue(
    z
      .string()
      .trim()
      .regex(
        HERO_IMAGE_PATTERN,
        "Hero image must be a flat path under /images/articles/ with a lowercase .webp, .png, .jpg, or .jpeg extension.",
      ),
  ),
  heroImageAlt: z.string().trim().max(240).optional(),
  heroImageDecorative: z.boolean().optional(),
  heroImageCaption: optionalCmsValue(requiredText(10, 300)),
  heroImageCredit: optionalCmsValue(requiredText(2, 200)),
  heroImageSourceUrl: optionalCmsValue(publicEvidenceUrlSchema),
  heroImageLicense: optionalCmsValue(requiredText(2, 120)),
} as const;

const commonPublicationShape = {
  ...identityShape,
  description: requiredText(50, 180),
  category: z.enum(categorySlugs),
  contentType: z.enum(CONTENT_TYPES),
  ...explanationShape,
  ...fitShape,
  verificationStatus: z.enum(PUBLICATION_VERIFICATION_STATUSES),
  datePublished: publicationEraDateSchema,
  dateModified: optionalCmsValue(publicationEraDateSchema),
  lastReviewed: publicationEraDateSchema,
  featured: z.boolean().default(false),
  summary: requiredText(40, 500),
  visual: articleVisualSchema,
  sourceList: z.array(sourceSchema).min(2),
  relatedArticles: z.array(slugSchema).default([]),
  ...heroShape,
  canonicalOverride: optionalCmsValue(canonicalOverrideSchema),
} as const;

const draftArticleSchema = z
  .object({
    ...identityShape,
    status: z.literal("draft"),
    description: optionalCmsValue(requiredText(50, 180)),
    category: z.enum(categorySlugs).optional(),
    contentType: z.enum(CONTENT_TYPES).optional(),
    guidePromise: optionalCmsValue(explanationShape.guidePromise),
    deliverable: optionalCmsValue(explanationShape.deliverable),
    whenToUse: optionalCmsValue(explanationShape.whenToUse),
    businessProblem: optionalCmsValue(fitShape.businessProblem),
    technologyFocus: optionalCmsValue(fitShape.technologyFocus),
    intendedAudience: optionalCmsValue(fitShape.intendedAudience),
    readerOutcome: optionalCmsValue(fitShape.readerOutcome),
    verificationStatus: z.enum(VERIFICATION_STATUSES).default("unverified"),
    datePublished: optionalCmsValue(publicationEraDateSchema),
    dateModified: optionalCmsValue(publicationEraDateSchema),
    lastReviewed: optionalCmsValue(publicationEraDateSchema),
    featured: z.boolean().default(false),
    summary: optionalCmsValue(requiredText(40, 500)),
    visual: articleVisualSchema.optional(),
    sourceList: z.array(sourceSchema).optional(),
    relatedArticles: z.array(slugSchema).default([]),
    ...heroShape,
    canonicalOverride: optionalCmsValue(canonicalOverrideSchema),
    noindex: z.literal(true).default(true),
  })
  .strict();

const reviewArticleSchema = z
  .object({
    ...identityShape,
    status: z.literal("review"),
    description: requiredText(50, 180),
    category: z.enum(categorySlugs),
    contentType: z.enum(CONTENT_TYPES),
    ...explanationShape,
    ...fitShape,
    verificationStatus: z.enum(VERIFICATION_STATUSES).default("unverified"),
    datePublished: optionalCmsValue(publicationEraDateSchema),
    dateModified: optionalCmsValue(publicationEraDateSchema),
    lastReviewed: optionalCmsValue(publicationEraDateSchema),
    featured: z.boolean().default(false),
    summary: requiredText(40, 500),
    visual: articleVisualSchema,
    sourceList: z.array(sourceSchema).min(1),
    relatedArticles: z.array(slugSchema).default([]),
    ...heroShape,
    canonicalOverride: optionalCmsValue(canonicalOverrideSchema),
    noindex: z.literal(true),
  })
  .strict();

const publishedArticleSchema = z
  .object({
    ...commonPublicationShape,
    status: z.literal("published"),
    noindex: z.literal(false).default(false),
  })
  .strict();

const archivedArticleSchema = z
  .object({
    ...commonPublicationShape,
    status: z.literal("archived"),
    dateArchived: publicationEraDateSchema,
    noindex: z.literal(true),
  })
  .strict();

const CMS_EMPTY_OPTIONAL_FIELDS = [
  "description",
  "guidePromise",
  "deliverable",
  "whenToUse",
  "businessProblem",
  "technologyFocus",
  "intendedAudience",
  "readerOutcome",
  "datePublished",
  "dateModified",
  "lastReviewed",
  "dateArchived",
  "summary",
  "heroImage",
  "heroImageCaption",
  "heroImageCredit",
  "heroImageSourceUrl",
  "heroImageLicense",
  "canonicalOverride",
] as const;

function normalizeCmsEmptyOptionals(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;

  const normalized = { ...(input as Record<string, unknown>) };
  for (const field of CMS_EMPTY_OPTIONAL_FIELDS) {
    if (
      typeof normalized[field] === "string" &&
      normalized[field].trim() === ""
    ) {
      delete normalized[field];
    }
  }

  if (
    normalized.heroImage === undefined &&
    typeof normalized.heroImageAlt === "string" &&
    normalized.heroImageAlt.trim() === ""
  ) {
    delete normalized.heroImageAlt;
  }

  return normalized;
}

function addDateOrderIssues(
  article: {
    datePublished?: string;
    dateModified?: string;
    lastReviewed?: string;
  },
  context: z.RefinementCtx,
) {
  if (
    article.dateModified &&
    (!article.datePublished || article.dateModified <= article.datePublished)
  ) {
    context.addIssue({
      code: "custom",
      path: ["dateModified"],
      message: "Modification date must be later than publication date.",
    });
  }

  if (
    article.lastReviewed &&
    article.datePublished &&
    article.lastReviewed < article.datePublished
  ) {
    context.addIssue({
      code: "custom",
      path: ["lastReviewed"],
      message: "Review date cannot precede publication date.",
    });
  }
}

function addHeroIssues(
  article: Record<string, unknown>,
  context: z.RefinementCtx,
) {
  const ancillaryFields = [
    "heroImageAlt",
    "heroImageDecorative",
    "heroImageCaption",
    "heroImageCredit",
    "heroImageSourceUrl",
    "heroImageLicense",
  ] as const;

  if (!article.heroImage) {
    for (const field of ancillaryFields) {
      if (article[field] !== undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Hero metadata requires a hero image.",
        });
      }
    }
    return;
  }

  if (typeof article.heroImageDecorative !== "boolean") {
    context.addIssue({
      code: "custom",
      path: ["heroImageDecorative"],
      message: "Hero images must declare whether they are decorative.",
    });
  }
  if (typeof article.heroImageAlt !== "string") {
    context.addIssue({
      code: "custom",
      path: ["heroImageAlt"],
      message: "Hero images must provide an alternative-text value.",
    });
    return;
  }

  if (article.heroImageDecorative === true && article.heroImageAlt !== "") {
    context.addIssue({
      code: "custom",
      path: ["heroImageAlt"],
      message: "Decorative hero images must use empty alternative text.",
    });
  }
  if (
    article.heroImageDecorative === false &&
    (article.heroImageAlt.length < 10 ||
      containsForbiddenMetadata(article.heroImageAlt))
  ) {
    context.addIssue({
      code: "custom",
      path: ["heroImageAlt"],
      message: "Informative hero images require meaningful alternative text.",
    });
  }
}

export const articleFrontmatterSchema = z
  .preprocess(
    normalizeCmsEmptyOptionals,
    z.discriminatedUnion("status", [
      draftArticleSchema,
      reviewArticleSchema,
      publishedArticleSchema,
      archivedArticleSchema,
    ]),
  )
  .superRefine((article, context) => {
    addDateOrderIssues(article, context);
    addHeroIssues(article, context);

    const sourceUrls = new Set<string>();
    for (const source of article.sourceList ?? []) {
      const normalizedUrl = new URL(source.url).href;
      if (sourceUrls.has(normalizedUrl)) {
        context.addIssue({
          code: "custom",
          path: ["sourceList"],
          message: "Source URLs must be unique within an article.",
        });
      }
      sourceUrls.add(normalizedUrl);
    }

    if (article.status === "archived") {
      const precedingDates = [
        article.datePublished,
        article.dateModified,
        article.lastReviewed,
      ].filter((value): value is string => value !== undefined);
      if (precedingDates.some((date) => article.dateArchived < date)) {
        context.addIssue({
          code: "custom",
          path: ["dateArchived"],
          message:
            "Archive date cannot precede publication, modification, or review.",
        });
      }
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

export type ArticleFrontmatter = z.output<typeof articleFrontmatterSchema>;
export type DraftArticleFrontmatter = Extract<
  ArticleFrontmatter,
  { status: "draft" }
>;
export type ReviewArticleFrontmatter = Extract<
  ArticleFrontmatter,
  { status: "review" }
>;
export type PublishedArticleFrontmatter = Extract<
  ArticleFrontmatter,
  { status: "published" }
>;
export type ArchivedArticleFrontmatter = Extract<
  ArticleFrontmatter,
  { status: "archived" }
>;
export type ArticleSource = z.infer<typeof sourceSchema>;
export type ArticleVisual = z.infer<typeof articleVisualSchema>;

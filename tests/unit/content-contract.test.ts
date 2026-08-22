import { describe, expect, it } from "vitest";

import {
  ARTICLE_STATUSES,
  CONTENT_TYPES,
  VERIFICATION_STATUSES,
  articleFrontmatterSchema,
  assessBusinessTechnologyFit,
} from "../../src/utils/content-contract";
import { siteUrl } from "../../site.config.mjs";

const validPublishedArticle = {
  title: "How to evaluate an automation workflow before rollout",
  description:
    "A practical framework for small businesses to assess automation value, risk, and implementation readiness.",
  slug: "evaluate-automation-workflow",
  category: "ai-automation",
  author: "Everyday Tech Insight",
  status: "published",
  contentType: "framework",
  businessProblem:
    "Manual handoffs consume staff time and make routine work harder to verify.",
  technologyFocus:
    "Workflow automation tools with approval steps, audit logs, and rollback controls.",
  intendedAudience:
    "Small-business decision makers comparing a first automation project.",
  readerOutcome:
    "Create a scored go-or-no-go assessment before buying or deploying a tool.",
  verificationStatus: "source-checked",
  datePublished: "2026-08-21",
  lastReviewed: "2026-08-21",
  featured: true,
  summary:
    "Assess the business problem, control requirements, and rollout evidence before automating.",
  sourceList: [
    {
      title: "Artificial Intelligence Risk Management Framework",
      url: "https://www.nist.gov/itl/ai-risk-management-framework",
      publisher: "National Institute of Standards and Technology",
      accessed: "2026-08-21",
    },
    {
      title: "Small Business Cybersecurity Corner",
      url: "https://www.nist.gov/itl/smallbusinesscyber",
      publisher: "National Institute of Standards and Technology",
      accessed: "2026-08-21",
    },
  ],
  relatedArticles: ["compare-business-software"],
  heroImage: "/images/automation-workflow.svg",
  heroImageAlt: "Decision flow for evaluating a business automation workflow",
  canonicalOverride: new URL(
    "articles/evaluate-automation-workflow/",
    siteUrl,
  ).toString(),
  noindex: false,
} as const;

describe("article frontmatter contract", () => {
  it("accepts every supported field for a valid published article", () => {
    const result = articleFrontmatterSchema.safeParse(validPublishedArticle);

    expect(result.success).toBe(true);
  });

  it("allows canonical overrides only on the configured site origin", () => {
    const sameOrigin = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      canonicalOverride: new URL("articles/same-origin/", siteUrl).toString(),
    });
    const offOrigin = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      canonicalOverride: "https://example.org/articles/off-origin/",
    });

    expect(sameOrigin.success).toBe(true);
    expect(offOrigin.success).toBe(false);
  });

  it("limits workflow, content, and verification values to the approved vocabularies", () => {
    expect(ARTICLE_STATUSES).toEqual(["draft", "review", "published"]);
    expect(CONTENT_TYPES).toEqual([
      "guide",
      "checklist",
      "framework",
      "comparison",
    ]);
    expect(VERIFICATION_STATUSES).toEqual([
      "unverified",
      "source-checked",
      "tested",
    ]);

    expect(
      articleFrontmatterSchema.safeParse({
        ...validPublishedArticle,
        status: "live",
      }).success,
    ).toBe(false);
    expect(
      articleFrontmatterSchema.safeParse({
        ...validPublishedArticle,
        contentType: "news",
      }).success,
    ).toBe(false);
  });

  it.each([
    "businessProblem",
    "technologyFocus",
    "intendedAudience",
    "readerOutcome",
  ] as const)("rejects a placeholder %s in the five-part fit", (field) => {
    const result = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      [field]: "TODO",
    });

    expect(result.success).toBe(false);
  });

  it("requires traceable source support to complete the five-part fit", () => {
    const result = assessBusinessTechnologyFit({
      ...validPublishedArticle,
      sourceList: [],
    });

    expect(result).toEqual({
      passes: false,
      missing: ["sourceList"],
    });
  });

  it("requires published entries to provide at least two HTTPS sources", () => {
    const oneSource = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      sourceList: validPublishedArticle.sourceList.slice(0, 1),
    });
    const insecureSource = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      sourceList: [
        ...validPublishedArticle.sourceList.slice(0, 1),
        {
          ...validPublishedArticle.sourceList[1],
          url: "http://www.nist.gov/itl/smallbusinesscyber",
        },
      ],
    });

    expect(oneSource.success).toBe(false);
    expect(insecureSource.success).toBe(false);
  });

  it("accepts the real 2026-08-21 publication date and rejects impossible or future dates", () => {
    expect(
      articleFrontmatterSchema.safeParse(validPublishedArticle).success,
    ).toBe(true);
    expect(
      articleFrontmatterSchema.safeParse({
        ...validPublishedArticle,
        datePublished: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      articleFrontmatterSchema.safeParse({
        ...validPublishedArticle,
        lastReviewed: "9999-01-01",
      }).success,
    ).toBe(false);
  });

  it("requires dateModified to be later than datePublished", () => {
    expect(
      articleFrontmatterSchema.safeParse({
        ...validPublishedArticle,
        dateModified: validPublishedArticle.datePublished,
      }).success,
    ).toBe(false);
  });

  it("rejects missing or placeholder publication identity", () => {
    expect(
      articleFrontmatterSchema.safeParse({
        ...validPublishedArticle,
        author: "",
      }).success,
    ).toBe(false);
    expect(
      articleFrontmatterSchema.safeParse({
        ...validPublishedArticle,
        author: "Your Name",
      }).success,
    ).toBe(false);
  });

  it("rejects AdSense and analytics identifiers from article metadata", () => {
    const advertisingIdentifier = ["ca", "pub", "1234567890123456"].join("-");
    const analyticsIdentifier = ["G", "ABC123XYZ9"].join("-");

    expect(
      articleFrontmatterSchema.safeParse({
        ...validPublishedArticle,
        summary: `Tracking reference ${advertisingIdentifier}`,
      }).success,
    ).toBe(false);
    expect(
      articleFrontmatterSchema.safeParse({
        ...validPublishedArticle,
        summary: `Analytics reference ${analyticsIdentifier}`,
      }).success,
    ).toBe(false);
  });

  it("does not allow published content to opt out of indexing", () => {
    const result = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      noindex: true,
    });

    expect(result.success).toBe(false);
  });

  it("requires published content to be source-checked or tested", () => {
    const unverified = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      verificationStatus: "unverified",
    });
    const sourceChecked = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      verificationStatus: "source-checked",
    });
    const tested = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      verificationStatus: "tested",
    });

    expect(unverified.success).toBe(false);
    expect(sourceChecked.success).toBe(true);
    expect(tested.success).toBe(true);
  });

  it("requires hero images and alternative text to be supplied together", () => {
    const missingAlt = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      heroImageAlt: undefined,
    });
    const missingImage = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      heroImage: undefined,
    });

    expect(missingAlt.success).toBe(false);
    expect(missingImage.success).toBe(false);
  });

  it("rejects remote hero images that the production CSP cannot load", () => {
    const result = articleFrontmatterSchema.safeParse({
      ...validPublishedArticle,
      heroImage: "https://images.example.test/automation-workflow.svg",
    });

    expect(result.success).toBe(false);
  });
});

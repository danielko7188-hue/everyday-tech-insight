import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readArticleRecords,
  todayInPublicationTimeZone,
  validateContentPortfolio,
} from "../../scripts/qa-content.mjs";
import { siteConfig } from "../../site.config.mjs";
import { categorySlugs } from "../../src/data/categories";
import { BUSINESS_TECHNOLOGY_FIT_FIELDS } from "../../src/utils/content-contract";

const articlesDirectory = join(process.cwd(), "src", "content", "articles");
const contentAuditPath = join(process.cwd(), "docs", "CONTENT_AUDIT.md");
const launchArticleSlugs = [
  "back-up-business-files-with-the-3-2-1-method",
  "calculate-the-total-cost-of-business-software",
  "create-a-shared-file-and-folder-system",
  "create-a-simple-technology-risk-register",
  "crm-vs-project-management-software",
  "document-a-repetitive-workflow-before-automating",
  "evaluate-ai-output-quality-in-a-small-team-pilot",
  "evaluate-saas-with-a-practical-checklist",
  "how-to-identify-business-tasks-for-automation",
  "onboard-employees-and-contractors-to-business-technology",
  "respond-to-a-suspected-phishing-message",
  "roll-out-mfa-across-a-small-business",
  "run-a-30-day-business-technology-pilot",
  "test-data-export-and-integrations-before-saas-lock-in",
  "write-a-practical-ai-acceptable-use-policy",
] as const;

interface ArticleRecord {
  body: string;
  fileName: string;
  frontmatter: string;
}

interface VisualMetadata {
  type: string;
  key: string;
  alt: string;
  caption?: string;
  decorative: boolean;
}

const expectedArticleVisuals = {
  "how-to-identify-business-tasks-for-automation": {
    type: "decision-tree",
    key: "automation-candidate-screen",
  },
  "evaluate-ai-output-quality-in-a-small-team-pilot": {
    type: "comparison",
    key: "ai-quality-scorecard",
  },
  "write-a-practical-ai-acceptable-use-policy": {
    type: "governance",
    key: "ai-use-governance",
  },
  "evaluate-saas-with-a-practical-checklist": {
    type: "checklist",
    key: "saas-evidence-checklist",
  },
  "crm-vs-project-management-software": {
    type: "comparison",
    key: "work-object-comparison",
  },
  "test-data-export-and-integrations-before-saas-lock-in": {
    type: "data-flow",
    key: "saas-exit-data-flow",
  },
  "roll-out-mfa-across-a-small-business": {
    type: "security-boundary",
    key: "mfa-rollout-boundary",
  },
  "respond-to-a-suspected-phishing-message": {
    type: "workflow",
    key: "phishing-response-workflow",
  },
  "back-up-business-files-with-the-3-2-1-method": {
    type: "backup-topology",
    key: "three-two-one-topology",
  },
  "create-a-shared-file-and-folder-system": {
    type: "information-architecture",
    key: "shared-file-architecture",
  },
  "document-a-repetitive-workflow-before-automating": {
    type: "process-lane",
    key: "workflow-exception-lane",
  },
  "onboard-employees-and-contractors-to-business-technology": {
    type: "checklist",
    key: "access-onboarding-checklist",
  },
  "create-a-simple-technology-risk-register": {
    type: "risk-matrix",
    key: "technology-risk-matrix",
  },
  "calculate-the-total-cost-of-business-software": {
    type: "cost-stack",
    key: "software-cost-stack",
  },
  "run-a-30-day-business-technology-pilot": {
    type: "timeline",
    key: "thirty-day-pilot-timeline",
  },
} as const;

const expectedGuideExplanations = {
  "how-to-identify-business-tasks-for-automation": {
    guidePromise:
      "Inventory recurring work, screen repeatability and risk, and select one bounded automation candidate with a human-owned fallback.",
    deliverable:
      "Ranked automation-candidate shortlist and one-page pilot brief.",
    whenToUse:
      "Use before comparing automation products or connecting AI tools to an existing business workflow.",
  },
  "evaluate-ai-output-quality-in-a-small-team-pilot": {
    guidePromise:
      "Test AI output against representative cases, a defined rubric, a baseline, and the real time required for human correction.",
    deliverable:
      "AI pilot scorecard with a go, revise, or stop recommendation.",
    whenToUse:
      "Use before expanding an AI drafting, extraction, classification, or summarization pilot into normal operations.",
  },
  "write-a-practical-ai-acceptable-use-policy": {
    guidePromise:
      "Define which AI tools, data, and use cases are allowed, restricted, or prohibited before employees begin using them.",
    deliverable:
      "Short AI acceptable-use policy draft with approval and reporting duties.",
    whenToUse:
      "Use when employees are already experimenting with AI or before the business authorizes broader AI use.",
  },
  "evaluate-saas-with-a-practical-checklist": {
    guidePromise:
      "Turn business requirements into test scenarios and verify workflow, security, data, administration, and exit claims before buying.",
    deliverable:
      "SaaS evidence sheet and documented buy, revise, or reject decision.",
    whenToUse:
      "Use during a trial, vendor demonstration, renewal review, or replacement decision for important business software.",
  },
  "crm-vs-project-management-software": {
    guidePromise:
      "Choose software by whether the durable record is the customer relationship or the coordinated delivery of project work.",
    deliverable:
      "System-category decision and documented CRM-to-project handoff.",
    whenToUse:
      "Use when sales, customer, and delivery tools appear to offer overlapping tasks, notes, owners, and reports.",
  },
  "test-data-export-and-integrations-before-saas-lock-in": {
    guidePromise:
      "Export representative data and test critical integrations before dependence grows and migration becomes expensive.",
    deliverable:
      "Portability test record, dependency map, and exit-effort estimate.",
    whenToUse:
      "Use before selecting, renewing, or deeply integrating a SaaS product that will hold important business records.",
  },
  "roll-out-mfa-across-a-small-business": {
    guidePromise:
      "Prioritize critical accounts, protect recovery paths, stage enrollment, and verify that MFA is actually enforced.",
    deliverable:
      "Prioritized MFA rollout, recovery procedure, and coverage record.",
    whenToUse:
      "Use when introducing MFA, correcting uneven enrollment, or reviewing privileged and recovery-account protection.",
  },
  "respond-to-a-suspected-phishing-message": {
    guidePromise:
      "Verify a suspicious request through a known channel and escalate containment based on clicks, credentials, payments, or exposed data.",
    deliverable: "Phishing response checklist and initial incident record.",
    whenToUse:
      "Use immediately after a suspicious email, text, call, attachment, login page, or payment request is received.",
  },
  "back-up-business-files-with-the-3-2-1-method": {
    guidePromise:
      "Separate live data from independent backup copies and prove that representative files can be restored before an incident.",
    deliverable:
      "Backup inventory, 3-2-1 plan, and documented restore-test log.",
    whenToUse:
      "Use when cloud sync is being treated as backup or when recovery has never been tested.",
  },
  "create-a-shared-file-and-folder-system": {
    guidePromise:
      "Organize shared files by durable business function, consistent naming, ownership, permissions, and lifecycle.",
    deliverable:
      "Shared-folder map, naming convention, and file-governance rules.",
    whenToUse:
      "Use when important files are scattered across personal drives, inboxes, duplicate folders, or inconsistent names.",
  },
  "document-a-repetitive-workflow-before-automating": {
    guidePromise:
      "Map the real workflow, including decisions and exceptions, before choosing what should be improved or automated.",
    deliverable:
      "Verified current-state workflow map and automation-requirements packet.",
    whenToUse:
      "Use before purchasing workflow software or automating a recurring administrative or operational process.",
  },
  "onboard-employees-and-contractors-to-business-technology": {
    guidePromise:
      "Provision role-based accounts, devices, access, and training while preserving the records needed for later changes or departure.",
    deliverable: "Technology onboarding checklist and approved-access record.",
    whenToUse:
      "Use before an employee, contractor, temporary worker, or service provider receives business-system access.",
  },
  "calculate-the-total-cost-of-business-software": {
    guidePromise:
      "Compare software using the full cost of implementation, labor, operation, change, and exit—not subscription price alone.",
    deliverable: "Transparent total-cost range and assumptions register.",
    whenToUse:
      "Use when comparing, renewing, consolidating, replacing, building, or retaining business software.",
  },
  "create-a-simple-technology-risk-register": {
    guidePromise:
      "Turn vague technology concerns into prioritized event-to-consequence risks with evidence, ownership, treatment, and review.",
    deliverable:
      "Prioritized technology risk register with owners and treatment actions.",
    whenToUse:
      "Use when technology concerns are scattered, appear equally urgent, or lack ownership and review dates.",
  },
  "run-a-30-day-business-technology-pilot": {
    guidePromise:
      "Run a controlled four-week technology test without allowing a trial to become production by default.",
    deliverable:
      "Pilot charter, evidence log, and documented go, revise, or stop decision.",
    whenToUse:
      "Use before a broader commitment to SaaS, automation, collaboration, security, or operational technology.",
  },
} as const;

const expectedToolkitResources = [
  {
    id: "automation-candidate-screen",
    articleSlug: "how-to-identify-business-tasks-for-automation",
    guideHref: "/articles/how-to-identify-business-tasks-for-automation/",
    downloadHref: "/toolkit/automation-candidate-screen.csv",
    csvHeaders: [
      "Task",
      "Process owner",
      "Monthly frequency",
      "Active minutes per run",
      "Input stability",
      "Rule stability",
      "Exception and rework evidence",
      "Failure consequence",
      "Sensitive data and access boundary",
      "Human review point",
      "Manual fallback",
      "Pilot decision",
      "Evidence owner",
      "Review date",
    ],
  },
  {
    id: "saas-evaluation-evidence-sheet",
    articleSlug: "evaluate-saas-with-a-practical-checklist",
    guideHref: "/articles/evaluate-saas-with-a-practical-checklist/",
    downloadHref: "/toolkit/saas-evaluation-evidence-sheet.csv",
    csvHeaders: [
      "Requirement",
      "Priority",
      "Test scenario",
      "Acceptance condition",
      "Purchased plan",
      "Configuration and role",
      "Observed evidence",
      "Result",
      "Limitation",
      "Implementation effort",
      "Exit impact",
      "Follow-up owner",
      "Due date",
    ],
  },
  {
    id: "technology-risk-register",
    articleSlug: "create-a-simple-technology-risk-register",
    guideHref: "/articles/create-a-simple-technology-risk-register/",
    downloadHref: "/toolkit/technology-risk-register.csv",
    csvHeaders: [
      "Risk event",
      "Business consequence",
      "Affected process or asset",
      "Existing safeguards",
      "Likelihood rating",
      "Likelihood basis",
      "Impact rating",
      "Impact basis",
      "Evidence and uncertainty",
      "Response",
      "Target state",
      "Owner",
      "Due date",
      "Review outcome",
      "Next review date",
    ],
  },
  {
    id: "backup-restore-test-log",
    articleSlug: "back-up-business-files-with-the-3-2-1-method",
    guideHref: "/articles/back-up-business-files-with-the-3-2-1-method/",
    downloadHref: "/toolkit/backup-restore-test-log.csv",
    csvHeaders: [
      "Protected data",
      "Recovery point",
      "Backup copy",
      "Failure scenario",
      "Restore destination",
      "Request time",
      "Start time",
      "Completion time",
      "Active effort",
      "Validation method",
      "Result",
      "Missing items and errors",
      "Recovery dependencies",
      "Corrective action",
      "Owner",
      "Retest date",
    ],
  },
] as const;

function articleRecords(): ArticleRecord[] {
  return readdirSync(articlesDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .sort()
    .map((fileName) => {
      const raw = readFileSync(join(articlesDirectory, fileName), "utf8");
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

      if (!match?.[1] || match[2] === undefined) {
        throw new Error(`${fileName} has no valid frontmatter block.`);
      }

      return { fileName, frontmatter: match[1], body: match[2] };
    });
}

function articleBySlug(slug: string): ArticleRecord {
  const article = articleRecords().find(
    (candidate) => scalar(candidate, "slug") === slug,
  );

  if (!article) throw new Error(`Missing article: ${slug}`);

  return article;
}

function scalar(article: ArticleRecord, field: string): string {
  const expression = new RegExp(
    `^${field}:\\s*("(?:[^"\\\\]|\\\\.)*")\\s*$`,
    "m",
  );
  const match = article.frontmatter.match(expression);
  const value = match?.[1];

  if (!value) throw new Error(`${article.fileName} is missing ${field}.`);

  return JSON.parse(value) as string;
}

function optionalScalar(
  article: ArticleRecord,
  field: string,
): string | undefined {
  const expression = new RegExp(
    `^${field}:\\s*("(?:[^"\\\\]|\\\\.)*")\\s*$`,
    "m",
  );
  const value = article.frontmatter.match(expression)?.[1];
  return value ? (JSON.parse(value) as string) : undefined;
}

function visualMetadata(article: ArticleRecord): VisualMetadata {
  const block = article.frontmatter.match(
    /^visual:\s*\r?\n((?: {2}.+(?:\r?\n|$))+)/m,
  )?.[1];

  if (!block) throw new Error(`${article.fileName} is missing visual.`);

  const requiredString = (field: string): string => {
    const value = block.match(
      new RegExp(`^ {2}${field}:\\s*("(?:[^"\\\\]|\\\\.)*")\\s*$`, "m"),
    )?.[1];
    if (!value)
      throw new Error(`${article.fileName} visual is missing ${field}.`);
    return JSON.parse(value) as string;
  };
  const caption = block.match(/^ {2}caption:\s*("(?:[^"\\]|\\.)*")\s*$/m)?.[1];
  const decorative = block.match(/^ {2}decorative:\s*(true|false)\s*$/m)?.[1];

  if (!decorative) {
    throw new Error(`${article.fileName} visual is missing decorative.`);
  }

  return {
    type: requiredString("type"),
    key: requiredString("key"),
    alt: requiredString("alt"),
    caption: caption ? (JSON.parse(caption) as string) : undefined,
    decorative: decorative === "true",
  };
}

function sourceUrls(article: ArticleRecord): string[] {
  return [
    ...article.frontmatter.matchAll(/^\s+url:\s*"([^"]+)"\s*$/gm),
  ].flatMap((match) => (match[1] ? [match[1]] : []));
}

function sequenceValues(article: ArticleRecord, field: string): string[] {
  const start = article.frontmatter.search(new RegExp(`^${field}:`, "m"));
  if (start < 0) throw new Error(`${article.fileName} is missing ${field}.`);

  const followingLines = article.frontmatter
    .slice(start)
    .split(/\r?\n/)
    .slice(1);
  const values: string[] = [];

  for (const line of followingLines) {
    const match = line.match(/^\s+-\s+"([^"]+)"\s*$/);
    if (!match?.[1]) break;
    values.push(match[1]);
  }

  return values;
}

function whitespaceTokenCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

describe("published content portfolio", () => {
  it("centralizes four complete Toolkit records with stable article and CSV contracts", async () => {
    const toolkitModule = await import("../../src/data/toolkit").catch(
      () => null,
    );

    expect(toolkitModule).not.toBeNull();
    if (!toolkitModule) return;

    const resources = toolkitModule.toolkitResources;
    expect(resources).toHaveLength(4);
    expect(new Set(resources.map(({ id }) => id)).size).toBe(4);
    expect(new Set(resources.map(({ detailHref }) => detailHref)).size).toBe(4);
    expect(
      new Set(resources.map(({ downloadHref }) => downloadHref)).size,
    ).toBe(4);
    expect(new Set(resources.map(({ articleSlug }) => articleSlug)).size).toBe(
      4,
    );

    for (const expected of expectedToolkitResources) {
      const resource = resources.find(({ id }) => id === expected.id);
      expect(resource, expected.id).toBeDefined();
      if (!resource) continue;

      expect(resource.detailHref).toBe(`/toolkit/${expected.id}/`);
      expect(resource.downloadHref).toBe(expected.downloadHref);
      expect(resource.guideHref).toBe(expected.guideHref);
      expect(resource.articleSlug).toBe(expected.articleSlug);
      expect(resource.csvHeaders).toEqual(expected.csvHeaders);
      expect(resource.fields).toHaveLength(8);

      for (const value of [
        resource.title,
        resource.outcome,
        resource.purpose,
        resource.intendedAudience,
        resource.limitation,
        resource.dataNotice,
      ]) {
        expect(
          value.trim().length,
          `${expected.id} complete copy`,
        ).toBeGreaterThan(20);
      }
      expect(resource.whenToUse.length).toBeGreaterThan(0);
      expect(resource.whenNotToUse.length).toBeGreaterThan(0);
      for (const field of resource.fields) {
        expect(field.name.trim().length).toBeGreaterThan(0);
        expect(field.guidance.trim().length).toBeGreaterThan(20);
      }

      const csvPath = join(
        process.cwd(),
        "public",
        resource.downloadHref.replace(/^\//, ""),
      );
      const rows = readFileSync(csvPath, "utf8")
        .split(/\r?\n/)
        .filter((row) => row.trim().length > 0);
      expect(rows, expected.id).toHaveLength(1);
      expect(rows[0]?.split(","), expected.id).toEqual(expected.csvHeaders);
    }
  });

  it("contains at least fifteen Markdown articles and three in every category", () => {
    const articles = articleRecords();
    const categoryCounts = Object.fromEntries(
      categorySlugs.map((category) => [
        category,
        articles.filter((article) => scalar(article, "category") === category)
          .length,
      ]),
    );

    expect(articles.length).toBeGreaterThanOrEqual(15);
    for (const category of categorySlugs) {
      expect(categoryCounts[category]).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses distinct slugs, titles, and descriptions that match their files", () => {
    const articles = articleRecords();

    for (const field of ["slug", "title", "description"] as const) {
      const values = articles.map((article) => scalar(article, field));
      expect(new Set(values).size, `${field} values must be unique`).toBe(
        values.length,
      );
    }

    for (const article of articles) {
      expect(scalar(article, "slug")).toBe(basename(article.fileName, ".md"));
    }
  });

  it("assigns every launch article its exact stable informative visual", () => {
    const articles = articleRecords();
    const visuals = articles.map((article) => ({
      slug: scalar(article, "slug"),
      visual: visualMetadata(article),
    }));

    expect(visuals).toHaveLength(15);
    expect(new Set(visuals.map(({ visual }) => visual.key)).size).toBe(15);
    expect(
      new Set(visuals.map(({ visual }) => visual.type)).size,
    ).toBeGreaterThanOrEqual(12);

    for (const { slug, visual } of visuals) {
      expect(visual.decorative, slug).toBe(false);
      expect(visual.alt.trim().length, slug).toBeGreaterThan(0);
      if (visual.caption !== undefined) {
        expect(visual.caption.trim().length, slug).toBeGreaterThan(0);
      }
      expect({ type: visual.type, key: visual.key }, slug).toEqual(
        expectedArticleVisuals[slug as keyof typeof expectedArticleVisuals],
      );
    }
  });

  it("provides the exact approved explanation metadata for all fifteen guides", () => {
    const articles = articleRecords();

    expect(articles).toHaveLength(15);
    expect(Object.keys(expectedGuideExplanations)).toHaveLength(15);

    for (const article of articles) {
      const slug = scalar(article, "slug");
      expect(
        {
          guidePromise: scalar(article, "guidePromise"),
          deliverable: scalar(article, "deliverable"),
          whenToUse: scalar(article, "whenToUse"),
        },
        slug,
      ).toEqual(
        expectedGuideExplanations[
          slug as keyof typeof expectedGuideExplanations
        ],
      );

      expect(article.frontmatter.indexOf("contentType:")).toBeLessThan(
        article.frontmatter.indexOf("guidePromise:"),
      );
    }
  });

  it("passes mechanical published-explanation uniqueness and body-support QA", async () => {
    const issues = validateContentPortfolio(await readArticleRecords(), {
      today: todayInPublicationTimeZone(),
    });
    const explanationCodes = new Set([
      "duplicate-guide-promise",
      "duplicate-deliverable",
      "duplicate-when-to-use",
      "unsupported-guide-promise",
      "unsupported-deliverable",
      "unsupported-when-to-use",
    ]);

    expect(issues.filter(({ code }) => explanationCodes.has(code))).toEqual([]);
  });

  it("keeps publication evidence ordered from launch through the current date", () => {
    const today = todayInPublicationTimeZone();
    for (const article of articleRecords()) {
      expect(scalar(article, "status"), article.fileName).toBe("published");
      expect(scalar(article, "verificationStatus"), article.fileName).toBe(
        "source-checked",
      );
      const published = scalar(article, "datePublished");
      const reviewed = scalar(article, "lastReviewed");
      const modified = optionalScalar(article, "dateModified");
      expect(
        published.localeCompare(siteConfig.launchDate),
        article.fileName,
      ).toBeGreaterThanOrEqual(0);
      expect(
        published.localeCompare(today),
        article.fileName,
      ).toBeLessThanOrEqual(0);
      expect(
        reviewed.localeCompare(published),
        article.fileName,
      ).toBeGreaterThanOrEqual(0);
      expect(
        reviewed.localeCompare(today),
        article.fileName,
      ).toBeLessThanOrEqual(0);
      if (modified) {
        expect(
          modified.localeCompare(published),
          article.fileName,
        ).toBeGreaterThan(0);
        expect(
          modified.localeCompare(today),
          article.fileName,
        ).toBeLessThanOrEqual(0);
      }
    }
  });

  it("completes the five-part business-technology fit for every article", () => {
    for (const article of articleRecords()) {
      for (const field of BUSINESS_TECHNOLOGY_FIT_FIELDS.slice(0, 4)) {
        expect(
          scalar(article, field).length,
          `${article.fileName}: ${field}`,
        ).toBeGreaterThanOrEqual(20);
      }

      expect(
        sourceUrls(article).length,
        `${article.fileName}: sourceList`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses unique traceable HTTPS source records cited in each body", () => {
    for (const article of articleRecords()) {
      const urls = sourceUrls(article);

      expect(
        new Set(urls).size,
        `${article.fileName}: duplicate source URL`,
      ).toBe(urls.length);

      for (const sourceUrl of urls) {
        const url = new URL(sourceUrl);
        expect(url.protocol, `${article.fileName}: ${sourceUrl}`).toBe(
          "https:",
        );
        expect(
          article.body,
          `${article.fileName}: source must be cited in body`,
        ).toContain(sourceUrl);
      }
    }
  });

  it("links related guides only to distinct published articles", () => {
    const articles = articleRecords();
    const publishedSlugs = new Set(
      articles.map((article) => scalar(article, "slug")),
    );

    for (const article of articles) {
      const slug = scalar(article, "slug");
      const related = sequenceValues(article, "relatedArticles");

      expect(
        new Set(related).size,
        `${article.fileName}: duplicate relation`,
      ).toBe(related.length);
      expect(related, `${article.fileName}: self relation`).not.toContain(slug);
      for (const relatedSlug of related) {
        expect(
          publishedSlugs.has(relatedSlug),
          `${article.fileName}: unresolved relation ${relatedSlug}`,
        ).toBe(true);
      }
    }
  });

  it("provides substantive, structured guidance with an explicit limitation", () => {
    for (const article of articleRecords()) {
      expect(
        whitespaceTokenCount(article.body),
        article.fileName,
      ).toBeGreaterThanOrEqual(650);
      expect(
        article.body.match(/^##\s+/gm)?.length ?? 0,
        `${article.fileName}: section count`,
      ).toBeGreaterThanOrEqual(4);
      expect(article.body, `${article.fileName}: limitation language`).toMatch(
        /\b(?:limitation|limits|does not prove|not a substitute|not a guarantee)\b/i,
      );
      expect(
        article.body,
        `${article.fileName}: unsupported firsthand claim`,
      ).not.toMatch(
        /\b(?:I|we)\s+(?:tested|used|reviewed|found|observed|measured|deployed)\b/,
      );
    }
  });

  it("distinguishes literal two-media 3-2-1 from an all-cloud resilience adaptation", () => {
    const article = articleBySlug(
      "back-up-business-files-with-the-3-2-1-method",
    );

    expect(article.body).toMatch(
      /literal[\s\S]{0,240}two different media types/i,
    );
    expect(article.body).toMatch(/\b(?:tape|optical media)\b/i);
    expect(article.body).toMatch(
      /all-cloud[\s\S]{0,240}(?:resilience adaptation|not literal 3-2-1)/i,
    );
  });

  it("cites the current CISA StopRansomware guidance in the backup source list and body", () => {
    const article = articleBySlug(
      "back-up-business-files-with-the-3-2-1-method",
    );
    const currentCisaGuide =
      "https://www.cisa.gov/stopransomware/ransomware-guide";

    expect(sourceUrls(article)).toContain(currentCisaGuide);
    expect(article.body).toContain(currentCisaGuide);
  });

  it("keeps contingent exit exposure outside a total unless exit occurs within the horizon", () => {
    const article = articleBySlug(
      "calculate-the-total-cost-of-business-software",
    );

    expect(scalar(article, "summary")).toMatch(/contingent exit exposure/i);
    expect(article.body).toMatch(
      /include[\s\S]{0,160}exit cost[\s\S]{0,160}total only when[\s\S]{0,160}within the (?:chosen )?horizon/i,
    );
    expect(article.body).toMatch(
      /contingent exit exposure[\s\S]{0,160}(?:separately|outside the total)/i,
    );
  });

  it("maps the pilot summary to the four weekly stages in the article", () => {
    const summary = scalar(
      articleBySlug("run-a-30-day-business-technology-pilot"),
      "summary",
    );

    expect(summary).toMatch(
      /week 1[\s\S]*week 2[\s\S]*week 3[\s\S]*(?:exceptions|failure)[\s\S]*week 4[\s\S]*(?:export|decision)/i,
    );
  });

  it("reports current whitespace-delimited Markdown token totals without calling them words", () => {
    const audit = readFileSync(contentAuditPath, "utf8");
    const totalPattern =
      /\|\s*Total article body whitespace-delimited Markdown tokens\s*\|\s*([\d,]+)\s*\|/;
    const rangePattern =
      /\|\s*Body whitespace-token range\s*\|\s*([\d,]+)–([\d,]+)\s*\|/;

    expect(audit).toMatch(totalPattern);
    expect(audit).toMatch(rangePattern);
    expect(audit).not.toMatch(/\b(?:body words|word-count|word counts)\b/i);

    const totalMatch = audit.match(totalPattern);
    const rangeMatch = audit.match(rangePattern);
    if (!totalMatch?.[1] || !rangeMatch?.[1] || !rangeMatch[2]) return;

    const tokenCounts = launchArticleSlugs.map((slug) =>
      whitespaceTokenCount(articleBySlug(slug).body),
    );
    const parseNumber = (value: string) => Number(value.replaceAll(",", ""));

    expect(parseNumber(totalMatch[1])).toBe(
      tokenCounts.reduce((total, count) => total + count, 0),
    );
    expect(parseNumber(rangeMatch[1])).toBe(Math.min(...tokenCounts));
    expect(parseNumber(rangeMatch[2])).toBe(Math.max(...tokenCounts));
  });
});

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertGeneratedDocument,
  checkEditorialRepository,
  findPublicSafetyIssues,
  LAUNCH_GUIDE_SLUGS,
  PUBLIC_SAFETY_PATHS,
  RELEASE_GATE_VALUES,
  renderEditorialDocuments,
  parseEditorialSource,
  validateEditorialSource,
} from "../../scripts/qa-editorial.mjs";
import {
  countReaderVisibleWords,
  readArticleRecords,
} from "../../scripts/qa-content.mjs";

const repositoryRoot = process.cwd();
const sourcePath = path.join(
  repositoryRoot,
  "docs",
  "editorial-operations.yml",
);
const ownerInputsPath = path.join(
  repositoryRoot,
  "docs",
  "OWNER_INPUTS_REQUIRED.md",
);
const qualityQueuePath = path.join(
  repositoryRoot,
  "docs",
  "CONTENT_QUALITY_REVIEW_QUEUE.md",
);
const publishingGuidePath = path.join(
  repositoryRoot,
  "docs",
  "PUBLISHING_GUIDE.md",
);
const designSpecPath = path.join(
  repositoryRoot,
  "docs",
  "superpowers",
  "specs",
  "2026-08-25-cms-purple-signal-publication-maturity-design.md",
);
const historicalPlanPath = path.join(
  repositoryRoot,
  "docs",
  "superpowers",
  "plans",
  "2026-08-22-final-publication-maturity.md",
);
const cmsWorkflowPlanPath = path.join(
  repositoryRoot,
  "docs",
  "superpowers",
  "plans",
  "2026-08-25-pages-cms-content-workflow.md",
);
const releasePlanPath = path.join(
  repositoryRoot,
  "docs",
  "superpowers",
  "plans",
  "2026-08-25-publication-maturity-release.md",
);
const vercelIgnorePath = path.join(repositoryRoot, ".vercelignore");

const expectedQaCommands = [
  "npm run format:check",
  "npm run lint",
  "npm run typecheck",
  "npm run test -- --run",
  "npm run build",
  "npm run check:content",
  "npm run check:editorial",
  "npm run check:cms",
  "npm run check:images",
  "npm run check:cms-fixture",
  "npm run check:seo",
  "npm run check:links",
  "npm run test:e2e",
  "npm run test:visual",
  "npm run lighthouse",
] as const;

interface OwnerGateRecord extends Record<string, unknown> {
  number: number;
  name: string;
  status: string;
  evidenceReference: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

interface QualityRecord extends Record<string, unknown> {
  slug: string;
  title: string;
  category: string;
  publicationStatus: string;
  wordCount: number;
  reader: string;
  businessNeed: string;
  guidePromise: string;
  deliverable: string;
  whenToUse: string;
  sourceUrls: string[];
  sourceLastChecked: string | null;
  originalMethod: string;
  originalVisual: string;
  claimRisks: string;
  repetitionRisks: string;
  evidenceLimits: string;
  mediaRights: string;
  humanEditorialReview: string;
  ownerAction: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  releaseGate: {
    status: string;
    rationale: string;
    evidenceReference: string;
  };
}

interface EditorialSource {
  ownerGates: OwnerGateRecord[];
  qualityRecords: QualityRecord[];
}
type ArticleRecord = Awaited<ReturnType<typeof readArticleRecords>>[number];

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function loadCurrentRecords(): Promise<{
  source: EditorialSource;
  articles: ArticleRecord[];
}> {
  const [yaml, articles] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readArticleRecords(),
  ]);
  return {
    source: parseEditorialSource(yaml) as EditorialSource,
    articles,
  };
}

describe("reader-visible article word count", () => {
  it("counts prose text from the iterative Markdown AST and excludes markup-only content", () => {
    const markdown = [
      "# Visible heading",
      "",
      "Read the [linked guidance](https://www.cisa.gov/) now.",
      "",
      "`not counted inline code`",
      "",
      "![not counted image text](/images/articles/example.webp)",
      "",
      "```text",
      "not counted fenced code",
      "```",
      "",
      "<span hidden>not counted raw HTML</span>",
    ].join("\n");

    expect(countReaderVisibleWords(markdown)).toBe(7);
  });
});

describe("strict structured editorial source", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects duplicate YAML keys instead of silently accepting the last value", () => {
    expect(() =>
      parseEditorialSource(
        "ownerGates: []\nownerGates: []\nqualityRecords: []\n",
      ),
    ).toThrow(/duplicate|duplicated/i);
  });

  it("validates the current source and byte-matches both finished Markdown records", async () => {
    const [{ source, articles }, ownerDocument, qualityDocument] =
      await Promise.all([
        loadCurrentRecords(),
        readFile(ownerInputsPath, "utf8"),
        readFile(qualityQueuePath, "utf8"),
      ]);

    expect(() => validateEditorialSource(source, { articles })).not.toThrow();
    const rendered = renderEditorialDocuments(source);
    expect(rendered.ownerInputs).toBe(ownerDocument);
    expect(rendered.qualityQueue).toBe(qualityDocument);
    expect(() =>
      assertGeneratedDocument(
        `${ownerDocument}\nUnparsed injected line.\n`,
        rendered.ownerInputs,
        "owner input document",
      ),
    ).toThrow(/generated|unparsed|match/i);
  });

  it("rejects missing fields, unexpected fields, duplicate records, wrong types, and empty required text", async () => {
    const { source, articles } = await loadCurrentRecords();

    const missing = clone(source);
    delete (missing.ownerGates[0]! as Record<string, unknown>).reason;
    expect(() => validateEditorialSource(missing, { articles })).toThrow(
      /missing|reason/i,
    );

    const unexpected = clone(source);
    (unexpected.qualityRecords[0]! as Record<string, unknown>).unparsed =
      "must fail";
    expect(() => validateEditorialSource(unexpected, { articles })).toThrow(
      /unexpected|unparsed/i,
    );

    const duplicate = clone(source);
    duplicate.qualityRecords.push(clone(duplicate.qualityRecords[0]!));
    expect(() => validateEditorialSource(duplicate, { articles })).toThrow(
      /duplicate/i,
    );

    const wrongType = clone(source);
    (wrongType.qualityRecords[0]! as Record<string, unknown>).wordCount =
      "1157";
    expect(() => validateEditorialSource(wrongType, { articles })).toThrow(
      /wordCount|number/i,
    );

    const empty = clone(source);
    empty.qualityRecords[0]!.claimRisks = "";
    expect(() => validateEditorialSource(empty, { articles })).toThrow(
      /claimRisks|nonempty/i,
    );
  });

  it("keeps all current owner gates unresolved but permits only evidenced future verification", async () => {
    const { source, articles } = await loadCurrentRecords();
    expect(source.ownerGates).toHaveLength(18);
    expect(
      source.ownerGates.every(
        (gate) =>
          ["UNKNOWN", "OWNER ACTION REQUIRED"].includes(gate.status) &&
          gate.evidenceReference === null &&
          gate.verifiedBy === null &&
          gate.verifiedAt === null,
      ),
    ).toBe(true);

    const verified = clone(source);
    Object.assign(verified.ownerGates[0]!, {
      status: "VERIFIED",
      evidenceReference:
        "Owner evidence register reference OER-2026-001; confidential evidence remains outside Git.",
      verifiedBy: "Avery Chen",
      verifiedAt: "2026-08-25",
    });
    expect(() => validateEditorialSource(verified, { articles })).not.toThrow();

    for (const absent of ["evidenceReference", "verifiedBy", "verifiedAt"]) {
      const incomplete = clone(verified);
      (incomplete.ownerGates[0]! as Record<string, unknown>)[absent] = null;
      expect(() => validateEditorialSource(incomplete, { articles })).toThrow(
        new RegExp(absent, "i"),
      );
    }

    for (const genericVerifier of [
      "Editorial reviewer",
      "To be supplied",
      "A Reviewer",
      "No Evidence",
      "Pending Person",
      "Unknown Person",
      "Example Person",
      "Sample User",
    ]) {
      const generic = clone(verified);
      generic.ownerGates[0]!.verifiedBy = genericVerifier;
      expect(() => validateEditorialSource(generic, { articles })).toThrow(
        /verifiedBy|real reviewer|name/i,
      );
    }

    for (const unsupportedReference of [
      "No supporting evidence exists; this gate is still unresolved.",
      "No proof is available under reference OER-2026-001.",
      "Reference OER-2026-001 is pending and incomplete.",
      "https://example.com/proof",
      "https://localhost/proof",
    ]) {
      const unsupportedEvidence = clone(verified);
      unsupportedEvidence.ownerGates[0]!.evidenceReference =
        unsupportedReference;
      expect(() =>
        validateEditorialSource(unsupportedEvidence, { articles }),
      ).toThrow(/evidenceReference|evidence|reference/i);
    }
  });

  it("records current repository enforcement without treating external CMS access as verified", async () => {
    const { source } = await loadCurrentRecords();
    const repositoryGate = source.ownerGates.find(
      ({ number }) => number === 14,
    );
    const cmsGate = source.ownerGates.find(({ number }) => number === 13);

    expect(repositoryGate).toBeDefined();
    expect(repositoryGate?.reason).not.toMatch(
      /main is not protected|no (?:GitHub )?Actions workflows/i,
    );
    expect(repositoryGate?.reason).toMatch(
      /2026-08-26.*protected `main`.*owner-only publishing gate/i,
    );
    expect(repositoryGate?.reason).toMatch(
      /not live until.*trusted-base workflow.*merged.*required branch protection/i,
    );
    expect(repositoryGate?.publicEffect).toMatch(
      /currently requires the `Full quality gate`.*not yet an enforced live control/i,
    );
    expect(repositoryGate?.nextAction).toMatch(
      /second owner-authored pull request.*app-bound context.*required `main` checks/i,
    );
    expect(repositoryGate?.status).toBe("OWNER ACTION REQUIRED");
    expect(repositoryGate?.evidenceReference).toBeNull();

    expect(cmsGate?.reason).toMatch(
      /hosted collaborator.*exact GitHub App scope.*unverified/i,
    );
    expect(cmsGate?.status).toBe("OWNER ACTION REQUIRED");
  });

  it("renders truthful instructions after valid owner and review transitions", async () => {
    const { source, articles } = await loadCurrentRecords();
    const transitioned = clone(source);
    Object.assign(transitioned.ownerGates[0]!, {
      status: "VERIFIED",
      evidenceReference:
        "Owner evidence register reference OER-2026-001; confidential evidence remains outside Git.",
      verifiedBy: "Avery Chen",
      verifiedAt: "2026-08-25",
    });
    Object.assign(transitioned.qualityRecords[0]!, {
      sourceLastChecked: "2026-08-25",
      humanEditorialReview: "COMPLETE",
      reviewedBy: "Avery Chen",
      reviewedAt: "2026-08-25",
      expertReviewNeeded:
        "NO — the bounded test record requires no expert review after its scoped human assessment.",
      mediaRights:
        "CLEARED — rights review recorded under nonsecret evidence reference ER-001.",
      releaseGate: {
        status: "clear",
        rationale:
          "The guide-specific source, human, rights, and expert-need assessments are recorded for this candidate.",
        evidenceReference:
          "Nonsecret release evidence reference ER-001, including the expert-need assessment.",
      },
    });
    expect(() =>
      validateEditorialSource(transitioned, { articles }),
    ).not.toThrow();

    const rendered = renderEditorialDocuments(transitioned);
    expect(rendered.ownerInputs).not.toMatch(
      /Current gates use `OWNER ACTION REQUIRED` or `UNKNOWN`/,
    );
    expect(rendered.qualityQueue).not.toMatch(
      /`sourceLastChecked` remains `UNKNOWN`|Every current guide remains `OWNER REVIEW REQUIRED`/,
    );
    expect(rendered.ownerInputs).toContain("`status`: VERIFIED");
    expect(rendered.qualityQueue).toContain("`humanEditorialReview`: COMPLETE");
  });

  it("uses all 18 exact gate names from the approved design source", async () => {
    const [{ source, articles }, designSpec] = await Promise.all([
      loadCurrentRecords(),
      readFile(designSpecPath, "utf8"),
    ]);
    validateEditorialSource(source, { articles });
    const designGateSection = designSpec.match(
      /contains 18 numbered gates[\s\S]*?\n\n([\s\S]*?)\n\n## 12\./,
    )?.[1];
    expect(designGateSection).toBeTruthy();
    const expectedNames = [
      ...designGateSection!.matchAll(/^\d+\. (.+?)[.;]$/gm),
    ].map((match) => {
      const plainName = match[1]!.replaceAll("`", "");
      return `${plainName[0]!.toUpperCase()}${plainName.slice(1)}`;
    });

    expect(expectedNames).toHaveLength(18);
    expect(source.ownerGates.map(({ name }) => name)).toEqual(expectedNames);
  });

  it("derives every current published guide while retaining the launch 15 as the required subset", async () => {
    const { source, articles } = await loadCurrentRecords();
    validateEditorialSource(source, { articles });

    const published = articles
      .filter(({ data }) => data.status === "published")
      .sort((left, right) => left.data.slug.localeCompare(right.data.slug));
    const records = [...source.qualityRecords].sort((left, right) =>
      left.slug.localeCompare(right.slug),
    );
    const recordBySlug = new Map(
      records.map((record) => [record.slug, record]),
    );

    expect(records.length).toBeGreaterThanOrEqual(15);
    expect(LAUNCH_GUIDE_SLUGS).toHaveLength(15);
    for (const slug of LAUNCH_GUIDE_SLUGS) {
      expect(recordBySlug.has(slug)).toBe(true);
    }
    for (const article of published) {
      const record = recordBySlug.get(article.data.slug);
      expect(record).toBeDefined();
      expect(record).toMatchObject({
        slug: article.data.slug,
        title: article.data.title,
        category: article.data.category,
        publicationStatus: article.data.status,
        reader: article.data.intendedAudience,
        businessNeed: article.data.businessProblem,
        guidePromise: article.data.guidePromise,
        deliverable: article.data.deliverable,
        whenToUse: article.data.whenToUse,
      });
      expect(record!.wordCount).toBe(countReaderVisibleWords(article.body));
      expect(record!.sourceUrls).toEqual(
        article.data.sourceList.map(({ url }: { url: string }) => url),
      );
      expect(record!.sourceLastChecked).toBeNull();
      expect(record!.humanEditorialReview).toBe("OWNER REVIEW REQUIRED");
      expect(record!.reviewedBy).toBeNull();
      expect(record!.reviewedAt).toBeNull();
      expect(record!.releaseGate.status).toBe("owner-action");
    }
  });

  it("accepts and retains a valid future sixteenth guide without weakening the launch subset", async () => {
    const { source, articles } = await loadCurrentRecords();
    const futureArticle = clone(articles[0]);
    futureArticle.fileName = "future-publication-guide.md";
    futureArticle.data = {
      ...futureArticle.data,
      slug: "future-publication-guide",
      title: "A future publication guide with verified metadata",
      intendedAudience:
        "A distinct future reader group with a documented technology decision.",
      businessProblem:
        "A distinct future business need requires a separately reviewed publication record.",
      guidePromise:
        "Explain a distinct future method while retaining a bounded evidence and review record for publication.",
      deliverable: "A future guide-specific decision record.",
      whenToUse:
        "Use only after the future guide and its sources exist in the repository.",
    };
    const futureRecord = clone(source.qualityRecords[0]!);
    Object.assign(futureRecord, {
      slug: futureArticle.data.slug,
      title: futureArticle.data.title,
      category: futureArticle.data.category,
      publicationStatus: futureArticle.data.status,
      wordCount: countReaderVisibleWords(futureArticle.body),
      reader: futureArticle.data.intendedAudience,
      businessNeed: futureArticle.data.businessProblem,
      guidePromise: futureArticle.data.guidePromise,
      deliverable: futureArticle.data.deliverable,
      whenToUse: futureArticle.data.whenToUse,
      sourceUrls: futureArticle.data.sourceList.map(
        ({ url }: { url: string }) => url,
      ),
      originalMethod:
        "Future-specific method requiring a new human review before any release decision.",
      claimRisks:
        "Future-specific claims may outrun evidence unless the new guide receives its own scoped review.",
      repetitionRisks:
        "Future-specific language must be compared against every existing guide before release.",
      evidenceLimits:
        "The cloned test body is not publication evidence and exists only to exercise dynamic validation.",
      ownerAction:
        "Review the future record, replace test-only source material, and document the actual decision.",
    });
    const futureSource = clone(source);
    futureSource.qualityRecords.push(futureRecord);

    expect(() =>
      validateEditorialSource(futureSource, {
        articles: [...articles, futureArticle],
      }),
    ).not.toThrow();

    futureArticle.data.status = "archived";
    futureRecord.publicationStatus = "archived";
    expect(() =>
      validateEditorialSource(futureSource, {
        articles: [...articles, futureArticle],
      }),
    ).not.toThrow();
  });

  it("allows documented review/date and all four release-gate transitions with rationale and evidence", async () => {
    const { source, articles } = await loadCurrentRecords();
    for (const gateStatus of RELEASE_GATE_VALUES) {
      const transitioned = clone(source);
      const record = transitioned.qualityRecords[0]!;
      record.releaseGate = {
        status: gateStatus,
        rationale: `Specific ${gateStatus} rationale for this guide and release candidate.`,
        evidenceReference: `Repository-safe ${gateStatus} evidence reference ER-001.`,
      };
      if (gateStatus === "clear") {
        record.sourceLastChecked = "2026-08-25";
        record.humanEditorialReview = "COMPLETE";
        record.reviewedBy = "Avery Chen";
        record.reviewedAt = "2026-08-25";
        record.expertReviewNeeded =
          "NO — the bounded test record requires no expert review after its scoped human assessment.";
        record.mediaRights =
          "CLEARED — rights review recorded under nonsecret evidence reference ER-001.";
      }
      expect(() =>
        validateEditorialSource(transitioned, { articles }),
      ).not.toThrow();
    }
  });

  it("rejects contradictory or unsupported future review transitions", async () => {
    const { source, articles } = await loadCurrentRecords();

    const incompleteReview = clone(source);
    incompleteReview.qualityRecords[0]!.humanEditorialReview = "COMPLETE";
    expect(() =>
      validateEditorialSource(incompleteReview, { articles }),
    ).toThrow(/reviewedBy|reviewedAt|complete/i);

    const placeholderReviewer = clone(source);
    Object.assign(placeholderReviewer.qualityRecords[0]!, {
      humanEditorialReview: "COMPLETE",
      reviewedBy: "TBD",
      reviewedAt: "2026-08-25",
    });
    expect(() =>
      validateEditorialSource(placeholderReviewer, { articles }),
    ).toThrow(/reviewedBy|placeholder/i);

    const genericReviewer = clone(source);
    Object.assign(genericReviewer.qualityRecords[0]!, {
      humanEditorialReview: "COMPLETE",
      reviewedBy: "Owner-designated reviewer",
      reviewedAt: "2026-08-25",
    });
    expect(() =>
      validateEditorialSource(genericReviewer, { articles }),
    ).toThrow(/reviewedBy|placeholder|real reviewer/i);

    const falseClear = clone(source);
    falseClear.qualityRecords[0]!.releaseGate = {
      status: "clear",
      rationale: "The record claims clear while human review remains open.",
      evidenceReference: "Repository check reference ER-002.",
    };
    expect(() => validateEditorialSource(falseClear, { articles })).toThrow(
      /clear|review|source|rights/i,
    );

    const unresolvedExpertClear = clone(source);
    Object.assign(unresolvedExpertClear.qualityRecords[0]!, {
      sourceLastChecked: "2026-08-25",
      humanEditorialReview: "COMPLETE",
      reviewedBy: "Avery Chen",
      reviewedAt: "2026-08-25",
      mediaRights:
        "CLEARED — rights review recorded under nonsecret evidence reference ER-001.",
      releaseGate: {
        status: "clear",
        rationale:
          "The record incorrectly claims clear while expert review remains unresolved.",
        evidenceReference: "Repository check reference ER-002.",
      },
    });
    expect(() =>
      validateEditorialSource(unresolvedExpertClear, { articles }),
    ).toThrow(/expert/i);

    for (const bypassText of [
      "YES COMPLETE",
      "YES — NOT COMPLETE",
      "CONDITIONAL — NOT REQUIRED TO BE COMPLETE",
      "CONDITIONAL — UNRESOLVED BUT NOT REQUIRED",
      "NO — expert review is required before release",
      "NO — no expert review is required, but a security expert must review",
    ]) {
      const attemptedBypass = clone(unresolvedExpertClear);
      attemptedBypass.qualityRecords[0]!.expertReviewNeeded = bypassText;
      expect(() =>
        validateEditorialSource(attemptedBypass, { articles }),
      ).toThrow(/expert/i);
    }

    for (const unsafeRights of [
      "Rights are not cleared and no license exists.",
      "Rights review is incomplete pending owner action.",
      "CLEARED — rights are not cleared and no license exists.",
      "CLEARED — rights review is incomplete pending owner action.",
    ]) {
      const attemptedRightsBypass = clone(unresolvedExpertClear);
      attemptedRightsBypass.qualityRecords[0]!.expertReviewNeeded =
        "NO — the bounded test record requires no expert review after its scoped human assessment.";
      attemptedRightsBypass.qualityRecords[0]!.mediaRights = unsafeRights;
      expect(() =>
        validateEditorialSource(attemptedRightsBypass, { articles }),
      ).toThrow(/media|rights|clear/i);
    }

    for (const contradiction of [
      {
        rationale:
          "The release remains blocked because required evidence is missing.",
        evidenceReference: "Release evidence reference ER-002.",
      },
      {
        rationale: "All bounded release checks are recorded for this guide.",
        evidenceReference:
          "No proof is available under release reference ER-002.",
      },
    ]) {
      const contradictoryClear = clone(unresolvedExpertClear);
      contradictoryClear.qualityRecords[0]!.expertReviewNeeded =
        "NO — the bounded test record requires no expert review after its scoped human assessment.";
      contradictoryClear.qualityRecords[0]!.mediaRights =
        "CLEARED — rights review recorded under nonsecret evidence reference ER-001.";
      contradictoryClear.qualityRecords[0]!.releaseGate = {
        status: "clear",
        ...contradiction,
      };
      expect(() =>
        validateEditorialSource(contradictoryClear, { articles }),
      ).toThrow(/clear|rationale|evidence/i);
    }

    const invalidGate = clone(source);
    invalidGate.qualityRecords[0]!.releaseGate.status = "approved";
    expect(() => validateEditorialSource(invalidGate, { articles })).toThrow(
      /releaseGate|approved/i,
    );

    const futureSourceDate = clone(source);
    futureSourceDate.qualityRecords[0]!.sourceLastChecked = "2026-08-26";
    expect(() =>
      validateEditorialSource(futureSourceDate, { articles }),
    ).toThrow(/sourceLastChecked|future/i);
  });
});

describe("public-repository safety boundary", () => {
  it("rejects secret-like values while allowing explanatory labels without payloads", () => {
    const explanatory = [
      "Never commit a publisher ID such as `pub-…`.",
      "Tokens, credentials, private keys, and email addresses stay outside Git.",
      "A secret-bearing query parameter is prohibited.",
    ].join("\n");
    expect(findPublicSafetyIssues(explanatory, "explanatory labels")).toEqual(
      [],
    );

    for (const [label, unsafe] of [
      ["publisher identifier", `pub-${"1".repeat(16)}`],
      ["email address", "owner@real-looking-domain.com"],
      ["GitHub token", `ghp_${"A".repeat(36)}`],
      ["Google API token", `AIza${"A".repeat(35)}`],
      ["Bearer credential", `Authorization: Bearer ${"A".repeat(32)}`],
      [
        "JWT credential",
        `${"a".repeat(24)}.${"b".repeat(24)}.${"c".repeat(24)}`,
      ],
      [
        "secret-bearing URL",
        "https://www.nist.gov/record?access_token=secret-value",
      ],
      [
        "client-secret URL",
        "https://www.nist.gov/record?client_secret=secret-value",
      ],
      [
        "private key material",
        "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
      ],
    ] as const) {
      expect(findPublicSafetyIssues(unsafe, label)).not.toEqual([]);
    }
  });

  it("keeps every editorial source explicitly repository-tracked, non-deployed, and public-safe", async () => {
    expect(PUBLIC_SAFETY_PATHS).toContain("src/data/authors.ts");
    const contents = await Promise.all(
      PUBLIC_SAFETY_PATHS.map(async (relativePath: string) => ({
        relativePath,
        content: await readFile(
          path.join(repositoryRoot, relativePath),
          "utf8",
        ),
      })),
    );
    for (const { relativePath, content } of contents) {
      expect(findPublicSafetyIssues(content, relativePath)).toEqual([]);
    }
    const combined = contents.map(({ content }) => content).join("\n");
    expect(combined).toMatch(/repository-tracked, non-deployed source/i);
    expect(combined).toMatch(
      /every committed file and branch.*publicly visible/i,
    );
    expect(combined).toMatch(/confidential.*outside Git/i);
    expect(combined).toMatch(/nonsecret (?:evidence )?reference/i);
    expect(combined).not.toMatch(
      /internal,? nonpublic|private[- ]source|private managed-media|record .*privately|not public content/i,
    );
  });

  it("blocks unsafe generated source before write mode changes either Markdown document", async () => {
    const [{ articles }, sourceText, designSpec] = await Promise.all([
      loadCurrentRecords(),
      readFile(sourcePath, "utf8"),
      readFile(designSpecPath, "utf8"),
    ]);
    const unsafeSource = sourceText.replace(
      "A nonsecret evidence reference",
      `Publisher evidence pub-${"1".repeat(16)}`,
    );
    expect(unsafeSource).not.toBe(sourceText);
    const writes: string[] = [];

    await expect(
      checkEditorialRepository({
        repositoryRoot: path.join(repositoryRoot, "virtual-editorial-check"),
        write: true,
        readArticleRecordsImpl: async () => articles,
        readFileImpl: (async (filePath: unknown) => {
          const normalized = String(filePath).replaceAll("\\", "/");
          if (normalized.endsWith("/docs/editorial-operations.yml")) {
            return unsafeSource;
          }
          if (
            normalized.endsWith(
              "/docs/superpowers/specs/2026-08-25-cms-purple-signal-publication-maturity-design.md",
            )
          ) {
            return designSpec;
          }
          return "Repository-tracked, non-deployed source. Every committed file and branch is publicly visible. Confidential evidence stays outside Git; commit only a nonsecret evidence reference.";
        }) as unknown as typeof readFile,
        writeFileImpl: (async (filePath: unknown) => {
          writes.push(String(filePath));
        }) as unknown as typeof writeFile,
      }),
    ).rejects.toThrow(/publisher identifier|safety/i);
    expect(writes).toEqual([]);
  });
});

describe("publication operating guide", () => {
  it("documents the owner-only hosted CMS and complete branch-to-release workflow", async () => {
    const guide = await readFile(publishingGuidePath, "utf8");

    for (const required of [
      /configured and locally tested/i,
      /hosted Pages CMS.*GitHub App.*owner action/i,
      /hosted authorization.*save.*round-trip.*unverified/i,
      /sign in.*Pages CMS/i,
      /select.*repository/i,
      /select.*non-main.*branch/i,
      /create.*draft/i,
      /draft.*review.*published.*archived/i,
      /archive, not delete/i,
      /permanent deletion.*reviewed Git operation/i,
      /slug.*filename.*immutable/i,
      /src\/content-assets\/articles/i,
      /public URL.*\/images\/articles\//i,
      /hero.*body image.*slug-prefixed/i,
      /EXIF[\s\S]{0,160}GPS.*location.*device.*author.*XMP.*IPTC.*comments/i,
      /raw bytes[\s\S]{0,120}public repository[\s\S]{0,160}before CI[\s\S]{0,160}cannot erase[\s\S]{0,120}Git history/i,
      /body image.*Markdown.*path.*alt/i,
      /Pages CMS[\s\S]{0,160}does not[\s\S]{0,160}body-image[\s\S]{0,160}caption.*credit.*license.*source/i,
      /mediaRights[\s\S]{0,160}quality record/i,
      /before[\s\S]{0,160}published[\s\S]{0,200}quality record[\s\S]{0,160}editorial-operations\.yml/i,
      /new visual key[\s\S]{0,160}symbol/i,
      /sources.*related guides/i,
      /truthful dates/i,
      /safe Markdown.*source mode.*raw HTML/i,
      /branch.*pull request/i,
      /Vercel preview.*review-status.*nonroutable/i,
      /GitHub commit/i,
      /npm run check:editorial/i,
      /editorial-operations\.yml.*source of truth/i,
      /npm run generate:editorial/i,
      /rollback.*git revert/i,
      /production release/i,
      /not.*native.*approval engine/i,
      /published.*controls routing.*does not prove.*human review/i,
    ]) {
      expect(guide).toMatch(required);
    }
  });

  it("documents strict record evolution in the current design specification", async () => {
    const design = await readFile(designSpecPath, "utf8");
    for (const required of [
      /editorial-operations\.yml.*structured source/i,
      /VERIFIED.*evidence reference.*verifiedBy.*verifiedAt/i,
      /launch.*15.*required subset.*currently published/i,
      /sourceLastChecked.*YYYY-MM-DD/i,
      /humanEditorialReview.*COMPLETE.*reviewedBy.*reviewedAt/i,
      /releaseGate.*rationale.*evidence reference/i,
      /reader-visible.*Markdown AST/i,
      /clear.*expert review.*resolved/i,
      /public-safety scan.*before.*generated.*writ/i,
    ]) {
      expect(design).toMatch(required);
    }
  });

  it("states the complete secret incident response and ordinary-revert limitation", async () => {
    const guide = await readFile(publishingGuidePath, "utf8");
    for (const required of [
      /stop.*do not.*commit|stop.*publication/i,
      /revoke.*rotate.*first/i,
      /coordinate.*owner.*administrator/i,
      /git-filter-repo|GitHub.*sensitive data/i,
      /invalidate.*deployment.*cache/i,
      /ordinary (?:git )?revert.*(?:does not|cannot).*erase.*(?:secret|history)/i,
    ]) {
      expect(guide).toMatch(required);
    }
  });

  it("uses the exact QA command sequence once, with no self-reference, omission, duplicate, reordering, or extra", async () => {
    const [packageText, guide] = await Promise.all([
      readFile(path.join(repositoryRoot, "package.json"), "utf8"),
      readFile(publishingGuidePath, "utf8"),
    ]);
    const packageJson = JSON.parse(packageText) as {
      scripts: Record<string, string>;
    };
    const qaCommands = packageJson.scripts
      .qa!.split(/\s*&&\s*/)
      .map((command) => command.trim());
    expect(qaCommands).toEqual(expectedQaCommands);
    expect(qaCommands).not.toContain("npm run qa");
    expect(new Set(qaCommands).size).toBe(qaCommands.length);

    for (const command of expectedQaCommands) {
      const scriptName = command.startsWith("npm run ")
        ? command.slice("npm run ".length).split(" ")[0]!
        : "test";
      expect(packageJson.scripts[scriptName]).toBeTruthy();
    }

    const localCommands = guide
      .match(/## Local checks[\s\S]*?```text\r?\n([\s\S]*?)```/)![1]!
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    expect(localCommands).toEqual([
      "npm ci",
      "npm run setup:browsers",
      ...expectedQaCommands,
    ]);
  });

  it("renders the exact truthful publication-name disclosure once per article", async () => {
    const layout = await readFile(
      path.join(repositoryRoot, "src", "layouts", "ArticleLayout.astro"),
      "utf8",
    );
    const disclosure =
      "Everyday Tech Insight is a publication-name byline, not an identified person or legal organization; the name never represents a person.";

    expect(layout.replace(/\s+/g, " ").split(disclosure)).toHaveLength(2);
    expect(layout.match(/byline-notice/g)).toHaveLength(1);
    expect(layout).not.toMatch(/@type["']?\s*:\s*["'](?:Person|Organization)/);
  });

  it("keeps unknown AdSense account facts inside the repository evidence boundary", async () => {
    const ownerInputs = await readFile(ownerInputsPath, "utf8");

    expect(ownerInputs).not.toContain(
      "No platform-authorized `ads.txt` line exists",
    );
    expect(ownerInputs).toMatch(
      /No platform-authorized `ads\.txt` line (?:has been supplied to|is evidenced in) the repository/i,
    );
  });
});

describe("historical implementation plan", () => {
  it("marks the older Final plan as superseded and routes readers to all current controls", async () => {
    const plan = await readFile(historicalPlanPath, "utf8");
    const noticeBoundary = plan.indexOf("---");
    const notice = plan.slice(0, noticeBoundary);

    expect(noticeBoundary).toBeGreaterThan(0);
    expect(notice).toMatch(/historical.*superseded/i);
    for (const currentDocument of [
      "2026-08-25-cms-purple-signal-publication-maturity-design.md",
      "2026-08-25-pages-cms-content-workflow.md",
      "2026-08-25-publication-maturity-release.md",
      "PUBLISHING_GUIDE.md",
    ]) {
      expect(notice).toContain(currentDocument);
    }
    expect(plan).toContain(
      "**Goal:** Turn Everyday Tech Insight into a curated, scalable, distinctive static publication",
    );
  });
});

describe("current executable plans", () => {
  it("keeps every editorial release-gate input in the Vercel build bundle", async () => {
    const rules = (await readFile(vercelIgnorePath, "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    const ignoredEditorialInputs = rules.filter(
      (rule) =>
        !rule.startsWith("!") &&
        (rule === "README.md" || /^\/?docs(?:\/|\*|$)/.test(rule)),
    );

    expect(ignoredEditorialInputs).toEqual([]);
  });

  it("keeps the structured editorial source, generator, checker, tests, and staged paths together", async () => {
    const plan = await readFile(cmsWorkflowPlanPath, "utf8");
    const taskSeven = plan.match(/### Task 7:[\s\S]*?(?=### Task 8:)/)?.[0];
    const taskEight = plan.match(/### Task 8:[\s\S]*?(?=### Task 9:)/)?.[0];
    expect(taskSeven).toBeTruthy();
    expect(taskEight).toBeTruthy();

    for (const required of [
      "docs/editorial-operations.yml",
      "scripts/qa-editorial.mjs",
      "scripts/qa-content.mjs",
      "tests/unit/editorial-operations.test.ts",
      "npm run generate:editorial",
      "npm run check:editorial",
      "createVerifiedAuthorRegistry([])",
      "actual UTC",
    ]) {
      expect(taskSeven).toContain(required);
    }
    expect(taskSeven).toMatch(
      /git add[^\n]*docs\/editorial-operations\.yml[^\n]*scripts\/qa-editorial\.mjs[^\n]*tests\/unit\/editorial-operations\.test\.ts/,
    );
    expect(taskEight).toContain("tests/unit/editorial-operations.test.ts");
    expect(taskEight).toMatch(
      /git add[^\n]*docs\/PUBLISHING_GUIDE\.md[^\n]*tests\/unit\/editorial-operations\.test\.ts/,
    );
  });

  it("never bulk-stages an unknown release-candidate worktree", async () => {
    const plan = await readFile(releasePlanPath, "utf8");
    expect(plan).not.toMatch(/^git add\s+-A\b/m);
    expect(plan).toMatch(/git status --short/);
    expect(plan).toMatch(/git diff --cached --name-status/);
    expect(plan).toMatch(/stage each reviewed.*literal path/i);
  });
});

import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readArticleRecords } from "../../scripts/qa-content.mjs";
import { getToolkitResourceForArticle } from "../../src/data/toolkit";

const repositoryRoot = process.cwd();
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

const launchSlugs = [
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

const qualityFields = [
  "slug",
  "title",
  "category",
  "publicationStatus",
  "wordCount",
  "reader",
  "businessNeed",
  "guidePromise",
  "deliverable",
  "whenToUse",
  "sourceUrls",
  "sourceSuitability",
  "sourceLastChecked",
  "originalMethod",
  "originalVisual",
  "toolkitContribution",
  "claimRisks",
  "repetitionRisks",
  "evidenceLimits",
  "mediaRights",
  "automationReview",
  "humanEditorialReview",
  "expertReviewNeeded",
  "recommendation",
  "ownerAction",
  "reviewedBy",
  "reviewedAt",
  "releaseGate",
] as const;

function parseFieldBlock(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  let activeField: string | undefined;
  for (const line of block.split(/\r?\n/)) {
    const field = line.match(/^- `([^`]+)`: ?(.*)$/);
    if (field) {
      activeField = field[1]!;
      fields.set(activeField, field[2]!.trim());
      continue;
    }
    if (activeField && /^\s{2,}\S/.test(line)) {
      fields.set(
        activeField,
        `${fields.get(activeField)} ${line.trim()}`.trim(),
      );
    } else if (line.trim() === "") {
      activeField = undefined;
    }
  }
  return fields;
}

function markdownWordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

describe("owner input record", () => {
  it("contains the exact 18 evidence gates and exact five fields", async () => {
    const [document, designSpec] = await Promise.all([
      readFile(ownerInputsPath, "utf8"),
      readFile(designSpecPath, "utf8"),
    ]);
    const designGateSection = designSpec.match(
      /contains 18 numbered gates[\s\S]*?\n\n([\s\S]*?)\n\n## 12\./,
    )?.[1];
    expect(designGateSection).toBeTruthy();
    const ownerGates = [
      ...designGateSection!.matchAll(/^\d+\. (.+?)[.;]$/gm),
    ].map((match) => {
      const plainName = match[1]!.replaceAll("`", "");
      return `${plainName[0]!.toUpperCase()}${plainName.slice(1)}`;
    });
    expect(ownerGates).toHaveLength(18);
    const sections = [
      ...document.matchAll(
        /^## Gate (\d{2}): (.+)\r?\n([\s\S]*?)(?=^## Gate \d{2}:|(?![\s\S]))/gm,
      ),
    ];

    expect(sections).toHaveLength(18);
    expect(sections.map((section) => section[1])).toEqual(
      Array.from({ length: 18 }, (_, index) =>
        String(index + 1).padStart(2, "0"),
      ),
    );
    expect(sections.map((section) => section[2])).toEqual(ownerGates);

    for (const section of sections) {
      const fields = parseFieldBlock(section[3]!);
      expect([...fields.keys()]).toEqual([
        "status",
        "reason",
        "accepted evidence",
        "public effect",
        "next action",
      ]);
      expect(fields.get("status")).toMatch(
        /^(?:OWNER ACTION REQUIRED|UNKNOWN)$/,
      );
      for (const [field, value] of fields) {
        if (field !== "status") expect(value.length).toBeGreaterThan(8);
      }
    }

    expect(document).toMatch(/internal, nonpublic record/i);
    expect(document).toMatch(/must not be copied into public placeholders/i);
    expect(document).not.toMatch(/\b(?:TBD|TODO)\b|ca-pub-|example@|<[^>]+>/i);
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

describe("content quality review queue", () => {
  it("contains exactly one complete repository-derived record per launch guide", async () => {
    const [document, articleRecords] = await Promise.all([
      readFile(qualityQueuePath, "utf8"),
      readArticleRecords(),
    ]);
    const published = articleRecords
      .filter(({ data }) => data.status === "published")
      .sort((left, right) => left.data.slug.localeCompare(right.data.slug));
    const sections = [
      ...document.matchAll(
        /^## Guide (\d{2}): `([^`]+)`\r?\n([\s\S]*?)(?=^## Guide \d{2}:|(?![\s\S]))/gm,
      ),
    ];

    expect(published.map(({ data }) => data.slug)).toEqual(launchSlugs);
    expect(sections).toHaveLength(15);
    expect(sections.map((section) => section[2])).toEqual(launchSlugs);
    expect(new Set(sections.map((section) => section[2])).size).toBe(15);

    const riskValues = {
      claims: new Set<string>(),
      repetition: new Set<string>(),
      evidence: new Set<string>(),
      owner: new Set<string>(),
    };

    for (const [index, article] of published.entries()) {
      const section = sections[index]!;
      const fields = parseFieldBlock(section[3]!);
      expect([...fields.keys()]).toEqual(qualityFields);
      expect(fields.get("slug")).toBe(article.data.slug);
      expect(fields.get("title")).toBe(article.data.title);
      expect(fields.get("category")).toBe(article.data.category);
      expect(fields.get("publicationStatus")).toBe(article.data.status);
      expect(Number(fields.get("wordCount"))).toBe(
        markdownWordCount(article.body),
      );
      expect(fields.get("reader")).toBe(article.data.intendedAudience);
      expect(fields.get("businessNeed")).toBe(article.data.businessProblem);
      expect(fields.get("guidePromise")).toBe(article.data.guidePromise);
      expect(fields.get("deliverable")).toBe(article.data.deliverable);
      expect(fields.get("whenToUse")).toBe(article.data.whenToUse);
      expect(fields.get("sourceUrls")?.split(" | ")).toEqual(
        article.data.sourceList.map(({ url }: { url: string }) => url),
      );
      expect(fields.get("sourceSuitability")).toMatch(
        /(?:official|government|vendor).*(?:scope|guidance|definition|framework|control)/i,
      );
      expect(fields.get("sourceLastChecked")).toBe("UNKNOWN");
      expect(fields.get("originalVisual")).toContain(article.data.visual.type);
      expect(fields.get("originalVisual")).toContain(article.data.visual.key);

      const toolkit = getToolkitResourceForArticle(article.data.slug);
      if (toolkit) {
        expect(fields.get("toolkitContribution")).toContain(toolkit.title);
        expect(fields.get("toolkitContribution")).toContain(toolkit.detailHref);
      } else {
        expect(fields.get("toolkitContribution")).toMatch(
          /no mapped toolkit worksheet/i,
        );
      }

      expect(fields.get("mediaRights")).toMatch(/OWNER RIGHTS REVIEW REQUIRED/);
      expect(fields.get("automationReview")).toMatch(/repository-observable/i);
      expect(fields.get("automationReview")).toMatch(/does not prove/i);
      expect(fields.get("humanEditorialReview")).toBe("OWNER REVIEW REQUIRED");
      expect(fields.get("reviewedBy")).toBe("");
      expect(fields.get("reviewedAt")).toBe("");
      expect(fields.get("recommendation")).toMatch(
        /^(?:KEEP|REVISE|ARCHIVE)\b/,
      );
      expect(fields.get("releaseGate")).toBe("owner-action");

      riskValues.claims.add(fields.get("claimRisks")!);
      riskValues.repetition.add(fields.get("repetitionRisks")!);
      riskValues.evidence.add(fields.get("evidenceLimits")!);
      riskValues.owner.add(fields.get("ownerAction")!);
    }

    expect(riskValues.claims.size).toBe(15);
    expect(riskValues.repetition.size).toBe(15);
    expect(riskValues.evidence.size).toBe(15);
    expect(riskValues.owner.size).toBe(15);
    expect(document).toMatch(/internal, nonpublic review record/i);
    expect(document).not.toMatch(/\b(?:TBD|TODO)\b|ca-pub-|example@|<[^>]+>/i);
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
      /alt.*caption.*credit.*license.*source.*rights/i,
      /sources.*related guides/i,
      /truthful dates/i,
      /safe Markdown.*source mode.*raw HTML/i,
      /branch.*pull request/i,
      /Vercel preview.*review-status.*nonroutable/i,
      /GitHub commit/i,
      /npm run check:cms/i,
      /npm run check:images/i,
      /npm run check:cms-fixture/i,
      /rollback.*git revert/i,
      /production release/i,
      /not.*native.*approval engine/i,
      /published.*controls routing.*does not prove.*human review/i,
    ]) {
      expect(guide).toMatch(required);
    }
  });

  it("keeps QA gates in the required executable order", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const qa = packageJson.scripts.qa!;
    const ordered = [
      "npm run build",
      "npm run check:content",
      "npm run check:cms",
      "npm run check:images",
      "npm run check:cms-fixture",
      "npm run check:seo",
      "npm run check:links",
      "npm run test:e2e",
    ];

    for (const command of ordered) expect(qa).toContain(command);
    expect(ordered.map((command) => qa.indexOf(command))).toEqual(
      [...ordered].map((command) => qa.indexOf(command)).sort((a, b) => a - b),
    );
    for (const command of ordered) {
      const scriptName = command.replace("npm run ", "");
      expect(packageJson.scripts[scriptName]).toBeTruthy();
    }
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

  it("documents private source media and published-only public URLs without the stale public source root", async () => {
    const currentDocuments = [
      "README.md",
      "docs/CMS_BRAND_ADSENSE_SOURCE_LOG.md",
      "docs/superpowers/specs/2026-08-25-cms-purple-signal-publication-maturity-design.md",
      "docs/superpowers/plans/2026-08-25-pages-cms-content-workflow.md",
    ];
    const contents = await Promise.all(
      currentDocuments.map((file) =>
        readFile(path.join(repositoryRoot, file), "utf8"),
      ),
    );

    for (const content of contents) {
      expect(content).not.toContain("public/images/articles");
      expect(content).toContain("src/content-assets/articles");
    }
    expect(contents.join("\n")).toMatch(/published.*\/images\/articles\//i);
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

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createPublicationRouteInventory,
  derivePublicationRouteInventory,
} from "../../scripts/publication-route-inventory.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const genericVerificationFiles = [
  "scripts/capture-production-screenshots.mjs",
  "scripts/run-lighthouse.mjs",
  "tests/e2e/accessibility.spec.ts",
  "tests/e2e/public-routes.spec.ts",
  "tests/e2e/responsive.spec.ts",
  "tests/e2e/visual-regression.spec.ts",
] as const;
const currentRepresentativePaths = [
  "/articles/how-to-identify-business-tasks-for-automation/",
  "/articles/evaluate-saas-with-a-practical-checklist/",
  "/articles/respond-to-a-suspected-phishing-message/",
  "/articles/create-a-shared-file-and-folder-system/",
  "/articles/calculate-the-total-cost-of-business-software/",
  "/articles/back-up-business-files-with-the-3-2-1-method/",
] as const;

describe("current-published representative route inventory", () => {
  it("preserves the current representative article selections deterministically", async () => {
    const inventory = await derivePublicationRouteInventory();

    expect(inventory.representativeArticlePaths).toEqual({
      primary: "/articles/how-to-identify-business-tasks-for-automation/",
      saasEvaluation: "/articles/evaluate-saas-with-a-practical-checklist/",
      securityWorkflow: "/articles/respond-to-a-suspected-phishing-message/",
      operationsArchitecture:
        "/articles/create-a-shared-file-and-folder-system/",
      strategyCost: "/articles/calculate-the-total-cost-of-business-software/",
      backup: "/articles/back-up-business-files-with-the-3-2-1-method/",
      table: "/articles/create-a-simple-technology-risk-register/",
    });
  });

  it("keeps generic verification suites independent of individual article URL literals", () => {
    for (const relativePath of genericVerificationFiles) {
      const source = readFileSync(
        path.join(repositoryRoot, relativePath),
        "utf8",
      );
      for (const articlePath of currentRepresentativePaths) {
        expect(source, relativePath).not.toContain(articlePath);
      }
    }
  });

  it("makes browser consumers use selected metadata and the table-specific route", () => {
    const publicRoutes = readFileSync(
      path.join(repositoryRoot, "tests/e2e/public-routes.spec.ts"),
      "utf8",
    );
    const responsive = readFileSync(
      path.join(repositoryRoot, "tests/e2e/responsive.spec.ts"),
      "utf8",
    );
    const accessibility = readFileSync(
      path.join(repositoryRoot, "tests/e2e/accessibility.spec.ts"),
      "utf8",
    );

    for (const source of [publicRoutes, responsive, accessibility]) {
      expect(source).toContain("REPRESENTATIVE_ARTICLES");
    }
    for (const source of [responsive, accessibility]) {
      expect(source).toContain("REPRESENTATIVE_ARTICLE_PATHS.table");
    }
    expect(responsive).not.toContain(
      'data-visual-key="automation-candidate-screen"',
    );
    expect(accessibility).not.toContain(
      "A task funnel that rejects unstable or high-risk work before a bounded pilot.",
    );
  });

  it("replaces an archived representative with a validated current-published route", () => {
    const inventory = createPublicationRouteInventory([
      {
        body: "Archived.",
        data: {
          slug: "former-primary-guide",
          status: "archived",
          visual: { type: "decision-tree" },
        },
        fileName: "former-primary-guide.md",
      },
      {
        body: "Published.",
        data: {
          slug: "replacement-primary-guide",
          status: "published",
          visual: { type: "decision-tree" },
        },
        fileName: "replacement-primary-guide.md",
      },
    ]);

    expect(inventory.archivedArticlePaths).toEqual([
      "/articles/former-primary-guide/",
    ]);
    expect(inventory.representativeArticlePaths.primary).toBe(
      "/articles/replacement-primary-guide/",
    );
  });

  it("derives fallback metadata and a separate table representative when the sole decision tree is archived", () => {
    const inventory = createPublicationRouteInventory([
      {
        body: "Archived.",
        data: {
          slug: "former-decision-tree-guide",
          status: "archived",
          visual: { key: "former-tree", type: "decision-tree" },
        },
        fileName: "former-decision-tree-guide.md",
      },
      {
        body: "A current article without a data table.",
        data: {
          category: "business-software",
          dateModified: "2026-08-24",
          datePublished: "2026-08-22",
          slug: "current-fallback-guide",
          status: "published",
          visual: {
            alt: "A comparison of two current software choices.",
            key: "current-comparison",
            type: "comparison",
          },
        },
        fileName: "current-fallback-guide.md",
      },
      {
        body: [
          "A current article with a data table.",
          "",
          "| Check | Result |",
          "| --- | --- |",
          "| Restore | Pass |",
        ].join("\n"),
        data: {
          category: "cybersecurity-data-protection",
          datePublished: "2026-08-23",
          slug: "current-table-guide",
          status: "published",
          visual: {
            alt: "A current backup verification sequence.",
            key: "current-backup",
            type: "backup-topology",
          },
        },
        fileName: "current-table-guide.md",
      },
    ]);

    expect(inventory.representativeArticles.primary).toEqual({
      category: "business-software",
      dateModified: "2026-08-24",
      datePublished: "2026-08-22",
      path: "/articles/current-fallback-guide/",
      slug: "current-fallback-guide",
      visual: {
        alt: "A comparison of two current software choices.",
        key: "current-comparison",
        type: "comparison",
      },
    });
    expect(inventory.representativeArticlePaths.table).toBe(
      "/articles/current-table-guide/",
    );
  });

  it("keeps an urgent zero-published withdrawal buildable with empty representative routes", () => {
    let inventory: ReturnType<typeof createPublicationRouteInventory>;

    expect(() => {
      inventory = createPublicationRouteInventory([
        {
          body: "Archived for urgent withdrawal.",
          data: {
            slug: "withdrawn-guide",
            status: "archived",
            visual: { key: "withdrawn-visual", type: "decision-tree" },
          },
          fileName: "withdrawn-guide.md",
        },
      ]);
    }).not.toThrow();

    expect(inventory!.representativeArticlePaths).toEqual({
      backup: null,
      operationsArchitecture: null,
      primary: null,
      saasEvaluation: null,
      securityWorkflow: null,
      strategyCost: null,
      table: null,
    });
  });
});

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
  it("preserves the current six representative article selections deterministically", async () => {
    const inventory = await derivePublicationRouteInventory();

    expect(inventory.representativeArticlePaths).toEqual({
      primary: "/articles/how-to-identify-business-tasks-for-automation/",
      saasEvaluation: "/articles/evaluate-saas-with-a-practical-checklist/",
      securityWorkflow: "/articles/respond-to-a-suspected-phishing-message/",
      operationsArchitecture:
        "/articles/create-a-shared-file-and-folder-system/",
      strategyCost: "/articles/calculate-the-total-cost-of-business-software/",
      backup: "/articles/back-up-business-files-with-the-3-2-1-method/",
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
});

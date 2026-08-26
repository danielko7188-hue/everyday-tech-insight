import { expect, test } from "@playwright/test";

// Regression: ISSUE-001 — the evidence-boundary sentences rendered without a separating space
// Found by /qa on 2026-08-25
// Report: .gstack/qa-reports/qa-report-everyday-tech-insight-vercel-app-2026-08-25.md
test("guide-preparation prose preserves the sentence boundary", async ({
  page,
}) => {
  await page.goto("/articles/how-to-identify-business-tasks-for-automation/");

  const preparation = page.locator(".guide-preparation");
  await expect(preparation).toContainText(
    "3 cited sources. Recorded source access date:",
  );
  await expect(preparation).not.toContainText("sources.Recorded");
});

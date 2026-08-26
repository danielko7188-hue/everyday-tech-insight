import { expect, test } from "@playwright/test";

const expectedGroups = [
  "Publication",
  "Guides",
  "Topics",
  "Standards & transparency",
  "Privacy & advertising",
  "Sitemap & RSS",
] as const;

test("ISSUE-009 renders the requested six footer navigation groups", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.locator("footer.site-footer");

  await expect(footer.getByRole("navigation")).toHaveCount(6);
  for (const name of expectedGroups) {
    await expect(footer.getByRole("navigation", { name })).toHaveCount(1);
  }
});

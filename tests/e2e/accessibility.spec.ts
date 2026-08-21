import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const articlePath = "/articles/how-to-identify-business-tasks-for-automation/";

for (const route of ["/", articlePath]) {
  test(`${route} has no serious or critical axe violations`, async ({
    page,
  }) => {
    await page.goto(route);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blockingViolations = results.violations.filter(({ impact }) =>
      ["serious", "critical"].includes(impact ?? ""),
    );

    expect(blockingViolations).toEqual([]);
  });
}

test("skip link is first, visibly focused, and moves focus to main", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  const focusOutline = await skipLink.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );
  expect(focusOutline).not.toBe("none");

  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("375px layout has no horizontal overflow and keeps navigation usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);

  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(navigation).toBeVisible();

  for (const name of ["Home", "Categories", "About"]) {
    const link = navigation.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("article body links are visibly underlined and keyboard focus is visible", async ({
  page,
}) => {
  await page.goto(articlePath);

  const sourceLink = page
    .getByRole("region", { name: "Sources" })
    .getByRole("link")
    .first();
  await expect(sourceLink).toBeVisible();
  expect(
    await sourceLink.evaluate((element) =>
      getComputedStyle(element).textDecorationLine.includes("underline"),
    ),
  ).toBe(true);

  await sourceLink.focus();
  expect(
    await sourceLink.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    ),
  ).not.toBe("none");
});

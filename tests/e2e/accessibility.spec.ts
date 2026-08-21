import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const articlePath = "/articles/how-to-identify-business-tasks-for-automation/";
const navy = "#15314b";
const focusAmber = "#ffbf47";

function relativeLuminance(hexColor: string): number {
  const [red, green, blue] = hexColor
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    ) as [number, number, number];

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

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

  const skipFocusIndicator = await skipLink.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      boxShadow: styles.boxShadow,
      outlineColor: styles.outlineColor,
      outlineStyle: styles.outlineStyle,
      outlineWidth: Number.parseFloat(styles.outlineWidth),
    };
  });
  expect(skipFocusIndicator.outlineStyle).toBe("solid");
  expect(skipFocusIndicator.outlineWidth).toBeGreaterThan(0);
  expect(skipFocusIndicator.outlineColor).toBe("rgb(21, 49, 75)");
  expect(skipFocusIndicator.boxShadow).toContain("rgb(255, 191, 71)");

  await page.keyboard.press("Enter");
  const mainContent = page.locator("#main-content");
  await expect(mainContent).toBeFocused();

  const mainFocusIndicator = await mainContent.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      boxShadow: styles.boxShadow,
      outlineColor: styles.outlineColor,
      outlineStyle: styles.outlineStyle,
      outlineWidth: Number.parseFloat(styles.outlineWidth),
    };
  });
  expect(mainFocusIndicator.outlineStyle).toBe("solid");
  expect(mainFocusIndicator.outlineWidth).toBeGreaterThan(0);
  expect(mainFocusIndicator.outlineColor).toBe("rgb(21, 49, 75)");
  expect(mainFocusIndicator.boxShadow).toContain("rgb(255, 191, 71)");

  expect(contrastRatio(navy, "#ffffff")).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(navy, "#f7f5ef")).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(focusAmber, navy)).toBeGreaterThanOrEqual(3);
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

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";

const articlePath = "/articles/how-to-identify-business-tasks-for-automation/";
const categoryPath = "/categories/ai-automation/";
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const categories = [
  { name: "AI & Automation", slug: "ai-automation" },
  { name: "Business Software & SaaS", slug: "business-software" },
  {
    name: "Cybersecurity & Data Protection",
    slug: "cybersecurity-data-protection",
  },
  {
    name: "Digital Operations & Productivity",
    slug: "digital-operations",
  },
  {
    name: "Technology Decisions & Strategy",
    slug: "technology-strategy",
  },
] as const;

interface RgbaColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

function parseCssColor(value: string): RgbaColor | null {
  const hexMatch = value.trim().match(/^#([\da-f]{3,8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = [...hex].map((character) => character.repeat(2)).join("");
    }
    if (hex.length === 6) {
      hex += "ff";
    }
    if (hex.length === 8) {
      return {
        red: Number.parseInt(hex.slice(0, 2), 16),
        green: Number.parseInt(hex.slice(2, 4), 16),
        blue: Number.parseInt(hex.slice(4, 6), 16),
        alpha: Number.parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  if (!/^rgba?\(/i.test(value.trim())) {
    return null;
  }
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) {
    return null;
  }
  return {
    red: channels[0],
    green: channels[1],
    blue: channels[2],
    alpha: channels[3] ?? 1,
  };
}

function compositeColor(
  foreground: RgbaColor,
  background: RgbaColor,
): RgbaColor {
  return {
    red:
      foreground.red * foreground.alpha +
      background.red * (1 - foreground.alpha),
    green:
      foreground.green * foreground.alpha +
      background.green * (1 - foreground.alpha),
    blue:
      foreground.blue * foreground.alpha +
      background.blue * (1 - foreground.alpha),
    alpha: 1,
  };
}

function relativeLuminance(color: RgbaColor): number {
  const [red, green, blue] = [color.red, color.green, color.blue]
    .map((channel) => channel / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    ) as [number, number, number];

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: RgbaColor, second: RgbaColor): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

async function expectVisibleFocusIndicator(locator: Locator): Promise<void> {
  const appearance = await locator.evaluate((element) => {
    const styles = getComputedStyle(element);
    const ancestorBackgrounds: string[] = [];
    let ancestor = element.parentElement;
    while (ancestor) {
      ancestorBackgrounds.push(getComputedStyle(ancestor).backgroundColor);
      ancestor = ancestor.parentElement;
    }
    return {
      ancestorBackgrounds,
      boxShadow: styles.boxShadow,
      outlineColor: styles.outlineColor,
      outlineStyle: styles.outlineStyle,
      outlineWidth: Number.parseFloat(styles.outlineWidth),
    };
  });

  const outlineColor = parseCssColor(appearance.outlineColor);
  const indicatorColors: RgbaColor[] = [];
  if (
    !["none", "hidden"].includes(appearance.outlineStyle) &&
    appearance.outlineWidth > 0 &&
    outlineColor &&
    outlineColor.alpha > 0
  ) {
    indicatorColors.push(outlineColor);
  }
  for (const colorValue of appearance.boxShadow.match(
    /rgba?\([^)]+\)|#[\da-f]{3,8}/gi,
  ) ?? []) {
    const color = parseCssColor(colorValue);
    if (color && color.alpha > 0) {
      indicatorColors.push(color);
    }
  }

  expect(indicatorColors.length).toBeGreaterThan(0);

  const white: RgbaColor = {
    red: 255,
    green: 255,
    blue: 255,
    alpha: 1,
  };
  const nearestBackground = appearance.ancestorBackgrounds
    .map(parseCssColor)
    .find((color): color is RgbaColor => Boolean(color && color.alpha > 0));
  const background = nearestBackground
    ? compositeColor(nearestBackground, white)
    : white;
  const strongestContrast = Math.max(
    ...indicatorColors.map((color) =>
      contrastRatio(compositeColor(color, background), background),
    ),
  );
  expect(strongestContrast).toBeGreaterThanOrEqual(3);
}

function longestDuration(value: string): number {
  return Math.max(
    0,
    ...value.split(",").map((duration) => {
      const normalized = duration.trim();
      const amount = Number.parseFloat(normalized);
      return normalized.endsWith("ms") ? amount / 1000 : amount;
    }),
  );
}

for (const route of ["/", categoryPath, articlePath]) {
  test(`${route} has no serious or critical axe violations`, async ({
    page,
  }) => {
    await page.goto(route);

    const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
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
  await expectVisibleFocusIndicator(skipLink);

  await page.keyboard.press("Enter");
  const mainContent = page.locator("#main-content");
  await expect(mainContent).toBeFocused();
  await expectVisibleFocusIndicator(mainContent);
});

test("390px native menu opens from the keyboard and exposes every topic", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(categoryPath);

  const menu = page.locator("header.site-header details").first();
  const summary = menu.locator("summary");
  await expect(menu).toBeVisible();
  await expect(summary).toBeVisible();
  await expect(menu).not.toHaveAttribute("open", "");

  const summaryBox = await summary.boundingBox();
  expect(summaryBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(summaryBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await summary.focus();
  await expect(summary).toBeFocused();
  await expectVisibleFocusIndicator(summary);
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");

  for (const category of categories) {
    const topicLink = menu.getByRole("link", {
      name: category.name,
      exact: true,
    });
    await expect(topicLink).toBeVisible();
    const topicLinkBox = await topicLink.boundingBox();
    expect(
      topicLinkBox?.height ?? 0,
      `${category.name} mobile touch target`,
    ).toBeGreaterThanOrEqual(44);
  }
  const aboutLink = menu.getByRole("link", { name: "About", exact: true });
  await expect(aboutLink).toBeVisible();
  const aboutLinkBox = await aboutLink.boundingBox();
  expect(
    aboutLinkBox?.height ?? 0,
    "About mobile touch target",
  ).toBeGreaterThanOrEqual(44);
  await expect(
    menu.getByRole("link", { name: "AI & Automation", exact: true }),
  ).toHaveAttribute("aria-current", "page");
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
  await expectVisibleFocusIndicator(sourceLink);
});

test("mobile article TOC and data table stay accessible inside the page boundary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath);

  const tocSummary = page
    .locator("article.article-page summary")
    .filter({ hasText: /^On this page$/ });
  await expect(tocSummary).toBeVisible();
  await expect(tocSummary).toHaveAccessibleName("On this page");
  await expect(
    page.locator("article.article-page table").first(),
  ).toBeVisible();

  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);

  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  const blockingViolations = results.violations
    .filter(({ impact }) => ["serious", "critical"].includes(impact ?? ""))
    .map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }));
  expect(blockingViolations).toEqual([]);

  const scrollableRegionResults = await new AxeBuilder({ page })
    .withRules(["scrollable-region-focusable"])
    .analyze();
  expect(
    scrollableRegionResults.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.length,
    })),
  ).toEqual([]);
});

test("reduced motion removes effective transition and animation durations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(categoryPath);

  const topicLink = page.locator(
    'header.site-header a[href="/categories/ai-automation/"]:visible',
  );
  await expect(topicLink).toBeVisible();
  const durations = await topicLink.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      animation: styles.animationDuration,
      transition: styles.transitionDuration,
    };
  });

  expect(longestDuration(durations.transition)).toBeLessThanOrEqual(0.01);
  expect(longestDuration(durations.animation)).toBeLessThanOrEqual(0.01);
});

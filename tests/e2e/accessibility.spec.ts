import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

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

interface FocusAppearance {
  ancestorBackgrounds: string[];
  backgroundColor: string;
  boxShadow: string;
  outlineColor: string;
  outlineOffset: string;
  outlineStyle: string;
  outlineWidth: number;
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

async function captureFocusAppearance(
  locator: Locator,
): Promise<FocusAppearance> {
  return locator.evaluate((element) => {
    const styles = getComputedStyle(element);
    const ancestorBackgrounds: string[] = [];
    let ancestor = element.parentElement;
    while (ancestor) {
      ancestorBackgrounds.push(getComputedStyle(ancestor).backgroundColor);
      ancestor = ancestor.parentElement;
    }
    return {
      ancestorBackgrounds,
      backgroundColor: styles.backgroundColor,
      boxShadow: styles.boxShadow,
      outlineColor: styles.outlineColor,
      outlineOffset: styles.outlineOffset,
      outlineStyle: styles.outlineStyle,
      outlineWidth: Number.parseFloat(styles.outlineWidth),
    };
  });
}

async function reachByTab(
  page: Page,
  target: Locator,
  maxTabs = 60,
): Promise<void> {
  await expect(target).toBeVisible();
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
  }

  const activeElement = await page.evaluate(() => {
    const active = document.activeElement;
    return active
      ? `${active.tagName.toLowerCase()}#${active.id}.${active.className}`
      : "none";
  });
  throw new Error(
    `Target was not reached within ${maxTabs} Tab presses; active element: ${activeElement}`,
  );
}

async function expectVisibleFocusIndicator(
  locator: Locator,
  unfocused: FocusAppearance,
): Promise<void> {
  const appearance = await captureFocusAppearance(locator);
  const outlineChanged =
    appearance.outlineColor !== unfocused.outlineColor ||
    appearance.outlineOffset !== unfocused.outlineOffset ||
    appearance.outlineStyle !== unfocused.outlineStyle ||
    appearance.outlineWidth !== unfocused.outlineWidth;
  const shadowChanged = appearance.boxShadow !== unfocused.boxShadow;

  expect(outlineChanged || shadowChanged).toBe(true);

  const outlineColor = parseCssColor(appearance.outlineColor);
  const indicatorColors: RgbaColor[] = [];
  if (
    outlineChanged &&
    !["none", "hidden"].includes(appearance.outlineStyle) &&
    appearance.outlineWidth > 0 &&
    outlineColor &&
    outlineColor.alpha > 0
  ) {
    indicatorColors.push(outlineColor);
  }
  if (shadowChanged) {
    for (const colorValue of appearance.boxShadow.match(
      /rgba?\([^)]+\)|#[\da-f]{3,8}/gi,
    ) ?? []) {
      const color = parseCssColor(colorValue);
      if (color && color.alpha > 0) {
        indicatorColors.push(color);
      }
    }
  }

  expect(indicatorColors.length).toBeGreaterThan(0);

  const white: RgbaColor = {
    red: 255,
    green: 255,
    blue: 255,
    alpha: 1,
  };
  const nearestBackgroundColor = appearance.ancestorBackgrounds
    .map(parseCssColor)
    .find((color): color is RgbaColor => Boolean(color && color.alpha > 0));
  const surroundingBackground = nearestBackgroundColor
    ? compositeColor(nearestBackgroundColor, white)
    : white;
  const elementBackground = parseCssColor(appearance.backgroundColor);
  const effectiveElementBackground = elementBackground
    ? compositeColor(elementBackground, surroundingBackground)
    : surroundingBackground;
  const relevantSurfaces = [
    surroundingBackground,
    effectiveElementBackground,
  ].filter(
    (surface, index, surfaces) =>
      surfaces.findIndex(
        (candidate) =>
          candidate.red === surface.red &&
          candidate.green === surface.green &&
          candidate.blue === surface.blue,
      ) === index,
  );

  for (const surface of relevantSurfaces) {
    const strongestContrast = Math.max(
      ...indicatorColors.map((color) =>
        contrastRatio(compositeColor(color, surface), surface),
      ),
    );
    expect(strongestContrast).toBeGreaterThanOrEqual(3);
  }
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

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  const skipLinkUnfocused = await captureFocusAppearance(skipLink);
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await expectVisibleFocusIndicator(skipLink, skipLinkUnfocused);

  const mainContent = page.locator("#main-content");
  const mainContentUnfocused = await captureFocusAppearance(mainContent);
  await page.keyboard.press("Enter");
  await expect(mainContent).toBeFocused();
  await expectVisibleFocusIndicator(mainContent, mainContentUnfocused);
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

  const summaryUnfocused = await captureFocusAppearance(summary);
  await reachByTab(page, summary, 20);
  await expect(summary).toBeFocused();
  await expectVisibleFocusIndicator(summary, summaryUnfocused);
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

  const sourceLinkUnfocused = await captureFocusAppearance(sourceLink);
  await reachByTab(page, sourceLink, 80);
  await expect(sourceLink).toBeFocused();
  await expectVisibleFocusIndicator(sourceLink, sourceLinkUnfocused);
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
  const tocDisclosure = page
    .locator("article.article-page details")
    .filter({ has: tocSummary });
  await expect(tocDisclosure).not.toHaveAttribute("open", "");
  const tocSummaryUnfocused = await captureFocusAppearance(tocSummary);
  await reachByTab(page, tocSummary, 40);
  await expect(tocSummary).toBeFocused();
  await expectVisibleFocusIndicator(tocSummary, tocSummaryUnfocused);
  await page.keyboard.press("Enter");
  await expect(tocDisclosure).toHaveAttribute("open", "");
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

test("reduced motion removes effective motion from rendered elements and pseudos", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const route of ["/", categoryPath, articlePath]) {
    await page.goto(route);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const durations = await page
      .locator("html, body, body *")
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const elementStyles = getComputedStyle(element);
          if (
            elementStyles.display === "none" ||
            elementStyles.visibility === "hidden" ||
            element.getClientRects().length === 0
          ) {
            return [];
          }

          const label = `${element.tagName.toLowerCase()}${
            element.id ? `#${element.id}` : ""
          }`;
          return ([null, "::before", "::after"] as const).flatMap((pseudo) => {
            const styles = getComputedStyle(element, pseudo);
            if (
              pseudo &&
              (styles.content === "none" || styles.content === "normal")
            ) {
              return [];
            }
            return [
              {
                animation: styles.animationDuration,
                element: `${label}${pseudo ?? ""}`,
                transition: styles.transitionDuration,
              },
            ];
          });
        }),
      );
    const movingElements = durations.filter(
      ({ animation, transition }) =>
        longestDuration(animation) > 0.001 ||
        longestDuration(transition) > 0.001,
    );

    expect(movingElements, route).toEqual([]);
  }
});

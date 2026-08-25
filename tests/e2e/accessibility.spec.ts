import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  REPRESENTATIVE_ARTICLE_PATHS,
  REPRESENTATIVE_ARTICLES,
} from "../../scripts/publication-route-inventory.mjs";

const articlePath = REPRESENTATIVE_ARTICLE_PATHS.primary;
const representativeArticle = REPRESENTATIVE_ARTICLES.primary;
const tableArticlePath = REPRESENTATIVE_ARTICLE_PATHS.table;
const toolkitDetailPath = "/toolkit/automation-candidate-screen/";
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
const representativeCategory = representativeArticle
  ? categories.find(({ slug }) => slug === representativeArticle.category)
  : undefined;
const categoryPath = representativeCategory
  ? `/categories/${representativeCategory.slug}/`
  : "/categories/ai-automation/";

function skipWhenNoRepresentativeArticle() {
  test.skip(!articlePath, "No current published representative article.");
}

function skipWhenNoTableArticle() {
  test.skip(
    !tableArticlePath,
    "No current published representative table article.",
  );
}

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
  color: string;
  outlineColor: string;
  outlineOffset: string;
  outlineStyle: string;
  outlineWidth: number;
}

function parseCssColor(value: string): RgbaColor | null {
  const hexMatch = value.trim().match(/^#([\da-f]{3,8})$/i);
  const matchedHex = hexMatch?.[1];
  if (matchedHex) {
    let hex = matchedHex;
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
  const red = channels?.[0];
  const green = channels?.[1];
  const blue = channels?.[2];
  if (red === undefined || green === undefined || blue === undefined) {
    return null;
  }
  return {
    red,
    green,
    blue,
    alpha: channels?.[3] ?? 1,
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
      color: styles.color,
      outlineColor: styles.outlineColor,
      outlineOffset: styles.outlineOffset,
      outlineStyle: styles.outlineStyle,
      outlineWidth: Number.parseFloat(styles.outlineWidth),
    };
  });
}

async function expectFocusedTextContrast(
  page: Page,
  locator: Locator,
  maxTabs: number,
): Promise<void> {
  await reachByTab(page, locator, maxTabs);
  await expect(locator).toBeFocused();
  await page.waitForTimeout(220);

  const appearance = await captureFocusAppearance(locator);
  const foreground = parseCssColor(appearance.color);
  expect(foreground).not.toBeNull();

  const white: RgbaColor = {
    red: 255,
    green: 255,
    blue: 255,
    alpha: 1,
  };
  const nearestBackground = appearance.ancestorBackgrounds
    .map(parseCssColor)
    .find((color): color is RgbaColor => Boolean(color && color.alpha > 0));
  const surrounding = nearestBackground
    ? compositeColor(nearestBackground, white)
    : white;
  const elementBackground = parseCssColor(appearance.backgroundColor);
  const effectiveBackground = elementBackground
    ? compositeColor(elementBackground, surrounding)
    : surrounding;
  const ratio = foreground
    ? contrastRatio(
        compositeColor(foreground, effectiveBackground),
        effectiveBackground,
      )
    : 0;

  expect(ratio).toBeGreaterThanOrEqual(4.5);
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

for (const route of [
  "/",
  "/articles/",
  categoryPath,
  ...(articlePath ? [articlePath] : []),
  "/toolkit/",
  toolkitDetailPath,
]) {
  test(`${route} has no moderate, serious, or critical axe violations`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);

    const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    const blockingViolations = results.violations.filter(({ impact }) =>
      ["moderate", "serious", "critical"].includes(impact ?? ""),
    );

    expect(blockingViolations).toEqual([]);
  });
}

test("story visuals are named while category fallback art remains decorative", async ({
  page,
}) => {
  skipWhenNoRepresentativeArticle();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath!);

  const storyVisual = page.getByRole("img", {
    name: representativeArticle!.visual.alt,
  });
  await expect(storyVisual).toBeVisible();
  await expect(storyVisual).not.toHaveAttribute("aria-hidden", "true");

  await page.goto(categoryPath);
  const fallbackVisual = page.locator(".category-hero__visual svg");
  await expect(fallbackVisual).toBeVisible();
  await expect(fallbackVisual).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator('.category-hero__visual [role="img"]')).toHaveCount(
    0,
  );
});

test("desktop navigation landmarks have unique accessible names", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/toolkit/");

  const results = await new AxeBuilder({ page })
    .withRules(["landmark-unique"])
    .analyze();

  expect(results.violations).toEqual([]);
});

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
  const guidesLink = menu.getByRole("link", {
    name: "Guides",
    exact: true,
  });
  await expect(guidesLink).toBeVisible();
  await expect(guidesLink).toHaveAttribute("href", "/articles/");
  const guidesLinkBox = await guidesLink.boundingBox();
  expect(
    guidesLinkBox?.height ?? 0,
    "Guides mobile touch target",
  ).toBeGreaterThanOrEqual(44);
  const toolkitLink = menu.getByRole("link", {
    name: "Toolkit",
    exact: true,
  });
  await expect(toolkitLink).toBeVisible();
  const toolkitLinkBox = await toolkitLink.boundingBox();
  expect(
    toolkitLinkBox?.height ?? 0,
    "Toolkit mobile touch target",
  ).toBeGreaterThanOrEqual(44);
  await expect(
    menu.getByRole("link", {
      name: representativeCategory?.name ?? "AI & Automation",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
});

test("mobile article navigation exposes one unambiguous current location", async ({
  page,
}) => {
  skipWhenNoRepresentativeArticle();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath!);

  const mobileList = page.locator(
    'header.site-header nav[aria-label="Mobile navigation"] ul',
  );
  await expect(mobileList.locator("[aria-current]")).toHaveCount(1);
  await expect(
    mobileList.locator(
      `a[href="/categories/${representativeArticle!.category}/"]`,
    ),
  ).toHaveAttribute("aria-current", "location");
  await expect(mobileList.locator('a[href="/articles/"]')).not.toHaveAttribute(
    "aria-current",
  );
});

test("article body links are visibly underlined and keyboard focus is visible", async ({
  page,
}) => {
  skipWhenNoRepresentativeArticle();
  await page.goto(articlePath!);

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

test("article-card headlines keep a visible destination affordance without hover", async ({
  page,
}) => {
  await page.goto("/");

  const headlineLink = page.locator(".article-card__title a").first();
  await expect(headlineLink).toBeVisible();
  const decoration = await headlineLink.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      color: styles.color,
      decorationColor: styles.textDecorationColor,
      decorationLine: styles.textDecorationLine,
    };
  });
  expect(decoration.decorationLine).toContain("underline");
  expect(decoration.decorationColor).toBe(decoration.color);
});

test("homepage editorial visual captions meet WCAG AA contrast on dark cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");

  const captions = page.locator(".home-opening .editorial-visual__caption");
  expect(await captions.count()).toBeGreaterThan(0);

  for (const caption of await captions.all()) {
    const appearance = await captureFocusAppearance(caption);
    const foreground = parseCssColor(appearance.color);
    const background = appearance.ancestorBackgrounds
      .map(parseCssColor)
      .find((color): color is RgbaColor => Boolean(color && color.alpha > 0));

    expect(foreground).not.toBeNull();
    expect(background).not.toBeUndefined();
    expect(contrastRatio(foreground!, background!)).toBeGreaterThanOrEqual(4.5);
  }
});

test("homepage briefing numbers meet WCAG AA contrast", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");

  const items = page.locator(".latest-briefing__list > li");
  expect(await items.count()).toBeGreaterThan(0);

  for (const item of await items.all()) {
    const foreground = parseCssColor(
      await item.evaluate(
        (element) => getComputedStyle(element, "::before").color,
      ),
    );
    const appearance = await captureFocusAppearance(item);
    const background = appearance.ancestorBackgrounds
      .map(parseCssColor)
      .find((color): color is RgbaColor => Boolean(color && color.alpha > 0));

    expect(foreground).not.toBeNull();
    expect(background).not.toBeUndefined();
    expect(contrastRatio(foreground!, background!)).toBeGreaterThanOrEqual(4.5);
  }
});

test("focused editorial links retain WCAG AA text contrast", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const storyMetaLink = page.locator(".story-meta a").first();
  const sectionLink = page.locator(".section-heading__link").first();
  await expect(storyMetaLink).toBeVisible();
  await expect(sectionLink).toBeVisible();

  await expectFocusedTextContrast(page, storyMetaLink, 30);
  await expectFocusedTextContrast(page, sectionLink, 120);
});

test("footer navigation hover and keyboard focus use the dark-surface focus color with WCAG AA contrast", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const footer = page.locator("footer.site-footer");
  const footerLink = footer.locator(".site-footer__groups a").first();
  const focusDark = parseCssColor(
    await page
      .locator(":root")
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--brand-focus-dark").trim(),
      ),
  );
  const footerBackground = parseCssColor(
    await footer.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  );
  expect(focusDark).not.toBeNull();
  expect(footerBackground).not.toBeNull();

  await footer.scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(220);
  await footerLink.hover();
  await page.waitForTimeout(220);
  expect(
    await footerLink.evaluate((element) => element.matches(":hover")),
  ).toBe(true);
  const hoverForeground = parseCssColor(
    await footerLink.evaluate((element) => getComputedStyle(element).color),
  );
  expect(hoverForeground).toEqual(focusDark);
  expect(
    contrastRatio(hoverForeground!, footerBackground!),
  ).toBeGreaterThanOrEqual(4.5);

  await page.mouse.move(0, 0);
  await reachByTab(page, footerLink, 160);
  await page.waitForTimeout(220);
  const focused = await captureFocusAppearance(footerLink);
  const focusedForeground = parseCssColor(focused.color);
  const focusedBackground = parseCssColor(focused.backgroundColor);
  const focusedOutline = parseCssColor(focused.outlineColor);
  expect(focusedBackground).toEqual(focusDark);
  expect(focusedOutline).toEqual(focusDark);
  expect(focusedForeground).not.toBeNull();
  expect(
    contrastRatio(focusedForeground!, focusedBackground!),
  ).toBeGreaterThanOrEqual(4.5);
});

test("mobile article exposes one keyboard-accessible TOC and data table inside the page boundary", async ({
  page,
}) => {
  skipWhenNoTableArticle();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(tableArticlePath!);

  const tableOfContents = page.getByRole("navigation", {
    name: "On this page",
  });
  await expect(tableOfContents).toHaveCount(1);
  await expect(tableOfContents).toBeVisible();
  const firstTocLink = tableOfContents.locator('a[href^="#"]').first();
  const firstTocLinkUnfocused = await captureFocusAppearance(firstTocLink);
  await reachByTab(page, firstTocLink, 40);
  await expect(firstTocLink).toBeFocused();
  await expectVisibleFocusIndicator(firstTocLink, firstTocLinkUnfocused);
  const tableRegion = page.getByRole("region", {
    name: "Scrollable data table",
  });
  await expect(tableRegion).toHaveCount(1);
  await expect(tableRegion).toHaveAttribute("tabindex", "0");
  await expect(tableRegion.locator("table")).toBeVisible();

  const tableRegionUnfocused = await captureFocusAppearance(tableRegion);
  await reachByTab(page, tableRegion, 80);
  await expect(tableRegion).toBeFocused();
  await expectVisibleFocusIndicator(tableRegion, tableRegionUnfocused);

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

test("mobile article exposes one semantic fit summary without a hidden duplicate", async ({
  page,
}) => {
  skipWhenNoRepresentativeArticle();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(articlePath!);

  const fitSummary = page.locator("section.fit-summary");
  await expect(fitSummary).toHaveCount(1);
  await expect(fitSummary).toBeVisible();
  await expect(
    fitSummary.getByRole("heading", { level: 2, name: "At a glance" }),
  ).toBeVisible();
  await expect(
    fitSummary.getByText("Business problem", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".fit-summary--desktop, .fit-summary--mobile"),
  ).toHaveCount(0);

  const accessibilityResults = await new AxeBuilder({ page })
    .withTags(wcagTags)
    .analyze();
  expect(
    accessibilityResults.violations.filter(({ impact }) =>
      ["serious", "critical"].includes(impact ?? ""),
    ),
  ).toEqual([]);
});

test("reduced motion removes effective motion from rendered elements and pseudos", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const route of [
    "/",
    categoryPath,
    ...(articlePath ? [articlePath] : []),
  ]) {
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

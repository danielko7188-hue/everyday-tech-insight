import { expect, test, type Page } from "@playwright/test";

import { readArticleRecords } from "../../scripts/qa-content.mjs";
import {
  REPRESENTATIVE_ARTICLE_PATHS,
  REPRESENTATIVE_ARTICLES,
} from "../../scripts/publication-route-inventory.mjs";
import { categories } from "../../src/data/categories";

const representativeArticlePath = REPRESENTATIVE_ARTICLE_PATHS.primary;
const representativeArticle = REPRESENTATIVE_ARTICLES.primary;
const tableArticlePath = REPRESENTATIVE_ARTICLE_PATHS.table;
const representativeCategory = representativeArticle
  ? categories.find(({ slug }) => slug === representativeArticle.category)
  : undefined;

function skipWhenNoRepresentativeArticle() {
  test.skip(
    !representativeArticlePath,
    "No current published representative article.",
  );
}

function skipWhenNoTableArticle() {
  test.skip(
    !tableArticlePath,
    "No current published representative table article.",
  );
}

const representativeRoutes = [
  {
    name: "home",
    path: "/",
    keySelectors: [
      "header.site-header",
      "main",
      ".home-page",
      "footer.site-footer",
    ],
  },
  {
    name: "guide archive",
    path: "/articles/",
    keySelectors: [
      "header.site-header",
      "main",
      ".guide-archive",
      "footer.site-footer",
    ],
  },
  {
    name: "category",
    path: "/categories/ai-automation/",
    keySelectors: [
      "header.site-header",
      "main",
      ".category-hero",
      "footer.site-footer",
    ],
  },
  ...(representativeArticlePath
    ? [
        {
          name: "article",
          path: representativeArticlePath,
          keySelectors: [
            "header.site-header",
            "main",
            ".article-page",
            ".article-hero",
            ".article-body",
            "footer.site-footer",
          ],
        },
      ]
    : []),
  {
    name: "toolkit landing",
    path: "/toolkit/",
    keySelectors: [
      "header.site-header",
      "main",
      ".toolkit-page",
      ".toolkit-grid",
      "footer.site-footer",
    ],
  },
  {
    name: "toolkit detail",
    path: "/toolkit/automation-candidate-screen/",
    keySelectors: [
      "header.site-header",
      "main",
      ".toolkit-detail",
      ".toolkit-field-guide",
      "footer.site-footer",
    ],
  },
] as const;
const requiredWidths = [320, 360, 390, 768, 1024, 1280, 1440, 1920] as const;
const categorySlugs = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
] as const;
const representativeLeafSelector = [
  "a",
  "button",
  "summary",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "[data-editorial-visual]",
  ".article-card",
].join(", ");

async function expectWithinViewport(
  page: Page,
  selector: string,
  viewportWidth: number,
  label: string,
): Promise<void> {
  const boxes = await page.locator(selector).evaluateAll((elements) =>
    elements
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
  );
  expect(boxes.length, `${label} is rendered`).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.left, `${label} left boundary`).toBeGreaterThanOrEqual(-1);
    expect(box.right, `${label} right boundary`).toBeLessThanOrEqual(
      viewportWidth + 1,
    );
  }
}

async function expectVisibleLeavesWithinViewport(
  page: Page,
  viewportWidth: number,
  label: string,
): Promise<void> {
  const roundingTolerance = 2;
  const clippedLeaves = await page
    .locator(representativeLeafSelector)
    .evaluateAll(
      (elements, bounds) =>
        elements.flatMap((element, index) => {
          const styles = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          const isVisible =
            element.getClientRects().length > 0 &&
            box.width > 0 &&
            box.height > 0 &&
            styles.display !== "none" &&
            styles.visibility !== "hidden" &&
            styles.visibility !== "collapse" &&
            Number.parseFloat(styles.opacity) > 0;
          const isInsideIntentionalScroller = Boolean(
            element.closest(
              "article.article-page table, [data-horizontal-scroll]",
            ),
          );

          if (!isVisible || isInsideIntentionalScroller) {
            return [];
          }

          if (
            box.left >= -bounds.tolerance &&
            box.right <= bounds.viewportWidth + bounds.tolerance
          ) {
            return [];
          }

          const id = element.id ? `#${element.id}` : "";
          const classes = Array.from(element.classList)
            .slice(0, 3)
            .map((className) => `.${className}`)
            .join("");
          return [
            {
              element: `${element.tagName.toLowerCase()}${id}${classes} (${index})`,
              left: box.left,
              right: box.right,
            },
          ];
        }),
      { tolerance: roundingTolerance, viewportWidth },
    );

  expect(clippedLeaves, `${label} clipped visible editorial elements`).toEqual(
    [],
  );
}

for (const route of representativeRoutes) {
  for (const width of requiredWidths) {
    test(`${route.name} at ${width}px stays inside the viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const overflow = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(
        overflow.document,
        `${route.path} at ${width}px document overflow`,
      ).toBeLessThanOrEqual(overflow.viewport);
      expect(
        overflow.body,
        `${route.path} at ${width}px body overflow`,
      ).toBeLessThanOrEqual(overflow.viewport);

      for (const selector of route.keySelectors) {
        await expectWithinViewport(
          page,
          selector,
          overflow.viewport,
          `${route.path} at ${width}px ${selector}`,
        );
      }
      await expectVisibleLeavesWithinViewport(
        page,
        overflow.viewport,
        `${route.path} at ${width}px`,
      );
    });
  }
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`homepage lead headline is visible at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const box = await page
      .locator(".front-page__lead .article-card__title")
      .boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.locator("main").evaluate((main) => main.scrollHeight),
    ).toBeLessThan(viewport.width === 390 ? 11_000 : 7_000);
  });
}

test("desktop homepage keeps the complete publication promise above the fold", async ({
  page,
}) => {
  const viewport = { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const heading = await page.locator(".home-opening__promise h1").boundingBox();
  const summary = await page
    .locator(".home-opening__promise .lead-summary")
    .boundingBox();
  expect(heading).not.toBeNull();
  expect(summary).not.toBeNull();
  expect(heading!.y + heading!.height).toBeLessThanOrEqual(viewport.height);
  expect(summary!.y + summary!.height).toBeLessThanOrEqual(viewport.height);
  expect(summary!.y).toBeGreaterThan(heading!.y + heading!.height);
});

test("dense article contents stay compact below the desktop reading layout", async ({
  page,
}) => {
  const denseArticle = (await readArticleRecords())
    .filter(({ data }) => data.status === "published")
    .map(({ body, data }) => ({
      depthThreeHeadingCount:
        String(body ?? "").match(/^###\s+/gm)?.length ?? 0,
      path: `/articles/${data.slug}/`,
    }))
    .sort(
      (left, right) =>
        right.depthThreeHeadingCount - left.depthThreeHeadingCount ||
        left.path.localeCompare(right.path, "en"),
    )[0];
  test.skip(
    !denseArticle || denseArticle.depthThreeHeadingCount === 0,
    "No current published article has depth-three contents to compact.",
  );

  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(denseArticle!.path);

    const contents = page.locator(".table-of-contents");
    const sublists = contents.locator(".table-of-contents__sublist");
    await expect(sublists).not.toHaveCount(0);
    expect(
      await sublists.evaluateAll((items) =>
        items.every((item) => getComputedStyle(item).display === "none"),
      ),
    ).toBe(true);

    const geometry = await contents.evaluate((element) => {
      const list = element.querySelector(":scope > ol")!;
      return {
        height: element.getBoundingClientRect().height,
        columns: getComputedStyle(list).gridTemplateColumns.split(/\s+/).length,
      };
    });
    expect(geometry.columns).toBe(2);
    expect(geometry.height).toBeLessThanOrEqual(340);
  }
});

test("desktop toolkit introduces its first worksheet before the initial fold", async ({
  page,
}) => {
  const viewport = { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.goto("/toolkit/");

  const firstTitle = await page
    .locator(".toolkit-card h2")
    .first()
    .boundingBox();
  expect(firstTitle).not.toBeNull();
  expect(firstTitle!.y + firstTitle!.height).toBeLessThanOrEqual(
    viewport.height,
  );

  const grid = await page.locator(".toolkit-grid").boundingBox();
  const safety = await page.locator(".toolkit-safety-note").boundingBox();
  expect(grid).not.toBeNull();
  expect(safety).not.toBeNull();
  expect(safety!.y).toBeGreaterThan(grid!.y + grid!.height);
});

test("390px Toolkit details use visible stacked field cards without a horizontal primary guide", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const slug of [
    "automation-candidate-screen",
    "saas-evaluation-evidence-sheet",
    "technology-risk-register",
    "backup-restore-test-log",
  ]) {
    await page.goto(`/toolkit/${slug}/`);
    const cards = page.locator(".toolkit-field-card");
    await expect(cards, slug).toHaveCount(8);
    await expect(cards.first(), slug).toBeVisible();
    await expect(page.locator(".toolkit-field-guide table"), slug).toHaveCount(
      0,
    );
    await expect(page.locator("[data-horizontal-scroll]"), slug).toHaveCount(0);

    const listBox = await page
      .locator(".toolkit-field-guide__list")
      .boundingBox();
    const firstCardBox = await cards.first().boundingBox();
    expect(listBox, `${slug} field list`).not.toBeNull();
    expect(firstCardBox, `${slug} first field card`).not.toBeNull();
    expect(Math.abs(firstCardBox!.x - listBox!.x), slug).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        firstCardBox!.x + firstCardBox!.width - (listBox!.x + listBox!.width),
      ),
      slug,
    ).toBeLessThanOrEqual(1);

    const boundaries = await cards.evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
    );
    for (const boundary of boundaries) {
      expect(boundary.left, slug).toBeGreaterThanOrEqual(-1);
      expect(boundary.right, slug).toBeLessThanOrEqual(391);
    }
  }
});

test("wide homepage lead keeps automation on one rendered line", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const wordRectCount = await page
    .locator(".front-page__lead .article-card__title a")
    .evaluate((link) => {
      const targetWord = "automation";
      const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let combinedText = "";

      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        textNodes.push(textNode);
        combinedText += textNode.data;
      }

      const targetStart = combinedText.toLowerCase().lastIndexOf(targetWord);
      if (targetStart < 0) return 0;

      const range = document.createRange();
      let cursor = 0;
      let startSet = false;

      for (const textNode of textNodes) {
        const nodeEnd = cursor + textNode.length;
        if (!startSet && targetStart < nodeEnd) {
          range.setStart(textNode, targetStart - cursor);
          startSet = true;
        }

        const targetEnd = targetStart + targetWord.length;
        if (startSet && targetEnd <= nodeEnd) {
          range.setEnd(textNode, targetEnd - cursor);
          break;
        }
        cursor = nodeEnd;
      }

      return range.getClientRects().length;
    });

  expect(wordRectCount).toBe(1);
});

test("tablet article evidence keeps each supported label on one line", async ({
  page,
}) => {
  skipWhenNoRepresentativeArticle();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(representativeArticlePath!);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const evidenceItems = page.locator(".article-evidence li");
  await expect(evidenceItems).toHaveCount(3);
  const renderedLines = await evidenceItems.evaluateAll((items) =>
    items.map((item) => {
      const range = document.createRange();
      range.selectNodeContents(item);
      return new Set(
        Array.from(range.getClientRects(), (rect) => Math.round(rect.top)),
      ).size;
    }),
  );

  expect(renderedLines).toEqual([1, 1, 1]);
});

test("publication mark keeps the full name visible on one line at every required width", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const name = page.locator(".site-header__mark .publication-mark__name");
    await expect(name, `${width}px publication name`).toBeVisible();
    const renderedLines = await name.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set(
        Array.from(range.getClientRects(), (rect) => Math.round(rect.top)),
      ).size;
    });
    expect(renderedLines, `${width}px publication name lines`).toBe(1);
  }
});

test("At a glance uses one mobile column, two tablet columns, and four wide columns", async ({
  page,
}) => {
  skipWhenNoRepresentativeArticle();
  for (const { width, columns } of [
    { width: 390, columns: 1 },
    { width: 767, columns: 1 },
    { width: 768, columns: 2 },
    { width: 1440, columns: 4 },
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(representativeArticlePath!);

    const renderedColumns = await page
      .locator(".fit-summary dl")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(/\s+/).length,
      );
    expect(renderedColumns, `${width}px At a glance columns`).toBe(columns);
  }
});

test("homepage briefing cards keep metadata above their headline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const cards = page.locator(".latest-briefing__list .article-card--list");
  await expect(cards).toHaveCount(3);
  const geometry = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const metadata = element.querySelector(".story-meta")!;
      const title = element.querySelector(".article-card__title")!;
      const summary = element.querySelector(".article-card__promise")!;
      const cardBox = element.getBoundingClientRect();
      const metadataBox = metadata.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      const summaryBox = summary.getBoundingClientRect();
      return {
        cardWidth: cardBox.width,
        metadataWidth: metadataBox.width,
        metadataBottom: metadataBox.bottom,
        titleTop: titleBox.top,
        titleWidth: titleBox.width,
        titleBottom: titleBox.bottom,
        summaryTop: summaryBox.top,
      };
    }),
  );

  for (const card of geometry) {
    expect(card.metadataWidth).toBeGreaterThan(card.cardWidth * 0.75);
    expect(card.titleWidth).toBeGreaterThan(card.cardWidth * 0.75);
    expect(card.titleTop).toBeGreaterThanOrEqual(card.metadataBottom - 1);
    expect(card.summaryTop).toBeGreaterThanOrEqual(card.titleBottom - 1);
  }
});

test("compact story metadata stays inside its card at tablet width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const overflow = await page
    .locator(".article-card--compact .story-meta")
    .evaluateAll((metadataLists) =>
      metadataLists.flatMap((metadataList, listIndex) => {
        const card = metadataList.closest(".article-card");
        if (!card) {
          return [
            { listIndex, itemIndex: -1, overflow: Number.POSITIVE_INFINITY },
          ];
        }

        const cardBox = card.getBoundingClientRect();
        return Array.from(metadataList.children).flatMap((item, itemIndex) => {
          const itemBox = item.getBoundingClientRect();
          const excess = Math.max(
            cardBox.left - itemBox.left,
            itemBox.right - cardBox.right,
            0,
          );
          return excess > 1 ? [{ listIndex, itemIndex, overflow: excess }] : [];
        });
      }),
    );

  expect(overflow).toEqual([]);
});

for (const categorySlug of categorySlugs) {
  test(`${categorySlug} compact directory balances every published guide without a forced lead`, async ({
    page,
  }) => {
    const publishedGuideCount = (await readArticleRecords()).filter(
      ({ data }) =>
        data.status === "published" && data.category === categorySlug,
    ).length;

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/categories/${categorySlug}/`);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      await expect(page.locator(".category-hero__lead")).toHaveCount(0);
      const cards = page.locator(".category-compact .article-card--compact");
      await expect(cards).toHaveCount(publishedGuideCount);
      const boxes = await cards.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, width: box.width };
        }),
      );
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(-1);
        expect(box.right).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.width).toBeGreaterThan(0);
      }
    }
  });
}

test("mobile article keeps its informative visual and one compact fit summary before the reading body", async ({
  page,
}) => {
  skipWhenNoRepresentativeArticle();
  await page.route("**/*.woff2", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeArticlePath!);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const visual = page.locator(".article-hero__visual");
  await expect(visual).toBeVisible();
  await expect(
    visual.locator(
      `figure[data-visual-key="${representativeArticle!.visual.key}"] svg[role="img"]`,
    ),
  ).toBeVisible();
  const fit = page.locator("section.fit-summary");
  await expect(fit).toBeVisible();
  await expect(page.locator(".fit-summary")).toHaveCount(1);
  await expect(
    page.locator(".fit-summary--desktop, .fit-summary--mobile"),
  ).toHaveCount(0);

  const tocColumns = await page
    .locator(".table-of-contents > ol")
    .evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(/\s+/).length,
    );
  expect(tocColumns).toBe(2);

  const firstParagraph = await page
    .locator(".article-body > p")
    .first()
    .boundingBox();
  expect(firstParagraph).not.toBeNull();
  expect(firstParagraph!.y).toBeLessThanOrEqual(844 * 2.5);
});

test("mobile article breadcrumb hides only its current page and orphaned separator", async ({
  page,
}) => {
  skipWhenNoRepresentativeArticle();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeArticlePath!);

  const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumbs.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(
    breadcrumbs.getByRole("link", { name: representativeCategory!.name }),
  ).toBeVisible();
  await expect(breadcrumbs.locator('[aria-current="page"]')).toBeHidden();
  expect(
    await breadcrumbs
      .locator("li:nth-last-child(2)")
      .evaluate((item) => getComputedStyle(item, "::after").display),
  ).toBe("none");
});

test("wide article headline wrapping is stable", async ({ page }) => {
  skipWhenNoRepresentativeArticle();
  const countHeadlineLines = async (width: number): Promise<number> => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto(representativeArticlePath!);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    return page.locator(".article-hero h1").evaluate((heading) => {
      const range = document.createRange();
      range.selectNodeContents(heading);
      const lineTops = Array.from(range.getClientRects(), (rect) =>
        Math.round(rect.top),
      );
      return new Set(lineTops).size;
    });
  };

  const linesAt1440 = await countHeadlineLines(1440);
  const linesAt1920 = await countHeadlineLines(1920);

  expect(linesAt1440).toBeGreaterThan(0);
  expect(linesAt1920).toBeLessThanOrEqual(linesAt1440);
});

test("shared chrome uses the balanced 900px header breakpoint", async ({
  page,
}) => {
  for (const width of [768, 899]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.locator(".site-header__mobile-menu"),
      `${width}px menu`,
    ).toBeVisible();
    await expect(
      page.locator(".site-header__utility"),
      `${width}px utility`,
    ).toBeHidden();
    await expect(
      page.locator(".site-header__topics"),
      `${width}px topics`,
    ).toBeHidden();
  }

  for (const width of [900, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.locator(".site-header__mobile-menu"),
      `${width}px menu`,
    ).toBeHidden();
    await expect(
      page.locator(".site-header__utility"),
      `${width}px utility`,
    ).toBeVisible();
    await expect(
      page.locator(".site-header__topics"),
      `${width}px topics`,
    ).toBeVisible();
  }
});

test("open mobile menu keeps its control anchored while expanding an opaque panel below", async ({
  page,
}) => {
  for (const width of [390, 768, 899]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/categories/ai-automation/");

    const identityRow = page.locator(".site-header__identity-row");
    const menu = page.locator(".site-header__mobile-menu");
    const summary = menu.locator("summary");
    const closedRow = await identityRow.boundingBox();
    const closedSummary = await summary.boundingBox();
    expect(closedRow).not.toBeNull();
    expect(closedSummary).not.toBeNull();

    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("open", "");
    await expect(summary).toContainText("Close");

    const geometry = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(
        ".site-header__identity-row",
      )!;
      const details = document.querySelector<HTMLElement>(
        ".site-header__mobile-menu",
      )!;
      const summaryElement = details.querySelector<HTMLElement>("summary")!;
      const navElement = details.querySelector<HTMLElement>("nav")!;
      const markElement = row.querySelector<HTMLElement>(".site-header__mark")!;
      const rowBox = row.getBoundingClientRect();
      const summaryBox = summaryElement.getBoundingClientRect();
      const navBox = navElement.getBoundingClientRect();
      const markBox = markElement.getBoundingClientRect();
      const navStyles = getComputedStyle(navElement);
      const markHitTarget = document.elementFromPoint(
        markBox.left + markBox.width / 2,
        markBox.top + markBox.height / 2,
      );
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        rowHeight: rowBox.height,
        rowLeft: rowBox.left,
        rowRight: rowBox.right,
        rowBottom: rowBox.bottom,
        summaryTop: summaryBox.top,
        summaryRight: summaryBox.right,
        summaryBottom: summaryBox.bottom,
        navLeft: navBox.left,
        navRight: navBox.right,
        navTop: navBox.top,
        navBottom: navBox.bottom,
        navPosition: navStyles.position,
        navBackground: navStyles.backgroundColor,
        markRemainsInteractive: Boolean(
          markHitTarget?.closest(".site-header__mark"),
        ),
      };
    });

    const closedBandBottom = closedRow!.y + closedRow!.height;
    expect(geometry.rowHeight).toBeGreaterThan(closedRow!.height + 100);
    expect(geometry.summaryTop).toBeCloseTo(closedSummary!.y, 0);
    expect(geometry.summaryBottom).toBeCloseTo(
      closedSummary!.y + closedSummary!.height,
      0,
    );
    expect(geometry.summaryRight).toBeCloseTo(geometry.rowRight, 0);
    expect(geometry.navLeft).toBeCloseTo(geometry.rowLeft, 0);
    expect(geometry.navRight).toBeCloseTo(geometry.rowRight, 0);
    expect(geometry.navTop).toBeGreaterThanOrEqual(closedBandBottom - 1);
    expect(geometry.navBottom).toBeLessThanOrEqual(geometry.rowBottom + 1);
    expect(geometry.navPosition).toBe("static");
    expect(geometry.navBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(geometry.markRemainsInteractive).toBe(true);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  }
});

test("mobile footer keeps four navigation groups in two equal columns", async ({
  page,
}) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");

    const footerGrid = await page
      .locator(".site-footer__groups")
      .evaluate((groups) => {
        const styles = getComputedStyle(groups);
        const items = Array.from(groups.children, (child) => {
          const box = child.getBoundingClientRect();
          return { left: Math.round(box.left), width: box.width };
        });
        return { columns: styles.gridTemplateColumns.split(" "), items };
      });

    expect(footerGrid.columns, `${width}px computed columns`).toHaveLength(2);
    expect(new Set(footerGrid.items.map(({ left }) => left)).size).toBe(2);
    expect(footerGrid.items).toHaveLength(4);
    const firstColumnWidth = footerGrid.columns[0];
    expect(firstColumnWidth).toBeDefined();
    if (!firstColumnWidth)
      throw new Error("Footer has no computed first column");
    for (const item of footerGrid.items) {
      expect(item.width).toBeGreaterThan(0);
      expect(item.width).toBeCloseTo(Number.parseFloat(firstColumnWidth), 0);
    }
  }
});

test("trust pages center breadcrumbs and content in one readable frame", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/about/");

    const frame = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".page-shell")!;
      const breadcrumbs = shell.querySelector<HTMLElement>(".breadcrumbs")!;
      const content = shell.querySelector<HTMLElement>(".trust-content")!;
      const shellBox = shell.getBoundingClientRect();
      const breadcrumbBox = breadcrumbs.getBoundingClientRect();
      const contentBox = content.getBoundingClientRect();
      return { shellBox, breadcrumbBox, contentBox };
    });

    expect(frame.contentBox.width).toBeLessThanOrEqual(760);
    expect(frame.breadcrumbBox.width).toBeCloseTo(frame.contentBox.width, 0);
    expect(frame.breadcrumbBox.left).toBeCloseTo(frame.contentBox.left, 0);
    expect(frame.contentBox.left - frame.shellBox.left).toBeCloseTo(
      frame.shellBox.right - frame.contentBox.right,
      0,
    );
  }
});

test("mobile tables use a readable contained horizontal region", async ({
  page,
}) => {
  skipWhenNoTableArticle();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(tableArticlePath!);

  const region = page.getByRole("region", { name: "Scrollable data table" });
  await expect(region).toHaveCount(1);
  await expect(region).toHaveAttribute("tabindex", "0");
  const geometry = await region.evaluate((element) => {
    const table = element.querySelector("table")!;
    const regionBox = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    const tableStyles = getComputedStyle(table);
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      regionLeft: regionBox.left,
      regionRight: regionBox.right,
      overflowX: styles.overflowX,
      fontSize: Number.parseFloat(tableStyles.fontSize),
      tableLayout: tableStyles.tableLayout,
      tableWidth: table.scrollWidth,
      regionWidth: element.clientWidth,
    };
  });

  expect(geometry.overflowX).toBe("auto");
  expect(geometry.fontSize).toBeGreaterThanOrEqual(16);
  expect(geometry.tableLayout).toBe("auto");
  expect(geometry.tableWidth).toBeGreaterThan(geometry.regionWidth);
  expect(geometry.regionLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.regionRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
});

test("200 percent zoom equivalent reflows header, article navigation, table, and footer", async ({
  page,
}) => {
  skipWhenNoTableArticle();
  // A 640 CSS-pixel viewport is the reflow equivalent of a 1280px desktop
  // viewport viewed at 200% browser zoom.
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto(tableArticlePath!);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const menu = page.locator("header.site-header details").first();
  await expect(menu).toBeVisible();
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await expect(
    menu.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();

  const toc = page.getByRole("navigation", { name: "On this page" });
  const tableRegion = page.getByRole("region", {
    name: "Scrollable data table",
  });
  const footer = page.locator("footer.site-footer");
  await expect(toc).toBeVisible();
  await expect(tableRegion).toBeVisible();
  await expect(footer).toBeVisible();

  for (const [label, locator] of [
    ["header", page.locator("header.site-header")],
    ["mobile menu", menu],
    ["table region", tableRegion],
    ["footer", footer],
  ] as const) {
    const box = await locator.boundingBox();
    expect(box, `${label} box`).not.toBeNull();
    expect(box!.x, `${label} left edge`).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, `${label} right edge`).toBeLessThanOrEqual(641);
  }

  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

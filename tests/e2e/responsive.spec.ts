import { expect, test, type Page } from "@playwright/test";

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
    name: "category",
    path: "/categories/ai-automation/",
    keySelectors: [
      "header.site-header",
      "main",
      ".category-hero",
      "footer.site-footer",
    ],
  },
  {
    name: "article",
    path: "/articles/how-to-identify-business-tasks-for-automation/",
    keySelectors: [
      "header.site-header",
      "main",
      ".article-page",
      ".article-hero",
      ".article-body",
      "footer.site-footer",
    ],
  },
] as const;
const requiredWidths = [360, 390, 768, 1024, 1280, 1440, 1920] as const;
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

      if (route.name === "article") {
        const table = page.locator("article.article-page table").first();
        await expect(table).toBeVisible();
        const tableBoundary = await table.evaluate((element) => {
          let candidate: Element | null = element;
          while (candidate && candidate !== document.body) {
            const overflowX = getComputedStyle(candidate).overflowX;
            if (overflowX === "auto" || overflowX === "scroll") {
              const box = candidate.getBoundingClientRect();
              return { left: box.left, right: box.right };
            }
            candidate = candidate.parentElement;
          }
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right };
        });
        expect(tableBoundary.left).toBeGreaterThanOrEqual(-1);
        expect(tableBoundary.right).toBeLessThanOrEqual(overflow.viewport + 1);
      }
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

test("homepage issue label stays semantic without entering the layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const box = await page.locator("#front-page-heading").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(1);
  expect(box!.height).toBeLessThanOrEqual(1);
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
      const summary = element.querySelector(".article-card__summary")!;
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
  test(`${categorySlug} lead begins in the opening mobile viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/categories/${categorySlug}/`);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const leadTitle = page.locator(".category-hero__lead .article-card__title");
    await expect(leadTitle).toBeVisible();
    const titleBox = await leadTitle.boundingBox();

    expect(titleBox).not.toBeNull();
    expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(820);
  });

  test(`${categorySlug} lead starts before the desktop opening threshold`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/categories/${categorySlug}/`);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const titleBox = await page
      .locator(".category-hero__lead .article-card__title")
      .boundingBox();

    expect(titleBox).not.toBeNull();
    expect(titleBox!.y).toBeLessThanOrEqual(760);
  });
}

test("mobile article reaches the reading body quickly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/articles/how-to-identify-business-tasks-for-automation/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await expect(page.locator(".article-hero__visual")).toBeHidden();
  const fit = page.locator("details.fit-summary--mobile");
  await expect(fit).toBeVisible();
  await expect(fit).not.toHaveAttribute("open", "");

  const firstParagraph = await page
    .locator(".article-body > p")
    .first()
    .boundingBox();
  expect(firstParagraph).not.toBeNull();
  expect(firstParagraph!.y).toBeLessThanOrEqual(1_477);
});

test("mobile article breadcrumb hides only its current page and orphaned separator", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/articles/how-to-identify-business-tasks-for-automation/");

  const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumbs.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(
    breadcrumbs.getByRole("link", { name: "AI & Automation" }),
  ).toBeVisible();
  await expect(breadcrumbs.locator('[aria-current="page"]')).toBeHidden();
  expect(
    await breadcrumbs
      .locator("li:nth-last-child(2)")
      .evaluate((item) => getComputedStyle(item, "::after").display),
  ).toBe("none");
});

test("wide article headline wrapping is stable", async ({ page }) => {
  const countHeadlineLines = async (width: number): Promise<number> => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/articles/how-to-identify-business-tasks-for-automation/");
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

test("open tablet menu expands as an opaque full-width row without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 899, height: 900 });
  await page.goto("/categories/ai-automation/");

  const identityRow = page.locator(".site-header__identity-row");
  const menu = page.locator(".site-header__mobile-menu");
  const summary = menu.locator("summary");
  const closedHeight = (await identityRow.boundingBox())?.height ?? 0;

  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");

  const geometry = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>(
      ".site-header__identity-row",
    )!;
    const details = document.querySelector<HTMLElement>(
      ".site-header__mobile-menu",
    )!;
    const summaryElement = details.querySelector<HTMLElement>("summary")!;
    const navElement = details.querySelector<HTMLElement>("nav")!;
    const rowBox = row.getBoundingClientRect();
    const detailsBox = details.getBoundingClientRect();
    const summaryBox = summaryElement.getBoundingClientRect();
    const navBox = navElement.getBoundingClientRect();
    const navStyles = getComputedStyle(navElement);
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rowHeight: rowBox.height,
      detailsLeft: detailsBox.left,
      detailsRight: detailsBox.right,
      rowLeft: rowBox.left,
      rowRight: rowBox.right,
      summaryBottom: summaryBox.bottom,
      navTop: navBox.top,
      navBottom: navBox.bottom,
      rowBottom: rowBox.bottom,
      navPosition: navStyles.position,
      navBackground: navStyles.backgroundColor,
    };
  });

  expect(geometry.rowHeight).toBeGreaterThan(closedHeight + 100);
  expect(geometry.detailsLeft).toBeCloseTo(geometry.rowLeft, 0);
  expect(geometry.detailsRight).toBeCloseTo(geometry.rowRight, 0);
  expect(geometry.navTop).toBeGreaterThanOrEqual(geometry.summaryBottom);
  expect(geometry.navBottom).toBeLessThanOrEqual(geometry.rowBottom + 1);
  expect(geometry.navPosition).toBe("static");
  expect(geometry.navBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/articles/how-to-identify-business-tasks-for-automation/");

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

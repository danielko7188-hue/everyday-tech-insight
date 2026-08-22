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

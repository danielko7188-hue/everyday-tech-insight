import { expect, test, type Page } from "@playwright/test";

import { toolkitResources } from "../../src/data/toolkit";

const toolkitWidths = [390, 600, 768, 1024, 1440] as const;
const compactActionWidths = new Set<number>([390, 600]);

type ToolkitGeometry = {
  actionBottom: number;
  actionColumns: number;
  actionDisplay: string;
  actionOverflow: number;
  cardBottom: number;
  cardTop: number;
  links: {
    height: number;
    isPrimary: boolean;
    justify: string;
    overflow: number;
    paddingInlineEnd: number;
    paddingInlineStart: number;
    textAlign: string;
    textCenterDelta: number;
  }[];
  primaryContentDelta: number;
};

async function readToolkitGeometry(page: Page): Promise<ToolkitGeometry[]> {
  return page.locator(".toolkit-card").evaluateAll((cards) =>
    cards.map((card) => {
      const actions = card.querySelector<HTMLElement>(
        ".toolkit-card__actions",
      )!;
      const primary = actions.querySelector<HTMLElement>(
        ".toolkit-card__primary",
      )!;
      const actionStyle = getComputedStyle(actions);
      const actionBox = actions.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const primaryBox = primary.getBoundingClientRect();
      const actionContentLeft =
        actionBox.left +
        Number.parseFloat(actionStyle.borderInlineStartWidth) +
        Number.parseFloat(actionStyle.paddingInlineStart);
      const actionContentRight =
        actionBox.right -
        Number.parseFloat(actionStyle.borderInlineEndWidth) -
        Number.parseFloat(actionStyle.paddingInlineEnd);
      const actionColumns =
        actionStyle.gridTemplateColumns === "none"
          ? 0
          : actionStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length;

      return {
        actionBottom: actionBox.bottom,
        actionColumns,
        actionDisplay: actionStyle.display,
        actionOverflow: actions.scrollWidth - actions.clientWidth,
        cardBottom: cardBox.bottom,
        cardTop: cardBox.top,
        links: Array.from(actions.querySelectorAll<HTMLElement>("a")).map(
          (link) => {
            const linkStyle = getComputedStyle(link);
            const linkBox = link.getBoundingClientRect();
            const textRange = document.createRange();
            textRange.selectNodeContents(link);
            const textBox = textRange.getBoundingClientRect();
            return {
              height: linkBox.height,
              isPrimary: link.classList.contains("toolkit-card__primary"),
              justify: linkStyle.justifyContent,
              overflow: link.scrollWidth - link.clientWidth,
              paddingInlineEnd: Number.parseFloat(linkStyle.paddingInlineEnd),
              paddingInlineStart: Number.parseFloat(
                linkStyle.paddingInlineStart,
              ),
              textAlign: linkStyle.textAlign,
              textCenterDelta: Math.abs(
                linkBox.left +
                  linkBox.width / 2 -
                  (textBox.left + textBox.width / 2),
              ),
            };
          },
        ),
        primaryContentDelta: Math.max(
          Math.abs(primaryBox.left - actionContentLeft),
          Math.abs(primaryBox.right - actionContentRight),
        ),
      };
    }),
  );
}

function expectStableGridRows(geometry: ToolkitGeometry[]): void {
  const rows = new Map<number, ToolkitGeometry[]>();

  for (const card of geometry) {
    const rowTop = Math.round(card.cardTop);
    rows.set(rowTop, [...(rows.get(rowTop) ?? []), card]);
  }

  for (const [rowTop, cards] of rows) {
    const cardBottoms = cards.map(({ cardBottom }) => cardBottom);
    expect(
      Math.max(...cardBottoms) - Math.min(...cardBottoms),
      `card bottoms in the row beginning at ${rowTop}px`,
    ).toBeLessThanOrEqual(1);

    for (const card of cards) {
      expect(
        Math.abs(card.cardBottom - card.actionBottom),
        `action footer at the bottom of the card in row ${rowTop}px`,
      ).toBeLessThanOrEqual(1);
    }
  }
}

for (const width of toolkitWidths) {
  test(`Toolkit actions remain balanced at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/toolkit/");

    const cards = page.locator(".toolkit-card");
    await expect(cards).toHaveCount(4);

    const geometry = await readToolkitGeometry(page);
    const expectedColumns = compactActionWidths.has(width) ? 1 : 2;

    for (const item of geometry) {
      expect(item.actionDisplay).toBe("grid");
      expect(item.actionColumns).toBe(expectedColumns);
      expect(item.actionOverflow).toBeLessThanOrEqual(0);
      expect(item.primaryContentDelta).toBeLessThanOrEqual(1);
      expect(item.links.length).toBeGreaterThanOrEqual(2);

      for (const link of item.links) {
        expect(link.height).toBeGreaterThanOrEqual(44);
        expect(link.overflow).toBeLessThanOrEqual(0);
        expect(
          Math.abs(link.paddingInlineStart - link.paddingInlineEnd),
        ).toBeLessThanOrEqual(0.01);
      }

      const primary = item.links.find(({ isPrimary }) => isPrimary);
      expect(primary).toBeDefined();
      expect(primary!.justify).toBe("center");
      expect(primary!.paddingInlineStart).toBeGreaterThanOrEqual(16);
      expect(primary!.paddingInlineEnd).toBeGreaterThanOrEqual(16);
      expect(primary!.textAlign).toBe("center");
      expect(primary!.textCenterDelta).toBeLessThan(2);

      const secondaryLinks = item.links.filter(({ isPrimary }) => !isPrimary);
      expect(secondaryLinks.length).toBeGreaterThanOrEqual(1);
      for (const secondary of secondaryLinks) {
        expect(secondary.justify).toBe("flex-start");
        expect(secondary.paddingInlineStart).toBeGreaterThanOrEqual(12);
        expect(secondary.paddingInlineEnd).toBeGreaterThanOrEqual(12);
        expect(secondary.textAlign).toBe("start");
      }
    }

    expectStableGridRows(geometry);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}

test("Toolkit action links accommodate long editorial labels without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/toolkit/");

  await page
    .locator(".toolkit-card")
    .first()
    .locator("a")
    .evaluateAll((links) => {
      const fixtureLabels = [
        "View the detailed worksheet guide before starting the review",
        "Read the complete supporting business technology guide",
        "Download the reusable worksheet evidence record as a CSV",
      ];

      links.forEach((link, index) => {
        link.textContent = fixtureLabels[index] ?? fixtureLabels.at(-1)!;
      });
    });

  const card = page.locator(".toolkit-card").first();
  const actions = card.locator(".toolkit-card__actions");
  await expect(actions).toHaveCSS("display", "grid");
  const overflow = await card.evaluate((element) => ({
    actions:
      element.querySelector<HTMLElement>(".toolkit-card__actions")!
        .scrollWidth -
      element.querySelector<HTMLElement>(".toolkit-card__actions")!.clientWidth,
    card: element.scrollWidth - element.clientWidth,
    links: Array.from(element.querySelectorAll<HTMLElement>("a")).map(
      (link) => link.scrollWidth - link.clientWidth,
    ),
  }));

  expect(overflow.actions).toBeLessThanOrEqual(0);
  expect(overflow.card).toBeLessThanOrEqual(0);
  expect(overflow.links.every((value) => value <= 0)).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

const articlePath =
  "/articles/how-to-identify-business-tasks-for-automation/" as const;
const toolkitDetailPath = "/toolkit/automation-candidate-screen/" as const;
const spatialWidths = [320, 390, 600, 768, 1024, 1280, 1440, 1920] as const;

test("homepage renders one local three-plane signal after its promise", async ({
  page,
}) => {
  await page.goto("/");

  const signal = page.locator(
    ".home-opening__promise > .lead-summary + [data-signal-field]",
  );
  await expect(signal).toHaveCount(1);
  await expect(signal).toHaveAttribute("aria-hidden", "true");
  await expect(signal.locator("[data-signal-plane]")).toHaveCount(3);
  await expect(signal.locator("svg")).toHaveCount(1);
  await expect(signal.locator("use")).toHaveCount(0);
  await expect(page.locator("[data-signal-field]")).toHaveCount(1);
  await expect(page.locator("[data-editorial-visual] use")).toHaveCount(8);
});

test("article reading progress is the inert first article child", async ({
  page,
}) => {
  await page.goto(articlePath);

  const progress = page.locator(
    ".article-page > [data-reading-progress]:first-child",
  );
  await expect(progress).toHaveCount(1);
  await expect(progress).toHaveAttribute("aria-hidden", "true");
  await expect(progress).toHaveCSS("pointer-events", "none");
  await expect(progress.locator("span")).toHaveCount(1);
});

for (const resource of toolkitResources) {
  test(`${resource.title} previews every real field once and in order`, async ({
    page,
  }) => {
    await page.goto(resource.detailHref);

    const preview = page.locator("[data-toolkit-structure]");
    await expect(preview).toHaveCount(1);
    await expect(preview.locator("[data-toolkit-structure-group]")).toHaveCount(
      3,
    );

    const fieldLabels = await preview
      .locator("[data-toolkit-structure-field]")
      .allTextContents();
    expect(fieldLabels.map((label) => label.trim())).toEqual(
      resource.fields.map(({ name }) => name),
    );
  });
}

test("404 provides the complete branded recovery route set", async ({
  page,
}) => {
  const response = await page.goto("/purple-signal-page-not-found/");
  expect(response?.status()).toBe(404);

  const signal = page.locator("[data-signal-field='compact']");
  const recovery = page.getByRole("navigation", { name: "Continue browsing" });
  await expect(signal).toHaveCount(1);
  await expect(recovery).toHaveCount(1);
  expect(
    await signal.evaluate((element) => {
      const recoveryActions = document.querySelector(".not-found-actions");
      return (
        recoveryActions !== null &&
        Boolean(
          element.compareDocumentPosition(recoveryActions) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        )
      );
    }),
  ).toBe(true);

  const links = await recovery.locator("a").evaluateAll((elements) =>
    elements.map((element) => ({
      href: element.getAttribute("href"),
      label: element.textContent?.trim(),
    })),
  );
  expect(links).toEqual([
    { href: "/", label: "Home" },
    { href: "/articles/", label: "Guides" },
    { href: "/categories/", label: "Topics" },
    { href: "/toolkit/", label: "Toolkit" },
  ]);
});

test("spatial pages preserve the zero-executable-script contract", async ({
  page,
}) => {
  for (const route of [
    "/",
    articlePath,
    toolkitDetailPath,
    "/purple-signal-page-not-found/",
  ]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(
      route === "/purple-signal-page-not-found/" ? 404 : 200,
    );
    await expect(page.locator("script[src]"), route).toHaveCount(0);
    await expect(
      page.locator('script:not([type="application/ld+json"])'),
      route,
    ).toHaveCount(0);
  }
});

test("reduced motion leaves every spatial enhancement static", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const signalStyles = await page
    .locator("[data-signal-plane]")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          animationDuration: style.animationDuration,
          transform: style.transform,
          transitionDuration: style.transitionDuration,
        };
      }),
    );
  expect(
    signalStyles.every(
      ({ animationDuration, transform, transitionDuration }) =>
        Number.parseFloat(animationDuration) <= 0.000001 &&
        transform === "none" &&
        Number.parseFloat(transitionDuration) <= 0.000001,
    ),
  ).toBe(true);

  await page.goto(articlePath);
  await expect(page.locator("[data-reading-progress]")).toHaveCSS(
    "display",
    "none",
  );
});

for (const width of spatialWidths) {
  test(`spatial route families stay balanced at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const route of ["/", articlePath, toolkitDetailPath, "/404.html"]) {
      await page.goto(route);
      const geometry = await page.locator("main").evaluate((main) => {
        const box = main.getBoundingClientRect();
        return {
          documentOverflow:
            document.documentElement.scrollWidth - window.innerWidth,
          mainLeft: box.left,
          mainRight: box.right,
          visibleSpatialOverflow: Array.from(
            main.querySelectorAll<HTMLElement>(
              "[data-signal-field], [data-reading-progress], [data-toolkit-structure]",
            ),
          )
            .filter((element) => element.getClientRects().length > 0)
            .map((element) => {
              const spatialBox = element.getBoundingClientRect();
              return {
                left: spatialBox.left,
                right: spatialBox.right,
              };
            }),
        };
      });

      expect(geometry.documentOverflow, route).toBeLessThanOrEqual(0);
      expect(geometry.mainLeft, route).toBeGreaterThanOrEqual(-1);
      expect(geometry.mainRight, route).toBeLessThanOrEqual(width + 1);
      for (const item of geometry.visibleSpatialOverflow) {
        expect(item.left, route).toBeGreaterThanOrEqual(-1);
        expect(item.right, route).toBeLessThanOrEqual(width + 1);
      }
    }
  });
}

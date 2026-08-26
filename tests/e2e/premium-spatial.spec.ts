import { expect, test, type Page } from "@playwright/test";

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
    justify: string;
    overflow: number;
    paddingInlineEnd: number;
    paddingInlineStart: number;
    textAlign: string;
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
            return {
              height: link.getBoundingClientRect().height,
              justify: linkStyle.justifyContent,
              overflow: link.scrollWidth - link.clientWidth,
              paddingInlineEnd: Number.parseFloat(linkStyle.paddingInlineEnd),
              paddingInlineStart: Number.parseFloat(
                linkStyle.paddingInlineStart,
              ),
              textAlign: linkStyle.textAlign,
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
        expect(link.justify).toBe("center");
        expect(link.overflow).toBeLessThanOrEqual(0);
        expect(link.paddingInlineStart).toBeGreaterThanOrEqual(12);
        expect(link.paddingInlineEnd).toBeGreaterThanOrEqual(12);
        expect(link.textAlign).toBe("center");
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

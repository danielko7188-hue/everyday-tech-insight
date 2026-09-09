import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const relatedTrustPages = JSON.parse(
  readFileSync(
    new URL("../../src/data/trust-navigation.json", import.meta.url),
    "utf8",
  ),
) as Array<{ path: string; label: string }>;

for (const width of [320, 390, 768, 1440] as const) {
  for (const route of relatedTrustPages) {
    test(`related publication navigation stays aligned on ${route.path} at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      const expectedGitSha = testInfo.project.metadata.expectedGitSha;
      if (typeof expectedGitSha === "string") {
        await expect(
          page.locator('meta[name="eti-build-git-sha"]'),
        ).toHaveAttribute("content", expectedGitSha);
      }
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const navigation = page.getByRole("navigation", {
        name: "Related publication pages",
      });
      await expect(navigation).toHaveCount(1);
      await navigation.scrollIntoViewIfNeeded();
      const items = navigation.locator(":scope > ul > li");
      await expect(items).toHaveCount(7);
      await expect(navigation.getByRole("link")).toHaveCount(7);
      for (const destination of relatedTrustPages) {
        const link = navigation.getByRole("link", {
          name: destination.label,
          exact: true,
        });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", destination.path);
        if (destination.path === route.path)
          await expect(link).toHaveAttribute("aria-current", "page");
        else await expect(link).not.toHaveAttribute("aria-current");
      }
      await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(1);

      const geometry = await navigation.evaluate((nav) => {
        const list = nav.querySelector("ul")!;
        const columns = getComputedStyle(list)
          .gridTemplateColumns.trim()
          .split(/\s+/).length;
        const firstRow = [...list.children].slice(0, columns).map((item) => {
          const itemBox = item.getBoundingClientRect();
          const linkBox = item.querySelector("a")!.getBoundingClientRect();
          return {
            itemTop: itemBox.top,
            itemLeft: itemBox.left,
            linkTop: linkBox.top,
            linkLeft: linkBox.left,
          };
        });
        return {
          columns,
          navigationLeft: nav.getBoundingClientRect().left,
          firstRow,
        };
      });
      expect(
        geometry.columns,
        "the related links retain their two-column layout",
      ).toBe(2);
      const itemTops = geometry.firstRow.map(({ itemTop }) => itemTop);
      const linkTops = geometry.firstRow.map(({ linkTop }) => linkTop);
      expect
        .soft(
          Math.max(...itemTops) - Math.min(...itemTops),
          "first-row list item tops align",
        )
        .toBeLessThanOrEqual(1);
      expect
        .soft(
          Math.max(...linkTops) - Math.min(...linkTops),
          "first-row anchor boxes align even when labels wrap",
        )
        .toBeLessThanOrEqual(1);
      expect
        .soft(
          Math.abs(geometry.firstRow[0]!.itemLeft - geometry.navigationLeft),
          "the first list item has no inherited prose indentation",
        )
        .toBeLessThanOrEqual(1);
      expect
        .soft(
          Math.abs(geometry.firstRow[0]!.linkLeft - geometry.navigationLeft),
          "the first link shares the navigation's left edge",
        )
        .toBeLessThanOrEqual(1);
    });
  }
}

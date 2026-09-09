import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { categorySlugs } from "../../src/data/categories";
import { homepageCuration } from "../../src/data/editorial";

const articlePath = "/articles/how-to-identify-business-tasks-for-automation/";

async function openPage(page: Page, path: string, testInfo: TestInfo) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  const sha = testInfo.project.metadata.expectedGitSha;
  if (typeof sha === "string") {
    await expect(
      page.locator('meta[name="eti-build-git-sha"]'),
    ).toHaveAttribute("content", sha);
  }
  await page.evaluate(() => document.fonts.ready);
}

async function assertCovers(page: Page, count: number) {
  const covers = page.locator(".editorial-cover");
  await expect(covers).toHaveCount(count);
  for (const cover of await covers.all()) {
    const image = cover.locator("img");
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(image).toHaveAttribute("alt", "");
    await expect(image).toHaveAttribute("width", "1536");
    await expect(image).toHaveAttribute("height", "1024");
    await expect(
      cover.locator("picture source[type='image/avif']"),
    ).toHaveAttribute("srcset", /480w.*960w.*1536w/);
    await expect(cover.locator("figcaption")).toHaveText(
      "AI-generated editorial illustration",
    );
  }
  await expect(
    covers.locator('img[loading="eager"][fetchpriority="high"]'),
  ).toHaveCount(1);
}

for (const width of [390, 1440]) {
  test(`story-led home opening at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openPage(page, "/", testInfo);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Make technology decisions you can explain.",
    );
    await expect(page.locator(".home-opening__actions a")).toHaveCount(2);
    await expect(page.locator(".signal-field--hero")).toHaveCount(0);
    const lead = page.locator(".front-page__lead .article-card__title");
    const bounds = await lead.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(780);
    const size = await lead.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(size).toBeGreaterThanOrEqual(width === 390 ? 24 : 40);
    expect(size).toBeLessThanOrEqual(width === 390 ? 32 : 48);
    const destinations = await page
      .locator(".home-page .article-card__title a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(destinations).toHaveLength(9);
    expect(new Set(destinations).size).toBe(9);
    expect(destinations).toEqual(
      Object.values(homepageCuration)
        .flat()
        .map((slug) => `/articles/${slug}/`),
    );
    await assertCovers(page, 3);
  });

  for (const category of categorySlugs) {
    test(`${category} has three unique guides and an early lead at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await openPage(page, `/categories/${category}/`, testInfo);
      await expect(page.locator(".category-page")).toHaveAttribute(
        "data-layout",
        "compact",
      );
      await expect(page.locator(".category-hero__copy > p")).toHaveCount(1);
      const titles = page.locator(
        ".category-compact__list .article-card__title a",
      );
      await expect(titles).toHaveCount(3);
      const destinations = await titles.evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")),
      );
      expect(new Set(destinations).size).toBe(3);
      const first = await titles.first().boundingBox();
      expect(first!.y + first!.height).toBeLessThanOrEqual(780);
      await expect(
        page.locator(".category-compact .story-meta__category"),
      ).toHaveCount(0);
      await assertCovers(page, 1);
    });
  }
}

test("fit details open with the keyboard and retain every field", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openPage(page, articlePath, testInfo);
  const details = page.locator("details.fit-summary");
  await expect(details).toHaveCount(1);
  await expect(details).not.toHaveAttribute("open");
  const summary = details.locator("summary");
  await expect(summary.getByRole("heading", { level: 2 })).toHaveText(
    "At a glance",
  );
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  for (const label of [
    "When to use this guide",
    "Business problem",
    "Technology focus",
    "Intended reader",
    "What you will produce",
  ]) {
    await expect(details.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(details.locator("dd")).toHaveCount(4);
  for (const value of await details.locator("dd").all()) {
    await expect(value).toBeVisible();
    expect((await value.textContent())?.trim().length).toBeGreaterThan(10);
  }
  await page.keyboard.press("Space");
  await expect(details).not.toHaveAttribute("open");
  await expect(
    page.locator(".article-reading-layout__content > .article-hero__visual"),
  ).toBeVisible();
  await expect(page.locator(".article-hero .article-hero__visual")).toHaveCount(
    0,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  expect((await page.locator(".article-body").boundingBox())!.y).toBeLessThan(
    1400,
  );
});

test("closed fit details print all guidance without a script", async ({
  page,
}, testInfo) => {
  await openPage(page, articlePath, testInfo);
  const details = page.locator("details.fit-summary");
  await expect(details).not.toHaveAttribute("open");
  await page.emulateMedia({ media: "print" });
  await expect(details.locator(".fit-summary__when")).toBeVisible();
  for (const value of await details.locator("dd").all())
    await expect(value).toBeVisible();
  await expect(details.locator("dd")).toHaveCount(4);
});

for (const width of [320, 390, 768, 1440]) {
  test(`editorial typography and reading stay inside ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/categories/cybersecurity-data-protection/",
      articlePath,
    ]) {
      await openPage(page, path, testInfo);
      await expect(page.locator("body")).toHaveCSS(
        "font-family",
        /Instrument Sans Variable/,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        path,
      ).toBeLessThanOrEqual(width);
      const details = page.locator("details.fit-summary");
      if (await details.count()) {
        await details.locator("summary").click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${path} expanded`,
        ).toBeLessThanOrEqual(width);
      }
    }
  });
}

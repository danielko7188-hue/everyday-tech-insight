import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function openPage(page: Page, path: string, testInfo: TestInfo) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(path === "/404/" ? 404 : 200);
  const expectedGitSha = testInfo.project.metadata.expectedGitSha;
  if (typeof expectedGitSha === "string") {
    await expect(
      page.locator('meta[name="eti-build-git-sha"]'),
    ).toHaveAttribute("content", expectedGitSha);
  }
  await page.evaluate(() => document.fonts.ready);
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
}

for (const width of [320, 390, 768, 1440]) {
  test(`native typography and unboxed category introduction at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openPage(
      page,
      "/categories/cybersecurity-data-protection/",
      testInfo,
    );
    for (const selector of [
      "body",
      "h1",
      ".publication-mark__name",
      ".story-meta",
      ".section-heading__eyebrow",
    ]) {
      await expect
        .soft(page.locator(selector).first())
        .toHaveCSS(
          "font-family",
          /-apple-system.*BlinkMacSystemFont.*Helvetica Neue.*Arial/,
        );
    }
    const hero = page.locator(".category-hero");
    await expect.soft(hero).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect.soft(hero).toHaveCSS("border-radius", "0px");
    await expect.soft(page.locator(".category-hero__visual")).toBeHidden();
    await expect(page.locator(".category-hero__copy > p")).toHaveCount(3);
    const compactBar = await page
      .locator(".article-card--compact")
      .first()
      .evaluate((element) => {
        const before = getComputedStyle(element, "::before");
        return before.display === "none" || before.content === "none";
      });
    expect
      .soft(compactBar, "no short category-color bar above compact guides")
      .toBe(true);
    for (const copy of await page.locator(".category-hero__copy > p").all())
      await expect(copy).toBeVisible();
    for (const label of await page
      .locator(".eyebrow, .section-heading__eyebrow")
      .all()) {
      await expect.soft(label).toHaveCSS("text-transform", "none");
      const accent = await label.evaluate((element) => {
        const before = getComputedStyle(element, "::before");
        return (
          before.content === "none" ||
          before.content === "normal" ||
          before.display === "none"
        );
      });
      expect.soft(accent, "no ornamental label bar").toBe(true);
    }
    const identityHeight = await page
      .locator(".site-header__identity-row")
      .evaluate((element) => element.getBoundingClientRect().height);
    expect.soft(identityHeight).toBeLessThanOrEqual(width < 900 ? 57 : 53);
    const menu = page.locator(".site-header__mobile-menu");
    if (width < 900) {
      await expect(menu).toBeVisible();
      const summary = menu.locator("summary");
      const before = await summary.boundingBox();
      await summary.click();
      await expect(menu).toHaveAttribute("open", "");
      const after = await summary.boundingBox();
      expect(after!.y).toBeCloseTo(before!.y, 0);
      expect(after!.height).toBeGreaterThanOrEqual(44);
      await expect(
        page
          .getByRole("navigation", { name: "Mobile navigation" })
          .getByRole("link"),
      ).toHaveCount(8);
      await summary.click();
    } else {
      await expect(menu).toBeHidden();
      await expect(
        page
          .getByRole("navigation", { name: "Topic navigation" })
          .getByRole("link"),
      ).toHaveCount(5);
    }
    if (width === 390 || width === 1440) {
      const firstGuide = page
        .locator(".category-compact__list .article-card__title")
        .first();
      expect(
        await firstGuide.evaluate(
          (element) => element.getBoundingClientRect().top,
        ),
      ).toBeLessThan(850);
    }
    await expectNoOverflow(page);
  });

  test(`topic directory stays fully usable without circuit tiles or hover lift at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openPage(page, "/categories/", testInfo);
    await expect(page.locator(".category-directory__entry")).toHaveCount(5);
    for (const motif of await page.locator(".category-directory__visual").all())
      await expect.soft(motif).toBeHidden();
    const entry = page.locator(".category-directory__entry").first();
    await entry.hover();
    await expect.soft(entry).toHaveCSS("transform", "none");
    await expect.soft(entry).toHaveCSS("box-shadow", "none");
    await expect.soft(entry).toHaveCSS("border-radius", "0px");
    await expect(entry.getByRole("link")).toBeVisible();
    await expectNoOverflow(page);
  });
}

for (const width of [390, 1440]) {
  test(`home promise and actions lead a frameless editorial opening at ${width}px`, async ({
    page,
  }, testInfo) => {
    const height = width === 390 ? 844 : 900;
    await page.setViewportSize({ width, height });
    await openPage(page, "/", testInfo);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Make technology decisions you can explain.",
    );
    for (const selector of [
      ".home-opening__promise h1",
      ".lead-summary",
      ".home-opening__actions",
    ]) {
      const bounds = await page.locator(selector).boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    }
    const art = page.locator(".signal-field--hero");
    await expect(art.locator("img")).toBeVisible();
    await expect.soft(art).toHaveCSS("border-radius", "0px");
    expect((await art.boundingBox())!.height).toBeLessThanOrEqual(
      width < 768 ? 241 : 281,
    );
    const lead = page.locator(".front-page__lead .article-card");
    expect(
      (await lead.locator(".article-card__title").boundingBox())!.y,
    ).toBeLessThanOrEqual(1200);
    await lead.hover();
    await expect.soft(lead).toHaveCSS("transform", "none");
    await expect.soft(lead).toHaveCSS("box-shadow", "none");
    await expect.soft(lead).toHaveCSS("border-radius", "0px");
    for (const motif of await page.locator(".topic-directory__motif").all())
      await expect.soft(motif).toBeHidden();
    await expect(page.locator(".topic-directory--compact li > a")).toHaveCount(
      5,
    );
    await expectNoOverflow(page);
  });
}

for (const width of [390, 768, 1440]) {
  test(`toolkit uses measured titles and compact primary actions at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openPage(page, "/toolkit/", testInfo);
    await expect
      .soft(page.locator(".toolkit-hero"))
      .toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".toolkit-card")).toHaveCount(4);
    for (const card of await page.locator(".toolkit-card").all()) {
      const size = await card
        .locator("h2")
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      expect.soft(size).toBeLessThanOrEqual(30);
      expect(size).toBeGreaterThanOrEqual(24);
      await expect
        .soft(card.locator(".toolkit-card__type"))
        .toHaveCSS("text-transform", "none");
      const action = card.locator(".toolkit-card__primary");
      expect
        .soft((await action.boundingBox())!.width)
        .toBeLessThan((await card.boundingBox())!.width * 0.94);
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      for (const selector of [
        ".toolkit-card__copy",
        ".toolkit-card__actions",
      ]) {
        await expect(card.locator(selector)).toHaveCSS(
          "background-color",
          "rgba(0, 0, 0, 0)",
        );
      }
    }
    await expectNoOverflow(page);
  });
}

test("404 keeps recovery links while omitting its ornamental circuit field", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, "/404/", testInfo);
  await expect.soft(page.locator(".signal-field--compact")).toBeHidden();
  await expect(page.locator(".not-found-actions a")).toHaveCount(4);
  await expectNoOverflow(page);
});

import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function openPage(page: Page, path: string, testInfo: TestInfo) {
  const response = await page.goto(path);
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
}

for (const width of [320, 390, 768, 1440]) {
  test(`category directory uses balanced, fully clickable entries at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openPage(page, "/categories/", testInfo);
    const entries = page.locator(".category-directory__entry");
    await expect(entries).toHaveCount(5);
    const layout = await page
      .locator(".category-directory")
      .evaluate((section) => {
        const list = section.querySelector("ol")!;
        const items = Array.from(list.children).map((item) =>
          item.getBoundingClientRect(),
        );
        return {
          sectionWidth: section.getBoundingClientRect().width,
          listWidth: list.getBoundingClientRect().width,
          widths: items.map((item) => item.width),
          tops: items.map((item) => item.top),
          heights: items.map((item) => item.height),
        };
      });
    expect(layout.listWidth).toBeCloseTo(layout.sectionWidth, 0);
    expect(
      Math.max(...layout.widths) - Math.min(...layout.widths),
    ).toBeLessThan(1);
    if (width >= 768) expect(layout.tops[0]).toBeCloseTo(layout.tops[1]!, 0);
    else expect(Math.max(...layout.heights)).toBeLessThan(300);

    for (const entry of await entries.all()) {
      await entry.scrollIntoViewIfNeeded();
      const target = await entry.evaluate((card) => {
        const box = card.getBoundingClientRect();
        const link = card.querySelector("a")!;
        return {
          height: link.getBoundingClientRect().height,
          bottomCornerIsLink:
            document
              .elementFromPoint(box.right - 16, box.bottom - 16)
              ?.closest("a") === link,
        };
      });
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.bottomCornerIsLink).toBe(true);
      const link = entry.getByRole("link");
      await link.focus();
      await expect(link).toBeFocused();
      const focus = await entry.evaluate((card) =>
        [card, card.querySelector("a")!].some((element) => {
          const style = getComputedStyle(element);
          return (
            style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2
          );
        }),
      );
      expect(focus).toBe(true);
    }
    await entries.first().click({ position: { x: 20, y: 20 } });
    await expect(page).toHaveURL(/\/categories\/ai-automation\/$/);
  });

  test(`archive metadata wraps without inherited offsets or orphan separators at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openPage(page, "/articles/", testInfo);
    const metadata = page.locator(".story-meta").first();
    await expect(metadata.locator("li")).toHaveCount(4);
    await expect(metadata.locator("time")).toHaveCount(1);
    await expect(metadata).toContainText("min read");
    const metrics = await metadata.locator("li").evaluateAll((items) =>
      items.map((item) => ({
        margin: getComputedStyle(item).marginTop,
        separator: getComputedStyle(item, "::before").content,
        top: item.getBoundingClientRect().top,
      })),
    );
    for (const item of metrics) {
      expect(item.margin).toBe("0px");
      expect(item.separator).not.toContain("/");
    }
    if (width >= 390) expect(metrics[0]!.top).toBeCloseTo(metrics[1]!.top, 0);
  });
}

for (const width of [320, 390, 768]) {
  test(`home topics are compact and clickable beyond their labels at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openPage(page, "/", testInfo);
    const cards = page.locator(".topic-directory--compact li");
    await expect(cards).toHaveCount(5);
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      const metric = await card.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          height: box.height,
        };
      });
      expect(metric.height).toBeLessThan(250);
      // Offscreen home sections use content-visibility: auto; wait for paint.
      await expect
        .poll(() =>
          card.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return (
              document
                .elementFromPoint(box.right - 16, box.bottom - 16)
                ?.closest("a") === element.querySelector("a")
            );
          }),
        )
        .toBe(true);
    }
    await cards.first().click({ position: { x: 20, y: 20 } });
    await expect(page).toHaveURL(/\/categories\/ai-automation\/$/);
  });
}

for (const width of [390, 1440]) {
  test(`category introduction brings the first guide into view at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openPage(
      page,
      "/categories/cybersecurity-data-protection/",
      testInfo,
    );
    const guide = page
      .locator(".category-compact__list .article-card__title a")
      .first();
    await expect(guide).toBeVisible();
    const top = await guide.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    expect(top).toBeLessThan(850);
    await expect(page.locator(".category-hero__copy > p")).toHaveCount(3);
  });
}

test("desktop article contents follow the reader while anchor links reach their headings", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(
    page,
    "/articles/back-up-business-files-with-the-3-2-1-method/",
    testInfo,
  );
  // Materialize deferred prose before measuring anchor and sticky geometry.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>(
      ".article-body > *",
    ))
      element.style.contentVisibility = "visible";
  });
  const contents = page.locator(".table-of-contents");
  await expect(contents).toHaveCount(1);
  await contents
    .getByRole("link", {
      name: "Run a representative restore test",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/#run-a-representative-restore-test$/);
  const heading = page.getByRole("heading", {
    name: "Run a representative restore test",
    exact: true,
  });
  await expect
    .poll(async () =>
      heading.evaluate((element) =>
        Math.round(element.getBoundingClientRect().top),
      ),
    )
    .toBeGreaterThanOrEqual(0);
  expect(
    await heading.evaluate((element) => element.getBoundingClientRect().top),
  ).toBeLessThan(120);
  const bounds = await contents.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
  expect(
    await page
      .locator(".article-body li + li")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).marginTop)),
  ).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1440, height: 600 });
  await expect(contents).toHaveCSS("position", "static");
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(contents).toHaveCSS("position", "static");
});

for (const width of [768, 1440]) {
  test(`paired toolkit primary actions align despite wrapped secondary links at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openPage(page, "/toolkit/", testInfo);
    const cards = page.locator(".toolkit-card");
    await expect(cards).toHaveCount(4);
    const positions = await cards.evaluateAll((elements) =>
      elements.map((element) => ({
        top: element.getBoundingClientRect().top,
        actionTop: element
          .querySelector(".toolkit-card__primary")!
          .getBoundingClientRect().top,
      })),
    );
    for (const offset of [0, 2]) {
      expect(positions[offset]!.top).toBeCloseTo(positions[offset + 1]!.top, 0);
      expect(positions[offset]!.actionTop).toBeCloseTo(
        positions[offset + 1]!.actionTop,
        0,
      );
    }
  });
}

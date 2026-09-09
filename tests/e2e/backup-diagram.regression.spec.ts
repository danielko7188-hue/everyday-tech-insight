import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`backup diagram labels fit their boxes at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/articles/back-up-business-files-with-the-3-2-1-method/");
    await page.evaluate(() => document.fonts.ready);

    const figure = page.locator(
      'figure[data-visual-key="three-two-one-topology"]',
    );
    await expect(figure).toBeVisible();
    await expect(
      figure.locator('use[href="#three-two-one-topology"]'),
    ).toHaveCount(1);

    const measurements = await page
      .locator("symbol#three-two-one-topology")
      .evaluate((symbol) => {
        const boxes = Array.from(symbol.querySelectorAll("rect"));
        const labels = Array.from(symbol.querySelectorAll("text"));
        const content = (label: SVGTextElement) => {
          const lines = Array.from(label.querySelectorAll("tspan"));
          return (lines.length ? lines : [label])
            .map((line) => line.textContent?.trim())
            .join(" ")
            .replace(/\s+/g, " ");
        };

        return ["Independent copy", "Second medium"].map((name) => {
          const label = labels.find((candidate) => content(candidate) === name);
          if (!label) throw new Error(`Missing backup label: ${name}`);
          const text = label.getBBox();
          const box = boxes
            .map((candidate) => candidate.getBBox())
            .sort(
              (a, b) =>
                Math.abs(a.y + a.height / 2 - (text.y + text.height / 2)) -
                Math.abs(b.y + b.height / 2 - (text.y + text.height / 2)),
            )[0];
          if (!box) throw new Error(`Missing box for backup label: ${name}`);

          return {
            name,
            text: {
              left: text.x,
              top: text.y,
              right: text.x + text.width,
              bottom: text.y + text.height,
              width: text.width,
              height: text.height,
            },
            box: {
              left: box.x,
              top: box.y,
              right: box.x + box.width,
              bottom: box.y + box.height,
            },
          };
        });
      });

    await testInfo.attach("backup-label-bounds", {
      body: JSON.stringify(measurements, null, 2),
      contentType: "application/json",
    });

    for (const { name, text, box } of measurements) {
      expect(text.width, `${name}: measurable text width`).toBeGreaterThan(0);
      expect(text.height, `${name}: measurable text height`).toBeGreaterThan(0);
      // Leave visible breathing room between the text and the box stroke.
      const inset = 8;
      expect
        .soft(text.left, `${name}: left inset`)
        .toBeGreaterThanOrEqual(box.left + inset);
      expect
        .soft(text.right, `${name}: right inset`)
        .toBeLessThanOrEqual(box.right - inset);
      expect
        .soft(text.top, `${name}: top inset`)
        .toBeGreaterThanOrEqual(box.top + inset);
      expect
        .soft(text.bottom, `${name}: bottom inset`)
        .toBeLessThanOrEqual(box.bottom - inset);
    }
  });
}

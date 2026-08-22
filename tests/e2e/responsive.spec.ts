import { expect, test } from "@playwright/test";

const representativeRoutes = [
  "/",
  "/categories/ai-automation/",
  "/articles/how-to-identify-business-tasks-for-automation/",
] as const;
const requiredWidths = [360, 390, 768, 1024, 1280, 1440, 1920] as const;

test("home, category, and article stay within every required viewport", async ({
  page,
}) => {
  for (const width of requiredWidths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });

    for (const route of representativeRoutes) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} at ${width}px`).toBe(200);

      const overflow = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(
        overflow.document,
        `${route} at ${width}px document overflow`,
      ).toBeLessThanOrEqual(overflow.viewport);
      expect(
        overflow.body,
        `${route} at ${width}px body overflow`,
      ).toBeLessThanOrEqual(overflow.viewport);
    }
  }
});

import { expect, test, type Page } from "@playwright/test";

const localOrigin = "http://127.0.0.1:4321";
const viewportHeight = 900;
const viewportWidths = [390, 768, 1440] as const;
const routes = [
  { alias: "home", path: "/", status: 200 },
  {
    alias: "category",
    path: "/categories/cybersecurity-data-protection/",
    status: 200,
  },
  {
    alias: "article",
    path: "/articles/back-up-business-files-with-the-3-2-1-method/",
    status: 200,
  },
  { alias: "toolkit", path: "/toolkit/", status: 200 },
  {
    alias: "toolkit-detail",
    path: "/toolkit/backup-restore-test-log/",
    status: 200,
  },
  { alias: "about", path: "/about/", status: 200 },
  {
    alias: "editorial-standards",
    path: "/editorial-standards/",
    status: 200,
  },
  { alias: "contact", path: "/contact/", status: 200 },
  {
    alias: "404",
    path: "/publication-visual-regression-route-that-does-not-exist/",
    status: 404,
  },
] as const;

test.describe.configure({ mode: "serial" });

function monitorRuntime(page: Page, expectedNotFoundPath?: string): string[] {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      const sourceUrl = message.location().url;
      if (
        expectedNotFoundPath &&
        sourceUrl === new URL(expectedNotFoundPath, localOrigin).href &&
        /status of 404/i.test(message.text())
      ) {
        return;
      }
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`page: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    errors.push(
      `request: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown failure"})`,
    );
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin !== localOrigin
    ) {
      errors.push(`cross-origin request: ${request.method()} ${request.url()}`);
    }
  });

  return errors;
}

async function stabilizePage(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        animation-iteration-count: 1 !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });

  const fontState = await page.evaluate(async () => {
    const publicationFace = await document.fonts.load(
      '600 16px "Newsreader Variable"',
      "Publication",
    );
    const interfaceFace = await document.fonts.load(
      '400 16px "Source Sans 3 Variable"',
      "Interface",
    );
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );

    return {
      interfaceFace: interfaceFace.length,
      publicationFace: publicationFace.length,
    };
  });

  expect(fontState.publicationFace, "local Newsreader face").toBeGreaterThan(0);
  expect(fontState.interfaceFace, "local Source Sans 3 face").toBeGreaterThan(
    0,
  );
}

async function visitStablePage(
  page: Page,
  path: string,
  expectedStatus = 200,
): Promise<string[]> {
  const runtimeErrors = monitorRuntime(
    page,
    expectedStatus === 404 ? path : undefined,
  );
  const response = await page.goto(path, { waitUntil: "networkidle" });
  expect(response?.status(), path).toBe(expectedStatus);
  await stabilizePage(page);
  expect(runtimeErrors, `${path} runtime errors before capture`).toEqual([]);
  return runtimeErrors;
}

async function expectTabletFooterColumnsDoNotOverlap(
  page: Page,
): Promise<void> {
  const markGeometry = await page
    .locator(".site-footer__mark")
    .evaluate((mark) => {
      const box = mark.getBoundingClientRect();
      return { paintedRight: box.x + mark.scrollWidth };
    });
  const groupsBox = await page.locator(".site-footer__groups").boundingBox();
  expect(groupsBox, "footer navigation geometry").not.toBeNull();
  expect(
    markGeometry.paintedRight,
    "footer publication mark must clear the navigation columns",
  ).toBeLessThanOrEqual(groupsBox!.x);
}

async function focusWithKeyboard(
  page: Page,
  target: ReturnType<Page["locator"]>,
) {
  for (let index = 0; index < 30; index += 1) {
    await page.keyboard.press("Tab");
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
  }
  throw new Error("Keyboard focus did not reach the requested element.");
}

for (const route of routes) {
  for (const width of viewportWidths) {
    test(`${route.alias} full page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ height: viewportHeight, width });
      const runtimeErrors = await visitStablePage(
        page,
        route.path,
        route.status,
      );
      if (route.alias === "home" && width === 768) {
        await expectTabletFooterColumnsDoNotOverlap(page);
      }

      await expect(page).toHaveScreenshot(`${width}-${route.alias}-full.png`, {
        fullPage: true,
      });
      expect(
        runtimeErrors,
        `${route.path} runtime errors after capture`,
      ).toEqual([]);
    });
  }
}

for (const width of [390, 768] as const) {
  test(`keyboard-open menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: viewportHeight, width });
    const runtimeErrors = await visitStablePage(page, "/");
    const menu = page.locator("header.site-header details").first();
    const summary = menu.locator("summary");
    await expect(menu).toBeVisible();
    await expect(menu).not.toHaveAttribute("open", "");
    await focusWithKeyboard(page, summary);
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("open", "");

    await expect(page).toHaveScreenshot(`${width}-menu-open-above-fold.png`);
    expect(runtimeErrors, `menu at ${width}px runtime errors`).toEqual([]);
  });
}

for (const width of viewportWidths) {
  test(`keyboard-focused skip link at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: viewportHeight, width });
    const runtimeErrors = await visitStablePage(page, "/");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await expect(page).toHaveScreenshot(`${width}-skip-link-focus.png`);
    expect(runtimeErrors, `skip link at ${width}px runtime errors`).toEqual([]);
  });
}

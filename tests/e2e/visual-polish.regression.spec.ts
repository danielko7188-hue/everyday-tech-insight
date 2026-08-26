import { expect, test, type Locator, type Page } from "@playwright/test";

const headlineCases = [
  {
    path: "/categories/",
    heading: "Explore the five‑topic operating picture",
    token: "five‑topic",
  },
  {
    path: "/articles/crm-vs-project-management-software/",
    heading: "CRM vs. project‑management software: choose by work object",
    token: "project‑management",
  },
  {
    path: "/articles/run-a-30-day-business-technology-pilot/",
    heading: "How to run a 30‑day business technology pilot",
    token: "30‑day",
  },
  {
    path: "/articles/back-up-business-files-with-the-3-2-1-method/",
    heading: "How to back up business files with the 3‑2‑1 method",
    token: "3‑2‑1",
  },
  {
    path: "/articles/write-a-practical-ai-acceptable-use-policy/",
    heading: "How to write a practical AI acceptable‑use policy",
    token: "acceptable‑use",
  },
  {
    path: "/articles/onboard-employees-and-contractors-to-business-technology/",
    heading: "Deliver role‑specific training",
    token: "role‑specific",
  },
] as const;

const cardHeadlineCases = headlineCases.slice(1, 5);

async function tokenLineCount(locator: Locator, token: string) {
  return locator.evaluate((element, requestedToken) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let fullText = "";

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      textNodes.push(textNode);
      fullText += textNode.data;
    }

    const tokenStart = fullText.indexOf(requestedToken);
    if (tokenStart === -1) return -1;

    const tokenEnd = tokenStart + requestedToken.length;
    let runningOffset = 0;
    let startNode: Text | undefined;
    let endNode: Text | undefined;
    let startOffset = 0;
    let endOffset = 0;

    for (const textNode of textNodes) {
      const nextOffset = runningOffset + textNode.length;

      if (
        !startNode &&
        tokenStart >= runningOffset &&
        tokenStart < nextOffset
      ) {
        startNode = textNode;
        startOffset = tokenStart - runningOffset;
      }

      if (tokenEnd > runningOffset && tokenEnd <= nextOffset) {
        endNode = textNode;
        endOffset = tokenEnd - runningOffset;
        break;
      }

      runningOffset = nextOffset;
    }

    if (!startNode || !endNode) return -1;

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    const lineTops = [...range.getClientRects()].map(({ top }) =>
      Math.round(top * 10),
    );
    return new Set(lineTops).size;
  }, token);
}

async function assertNoPageOverflow(page: Page, width: number) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    geometry.scrollWidth,
    `horizontal overflow at ${width}px`,
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

for (const width of [320, 390, 768, 1440] as const) {
  test(`hyphenated headline tokens stay intact without overflow at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ height: 900, width });

    for (const headlineCase of headlineCases) {
      await page.goto(headlineCase.path);
      const heading = page.getByRole("heading", {
        exact: true,
        name: headlineCase.heading,
      });

      await expect(heading).toBeVisible();
      expect(
        await tokenLineCount(heading, headlineCase.token),
        `${headlineCase.token} split on ${headlineCase.path} at ${width}px`,
      ).toBe(1);
      await assertNoPageOverflow(page, width);
    }

    await page.goto("/articles/");
    for (const headlineCase of cardHeadlineCases) {
      const cardHeading = page
        .locator(".article-card__title")
        .filter({ hasText: headlineCase.heading });
      await cardHeading.scrollIntoViewIfNeeded();
      await expect(cardHeading).toBeVisible();
      expect(
        await tokenLineCount(cardHeading, headlineCase.token),
        `${headlineCase.token} split in the guide archive at ${width}px`,
      ).toBe(1);
    }
    await assertNoPageOverflow(page, width);
  });
}

test("masthead home link uses only its visible mark hitbox", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440] as const) {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/");

    const geometry = await page
      .locator(".site-header__mark")
      .evaluate((mark) => {
        const markRect = mark.getBoundingClientRect();
        const childRects = [...mark.children].map((child) =>
          child.getBoundingClientRect(),
        );
        const visibleLeft = Math.min(...childRects.map(({ left }) => left));
        const visibleRight = Math.max(...childRects.map(({ right }) => right));

        return {
          markLeft: markRect.left,
          markRight: markRect.right,
          markWidth: markRect.width,
          visibleLeft,
          visibleRight,
          visibleWidth: visibleRight - visibleLeft,
        };
      });

    expect(geometry.markLeft).toBeCloseTo(geometry.visibleLeft, 0);
    expect(geometry.markRight - geometry.visibleRight).toBeLessThanOrEqual(2);
    expect(geometry.markWidth - geometry.visibleWidth).toBeLessThanOrEqual(2);
    await assertNoPageOverflow(page, width);
  }
});

test("visited editorial links use an accessible distinct color while controls retain theirs", async ({
  page,
}) => {
  await page.goto("/articles/back-up-business-files-with-the-3-2-1-method/");

  const result = await page.evaluate(() => {
    function collectRules(ruleList: CSSRuleList, output: CSSStyleRule[] = []) {
      for (const rule of ruleList) {
        if (rule instanceof CSSStyleRule) output.push(rule);
        if ("cssRules" in rule) {
          collectRules((rule as CSSGroupingRule).cssRules, output);
        }
      }
      return output;
    }

    const rules = [...document.styleSheets].flatMap((sheet) =>
      collectRules(sheet.cssRules),
    );

    function declaredColorFor(selector: string) {
      return rules
        .filter(({ selectorText }) =>
          selectorText
            ?.split(",")
            .some((candidate) => candidate.trim() === selector),
        )
        .at(-1)?.style.color;
    }

    function rgbFromHex(hex: string) {
      const compact = hex.replace("#", "");
      const expanded =
        compact.length === 3
          ? [...compact].map((character) => character.repeat(2)).join("")
          : compact;
      const channels = expanded
        .match(/.{2}/g)
        ?.map((value) => Number.parseInt(value, 16));
      if (!channels || channels.length !== 3) return undefined;
      const [red, green, blue] = channels;
      if (red === undefined || green === undefined || blue === undefined) {
        return undefined;
      }
      return [red, green, blue] as const;
    }

    function contrastRatio(foreground: string, background: string) {
      const luminance = (hex: string) => {
        const channels = rgbFromHex(hex);
        if (!channels) return Number.NaN;
        const toLinear = (channel: number) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        };
        return (
          0.2126 * toLinear(channels[0]) +
          0.7152 * toLinear(channels[1]) +
          0.0722 * toLinear(channels[2])
        );
      };

      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    }

    const rootStyle = getComputedStyle(document.documentElement);
    const visited = rootStyle.getPropertyValue("--brand-visited").trim();
    const unvisited = rootStyle.getPropertyValue("--brand-violet-dark").trim();
    const paper = rootStyle.getPropertyValue("--brand-white").trim();
    const mist = rootStyle.getPropertyValue("--brand-mist").trim();

    return {
      bodyVisited: declaredColorFor(".article-body a:visited"),
      cardVisited: declaredColorFor(".article-card__title a:visited"),
      footerVisited: declaredColorFor(".site-footer a:visited"),
      headerVisited: declaredColorFor(".site-header__mark:visited"),
      primaryActionVisited: declaredColorFor(".toolkit-card__primary:visited"),
      ratios: [contrastRatio(visited, paper), contrastRatio(visited, mist)],
      unvisited,
      visited,
    };
  });

  expect(result.visited).toMatch(/^#[0-9a-f]{6}$/i);
  expect(result.visited).not.toBe(result.unvisited);
  expect(result.bodyVisited).toBe("var(--brand-visited)");
  expect(result.cardVisited).toBe("var(--brand-visited)");
  for (const ratio of result.ratios) {
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }

  for (const stableControlColor of [
    result.footerVisited,
    result.headerVisited,
    result.primaryActionVisited,
  ]) {
    expect(stableControlColor).toBe("var(--brand-white)");
  }
});

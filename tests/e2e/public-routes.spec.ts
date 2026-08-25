import { expect, test } from "@playwright/test";
import { load } from "cheerio";

import { readArticleRecords } from "../../scripts/qa-content.mjs";
import { siteConfig, siteUrl } from "../../site.config.mjs";
import {
  homepageCuration,
  homepageSectionSizes,
} from "../../src/data/editorial";

const articleSlug = "how-to-identify-business-tasks-for-automation";
const absoluteSiteUrl = (path: string) => new URL(path, siteUrl).href;

const launchAiArticleHrefs = [
  "/articles/evaluate-ai-output-quality-in-a-small-team-pilot/",
  "/articles/how-to-identify-business-tasks-for-automation/",
  "/articles/write-a-practical-ai-acceptable-use-policy/",
] as const;

const toolkitCsvHeaders = {
  "/toolkit/automation-candidate-screen.csv": [
    "Task",
    "Process owner",
    "Monthly frequency",
    "Active minutes per run",
    "Input stability",
    "Rule stability",
    "Exception and rework evidence",
    "Failure consequence",
    "Sensitive data and access boundary",
    "Human review point",
    "Manual fallback",
    "Pilot decision",
    "Evidence owner",
    "Review date",
  ],
  "/toolkit/saas-evaluation-evidence-sheet.csv": [
    "Requirement",
    "Priority",
    "Test scenario",
    "Acceptance condition",
    "Purchased plan",
    "Configuration and role",
    "Observed evidence",
    "Result",
    "Limitation",
    "Implementation effort",
    "Exit impact",
    "Follow-up owner",
    "Due date",
  ],
  "/toolkit/technology-risk-register.csv": [
    "Risk event",
    "Business consequence",
    "Affected process or asset",
    "Existing safeguards",
    "Likelihood rating",
    "Likelihood basis",
    "Impact rating",
    "Impact basis",
    "Evidence and uncertainty",
    "Response",
    "Target state",
    "Owner",
    "Due date",
    "Review outcome",
    "Next review date",
  ],
  "/toolkit/backup-restore-test-log.csv": [
    "Protected data",
    "Recovery point",
    "Backup copy",
    "Failure scenario",
    "Restore destination",
    "Request time",
    "Start time",
    "Completion time",
    "Active effort",
    "Validation method",
    "Result",
    "Missing items and errors",
    "Recovery dependencies",
    "Corrective action",
    "Owner",
    "Retest date",
  ],
} as const;

const toolkitRouteExpectations = [
  {
    id: "automation-candidate-screen",
    title: "Automation candidate screen",
    articleSlug: "how-to-identify-business-tasks-for-automation",
    guideHref: "/articles/how-to-identify-business-tasks-for-automation/",
    guideLabel: "Read the automation-candidate guide",
    downloadHref: "/toolkit/automation-candidate-screen.csv",
    downloadLabel: "Download automation screen CSV",
  },
  {
    id: "saas-evaluation-evidence-sheet",
    title: "SaaS evaluation evidence sheet",
    articleSlug: "evaluate-saas-with-a-practical-checklist",
    guideHref: "/articles/evaluate-saas-with-a-practical-checklist/",
    guideLabel: "Read the SaaS evaluation guide",
    downloadHref: "/toolkit/saas-evaluation-evidence-sheet.csv",
    downloadLabel: "Download SaaS evidence CSV",
  },
  {
    id: "technology-risk-register",
    title: "Technology risk register",
    articleSlug: "create-a-simple-technology-risk-register",
    guideHref: "/articles/create-a-simple-technology-risk-register/",
    guideLabel: "Read the technology-risk guide",
    downloadHref: "/toolkit/technology-risk-register.csv",
    downloadLabel: "Download technology risk CSV",
  },
  {
    id: "backup-restore-test-log",
    title: "Backup restore-test log",
    articleSlug: "back-up-business-files-with-the-3-2-1-method",
    guideHref: "/articles/back-up-business-files-with-the-3-2-1-method/",
    guideLabel: "Read the backup and restore guide",
    downloadHref: "/toolkit/backup-restore-test-log.csv",
    downloadLabel: "Download restore-test log CSV",
  },
] as const;

interface ArticleSourceRecord {
  data: {
    status: string;
    category: string;
    slug: string;
    title: string;
    contentType: string;
    datePublished: string;
    summary: string;
    featured: boolean;
    visual: {
      type: string;
      key: string;
      alt: string;
      caption?: string;
      decorative: false;
    };
  };
}

const categories = [
  { name: "AI & Automation", slug: "ai-automation" },
  { name: "Business Software & SaaS", slug: "business-software" },
  {
    name: "Cybersecurity & Data Protection",
    slug: "cybersecurity-data-protection",
  },
  {
    name: "Digital Operations & Productivity",
    slug: "digital-operations",
  },
  {
    name: "Technology Decisions & Strategy",
    slug: "technology-strategy",
  },
] as const;

const trustPages = [
  { path: "/about/", heading: "About Everyday Tech Insight" },
  { path: "/publisher/", heading: "Publisher" },
  { path: "/editorial-standards/", heading: "Editorial standards" },
  { path: "/corrections/", heading: "Corrections" },
  { path: "/contact/", heading: "Contact" },
  { path: "/privacy/", heading: "Privacy" },
  {
    path: "/advertising-disclosure/",
    heading: "Advertising disclosure",
  },
] as const;

const htmlRoutes = [
  "/",
  "/categories/",
  "/articles/",
  "/toolkit/",
  ...toolkitRouteExpectations.map(({ id }) => `/toolkit/${id}/`),
  ...categories.map(({ slug }) => `/categories/${slug}/`),
  `/articles/${articleSlug}/`,
  ...trustPages.map(({ path }) => path),
  "/sitemap/",
] as const;

test("home explains the publication and links all five categories", async ({
  page,
}) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /practical business technology/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/source-backed guidance/i).first()).toBeVisible();
  await expect(page.getByText(/without product hype/i)).toBeVisible();

  for (const category of categories) {
    await expect(
      page.getByRole("link", { name: category.name, exact: true }).first(),
    ).toHaveAttribute("href", `/categories/${category.slug}/`);
  }
});

test("editorial pages ship only the local visual symbols they render", async ({
  page,
}) => {
  await page.goto("/");

  const homeReferences = await page
    .locator("[data-editorial-visual] use")
    .evaluateAll((uses) =>
      uses.map((use) => use.getAttribute("href")).filter(Boolean),
    );
  expect(homeReferences).toHaveLength(1);
  await expect(page.locator("body > svg > symbol")).toHaveCount(1);
  await expect(page.locator(`symbol${homeReferences[0]}`)).toHaveCount(1);

  await page.goto(`/articles/${articleSlug}/`);
  const articleReference = await page
    .locator(".article-hero__visual use")
    .getAttribute("href");
  expect(articleReference).toBeTruthy();
  await expect(page.locator("body > svg > symbol")).toHaveCount(1);
  await expect(page.locator(`symbol${articleReference}`)).toHaveCount(1);
});

test("deferred article blocks reserve stable cold-page geometry", async ({
  page,
}) => {
  const cases = [
    "/articles/create-a-simple-technology-risk-register/",
    "/articles/write-a-practical-ai-acceptable-use-policy/",
  ] as const;

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 800 });

    for (const path of cases) {
      await page.goto(path);
      const initialHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      const deferredBlocks = page.locator(".article-body > :nth-child(n + 5)");
      const fallbackSizes = await deferredBlocks.evaluateAll((elements) =>
        elements.map(
          (element) => getComputedStyle(element).containIntrinsicBlockSize,
        ),
      );

      expect(fallbackSizes.length).toBeGreaterThan(0);
      expect(fallbackSizes).not.toContain("none");
      expect(fallbackSizes).not.toContain("auto 0px");

      for (let index = 0; index < (await deferredBlocks.count()); index += 1) {
        await deferredBlocks.nth(index).scrollIntoViewIfNeeded();
      }

      const materializedHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      const relativeDelta =
        Math.abs(initialHeight - materializedHeight) / materializedHeight;

      expect(relativeDelta).toBeLessThan(0.1);
    }
  }
});

test("toolkit landing publishes four outcome-led cards with detail, guide, and CSV actions", async ({
  page,
  request,
}) => {
  const response = await page.goto("/toolkit/");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Business technology decision toolkit",
    }),
  ).toBeVisible();
  await expect(page.locator(".toolkit-card")).toHaveCount(4);
  await expect(
    page.getByText(/never put passwords, tokens, recovery keys/i),
  ).toBeVisible();

  const downloadHrefs = await page
    .locator(".toolkit-card a[download]")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")).filter(Boolean),
    );
  expect(downloadHrefs).toHaveLength(4);
  expect(new Set(downloadHrefs).size).toBe(4);

  const downloadNames = await page
    .locator(".toolkit-card a[download]")
    .allTextContents();
  expect(new Set(downloadNames).size).toBe(4);
  expect(downloadNames.every((name) => name.endsWith("CSV"))).toBe(true);

  for (const href of downloadHrefs) {
    const download = await request.get(href!);
    expect(download.status(), href!).toBe(200);
    expect(download.headers()["content-type"], href!).toMatch(
      /^text\/csv(?:;|$)/i,
    );
    const records = (await download.text())
      .split(/\r?\n/)
      .filter((record) => record.trim().length > 0);
    expect(records, href!).toHaveLength(1);
    const headers = records[0]!.split(",");
    const expectedHeaders =
      toolkitCsvHeaders[href! as keyof typeof toolkitCsvHeaders];
    expect(expectedHeaders, href!).toBeDefined();
    expect(headers, href!).toEqual(expectedHeaders);
  }

  for (const expected of toolkitRouteExpectations) {
    const card = page.locator(
      `.toolkit-card[data-toolkit-id="${expected.id}"]`,
    );
    await expect(card).toHaveCount(1);
    const outcomeText = await card
      .locator(".toolkit-card__outcome")
      .textContent();
    expect(outcomeText, `${expected.id} raw outcome text`).toContain(
      "Record produced: ",
    );
    await expect(
      card.getByRole("link", { name: "View worksheet guide" }),
    ).toHaveAttribute("href", `/toolkit/${expected.id}/`);
    await expect(
      card.getByRole("link", { name: expected.guideLabel }),
    ).toHaveAttribute("href", expected.guideHref);
    await expect(
      card.getByRole("link", { name: expected.downloadLabel }),
    ).toHaveAttribute("href", expected.downloadHref);
  }

  await expect(
    page.locator(".toolkit-resource, .toolkit-resource__scroll-hint"),
  ).toHaveCount(0);
});

test("every Toolkit detail page explains use boundaries and exposes a stacked field guide", async ({
  page,
}) => {
  for (const expected of toolkitRouteExpectations) {
    const response = await page.goto(`/toolkit/${expected.id}/`);
    expect(response?.status(), expected.id).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: expected.title }),
    ).toBeVisible();

    for (const heading of [
      "Purpose",
      "Intended audience",
      "When to use it",
      "When not to use it",
      "Field guide",
      "Limitations",
      "Data notice",
    ]) {
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
        `${expected.id}: ${heading}`,
      ).toBeVisible();
    }

    const fields = page.locator(".toolkit-field-card");
    await expect(fields, expected.id).toHaveCount(8);
    for (const field of await fields.all()) {
      await expect(field.getByRole("heading", { level: 3 })).not.toBeEmpty();
      await expect(field.locator("p")).not.toBeEmpty();
    }
    await expect(page.locator(".toolkit-field-guide table")).toHaveCount(0);
    await expect(page.locator("[data-horizontal-scroll]")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: expected.guideLabel }),
    ).toHaveAttribute("href", expected.guideHref);
    await expect(
      page.getByRole("link", { name: expected.downloadLabel }),
    ).toHaveAttribute("href", expected.downloadHref);
  }
});

test("only the four mapped guides show one contextual Toolkit callout", async ({
  page,
}) => {
  const articleRecords = (await readArticleRecords()) as ArticleSourceRecord[];
  const expectedBySlug = new Map<
    string,
    (typeof toolkitRouteExpectations)[number]
  >(
    toolkitRouteExpectations.map((resource) => [
      resource.articleSlug,
      resource,
    ]),
  );

  for (const { data } of articleRecords) {
    await page.goto(`/articles/${data.slug}/`);
    const callout = page.locator("aside.article-toolkit-callout");
    const expected = expectedBySlug.get(data.slug);

    if (!expected) {
      await expect(callout, data.slug).toHaveCount(0);
      continue;
    }

    await expect(callout, data.slug).toHaveCount(1);
    await expect(callout).toContainText(/worksheet helps produce/i);
    await expect(
      callout.getByRole("link", { name: "Open the worksheet guide" }),
    ).toHaveAttribute("href", `/toolkit/${expected.id}/`);
  }
});

test("home publishes only the approved nine-guide curation", async ({
  page,
  request,
}) => {
  await page.goto("/");

  const articleLinks = page.locator(
    '.article-card a[href^="/articles/"]:not([href="/articles/"])',
  );
  const articleHrefs = await articleLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );

  const rssResponse = await request.get("/rss.xml");
  expect(rssResponse.status()).toBe(200);
  const rss = load(await rssResponse.text(), { xmlMode: true });
  const publishedArticleHrefs = rss("item > link")
    .map((_, link) => new URL(rss(link).text()).pathname)
    .get();
  const expectedCuratedHrefs = Object.values(homepageCuration)
    .flat()
    .map((slug) => `/articles/${slug}/`);

  expect(expectedCuratedHrefs).toHaveLength(9);
  expect(new Set(expectedCuratedHrefs).size).toBe(9);
  expect(publishedArticleHrefs).toHaveLength(15);
  expect(new Set(publishedArticleHrefs).size).toBe(
    publishedArticleHrefs.length,
  );
  expect(articleHrefs).toHaveLength(9);
  expect(new Set(articleHrefs).size).toBe(articleHrefs.length);
  expect(articleHrefs).toEqual(expectedCuratedHrefs);
  expect(
    expectedCuratedHrefs.every((href) => publishedArticleHrefs.includes(href)),
  ).toBe(true);

  const featuredGuidance = page.getByRole("region", {
    name: "Featured guidance",
  });
  const latestGuides = page.getByRole("region", {
    name: "Latest guides",
  });
  const practicalFoundations = page.getByRole("region", {
    name: "Practical foundations",
  });

  await expect(featuredGuidance).toBeVisible();
  await expect(
    featuredGuidance.locator(".front-page__lead .article-card--lead"),
  ).toHaveCount(homepageSectionSizes.lead);
  await expect(
    featuredGuidance.locator(".front-page__support .article-card--feature"),
  ).toHaveCount(homepageSectionSizes.features);
  await expect(latestGuides).toBeVisible();
  await expect(latestGuides.locator(".article-card--list")).toHaveCount(
    homepageSectionSizes.briefing,
  );
  await expect(practicalFoundations).toBeVisible();
  await expect(practicalFoundations.locator(".article-card--list")).toHaveCount(
    homepageSectionSizes.startHere,
  );
  await expect(
    page.getByRole("link", { name: "View all guides" }),
  ).toHaveAttribute("href", "/articles/");
  await expect(page.locator(".more-guides")).toHaveCount(0);

  const structuralText = await page
    .locator(
      "main h1, main h2, main h3, main .eyebrow, main .section-heading__eyebrow",
    )
    .allTextContents();
  expect(structuralText.join(" ")).not.toMatch(
    /current issue|complete issue|\bedition\b|more guides/i,
  );
  expect(await page.locator("main").innerText()).not.toMatch(
    /most popular|most read|trending/i,
  );

  const topicRows = page.locator(".topic-directory--compact li");
  await expect(topicRows).toHaveCount(categories.length);
  await expect(
    page
      .getByRole("region", { name: "Browse by topic" })
      .getByRole("link", { name: "View all topics" }),
  ).toHaveAttribute("href", "/categories/");
  await expect(
    page.locator('.topic-directory--compact a[href^="/articles/"]'),
  ).toHaveCount(0);
  expect(
    (
      await topicRows.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-category")),
      )
    ).sort(),
  ).toEqual(categories.map(({ slug }) => slug).sort());

  for (const category of categories) {
    const categoryResponse = await request.get(`/categories/${category.slug}/`);
    expect(categoryResponse.status()).toBe(200);
    const categoryPage = load(await categoryResponse.text());
    const categoryArticleHrefs = new Set(
      categoryPage('main a[href^="/articles/"]')
        .map((_, link) => categoryPage(link).attr("href"))
        .get(),
    );
    expect(categoryArticleHrefs.size).toBeGreaterThan(0);

    const topicRow = page.locator(
      `.topic-directory--compact li[data-category="${category.slug}"]`,
    );
    await expect(topicRow).toBeVisible();
    await expect(
      topicRow.getByRole("link", { name: new RegExp(category.name, "i") }),
    ).toHaveAttribute("href", `/categories/${category.slug}/`);
    await expect(topicRow).toContainText(
      new RegExp(`${categoryArticleHrefs.size} guides?`, "i"),
    );
  }

  await expect(
    practicalFoundations.getByRole("link", {
      name: "How to back up business files with the 3-2-1 method",
    }),
  ).toHaveAttribute(
    "href",
    "/articles/back-up-business-files-with-the-3-2-1-method/",
  );

  const toolkit = page.getByRole("region", {
    name: "Featured Toolkit resource",
  });
  await expect(toolkit).toContainText("Automation candidate screen");
  await expect(
    toolkit.getByRole("link", {
      name: "Read the automation-candidate guide",
    }),
  ).toHaveAttribute(
    "href",
    "/articles/how-to-identify-business-tasks-for-automation/",
  );
  await expect(
    toolkit.getByRole("link", { name: "Download automation screen CSV" }),
  ).toHaveAttribute("href", "/toolkit/automation-candidate-screen.csv");

  const evidence = page.locator(".how-we-work");
  await expect(evidence).toHaveCount(1);
  await expect(evidence).toContainText(/practical business problem/i);
  await expect(evidence).toContainText(/primary or official sources/i);
  await expect(evidence).toContainText(/limitations/i);
  await expect(evidence).toContainText(/material corrections/i);
  await expect(
    evidence.getByRole("link", { name: "Editorial standards" }),
  ).toHaveAttribute("href", "/editorial-standards/");
  await expect(
    evidence.getByRole("link", { name: "Corrections" }),
  ).toHaveAttribute("href", "/corrections/");
  await expect(
    evidence.getByRole("link", { name: "Advertising disclosure" }),
  ).toHaveAttribute("href", "/advertising-disclosure/");
  await expect(
    evidence.getByRole("link", { name: "Publisher" }),
  ).toHaveAttribute("href", "/publisher/");
  await expect(evidence.getByRole("link", { name: "Contact" })).toHaveAttribute(
    "href",
    "/contact/",
  );
  await expect(evidence).toHaveAttribute(
    "aria-labelledby",
    "how-we-work-heading",
  );
  await expect(
    page.getByRole("region", {
      name: "How we work",
    }),
  ).toBeVisible();
});

test("all-guides archive groups every published guide once in category order", async ({
  page,
}) => {
  const articleRecords = (await readArticleRecords()) as ArticleSourceRecord[];
  const publishedArticles = articleRecords
    .filter(({ data }) => data.status === "published")
    .sort(
      (left, right) =>
        right.data.datePublished.localeCompare(left.data.datePublished) ||
        left.data.title.localeCompare(right.data.title, "en"),
    );
  expect(publishedArticles).toHaveLength(15);

  const response = await page.goto("/articles/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "All guides" }),
  ).toBeVisible();

  const groups = page.locator(".guide-archive__category");
  await expect(groups).toHaveCount(categories.length);
  expect(
    await groups.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-category")),
    ),
  ).toEqual(categories.map(({ slug }) => slug));

  const allHrefs = await page
    .locator('.guide-archive a[href^="/articles/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(allHrefs).toHaveLength(15);
  expect(new Set(allHrefs).size).toBe(15);

  for (const category of categories) {
    const group = page.locator(
      `.guide-archive__category[data-category="${category.slug}"]`,
    );
    const expected = publishedArticles.filter(
      ({ data }) => data.category === category.slug,
    );
    const expectedHrefs = expected.map(({ data }) => `/articles/${data.slug}/`);
    expect(expectedHrefs).toHaveLength(3);
    await expect(
      group.getByRole("heading", { name: category.name, exact: true }),
    ).toBeVisible();
    expect(
      await group
        .locator('a[href^="/articles/"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual(expectedHrefs);
    const cards = group.locator(".article-card");
    await expect(cards).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      await expect(
        cards
          .nth(index)
          .locator(`time[datetime="${expected[index]!.data.datePublished}"]`),
      ).toHaveCount(1);
      await expect(cards.nth(index).locator(".story-meta")).toContainText(
        /Guide|Framework|Checklist|Comparison/,
      );
      await expect(
        cards.nth(index).locator(".article-card__summary"),
      ).toBeVisible();
      await expect(
        cards.nth(index).locator(".article-card__summary"),
      ).toHaveText(expected[index]!.data.summary);
    }
  }
});

test("Guides navigation targets the all-guides archive with a correct active state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/articles/");

  const utilityLinks = page.locator(".site-header__utility a");
  expect(await utilityLinks.allTextContents()).toEqual([
    "Guides",
    "Toolkit",
    "About",
  ]);
  await expect(
    page.locator('.site-header__utility a[href="/articles/"]'),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator('footer a[href="/articles/"]')).toHaveText(
    "Guides",
  );

  await page.goto("/");
  for (const link of await page
    .getByRole("link", { name: /^(?:Guides|View all guides)$/ })
    .all()) {
    await expect(link).toHaveAttribute("href", "/articles/");
  }

  await page.goto("/sitemap/");
  await expect(
    page.getByRole("link", { name: "All guides", exact: true }),
  ).toHaveAttribute("href", "/articles/");
});

test("desktop masthead exposes every topic and marks the current route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/categories/ai-automation/");

  const header = page.locator("header.site-header");
  for (const category of categories) {
    const topicLink = header.locator(
      `a[href="/categories/${category.slug}/"]:visible`,
    );
    await expect(topicLink).toHaveCount(1);
    await expect(topicLink).toHaveText(category.name);
  }

  await expect(
    header.locator('a[href="/categories/ai-automation/"]:visible'),
  ).toHaveAttribute("aria-current", "page");
});

test("category directory visuals resolve their local symbol definitions", async ({
  page,
}) => {
  await page.goto("/categories/");

  const symbolReferences = await page
    .locator(".category-directory__visual use")
    .evaluateAll((uses) =>
      uses.map((use) => use.getAttribute("href")).filter(Boolean),
    );
  expect(symbolReferences).toHaveLength(categories.length);
  await expect(page.locator("body > svg > symbol")).toHaveCount(
    categories.length,
  );

  for (const reference of symbolReferences) {
    await expect(page.locator(`symbol${reference}`)).toHaveCount(1);
  }

  const categoryVisuals = page.locator(".category-directory__visual svg");
  await expect(categoryVisuals).toHaveCount(categories.length);
  for (const visual of await categoryVisuals.all()) {
    await expect(visual).toHaveAttribute("aria-hidden", "true");
    await expect(visual).not.toHaveAttribute("role", "img");
  }
  await expect(
    page.locator(".category-directory__visual [data-visual-key]"),
  ).toHaveCount(0);
});

test("category and published article routes expose useful editorial content", async ({
  page,
}) => {
  let response = await page.goto("/categories/ai-automation/");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "AI & Automation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "How to identify business tasks for automation",
    }),
  ).toHaveAttribute("href", `/articles/${articleSlug}/`);

  response = await page.goto(`/articles/${articleSlug}/`);

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "How to identify business tasks for automation",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Everyday Tech Insight", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/published august 21, 2026/i)).toBeVisible();
  await expect(page.getByText(/reviewed august 21, 2026/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "At a glance" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Sources" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /request a correction/i }),
  ).toHaveAttribute("href", "/corrections/");
});

test("a substantively revised article exposes its distinct modification date", async ({
  page,
}) => {
  const response = await page.goto(
    "/articles/back-up-business-files-with-the-3-2-1-method/",
  );

  expect(response?.status()).toBe(200);
  await expect(
    page.locator('meta[property="article:published_time"]'),
  ).toHaveAttribute("content", "2026-08-21");
  await expect(
    page.locator('meta[property="article:modified_time"]'),
  ).toHaveAttribute("content", "2026-08-22");
  await expect(page.getByText(/updated august 22, 2026/i)).toBeVisible();
  await expect(page.getByText(/reviewed august 22, 2026/i)).toBeVisible();
});

test("a three-guide category uses the compact branch with complete membership and no lead card", async ({
  page,
}) => {
  const articleRecords = (await readArticleRecords()) as ArticleSourceRecord[];
  const expectedArticleHrefs = articleRecords
    .filter(
      ({ data }) =>
        data.status === "published" && data.category === "ai-automation",
    )
    .sort(
      (left, right) =>
        Number(right.data.featured) - Number(left.data.featured) ||
        right.data.datePublished.localeCompare(left.data.datePublished) ||
        left.data.title.localeCompare(right.data.title, "en"),
    )
    .map(({ data }) => `/articles/${data.slug}/`);

  await page.goto("/categories/ai-automation/");

  const hero = page.locator('.category-hero[data-category="ai-automation"]');
  await expect(hero).toBeVisible();
  await expect(hero.locator("[data-editorial-visual]")).toBeVisible();
  await expect(
    hero.locator(".category-hero__visual svg.editorial-visual"),
  ).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
  const categoryAccent = await hero.evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--category-accent").trim(),
  );
  expect(categoryAccent).not.toBe("");
  expect(
    await page.evaluate(
      (color) => CSS.supports("color", color),
      categoryAccent,
    ),
  ).toBe(true);
  await expect(page.locator(".category-page")).toHaveAttribute(
    "data-layout",
    "compact",
  );
  await expect(hero.locator(".category-hero__lead")).toHaveCount(0);
  await expect(page.locator(".article-card--lead")).toHaveCount(0);
  await expect(page.locator(".article-card--feature")).toHaveCount(0);
  await expect(
    page.locator(".category-compact .article-card--compact"),
  ).toHaveCount(3);

  const articleHrefs = await page
    .locator('main a[href^="/articles/"]')
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute("href"))
        .filter((href): href is string => href !== null),
    );
  expect(articleHrefs).toEqual(expectedArticleHrefs);
  expect(new Set(articleHrefs).size).toBe(articleHrefs.length);
  for (const launchHref of launchAiArticleHrefs) {
    expect(articleHrefs).toContain(launchHref);
  }

  const storyCards = page.locator(".category-compact .article-card--compact");
  await expect(storyCards).toHaveCount(expectedArticleHrefs.length);
  for (let index = 0; index < expectedArticleHrefs.length; index += 1) {
    const storyMeta = storyCards
      .nth(index)
      .getByRole("list", { name: "Story details" });
    await expect(storyMeta).toBeVisible();
    await expect(storyMeta.locator("time[datetime]")).toHaveCount(1);
    await expect(storyMeta).toContainText(/\b\d+ min read\b/);
    await expect(storyMeta).toContainText(
      /Guide|Framework|Checklist|Comparison/,
    );
    await expect(
      storyMeta.getByRole("link", { name: "AI & Automation" }),
    ).toHaveAttribute("href", "/categories/ai-automation/");
  }
});

test("category routes use one visual anchor and distinct guide links", async ({
  page,
}) => {
  for (const category of categories) {
    await page.goto(`/categories/${category.slug}/`);

    await expect(page.locator("main [data-editorial-visual]")).toHaveCount(1);
    const categoryPage = page.locator(".category-page");
    await expect(categoryPage).toHaveAttribute("data-guide-count", /^\d+$/);
    const sourceGuideCount = Number(
      await categoryPage.getAttribute("data-guide-count"),
    );

    const articleHrefs = await page
      .locator('main a[href^="/articles/"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href"))
          .filter((href): href is string => href !== null),
      );

    expect(sourceGuideCount, category.slug).toBeGreaterThanOrEqual(3);
    expect(articleHrefs.length, category.slug).toBe(sourceGuideCount);
    expect(new Set(articleHrefs).size, category.slug).toBe(sourceGuideCount);
  }
});

test("article exposes editorial art, semantic story metadata, and explicit related guides", async ({
  page,
}) => {
  await page.goto(`/articles/${articleSlug}/`);

  const article = page.locator("article.article-page");
  const hero = article.locator(".article-hero");
  await expect(hero.locator("[data-editorial-visual]")).toBeVisible();
  await expect(hero.locator("svg.editorial-visual")).toHaveAttribute(
    "preserveAspectRatio",
    "xMidYMid slice",
  );
  const informativeVisual = hero.locator(
    'figure[data-visual-key="automation-candidate-screen"][data-visual-type="decision-tree"]',
  );
  await expect(informativeVisual).toBeVisible();
  const visualSvg = informativeVisual.getByRole("img", {
    name: "A task funnel that rejects unstable or high-risk work before a bounded pilot.",
  });
  await expect(visualSvg).toHaveAttribute(
    "aria-labelledby",
    "editorial-visual-automation-candidate-screen-title editorial-visual-automation-candidate-screen-description",
  );
  await expect(
    informativeVisual.locator(
      "#editorial-visual-automation-candidate-screen-title",
    ),
  ).toHaveText(/task funnel/i);
  await expect(
    informativeVisual.locator(
      "#editorial-visual-automation-candidate-screen-description",
    ),
  ).not.toBeEmpty();
  await expect(
    informativeVisual.locator('use[href="#automation-candidate-screen"]'),
  ).toHaveCount(1);
  await expect(informativeVisual.locator("figcaption")).toHaveText(
    "Screen repeatability, exceptions, consequences, review, and fallback before piloting.",
  );

  const storyMeta = hero.getByRole("list", { name: "Story details" });
  await expect(storyMeta).toContainText("Framework");
  await expect(storyMeta).toContainText(/\b\d+ min read\b/);
  await expect(storyMeta.locator('time[datetime="2026-08-21"]')).toHaveCount(1);
  await expect(
    storyMeta.getByRole("link", { name: "AI & Automation" }),
  ).toHaveAttribute("href", "/categories/ai-automation/");

  await expect(
    article.getByRole("heading", {
      level: 2,
      name: "At a glance",
    }),
  ).toBeVisible();
  await expect(article.getByRole("region", { name: "Sources" })).toBeVisible();
  await expect(
    article.getByRole("region", { name: "About the publication byline" }),
  ).toContainText(
    /publication-name byline.*not.*identified person.*legal organization.*never represents a person/i,
  );

  const relatedGuides = article.locator("section.related-articles");
  await expect(
    relatedGuides.getByRole("link", {
      name: "How to evaluate AI output quality in a small-team pilot",
    }),
  ).toHaveAttribute(
    "href",
    "/articles/evaluate-ai-output-quality-in-a-small-team-pilot/",
  );
  await expect(
    relatedGuides.getByRole("link", {
      name: "Document a repetitive workflow before automating it",
    }),
  ).toHaveAttribute(
    "href",
    "/articles/document-a-repetitive-workflow-before-automating/",
  );
});

test("every published guide renders its assigned informative visual and local symbol", async ({
  page,
}) => {
  const articleRecords = (await readArticleRecords()) as ArticleSourceRecord[];
  const publishedArticles = articleRecords.filter(
    ({ data }) => data.status === "published",
  );
  const keys = new Set<string>();

  expect(publishedArticles).toHaveLength(15);

  for (const { data } of publishedArticles) {
    const response = await page.goto(`/articles/${data.slug}/`);
    expect(response?.status(), data.slug).toBe(200);

    const visual = page.locator(
      `figure[data-visual-key="${data.visual.key}"][data-visual-type="${data.visual.type}"]`,
    );
    await expect(visual, data.slug).toHaveCount(1);
    await expect(visual, data.slug).toBeVisible();

    const titleId = `editorial-visual-${data.visual.key}-title`;
    const descriptionId = `editorial-visual-${data.visual.key}-description`;
    const svg = visual.getByRole("img", { name: data.visual.alt });
    await expect(svg, data.slug).toHaveAttribute(
      "aria-labelledby",
      `${titleId} ${descriptionId}`,
    );
    await expect(visual.locator(`#${titleId}`), data.slug).toHaveCount(1);
    await expect(visual.locator(`#${titleId}`), data.slug).not.toBeEmpty();
    await expect(visual.locator(`#${descriptionId}`), data.slug).toHaveCount(1);
    await expect(
      visual.locator(`#${descriptionId}`),
      data.slug,
    ).not.toBeEmpty();
    await expect(
      visual.locator(`use[href="#${data.visual.key}"]`),
      data.slug,
    ).toHaveCount(1);
    await expect(
      page.locator(`symbol#${data.visual.key}`),
      data.slug,
    ).toHaveCount(1);
    await expect(page.locator("body > svg > symbol"), data.slug).toHaveCount(1);

    if (data.visual.caption) {
      await expect(visual.locator("figcaption"), data.slug).toHaveText(
        data.visual.caption,
      );
    } else {
      await expect(visual.locator("figcaption"), data.slug).toHaveCount(0);
    }

    keys.add(data.visual.key);
  }

  expect(keys.size).toBe(15);
});

test("article surfaces its evidence boundary near the headline", async ({
  page,
}) => {
  await page.goto(`/articles/${articleSlug}/`);

  const hero = page.locator(".article-hero");
  const evidence = page.getByRole("region", { name: "Article evidence" });
  await expect(evidence).toBeVisible();
  await expect(evidence).toContainText("3 cited sources");
  await expect(evidence.locator('time[datetime="2026-08-21"]')).toHaveText(
    "August 21, 2026",
  );
  await expect(
    evidence.getByRole("link", { name: "Editorial standards" }),
  ).toHaveAttribute("href", "/editorial-standards/");
  await expect(
    evidence.getByRole("link", { name: "Corrections" }),
  ).toHaveAttribute("href", "/corrections/");

  const heroBox = await hero.boundingBox();
  const evidenceBox = await evidence.boundingBox();
  expect(heroBox).not.toBeNull();
  expect(evidenceBox).not.toBeNull();
  expect(evidenceBox!.y).toBeGreaterThanOrEqual(heroBox!.y);
  expect(evidenceBox!.y).toBeLessThanOrEqual(heroBox!.y + heroBox!.height + 1);
});

test("article emits one semantic fit summary in the raw DOM", async ({
  page,
}) => {
  await page.goto(`/articles/${articleSlug}/`);

  const article = page.locator("article.article-page");
  const fitSummary = article.locator("section.fit-summary");
  await expect(fitSummary).toHaveCount(1);
  await expect(
    article.locator(".fit-summary--desktop, .fit-summary--mobile"),
  ).toHaveCount(0);
  await expect(fitSummary).toHaveAttribute("aria-labelledby", "fit-heading");
  await expect(fitSummary.locator("#fit-heading")).toHaveText("At a glance");
  await expect(fitSummary.locator("dl")).toHaveCount(1);
  await expect(fitSummary.locator("dt")).toHaveCount(4);
  await expect(fitSummary.locator("dd")).toHaveCount(4);
  await expect(page.getByText("At a glance", { exact: true })).toHaveCount(1);
});

test("article emits one table of contents with one link per body heading ID", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/articles/${articleSlug}/`);

  const tableOfContents = page.getByRole("navigation", {
    name: "On this page",
  });
  await expect(tableOfContents).toHaveCount(1);
  await expect(tableOfContents).toBeVisible();
  await expect(
    page.locator(".table-of-contents__desktop, .table-of-contents__mobile"),
  ).toHaveCount(0);
  await expect(page.getByText("On this page", { exact: true })).toHaveCount(1);

  const headingHrefs = await tableOfContents
    .locator('a[href^="#"]')
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute("href"))
        .filter((href): href is string => Boolean(href && href.length > 1)),
    );
  expect(headingHrefs.length).toBeGreaterThan(1);
  expect(new Set(headingHrefs).size).toBe(headingHrefs.length);

  const bodyHeadingIds = await page
    .locator(".article-body :is(h2, h3, h4, h5, h6)[id]")
    .evaluateAll((headings) => headings.map((heading) => heading.id));
  expect(
    headingHrefs.map((href) => decodeURIComponent(href.slice(1))).sort(),
  ).toEqual([...bodyHeadingIds].sort());
  for (const href of headingHrefs) {
    expect(bodyHeadingIds).toContain(decodeURIComponent(href.slice(1)));
    await expect(
      page.locator(`[id="${decodeURIComponent(href.slice(1))}"]`),
    ).toHaveCount(1);
  }
});

test("publication byline links to its truthful profile and published article index", async ({
  page,
}) => {
  await page.goto(`/articles/${articleSlug}/`);

  const article = page.locator("article.article-page");
  const publicationDetails = article.locator(".article-facts");
  await expect(publicationDetails).not.toHaveAttribute("aria-label");
  await expect(
    publicationDetails.getByRole("link", {
      name: "Everyday Tech Insight",
      exact: true,
    }),
  ).toHaveAttribute("href", "/publisher/");

  const bylineBox = article.getByRole("region", {
    name: "About the publication byline",
  });
  await expect(bylineBox).toContainText(
    /publication-name byline.*not.*identified person.*legal organization.*never represents a person/i,
  );
  await expect(
    bylineBox.getByRole("link", { name: "Contact" }),
  ).toHaveAttribute("href", "/contact/");
  await expect(
    bylineBox.getByRole("link", { name: "Corrections" }),
  ).toHaveAttribute("href", "/corrections/");

  await page.goto("/publisher/");
  await expect(
    page.getByRole("heading", { level: 2, name: "Published articles" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "How to identify business tasks for automation",
    }),
  ).toHaveAttribute("href", `/articles/${articleSlug}/`);
});

test("publisher intro foregrounds its audience and practical guides", async ({
  page,
}) => {
  await page.goto("/publisher/");

  await expect(page).toHaveTitle(
    "Publisher and practical guides | Everyday Tech Insight",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /small-business decision makers.*published practical technology guides/i,
  );
  const intro = page.locator(".trust-page__intro");
  await expect(intro.locator(".eyebrow")).toHaveText(
    "Publication purpose and guides",
  );
  await expect(intro.locator(".page-deck")).toContainText(
    "publishes practical guides for small-business decision makers",
  );
  await expect(page.locator(".publisher-purpose")).toContainText(
    "practical technology decisions",
  );
});

test("publisher lists published work before its identity boundary", async ({
  page,
}) => {
  await page.goto("/publisher/");

  const published = page.locator(
    'section[aria-labelledby="published-articles-heading"]',
  );
  const identity = page.locator(
    'section[aria-labelledby="publisher-identity-boundary-heading"]',
  );
  await expect(published).toHaveCount(1);
  await expect(identity).toHaveCount(1);
  await expect(
    identity.locator("#publisher-identity-boundary-heading"),
  ).toHaveText("Publication identity boundary");

  const publishedPrecedesIdentity = await published.evaluate(
    (publishedSection, identitySelector) => {
      const identitySection = document.querySelector(identitySelector);
      return Boolean(
        identitySection &&
        publishedSection.compareDocumentPosition(identitySection) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      );
    },
    'section[aria-labelledby="publisher-identity-boundary-heading"]',
  );
  expect(publishedPrecedesIdentity).toBe(true);
});

test("trust pages are reachable and state the public evidence boundary", async ({
  page,
}) => {
  for (const trustPage of trustPages) {
    const response = await page.goto(trustPage.path);

    expect(response?.status(), trustPage.path).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: trustPage.heading }),
    ).toBeVisible();
    const shell = page.locator("main .trust-page");
    await expect(shell, trustPage.path).toHaveCount(1);
    await expect(
      shell.locator(":scope > .trust-page__intro"),
      trustPage.path,
    ).toHaveCount(1);
    const related = shell.getByRole("navigation", {
      name: "Related publication pages",
    });
    await expect(related, trustPage.path).toHaveCount(1);
    await expect(related.locator("a"), trustPage.path).toHaveCount(
      trustPages.length,
    );
  }

  await page.goto("/publisher/");
  await expect(
    page.getByText(/publication name, not a legal entity/i),
  ).toBeVisible();
  await expect(page.getByText(/does not claim.*credentials/i)).toBeVisible();

  await page.goto("/privacy/");
  await expect(
    page.getByText(/does not set cookies.*local storage/i),
  ).toBeVisible();
  await expect(page.getByText(/no analytics or advertising/i)).toBeVisible();

  await page.goto("/advertising-disclosure/");
  await expect(
    page.getByText(/does not currently run advertising/i),
  ).toBeVisible();
  await expect(
    page.getByText(/affiliate|sponsored compensation/i),
  ).toBeVisible();

  await page.goto("/editorial-standards/");
  await expect(
    page.getByText(/software comparisons use stated criteria/i),
  ).toBeVisible();
  await expect(
    page.getByText(/do not purchase favorable conclusions/i),
  ).toBeVisible();
  await expect(
    page.getByText(/AI tools assisted this initial project/i),
  ).toBeVisible();
  await expect(page.getByText(/human or expert review/i)).toBeVisible();

  await page.goto("/contact/");
  await expect(page.locator(".trust-page > p").first()).toContainText(
    "corrections process first.",
  );

  await page.goto("/corrections/");
  await expect(page.getByText(/does not silently backdate/i)).toBeVisible();
  await expect(page.getByText(/minor typographical/i)).toBeVisible();
  await expect(
    page.getByText(/may not receive a formal update note/i),
  ).toBeVisible();
  await expect(page.getByText(/transparent correction note/i)).toBeVisible();
});

test("markdown tables render once inside a named keyboard region", async ({
  page,
}) => {
  await page.goto(`/articles/${articleSlug}/`);

  const table = page.locator("article.article-page table");
  const region = page.getByRole("region", { name: "Scrollable data table" });
  await expect(table).toHaveCount(1);
  await expect(region).toHaveCount(1);
  await expect(region).toHaveAttribute("data-horizontal-scroll", "");
  await expect(region).toHaveAttribute("tabindex", "0");
  await expect(region.locator(":scope > table")).toHaveCount(1);
  await expect(region.locator(".table-scroll")).toHaveCount(0);
});

test("every public HTML route has one H1 and unique core metadata", async ({
  page,
}) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();

  for (const route of htmlRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("h1"), route).toHaveCount(1);
    const duplicateIds = await page.locator("[id]").evaluateAll((elements) => {
      const counts = new Map<string, number>();
      for (const element of elements) {
        counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
      }
      return [...counts]
        .filter(([, count]) => count > 1)
        .map(([id]) => id)
        .sort();
    });
    expect(duplicateIds, `${route} duplicate IDs`).toEqual([]);

    const title = await page.title();
    const description =
      (await page
        .locator('meta[name="description"]')
        .getAttribute("content")) ?? "";
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");

    expect(title.length, route).toBeGreaterThan(10);
    expect(description.length, route).toBeGreaterThan(40);
    expect(canonical, route).toBe(absoluteSiteUrl(route));
    await expect(page.locator('meta[name="robots"]'), route).toHaveAttribute(
      "content",
      "index,follow",
    );
    await expect(
      page.locator('meta[property="og:type"]'),
      route,
    ).toHaveAttribute(
      "content",
      route.startsWith("/articles/") && route !== "/articles/"
        ? "article"
        : "website",
    );
    await expect(
      page.locator('meta[property="og:title"]'),
      route,
    ).toHaveAttribute("content", title);
    await expect(
      page.locator('meta[property="og:description"]'),
      route,
    ).toHaveAttribute("content", description);
    await expect(
      page.locator('meta[property="og:url"]'),
      route,
    ).toHaveAttribute("content", absoluteSiteUrl(route));
    await expect(
      page.locator('meta[property="og:site_name"]'),
      route,
    ).toHaveAttribute("content", siteConfig.name);
    await expect(
      page.locator('meta[property="og:locale"]'),
      route,
    ).toHaveAttribute("content", "en_US");
    await expect(
      page.locator('meta[name="twitter:card"]'),
      route,
    ).toHaveAttribute("content", "summary_large_image");
    await expect(
      page.locator('meta[name="twitter:title"]'),
      route,
    ).toHaveAttribute("content", title);
    await expect(
      page.locator('meta[name="twitter:description"]'),
      route,
    ).toHaveAttribute("content", description);
    await expect(
      page.locator('link[rel="alternate"][type="application/rss+xml"]'),
      route,
    ).toHaveAttribute("href", absoluteSiteUrl("/rss.xml"));
    const socialImagePath =
      route.startsWith("/articles/") && route !== "/articles/"
        ? `/social/article-${route.split("/")[2]}.png`
        : route.startsWith("/categories/") && route !== "/categories/"
          ? `/social/category-${route.split("/")[2]}.png`
          : "/social/default.png";
    const socialImageUrl = absoluteSiteUrl(socialImagePath);
    await expect(
      page.locator('meta[property="og:image"]'),
      route,
    ).toHaveAttribute("content", socialImageUrl);
    await expect(
      page.locator('meta[property="og:image:width"]'),
      route,
    ).toHaveAttribute("content", "1200");
    await expect(
      page.locator('meta[property="og:image:height"]'),
      route,
    ).toHaveAttribute("content", "630");
    await expect(
      page.locator('meta[property="og:image:type"]'),
      route,
    ).toHaveAttribute("content", "image/png");
    await expect(
      page.locator('meta[property="og:image:alt"]'),
      route,
    ).toHaveAttribute("content", /\S/);
    await expect(
      page.locator('meta[name="twitter:image"]'),
      route,
    ).toHaveAttribute("content", socialImageUrl);
    await expect(
      page.locator('meta[name="twitter:image:alt"]'),
      route,
    ).toHaveAttribute("content", /\S/);
    await expect(page.locator('link[rel="manifest"]'), route).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
    await expect(
      page.locator('link[rel="apple-touch-icon"]'),
      route,
    ).toHaveAttribute("href", "/apple-touch-icon.png");

    if (route.startsWith("/articles/") && route !== "/articles/") {
      await expect(
        page.locator('meta[property="article:published_time"]'),
        route,
      ).toHaveAttribute("content", "2026-08-21");
      await expect(
        page.locator('meta[property="article:section"]'),
        route,
      ).toHaveAttribute("content", "AI & Automation");
      await expect(
        page.locator('meta[property="article:modified_time"]'),
        route,
      ).toHaveCount(0);
    } else {
      await expect(
        page.locator('meta[property^="article:"]'),
        route,
      ).toHaveCount(0);
    }

    expect(titles.has(title), `duplicate title: ${title}`).toBe(false);
    expect(
      descriptions.has(description),
      `duplicate description: ${description}`,
    ).toBe(false);
    titles.add(title);
    descriptions.add(description);
  }
});

test("breadcrumbs are visible and match BreadcrumbList structured data", async ({
  page,
}) => {
  await page.goto(`/articles/${articleSlug}/`);

  const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumbs.getByRole("link", { name: "Home" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    breadcrumbs.getByRole("link", { name: "AI & Automation" }),
  ).toHaveAttribute("href", "/categories/ai-automation/");

  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(
    structuredData.some((value) => value.includes('"BreadcrumbList"')),
  ).toBe(true);
  expect(
    structuredData.some((value) => /"(Person|Organization)"/.test(value)),
  ).toBe(false);
});

test("home alone exposes WebSite structured data without entity claims", async ({
  page,
}) => {
  await page.goto("/");
  const homeData = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();

  expect(homeData.some((value) => value.includes('"WebSite"'))).toBe(true);
  expect(homeData.some((value) => /"(Person|Organization)"/.test(value))).toBe(
    false,
  );

  await page.goto("/about/");
  const aboutData = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(aboutData.some((value) => value.includes('"WebSite"'))).toBe(false);
});

test("unknown paths return the custom 404 response", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist/");

  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,follow",
  );
  await expect(
    page.getByRole("link", { name: /return home/i }),
  ).toHaveAttribute("href", "/");
  const shell = page.locator("main .trust-page");
  await expect(shell).toHaveCount(1);
  await expect(shell.locator(":scope > .trust-page__intro")).toHaveCount(1);
  await expect(
    shell.getByRole("navigation", { name: "Related publication pages" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toHaveCount(0);
});

test("RSS includes exact published article destinations and robots stays public", async ({
  request,
}) => {
  const rss = await request.get("/rss.xml");
  const rssBody = await rss.text();

  expect(rss.status()).toBe(200);
  expect(rss.headers()["content-type"]).toContain("xml");
  expect(rssBody).toContain("How to identify business tasks for automation");
  expect(rssBody).toContain(`/articles/${articleSlug}/`);

  const robots = await request.get("/robots.txt");
  const robotsBody = await robots.text();

  expect(robots.status()).toBe(200);
  expect(robotsBody).toContain("User-agent: *");
  expect(robotsBody).toContain("Allow: /");
  expect(robotsBody).toContain(
    `Sitemap: ${absoluteSiteUrl("/sitemap-index.xml")}`,
  );
  expect(robotsBody).not.toContain("Disallow: /");
});

test("rendered pages contain no advertising, analytics, or executable client scripts", async ({
  page,
}) => {
  for (const route of ["/", `/articles/${articleSlug}/`]) {
    await page.goto(route);
    const html = await page.content();

    expect(html, route).not.toMatch(
      /googlesyndication|doubleclick|google-analytics|googletagmanager|gtag\s*\(|dataLayer|adsbygoogle|(?:ca-)?pub-\d{10,}|UA-\d+-\d+|GTM-[A-Z0-9]+/i,
    );
    await expect(page.locator("script[src]"), route).toHaveCount(0);
    await expect(
      page.locator('script:not([type="application/ld+json"])'),
      route,
    ).toHaveCount(0);
  }
});

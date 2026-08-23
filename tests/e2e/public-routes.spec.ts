import { expect, test } from "@playwright/test";
import { load } from "cheerio";

import { readArticleRecords } from "../../scripts/qa-content.mjs";
import { siteConfig, siteUrl } from "../../site.config.mjs";
import {
  homepageMoreGuidesLimit,
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

interface ArticleSourceRecord {
  data: {
    status: string;
    category: string;
    slug: string;
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
  "/toolkit/",
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

test("toolkit publishes four practical worksheets with local CSV downloads", async ({
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
  await expect(page.locator(".toolkit-resource")).toHaveCount(4);
  await expect(
    page.getByText(/never put passwords, tokens, recovery keys/i),
  ).toBeVisible();

  const downloadHrefs = await page
    .locator(".toolkit-resource a[download]")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")).filter(Boolean),
    );
  expect(downloadHrefs).toHaveLength(4);
  expect(new Set(downloadHrefs).size).toBe(4);

  const downloadNames = await page
    .locator(".toolkit-resource a[download]")
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

  await page.setViewportSize({ width: 600, height: 900 });
  const firstResource = page.locator(".toolkit-resource").first();
  const firstTableRegion = firstResource.locator(".table-scroll");
  const tableWidths = await firstTableRegion.evaluate((region) => ({
    client: region.clientWidth,
    scroll: region.scrollWidth,
  }));
  expect(tableWidths.scroll).toBeGreaterThan(tableWidths.client);
  await expect(
    firstResource.locator(".toolkit-resource__scroll-hint"),
  ).toBeVisible();
});

test("home is a de-duplicated issue front page", async ({ page, request }) => {
  await page.goto("/");

  const articleLinks = page.locator('main a[href^="/articles/"]');
  const articleHrefs = await articleLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );

  const rssResponse = await request.get("/rss.xml");
  expect(rssResponse.status()).toBe(200);
  const rss = load(await rssResponse.text(), { xmlMode: true });
  const publishedArticleHrefs = rss("item > link")
    .map((_, link) => new URL(rss(link).text()).pathname)
    .get();
  const curatedArticleCount = Object.values(homepageSectionSizes).reduce(
    (total, sectionSize) => total + sectionSize,
    0,
  );

  expect(publishedArticleHrefs.length).toBeGreaterThanOrEqual(
    curatedArticleCount,
  );
  expect(new Set(publishedArticleHrefs).size).toBe(
    publishedArticleHrefs.length,
  );
  const expectedMoreGuidesCount = Math.min(
    homepageMoreGuidesLimit,
    publishedArticleHrefs.length - curatedArticleCount,
  );
  expect(articleHrefs).toHaveLength(
    curatedArticleCount + expectedMoreGuidesCount,
  );
  expect(new Set(articleHrefs).size).toBe(articleHrefs.length);
  expect(
    articleHrefs.every((href) => publishedArticleHrefs.includes(href ?? "")),
  ).toBe(true);

  const currentIssue = page.getByRole("region", { name: "Current issue" });
  const latestBriefing = page.getByRole("region", {
    name: "Latest briefing",
  });
  const startHere = page.getByRole("region", { name: "Start here" });
  const moreGuides = page.getByRole("region", {
    name: "More guides",
  });

  await expect(currentIssue).toBeVisible();
  await expect(
    currentIssue.locator(".front-page__lead .article-card--lead"),
  ).toHaveCount(homepageSectionSizes.lead);
  await expect(
    currentIssue.locator(".front-page__support .article-card--feature"),
  ).toHaveCount(homepageSectionSizes.features);
  await expect(latestBriefing).toBeVisible();
  await expect(latestBriefing.locator(".article-card--list")).toHaveCount(
    homepageSectionSizes.briefing,
  );
  await expect(startHere).toBeVisible();
  await expect(startHere.locator(".article-card--list")).toHaveCount(
    homepageSectionSizes.startHere,
  );
  await expect(moreGuides).toBeVisible();
  await expect(moreGuides.locator(".article-card--list")).toHaveCount(
    expectedMoreGuidesCount,
  );
  await expect(
    moreGuides.getByRole("link", { name: "View all guides" }),
  ).toHaveAttribute("href", "/sitemap/");

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
    startHere.getByRole("link", {
      name: "How to back up business files with the 3-2-1 method",
    }),
  ).toHaveAttribute(
    "href",
    "/articles/back-up-business-files-with-the-3-2-1-method/",
  );

  const evidence = page.locator("header.home-opening + .publication-evidence");
  await expect(evidence).toHaveCount(1);
  await expect(evidence).toContainText(/source-led guidance/i);
  await expect(evidence).toContainText(/corrections/i);
  await expect(evidence).toContainText(/commercial status/i);
  await expect(evidence).toContainText(/publication-name byline/i);
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
    "publication-evidence-heading",
  );
  await expect(
    page.getByRole("region", {
      name: "Publication evidence",
    }),
  ).toBeVisible();
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

  for (const reference of symbolReferences) {
    await expect(page.locator(`symbol${reference}`)).toHaveCount(1);
  }
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
    page.getByRole("heading", { level: 2, name: "Business technology fit" }),
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

test("AI category has a lead, supporting features, complete membership, and story metadata", async ({
  page,
}) => {
  const articleRecords = (await readArticleRecords()) as ArticleSourceRecord[];
  const expectedArticleHrefs = articleRecords
    .filter(
      ({ data }) =>
        data.status === "published" && data.category === "ai-automation",
    )
    .map(({ data }) => `/articles/${data.slug}/`)
    .sort();

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
  await expect(page.locator(".article-card--lead")).toHaveCount(1);
  await expect(page.locator(".article-card--feature")).toHaveCount(2);

  const articleHrefs = await page
    .locator('main a[href^="/articles/"]')
    .evaluateAll((links) =>
      Array.from(
        new Set(
          links
            .map((link) => link.getAttribute("href"))
            .filter((href): href is string => href !== null),
        ),
      ).sort(),
    );
  expect(articleHrefs).toEqual(expectedArticleHrefs);
  for (const launchHref of launchAiArticleHrefs) {
    expect(articleHrefs).toContain(launchHref);
  }

  const storyCards = page.locator(
    ".article-card--lead, .article-card--feature, .article-card--list",
  );
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
      name: "Business technology fit",
    }),
  ).toBeVisible();
  await expect(article.getByRole("region", { name: "Sources" })).toBeVisible();
  await expect(
    article.getByRole("region", { name: "About the publication byline" }),
  ).toContainText(/publication-name byline.*not.*named person/i);

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

test("article table of contents links only to real body heading IDs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/articles/${articleSlug}/`);

  const tableOfContents = page.getByRole("navigation", {
    name: "On this page",
  });
  await expect(tableOfContents).toBeVisible();

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
  for (const href of headingHrefs) {
    expect(bodyHeadingIds).toContain(decodeURIComponent(href.slice(1)));
  }
});

test("publication byline links to its truthful profile and published article index", async ({
  page,
}) => {
  await page.goto(`/articles/${articleSlug}/`);

  const article = page.locator("article.article-page");
  const publicationDetails = article.getByLabel("Publication details");
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
    /publication-name byline.*not.*named person/i,
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

test("trust pages are reachable and state the public evidence boundary", async ({
  page,
}) => {
  for (const trustPage of trustPages) {
    const response = await page.goto(trustPage.path);

    expect(response?.status(), trustPage.path).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: trustPage.heading }),
    ).toBeVisible();
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
      route.startsWith("/articles/") ? "article" : "website",
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
    ).toHaveAttribute("content", "summary");
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
    await expect(page.locator('meta[property="og:image"]'), route).toHaveCount(
      0,
    );

    if (route.startsWith("/articles/")) {
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

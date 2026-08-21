import { expect, test } from "@playwright/test";

const siteUrl = "https://everyday-tech-insight.vercel.app";
const articleSlug = "how-to-identify-business-tasks-for-automation";

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
  await expect(page.getByText(/small-business decision makers/i)).toBeVisible();
  await expect(
    page.getByText(/business needs and technology decisions/i),
  ).toBeVisible();

  for (const category of categories) {
    await expect(
      page.getByRole("link", { name: category.name, exact: true }).first(),
    ).toHaveAttribute("href", `/categories/${category.slug}/`);
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
    expect(canonical, route).toBe(`${siteUrl}${route}`);
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
    ).toHaveAttribute("content", `${siteUrl}${route}`);
    await expect(page.locator('meta[property="og:image"]'), route).toHaveCount(
      0,
    );

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

test("RSS and robots expose only configured public destinations", async ({
  request,
}) => {
  const rss = await request.get("/rss.xml");
  const rssBody = await rss.text();

  expect(rss.status()).toBe(200);
  expect(rss.headers()["content-type"]).toContain("xml");
  expect(rssBody).toContain("How to identify business tasks for automation");
  expect(rssBody).toContain(`/articles/${articleSlug}/`);
  expect(rssBody).not.toMatch(/\b(?:draft|review)\b/i);

  const robots = await request.get("/robots.txt");
  const robotsBody = await robots.text();

  expect(robots.status()).toBe(200);
  expect(robotsBody).toContain("User-agent: *");
  expect(robotsBody).toContain("Allow: /");
  expect(robotsBody).toContain(
    "Sitemap: https://everyday-tech-insight.vercel.app/sitemap-index.xml",
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

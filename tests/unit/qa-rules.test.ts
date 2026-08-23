import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";

import astroConfig from "../../astro.config.mjs";
import { validateBuiltOutput } from "../../scripts/qa-build.mjs";
import { validateContentPortfolio } from "../../scripts/qa-content.mjs";
import {
  checkExternalUrls,
  checkUrl,
  collectExternalHttpsUrlsFromHtmlFiles,
  createPinnedLookup,
  isUnsafeNetworkAddress,
} from "../../scripts/check-external-links.mjs";
import {
  aggregateLighthouseScores,
  createLighthouseSummary,
  evaluateLighthouseCategories,
  installSignalCleanup,
  launchChromeSafely,
  prepareLighthouseReportRun,
  publishLighthouseReportRun,
  removeDirectoryWithRetries,
  stopChrome,
  withSignalCleanupInstalled,
} from "../../scripts/run-lighthouse.mjs";
import { siteConfig, siteUrl } from "../../site.config.mjs";
import { site } from "../../src/data/site";

const categorySlugs = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
] as const;

describe("canonical site configuration", () => {
  it("drives both Astro and runtime metadata from one origin", () => {
    expect(site.url).toBe(siteUrl);
    expect(siteConfig.url).toBe(siteUrl);
    expect(String(astroConfig.site)).toBe(siteUrl);
  });
});

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

function validBody(slug: string, sources: string[]): string {
  return [
    "## Direct answer",
    `${words(170)} limitation`,
    "## Practical steps",
    words(170),
    "## Decision checks",
    words(170),
    "## Limits and sources",
    words(170),
    ...sources.map((source) => `[Official source](${source})`),
    `This guidance is not a guarantee for ${slug}.`,
  ].join("\n\n");
}

function validArticle(
  slug: string,
  category: (typeof categorySlugs)[number],
  index: number,
) {
  const sources = [
    `https://www.nist.gov/example/${slug}/one`,
    `https://www.cisa.gov/example/${slug}/two`,
  ];

  return {
    fileName: `${slug}.md`,
    data: {
      title: `Practical technology decision guide number ${index}`,
      description: `A distinct practical description for business technology decision ${index} with enough detail for readers.`,
      slug,
      category,
      author: "Everyday Tech Insight",
      status: "published",
      contentType: "guide",
      businessProblem: `A specific business problem that needs a careful decision ${index}.`,
      technologyFocus: `A specific technology capability relevant to the decision ${index}.`,
      intendedAudience: `Small-business decision makers responsible for choice ${index}.`,
      readerOutcome: `A concrete next step the reader can complete after guide ${index}.`,
      verificationStatus: "source-checked",
      datePublished: "2026-08-21",
      dateModified: undefined as string | undefined,
      lastReviewed: "2026-08-21",
      featured: index === 1,
      summary: `A useful summary of the decision and the practical result for guide ${index}.`,
      sourceList: sources.map((url, sourceIndex) => ({
        title: `Official source ${sourceIndex + 1} for guide ${index}`,
        url,
        publisher: sourceIndex === 0 ? "NIST" : "CISA",
        accessed: "2026-08-21",
      })),
      relatedArticles: [],
      noindex: false,
    },
    body: validBody(slug, sources),
  };
}

function validPortfolio() {
  return categorySlugs.flatMap((category, categoryIndex) =>
    Array.from({ length: 3 }, (_, articleIndex) => {
      const index = categoryIndex * 3 + articleIndex + 1;
      return validArticle(
        `${category}-guide-${articleIndex + 1}`,
        category,
        index,
      );
    }),
  );
}

function htmlDocument(options: {
  route: string;
  title: string;
  description: string;
  body: string;
  robots?: string;
  ogType?: "website" | "article";
  jsonLd?: Record<string, unknown>;
}) {
  const canonical = new URL(options.route, siteUrl).toString();
  return `<!doctype html>
<html lang="en-US"><head>
<title>${options.title}</title>
<meta name="description" content="${options.description}">
<meta name="robots" content="${options.robots ?? "index,follow"}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${options.ogType ?? "website"}">
<meta property="og:title" content="${options.title}">
<meta property="og:description" content="${options.description}">
<meta property="og:url" content="${canonical}">
<link rel="icon" href="/favicon.svg">
${
  options.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(options.jsonLd)}</script>`
    : ""
}
</head><body><header><a class="site-name" href="/">Everyday Tech Insight</a></header><main><h1>${options.title}</h1>${options.body}</main></body></html>`;
}

function validBuiltFixture() {
  const articles = validPortfolio();
  const articleRoutes = articles.map(({ data }) => `/articles/${data.slug}/`);
  const categoryRoutes = categorySlugs.map((slug) => `/categories/${slug}/`);
  const fixedRoutes = [
    "/",
    "/categories/",
    "/about/",
    "/publisher/",
    "/editorial-standards/",
    "/corrections/",
    "/contact/",
    "/privacy/",
    "/advertising-disclosure/",
    "/sitemap/",
  ];
  const indexableRoutes = [...fixedRoutes, ...categoryRoutes, ...articleRoutes];
  const files = new Map<string, string>();

  for (const [index, route] of indexableRoutes.entries()) {
    const title = `Unique page title ${index + 1}`;
    const canonical = new URL(route, siteUrl).toString();
    let body =
      route === "/"
        ? `<a href="/">Home</a>`
        : `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><span aria-current="page">${title}</span></li></ol></nav>`;
    if (route === "/") {
      body += categoryRoutes
        .map((href) => `<a href="${href}">${href}</a>`)
        .join("");
    }
    if (route === "/sitemap/") {
      body += indexableRoutes
        .map((href) => `<a href="${href}">${href}</a>`)
        .join("");
    }
    const category = categorySlugs.find(
      (slug) => route === `/categories/${slug}/`,
    );
    if (category) {
      body += articles
        .filter(({ data }) => data.category === category)
        .map(
          ({ data }) => `<a href="/articles/${data.slug}/">${data.title}</a>`,
        )
        .join("");
    }

    const routeFile =
      route === "/" ? "index.html" : `${route.slice(1)}index.html`;
    files.set(
      routeFile,
      htmlDocument({
        route,
        title,
        description: `A unique and complete page description number ${index + 1} for this practical technology resource.`,
        body,
        ogType: route.startsWith("/articles/") ? "article" : "website",
        jsonLd:
          route === "/"
            ? {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "Everyday Tech Insight",
                url: siteUrl,
                description:
                  "A unique and complete page description number 1 for this practical technology resource.",
                inLanguage: "en-US",
              }
            : {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: siteUrl,
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: title,
                    item: canonical,
                  },
                ],
              },
      }),
    );
  }

  files.set(
    "404.html",
    htmlDocument({
      route: "/404.html",
      title: "Page not found | Everyday Tech Insight",
      description:
        "The requested page was not found. Return to Everyday Tech Insight to browse practical business technology guidance.",
      body: '<a href="/">Return home</a>',
      robots: "noindex,follow",
    }),
  );
  files.set("favicon.svg", '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  files.set(
    "robots.txt",
    `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap-index.xml\n`,
  );
  files.set(
    "sitemap-index.xml",
    `<?xml version="1.0"?><sitemapindex><sitemap><loc>${siteUrl}sitemap-0.xml</loc></sitemap></sitemapindex>`,
  );
  files.set(
    "sitemap-0.xml",
    `<?xml version="1.0"?><urlset>${indexableRoutes
      .map((route) => `<url><loc>${new URL(route, siteUrl)}</loc></url>`)
      .join("")}</urlset>`,
  );
  files.set(
    "rss.xml",
    `<?xml version="1.0"?><rss><channel><link>${siteUrl}</link>${articleRoutes
      .map(
        (route) =>
          `<item><link>${new URL(route, siteUrl)}</link><guid>${new URL(route, siteUrl)}</guid></item>`,
      )
      .join("")}</channel></rss>`,
  );

  return { articles, files };
}

describe("content QA rules", () => {
  it("loads the content checker in the same Node ESM runtime used by npm scripts", () => {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", 'import("./scripts/qa-content.mjs")'],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("accepts a complete fifteen-article, three-per-category portfolio", () => {
    expect(
      validateContentPortfolio(validPortfolio(), { today: "2026-08-21" }),
    ).toEqual([]);
  });

  it("allows the portfolio to grow beyond the launch minimums", () => {
    const articles = [
      ...validPortfolio(),
      validArticle("ai-automation-guide-4", "ai-automation", 16),
    ];

    expect(validateContentPortfolio(articles, { today: "2026-08-21" })).toEqual(
      [],
    );
  });

  it("allows truthful later publication, review, modification, and source-access dates", () => {
    const articles = validPortfolio();
    articles[0]!.data.datePublished = "2026-08-22";
    articles[0]!.data.lastReviewed = "2026-08-24";
    articles[0]!.data.dateModified = "2026-08-23";
    for (const source of articles[0]!.data.sourceList) {
      source.accessed = "2026-08-25";
    }

    const dateCodes = validateContentPortfolio(articles, {
      today: "2026-08-25",
    })
      .map(({ code }) => code)
      .filter((code) => code.includes("date") || code === "source-accessed");

    expect(dateCodes).toEqual([]);
  });

  it("rejects pre-launch, future, out-of-order, and same-day modification dates", () => {
    const articles = validPortfolio();
    articles[0]!.data.datePublished = "2026-08-20";
    articles[0]!.data.lastReviewed = "2026-08-20";
    articles[1]!.data.datePublished = "2026-08-23";
    articles[1]!.data.lastReviewed = "2026-08-23";
    articles[2]!.data.datePublished = "2026-08-22";
    articles[2]!.data.lastReviewed = "2026-08-21";
    articles[2]!.data.dateModified = "2026-08-22";
    articles[3]!.data.sourceList[0]!.accessed = "2026-08-23";

    const codes = validateContentPortfolio(articles, {
      today: "2026-08-22",
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "publication-date",
        "review-date",
        "date-order",
        "modification-date",
        "source-accessed",
      ]),
    );
  });

  it("rejects article descriptions over 180 characters", () => {
    const articles = validPortfolio();
    articles[0]!.data.description = "x".repeat(181);

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }),
    ).toContainEqual(
      expect.objectContaining({
        code: "required-field",
        file: articles[0]!.fileName,
      }),
    );
  });

  it("blocks count, coverage, duplicate metadata, fit, date, source, and body defects", () => {
    const articles = validPortfolio();
    articles.pop();
    articles[1]!.data.title = articles[0]!.data.title;
    articles[2]!.data.businessProblem = "Too short";
    articles[3]!.data.datePublished = "2026-08-22";
    articles[3]!.data.dateModified = "2026-08-21";
    articles[4]!.data.sourceList = [articles[4]!.data.sourceList[0]!];
    articles[5]!.body = "## Thin\nNo useful guidance.";

    const codes = validateContentPortfolio(articles, {
      today: "2026-08-21",
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "portfolio-count",
        "category-count",
        "duplicate-title",
        "fit-field",
        "publication-date",
        "modification-date",
        "source-count",
        "body-word-count",
        "body-section-count",
        "body-limitation",
      ]),
    );
  });
});

describe("built-output QA rules", () => {
  it("accepts an internally complete output with exact sitemap and feed sets", () => {
    const fixture = validBuiltFixture();
    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }),
    ).toEqual([]);
  });

  it("rejects built descriptions over 180 characters", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "about/index.html",
      fixture.files
        .get("about/index.html")!
        .replace(
          /(<meta name="description" content=")[^"]+/,
          `$1${"x".repeat(181)}`,
        )
        .replace(
          /(<meta property="og:description" content=")[^"]+/,
          `$1${"x".repeat(181)}`,
        ),
    );

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }),
    ).toContainEqual(expect.objectContaining({ code: "description" }));
  });

  it("detects missing and duplicate core metadata", () => {
    const fixture = validBuiltFixture();
    const about = fixture.files.get("about/index.html")!;
    fixture.files.set(
      "about/index.html",
      about
        .replace(/<meta name="robots"[^>]+>/, "")
        .replace(/<link rel="canonical"[^>]+>/, "")
        .replace(/<meta property="og:url"[^>]+>/, "")
        .replace(/<h1>[^<]+<\/h1>/, ""),
    );
    fixture.files.set(
      "contact/index.html",
      fixture.files
        .get("contact/index.html")!
        .replace("Unique page title 7", "Unique page title 6")
        .replace("number 7", "number 6"),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "h1-count",
        "robots",
        "canonical",
        "og-url",
        "duplicate-title",
        "duplicate-description",
      ]),
    );
  });

  it("detects broken links and resources, placeholders, draft leakage, and tracking code", () => {
    const fixture = validBuiltFixture();
    const draft = validArticle("unpublished-draft", "ai-automation", 99);
    draft.data.status = "draft";
    const home = fixture.files.get("index.html")!;
    fixture.files.set(
      "index.html",
      home.replace(
        "</main>",
        '<a href="/missing/">TBD</a><img src="/missing.png" alt=""><script src="https://www.googletagmanager.com/gtag/js?id=G-ABCDEF12"></script><a href="/articles/unpublished-draft/">Draft</a></main>',
      ),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: [...fixture.articles, draft],
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "broken-internal-link",
        "missing-resource",
        "placeholder",
        "tracking-or-ad-code",
        "draft-leakage",
      ]),
    );
  });

  it("requires exact sitemap, feed, category, and HTML sitemap membership", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "sitemap-0.xml",
      fixture.files
        .get("sitemap-0.xml")!
        .replace(/<url><loc>[^<]+\/articles\/[^<]+<\/loc><\/url>/, ""),
    );
    fixture.files.set(
      "rss.xml",
      fixture.files.get("rss.xml")!.replace(/<item>.*?<\/item>/, ""),
    );
    fixture.files.set(
      "categories/ai-automation/index.html",
      fixture.files
        .get("categories/ai-automation/index.html")!
        .replace(/<a href="\/articles\/[^"]+\/">[^<]+<\/a>/, ""),
    );
    fixture.files.set(
      "sitemap/index.html",
      fixture.files
        .get("sitemap/index.html")!
        .replace(/<a href="\/categories\/ai-automation\/">[^<]+<\/a>/, ""),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "sitemap-membership",
        "feed-membership",
        "category-membership",
        "html-sitemap-membership",
      ]),
    );
  });

  it("rejects off-origin, relative, query, and fragment URLs before sitemap or RSS path comparison", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "sitemap-0.xml",
      fixture.files
        .get("sitemap-0.xml")!
        .replace(
          `${siteUrl}articles/ai-automation-guide-1/`,
          "https://attacker.invalid/articles/ai-automation-guide-1/",
        )
        .replace(`${siteUrl}about/`, "/about/")
        .replace(`${siteUrl}publisher/`, `${siteUrl}publisher/?preview=1#top`),
    );
    fixture.files.set(
      "rss.xml",
      fixture.files
        .get("rss.xml")!
        .replace(`<channel><link>${siteUrl}</link>`, "<channel><link>/</link>")
        .replace(
          `${siteUrl}articles/ai-automation-guide-1/`,
          "https://attacker.invalid/articles/ai-automation-guide-1/",
        )
        .replace(
          `${siteUrl}articles/ai-automation-guide-2/`,
          `${siteUrl}articles/ai-automation-guide-2/?source=rss#item`,
        ),
    );

    const issues = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "sitemap-url" }),
        expect.objectContaining({ code: "feed-url" }),
      ]),
    );
    expect(issues.map(({ message }) => message).join(" ")).toMatch(
      /absolute HTTPS|configured origin|query|fragment/i,
    );
  });

  it("rejects unsupported schema types and hidden breadcrumb claims", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "about/index.html",
      fixture.files
        .get("about/index.html")!
        .replace('"name":"Home"', '"name":"Hidden home label"')
        .replace(
          "</head>",
          `<script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: "5" },
          })}</script></head>`,
        ),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining(["json-ld-type", "json-ld-breadcrumb-visible"]),
    );
  });

  it("matches WebSite schema to configured and visible metadata", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "index.html",
      fixture.files
        .get("index.html")!
        .replace('"name":"Everyday Tech Insight"', '"name":"Hidden Brand"'),
    );

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }),
    ).toContainEqual(
      expect.objectContaining({ code: "json-ld-website-visible" }),
    );
  });

  it("rejects untyped rating claims and other undeclared JSON-LD properties", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "index.html",
      fixture.files
        .get("index.html")!
        .replace(
          '"inLanguage":"en-US"',
          '"inLanguage":"en-US","aggregateRating":{"ratingValue":"5","reviewCount":"999"}',
        ),
    );

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }),
    ).toContainEqual(expect.objectContaining({ code: "json-ld-shape" }));
  });

  it("rejects every JSON-LD claim on the non-indexable 404 page", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "404.html",
      fixture.files.get("404.html")!.replace(
        "</head>",
        `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Everyday Tech Insight",
          url: siteUrl,
          aggregateRating: { ratingValue: "5", reviewCount: "999" },
        })}</script></head>`,
      ),
    );

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }),
    ).toContainEqual(expect.objectContaining({ code: "json-ld-404" }));
  });

  it("requires every RSS item to pair its own link and guid without duplicates", () => {
    const swapped = validBuiltFixture();
    const rss = swapped.files.get("rss.xml")!;
    const guids = [...rss.matchAll(/<guid>([^<]+)<\/guid>/g)].map(
      (match) => match[1]!,
    );
    const firstGuid = guids[0]!;
    const secondGuid = guids[1]!;
    swapped.files.set(
      "rss.xml",
      rss
        .replace(`<guid>${firstGuid}</guid>`, "<guid>SWAP-GUID</guid>")
        .replace(`<guid>${secondGuid}</guid>`, `<guid>${firstGuid}</guid>`)
        .replace("<guid>SWAP-GUID</guid>", `<guid>${secondGuid}</guid>`),
    );

    const duplicated = validBuiltFixture();
    const duplicateRss = duplicated.files.get("rss.xml")!;
    const firstItem = duplicateRss.match(/<item>.*?<\/item>/)?.[0];
    expect(firstItem).toBeTruthy();
    duplicated.files.set(
      "rss.xml",
      duplicateRss.replace("</channel>", `${firstItem}</channel>`),
    );

    for (const fixture of [swapped, duplicated]) {
      expect(
        validateBuiltOutput({
          files: fixture.files,
          articles: fixture.articles,
          categorySlugs: [...categorySlugs],
          siteUrl,
        }),
      ).toContainEqual(expect.objectContaining({ code: "feed-item-url" }));
    }
  });

  it("rejects duplicate sitemap-index and URL-set locations", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "sitemap-index.xml",
      fixture.files
        .get("sitemap-index.xml")!
        .replace(
          "</sitemapindex>",
          `<sitemap><loc>${siteUrl}sitemap-0.xml</loc></sitemap></sitemapindex>`,
        ),
    );
    const sitemap = fixture.files.get("sitemap-0.xml")!;
    const firstUrl = sitemap.match(/<url>.*?<\/url>/)?.[0];
    expect(firstUrl).toBeTruthy();
    fixture.files.set(
      "sitemap-0.xml",
      sitemap.replace("</urlset>", `${firstUrl}</urlset>`),
    );

    const duplicateFindings = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).filter(({ code }) => code === "sitemap-duplicate");

    expect(duplicateFindings).toHaveLength(2);
  });

  it("rejects malformed sitemap and RSS container structures even when URL sets survive", () => {
    const fixture = validBuiltFixture();
    const sitemapLocations = [
      ...fixture.files.get("sitemap-0.xml")!.matchAll(/<loc>[^<]+<\/loc>/g),
    ].map((match) => match[0]);
    fixture.files.set(
      "sitemap-0.xml",
      `<?xml version="1.0"?><urlset><url>${sitemapLocations.join("")}</url></urlset>`,
    );

    const rss = fixture.files.get("rss.xml")!;
    const items = [...rss.matchAll(/<item>.*?<\/item>/g)].map(
      (match) => match[0],
    );
    fixture.files.set(
      "rss.xml",
      rss
        .replace(/<item>.*?<\/item>/g, "")
        .replace("</rss>", `${items.join("")}</rss>`),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining(["sitemap-structure", "feed-structure"]),
    );
  });

  it("rejects truncated or mismatched XML instead of accepting a repaired tree", () => {
    const truncated = validBuiltFixture();
    truncated.files.set(
      "sitemap-0.xml",
      truncated.files.get("sitemap-0.xml")!.replace("</urlset>", ""),
    );
    truncated.files.set(
      "rss.xml",
      truncated.files.get("rss.xml")!.replace("</channel></rss>", "</wrong>"),
    );

    const codes = validateBuiltOutput({
      files: truncated.files,
      articles: truncated.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(expect.arrayContaining(["sitemap-xml", "feed-xml"]));
  });
});

describe("external link classification", () => {
  const publicLookup = (async () => [
    { address: "93.184.216.34", family: 4 as const },
  ]) as unknown as typeof import("node:dns/promises").lookup;

  it("collects and deduplicates external HTTP(S) anchors from built HTML", () => {
    const files = new Map([
      [
        "index.html",
        '<a href="https://github.com/example/issues#new">Contact</a><a href="/privacy/">Privacy</a>',
      ],
      [
        "privacy/index.html",
        '<a href="https://github.com/example/issues#new">Contact again</a><a href="https://vercel.com/legal/privacy-policy">Vercel privacy</a><a href="http://example.com/insecure">Insecure</a>',
      ],
      ["rss.xml", '<a href="https://outside.example/not-html">Ignored</a>'],
    ]);

    expect(collectExternalHttpsUrlsFromHtmlFiles(files, siteUrl)).toEqual([
      "http://example.com/insecure",
      "https://github.com/example/issues",
      "https://vercel.com/legal/privacy-policy",
    ]);
  });

  it("bounds DNS preflight time when a resolver never settles", async () => {
    let fetchCalls = 0;
    const neverLookup = (() =>
      new Promise(
        () => undefined,
      )) as unknown as typeof import("node:dns/promises").lookup;
    const check = checkUrl("https://stuck.example/source", {
      lookupImpl: neverLookup,
      timeoutMs: 5,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(null, { status: 200 });
      },
    });
    const outcome = await Promise.race([
      check,
      new Promise<"HUNG">((resolve) => setTimeout(() => resolve("HUNG"), 100)),
    ]);

    expect(outcome).not.toBe("HUNG");
    expect(outcome).toEqual(expect.objectContaining({ status: "UNVERIFIED" }));
    expect(fetchCalls).toBe(0);
  });

  it("uses HEAD first and falls back to GET before reporting PASS", async () => {
    const methods: string[] = [];
    const result = await checkUrl("https://example.com/source", {
      lookupImpl: publicLookup,
      fetchImpl: async (_url, init: RequestInit | undefined) => {
        methods.push(init?.method ?? "GET");
        return new Response(null, {
          status: init?.method === "HEAD" ? 405 : 200,
        });
      },
    });

    expect(methods).toEqual(["HEAD", "GET"]);
    expect(result.status).toBe("PASS");
  });

  it("distinguishes definitive failures from access-limited verification", async () => {
    const missing = await checkUrl("https://example.com/missing", {
      lookupImpl: publicLookup,
      fetchImpl: async () => new Response(null, { status: 404 }),
    });
    const blocked = await checkUrl("https://example.com/blocked", {
      lookupImpl: publicLookup,
      fetchImpl: async () => new Response(null, { status: 403 }),
    });

    expect(missing.status).toBe("FAIL");
    expect(blocked.status).toBe("UNVERIFIED");
  });

  it("rejects collected loopback and link-local destinations without fetching them", async () => {
    const files = new Map([
      [
        "index.html",
        '<a href="https://127.0.0.1/admin">Loopback</a><a href="https://169.254.169.254/latest/meta-data/">Metadata</a>',
      ],
    ]);
    let fetchCalls = 0;
    const urls = collectExternalHttpsUrlsFromHtmlFiles(files, siteUrl);
    const results = await checkExternalUrls(urls, {
      lookupImpl: publicLookup,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(null, { status: 200 });
      },
    });

    expect(urls).toEqual([
      "https://127.0.0.1/admin",
      "https://169.254.169.254/latest/meta-data/",
    ]);
    expect(results.map(({ status }) => status)).toEqual(["FAIL", "FAIL"]);
    expect(fetchCalls).toBe(0);
  });

  it("stops at an unsafe redirect before contacting the redirected host", async () => {
    const fetchedUrls: string[] = [];
    const result = await checkUrl("https://example.com/source", {
      lookupImpl: publicLookup,
      fetchImpl: async (input) => {
        fetchedUrls.push(String(input));
        return new Response(null, {
          status: 302,
          headers: { Location: "https://169.254.169.254/latest/meta-data/" },
        });
      },
    });

    expect(result.status).toBe("FAIL");
    expect(result.detail).toMatch(/unsafe redirect/i);
    expect(fetchedUrls).toEqual(["https://example.com/source"]);
  });

  it("pins the HTTPS connection lookup to the addresses that passed DNS validation", async () => {
    const pinnedLookup = createPinnedLookup(["93.184.216.34"]);
    let observedAddress = "";
    let observedFamily = 0;

    await new Promise<void>((resolve, reject) => {
      pinnedLookup(
        "rebind.example",
        {},
        (
          error: Error | null,
          address: string | Array<{ address: string; family: number }>,
          family?: number,
        ) => {
          if (error) {
            reject(error);
            return;
          }
          observedAddress = String(address);
          observedFamily = Number(family);
          resolve();
        },
      );
    });

    expect(observedAddress).toBe("93.184.216.34");
    expect(observedFamily).toBe(4);
  });

  it("rejects DNS-resolved private targets and reserved address families", async () => {
    let fetchCalls = 0;
    const privateLookup = (async () => [
      { address: "10.20.30.40", family: 4 as const },
    ]) as unknown as typeof import("node:dns/promises").lookup;
    const result = await checkUrl("https://internal.example/source", {
      lookupImpl: privateLookup,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(null, { status: 200 });
      },
    });

    expect(result.status).toBe("FAIL");
    expect(fetchCalls).toBe(0);
    expect(isUnsafeNetworkAddress("192.0.2.1")).toBe(true);
    expect(isUnsafeNetworkAddress("2001:db8::1")).toBe(true);
    expect(isUnsafeNetworkAddress("2001::1")).toBe(true);
    expect(isUnsafeNetworkAddress("2001:10::1")).toBe(true);
    expect(isUnsafeNetworkAddress("2001:20::1")).toBe(true);
    expect(isUnsafeNetworkAddress("2002:7f00:1::1")).toBe(true);
    expect(isUnsafeNetworkAddress("3ffe::1")).toBe(true);
    expect(isUnsafeNetworkAddress("3fff::1")).toBe(true);
    expect(isUnsafeNetworkAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isUnsafeNetworkAddress("93.184.216.34")).toBe(false);
    expect(isUnsafeNetworkAddress("2606:4700:4700::1111")).toBe(false);
    expect(isUnsafeNetworkAddress("::ffff:93.184.216.34")).toBe(false);
  });

  it.each([
    "http://example.com/source",
    "https://user:secret@example.com/source",
    "https://example.com:8443/source",
    "https://localhost/source",
  ])("rejects unsafe fetch target %s", async (url) => {
    let fetchCalls = 0;
    const result = await checkUrl(url, {
      lookupImpl: publicLookup,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(null, { status: 200 });
      },
    });

    expect(result.status).toBe("FAIL");
    expect(fetchCalls).toBe(0);
  });

  it("redacts credentials and query values from link-check results", async () => {
    const result = await checkUrl(
      "https://user:secret@example.com/source?token=sensitive",
      { lookupImpl: publicLookup },
    );

    expect(result.status).toBe("FAIL");
    expect(result.url).not.toMatch(/user|secret|sensitive/);
    expect(result.url).toContain("[redacted]");
  });
});

describe("Lighthouse thresholds", () => {
  it("uses the numeric median of three category scores without mutating the runs", () => {
    const runScores = [
      {
        performance: 0.88,
        accessibility: 1,
        "best-practices": 0.98,
        seo: 0.99,
      },
      {
        performance: 0.94,
        accessibility: 0.98,
        "best-practices": 1,
        seo: 0.97,
      },
      {
        performance: 0.91,
        accessibility: 0.99,
        "best-practices": 0.99,
        seo: 1,
      },
    ];
    const original = structuredClone(runScores);

    expect(aggregateLighthouseScores(runScores)).toEqual({
      scores: {
        performance: 0.91,
        accessibility: 0.99,
        "best-practices": 0.99,
        seo: 0.99,
      },
      representativeRunIndex: 2,
    });
    expect(runScores).toEqual(original);
  });

  it("fails a category closed when any run has a null or missing score", () => {
    const result = aggregateLighthouseScores([
      {
        performance: 0.91,
        accessibility: 1,
        "best-practices": 1,
        seo: 1,
      },
      {
        performance: 0.92,
        accessibility: null,
        "best-practices": 1,
        seo: 1,
      },
      {
        performance: 0.93,
        "best-practices": 1,
        seo: 1,
      },
    ]);

    expect(result?.scores.accessibility).toBeNull();
    expect(
      evaluateLighthouseCategories(result?.scores ?? {}).map(
        ({ category }) => category,
      ),
    ).toContain("accessibility");
  });

  it("records three runs and bases summary status on median failures", () => {
    const runScores = [
      {
        performance: 0.85,
        accessibility: 1,
        "best-practices": 1,
        seo: 1,
      },
      {
        performance: 0.92,
        accessibility: 1,
        "best-practices": 1,
        seo: 1,
      },
      {
        performance: 0.94,
        accessibility: 1,
        "best-practices": 1,
        seo: 1,
      },
    ];
    const aggregation = aggregateLighthouseScores(runScores);
    expect(aggregation).toBeDefined();
    const scores = aggregation?.scores ?? {};
    const failures = evaluateLighthouseCategories(scores);
    const summary = createLighthouseSummary([
      {
        name: "home",
        path: "/",
        runScores,
        scores,
        failures,
      },
    ]);

    expect(summary).toMatchObject({
      status: "PASS",
      formFactor: "desktop",
      runsPerPage: 3,
      pages: [{ runScores, scores: { performance: 0.92 }, failures: [] }],
    });
  });

  it("keeps signal handlers installed until normal cleanup and publication finish", async () => {
    const operations: string[] = [];
    let finishAction!: () => void;
    const actionCanFinish = new Promise<void>((resolve) => {
      finishAction = resolve;
    });
    const run = withSignalCleanupInstalled(
      async () => {
        operations.push("action:start");
        await actionCanFinish;
        operations.push("action:finish");
      },
      async () => undefined,
      {
        installImpl: () => {
          operations.push("install");
          return () => operations.push("remove");
        },
      },
    );

    await Promise.resolve();
    expect(operations).toEqual(["install", "action:start"]);
    finishAction();
    await run;

    expect(operations).toEqual([
      "install",
      "action:start",
      "action:finish",
      "remove",
    ]);
  });

  it("kills the owned Chromium process when launch rejects after spawn", async () => {
    const child = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      signalCode: null as string | null,
      kill: () => true,
    });
    let killCalls = 0;
    class FailingLauncher {
      chromeProcess = child;
      pid = 123;
      port = 456;
      remoteDebuggingPipes = null;

      async launch() {
        throw new Error("debug port never became ready");
      }

      kill() {
        killCalls += 1;
        child.exitCode = 1;
        child.emit("exit", 1, null);
      }
    }

    await expect(
      launchChromeSafely(
        {},
        {
          LauncherImpl:
            FailingLauncher as unknown as typeof import("chrome-launcher").Launcher,
        },
      ),
    ).rejects.toThrow(/debug port/i);
    expect(killCalls).toBe(1);
  });

  it("cleans owned resources before exiting on an interrupt signal", async () => {
    const processTarget = new EventEmitter();
    const operations: string[] = [];
    let resolveExit!: () => void;
    const exited = new Promise<void>((resolve) => {
      resolveExit = resolve;
    });
    const removeHandlers = installSignalCleanup(
      async () => {
        operations.push("cleanup");
      },
      {
        processImpl: processTarget as unknown as NodeJS.Process,
        exitImpl: ((code: number) => {
          operations.push(`exit:${code}`);
          resolveExit();
          return undefined as never;
        }) as typeof process.exit,
      },
    );

    processTarget.emit("SIGINT");
    await exited;
    removeHandlers();

    expect(operations).toEqual(["cleanup", "exit:130"]);
  });

  it("subscribes before launcher shutdown and waits for the browser process exit", async () => {
    let forceKillCalls = 0;
    const child = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      signalCode: null as string | null,
      kill: () => {
        forceKillCalls += 1;
        return true;
      },
    });
    const chrome = {
      process: child,
      kill: () => {
        child.exitCode = 0;
        child.emit("exit", 0, null);
      },
    };

    await stopChrome(chrome, { timeoutMs: 50 });

    expect(forceKillCalls).toBe(0);
  });

  it("uses a bounded force-kill fallback when launcher shutdown does not exit", async () => {
    const operations: string[] = [];
    let waitCount = 0;
    const child = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      signalCode: null as string | null,
      kill: (signal: string) => {
        operations.push(`force:${signal}`);
        return true;
      },
    });
    const chrome = {
      process: child,
      kill: () => operations.push("launcher"),
    };

    await stopChrome(chrome, {
      timeoutMs: 50,
      waitForExitImpl: async () => {
        waitCount += 1;
        return waitCount === 2;
      },
    });

    expect(operations).toEqual(["launcher", "force:SIGKILL"]);
  });

  it("clears stale reports and publishes the replacement directory atomically", async () => {
    const operations: string[] = [];
    const outputDirectory = "C:\\reports\\lighthouse";
    const pendingDirectory = await prepareLighthouseReportRun(outputDirectory, {
      mkdirImpl: async (directory) => {
        operations.push(`mkdir:${directory}`);
        return undefined;
      },
      removeImpl: async (directory) => {
        operations.push(`remove:${directory}`);
      },
    });
    await publishLighthouseReportRun(pendingDirectory, outputDirectory, {
      renameImpl: async (from, to) => {
        operations.push(`rename:${from}->${to}`);
      },
    });

    expect(pendingDirectory).toBe(`${outputDirectory}.pending`);
    expect(operations).toEqual([
      `remove:${outputDirectory}`,
      `remove:${outputDirectory}.pending`,
      `mkdir:${outputDirectory}.pending`,
      `rename:${outputDirectory}.pending->${outputDirectory}`,
    ]);
  });

  it("labels saved scores as desktop and marks threshold failures", () => {
    const summary = createLighthouseSummary([
      {
        name: "home",
        path: "/",
        scores: { performance: 0.89 },
        failures: [{ category: "performance", score: 0.89, threshold: 0.9 }],
      },
    ]);

    expect(summary).toMatchObject({ formFactor: "desktop", status: "FAIL" });
  });

  it("retries transient Windows profile cleanup errors", async () => {
    let attempts = 0;
    await removeDirectoryWithRetries("C:\\temp\\lighthouse-profile", {
      delayImpl: async () => undefined,
      rmImpl: async () => {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error(
            "profile is still locked",
          ) as NodeJS.ErrnoException;
          error.code = "EPERM";
          throw error;
        }
      },
    });

    expect(attempts).toBe(3);
  });

  it("requires 90 performance and 95 for accessibility, best practices, and SEO", () => {
    expect(
      evaluateLighthouseCategories({
        performance: 0.9,
        accessibility: 0.95,
        "best-practices": 0.95,
        seo: 0.95,
      }),
    ).toEqual([]);

    expect(
      evaluateLighthouseCategories({
        performance: 0.89,
        accessibility: 0.94,
        "best-practices": 0.94,
        seo: 0.94,
      }).map(({ category }) => category),
    ).toEqual(["performance", "accessibility", "best-practices", "seo"]);
  });
});

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

import { validateBuiltOutput } from "../../scripts/qa-build.mjs";
import { validateContentPortfolio } from "../../scripts/qa-content.mjs";
import {
  checkUrl,
  collectExternalHttpsUrlsFromHtmlFiles,
} from "../../scripts/check-external-links.mjs";
import {
  evaluateLighthouseCategories,
  removeDirectoryWithRetries,
} from "../../scripts/run-lighthouse.mjs";

const siteUrl = "https://everyday-tech-insight.vercel.app/";
const categorySlugs = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
] as const;

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
</head><body><main><h1>${options.title}</h1>${options.body}</main></body></html>`;
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
    let body = `<a href="/">Home</a>`;
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
        title: `Unique page title ${index + 1}`,
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
              }
            : {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [],
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
    `<?xml version="1.0"?><rss><channel>${articleRoutes
      .map((route) => `<item><link>${new URL(route, siteUrl)}</link></item>`)
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
    expect(validateContentPortfolio(validPortfolio())).toEqual([]);
  });

  it("rejects article descriptions over 180 characters", () => {
    const articles = validPortfolio();
    articles[0]!.data.description = "x".repeat(181);

    expect(validateContentPortfolio(articles)).toContainEqual(
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

    const codes = validateContentPortfolio(articles).map(({ code }) => code);

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
      fixture.files
        .get("rss.xml")!
        .replace(/<item><link>[^<]+<\/link><\/item>/, ""),
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
});

describe("external link classification", () => {
  it("collects and deduplicates external HTTPS anchors from built HTML", () => {
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
      "https://github.com/example/issues",
      "https://vercel.com/legal/privacy-policy",
    ]);
  });

  it("uses HEAD first and falls back to GET before reporting PASS", async () => {
    const methods: string[] = [];
    const result = await checkUrl("https://example.com/source", {
      fetchImpl: async (_url, init) => {
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
      fetchImpl: async () => new Response(null, { status: 404 }),
    });
    const blocked = await checkUrl("https://example.com/blocked", {
      fetchImpl: async () => new Response(null, { status: 403 }),
    });

    expect(missing.status).toBe("FAIL");
    expect(blocked.status).toBe("UNVERIFIED");
  });
});

describe("Lighthouse thresholds", () => {
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

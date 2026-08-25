import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import astroConfig from "../../astro.config.mjs";
import { validateBuiltOutput } from "../../scripts/qa-build.mjs";
import {
  parseArticleMarkdown,
  readArticleRecords,
  validateContentPortfolio,
} from "../../scripts/qa-content.mjs";
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
import { relatedTrustPages } from "../../src/data/trust-pages";
import {
  EDITORIAL_VISUAL_KEYS,
  EDITORIAL_VISUAL_TYPE_BY_KEY,
} from "../../src/utils/content-contract";
import { integrationPublicCopy } from "../../src/utils/monetization";

const categorySlugs = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
] as const;
const trustRoutePaths = relatedTrustPages.map(({ path }) => path);

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

const explanationScenarios = [
  {
    promise:
      "Map invoice approvals, capture routing decisions and exceptions, and confirm ownership for disputed payment reviews.",
    deliverable: "Invoice-approval workflow map",
    when: "before automating finance review or payment routing",
    risk: "unresolved payment exceptions",
  },
  {
    promise:
      "Trace customer handoffs, verify account ownership, and separate relationship records from delivery coordination.",
    deliverable: "Customer-to-delivery handoff record",
    when: "when CRM and project tools overlap across customer work",
    risk: "unclear system boundaries",
  },
  {
    promise:
      "Inventory backup copies, distinguish independent media, and verify recovery through a representative restore exercise.",
    deliverable: "Backup inventory and restore-test log",
    when: "before relying on cloud synchronization for recovery",
    risk: "untested restoration gaps",
  },
  {
    promise:
      "Prioritize privileged accounts, protect recovery paths, and stage multi-factor enrollment with measured coverage.",
    deliverable: "MFA rollout and recovery coverage register",
    when: "before enforcing multi-factor authentication across critical accounts",
    risk: "lockout and enrollment gaps",
  },
  {
    promise:
      "Verify suspicious requests through known channels and route click, credential, payment, or data exposure correctly.",
    deliverable: "Phishing response checklist and incident record",
    when: "immediately after receiving a suspicious message or payment request",
    risk: "delayed incident containment",
  },
  {
    promise:
      "Organize shared files by durable functions, naming rules, ownership, permissions, and documented lifecycle decisions.",
    deliverable: "Shared-folder architecture and governance rules",
    when: "when files are scattered across personal drives and duplicate folders",
    risk: "lost records and unclear access",
  },
  {
    promise:
      "Export representative records, exercise critical integrations, and estimate migration effort before dependence grows.",
    deliverable: "Portability test record and dependency map",
    when: "before selecting or renewing a record-holding SaaS product",
    risk: "costly data lock-in",
  },
  {
    promise:
      "Score artificial-intelligence output against representative cases, a baseline rubric, and actual correction effort.",
    deliverable: "AI pilot scorecard and recommendation",
    when: "before expanding an AI drafting or classification pilot",
    risk: "unmeasured correction work",
  },
  {
    promise:
      "Define allowed, restricted, and prohibited AI tools, data, uses, approvals, and employee reporting duties.",
    deliverable: "AI acceptable-use policy draft",
    when: "before authorizing broader employee use of AI tools",
    risk: "uncontrolled data disclosure",
  },
  {
    promise:
      "Calculate implementation, labor, operating, change, and exit costs instead of comparing subscription prices alone.",
    deliverable: "Total-cost range and assumptions register",
    when: "when comparing, renewing, consolidating, or replacing software",
    risk: "hidden ownership costs",
  },
  {
    promise:
      "Convert technology concerns into event-to-consequence risks with evidence, treatment, ownership, and review dates.",
    deliverable: "Prioritized technology risk register",
    when: "when technology concerns lack priority, evidence, or accountable owners",
    risk: "unmanaged operational exposure",
  },
  {
    promise:
      "Run a controlled four-week technology evaluation with entry criteria, evidence collection, and an explicit stop decision.",
    deliverable: "Pilot charter, evidence log, and decision record",
    when: "before moving a technology trial into normal production",
    risk: "accidental production dependence",
  },
  {
    promise:
      "Provision role-based accounts, devices, access, and training while preserving an approved onboarding record.",
    deliverable: "Technology onboarding and approved-access checklist",
    when: "before a worker or service provider receives system access",
    risk: "excess or undocumented permissions",
  },
  {
    promise:
      "Document workflow decisions, exceptions, inputs, and owners before selecting any improvement or automation target.",
    deliverable: "Current-state workflow and requirements packet",
    when: "before buying workflow software or automating recurring work",
    risk: "automated process defects",
  },
  {
    promise:
      "Turn software requirements into test scenarios and verify workflow, security, administration, data, and exit claims.",
    deliverable: "SaaS evidence sheet and purchase decision",
    when: "during a vendor trial, demonstration, renewal, or replacement review",
    risk: "unsupported vendor assumptions",
  },
  {
    promise:
      "Remove departing vendor access, transfer owned records, and verify service dependencies before closing accounts.",
    deliverable: "Vendor offboarding and dependency checklist",
    when: "before terminating a contractor, provider, or managed service",
    risk: "orphaned access and records",
  },
] as const;

function fixtureExplanations(index: number) {
  const scenario =
    explanationScenarios[(index - 1) % explanationScenarios.length]!;
  return {
    guidePromise: `${scenario.promise} Keep the decision bounded, owned, and reversible.`,
    deliverable: `${scenario.deliverable}, with assumptions, ownership, and next actions.`,
    whenToUse: `Use ${scenario.when} to resolve ${scenario.risk} before wider commitment.`,
  };
}

function validBody(
  slug: string,
  sources: string[],
  explanationSupport: string,
): string {
  return [
    "## Direct answer",
    `${words(170)} limitation`,
    explanationSupport,
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
  const explanations = fixtureExplanations(index);
  const visualKey =
    EDITORIAL_VISUAL_KEYS[(index - 1) % EDITORIAL_VISUAL_KEYS.length]!;

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
      guidePromise: explanations.guidePromise,
      deliverable: explanations.deliverable,
      whenToUse: explanations.whenToUse,
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
      visual: {
        type: EDITORIAL_VISUAL_TYPE_BY_KEY[visualKey],
        key: visualKey,
        alt: "A bounded decision tree with evidence, review, fallback, and a stop condition.",
        decorative: false,
      },
      sourceList: sources.map((url, sourceIndex) => ({
        title: `Official source ${sourceIndex + 1} for guide ${index}`,
        url,
        publisher: sourceIndex === 0 ? "NIST" : "CISA",
        accessed: "2026-08-21",
      })),
      relatedArticles: [] as string[],
      noindex: false,
    },
    body: validBody(slug, sources, Object.values(explanations).join(" ")),
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

function expectedSocialImagePath(route: string) {
  if (route.startsWith("/articles/") && route !== "/articles/") {
    return `/social/article-${route.split("/")[2]}.png`;
  }
  if (route.startsWith("/categories/") && route !== "/categories/") {
    return `/social/category-${route.split("/")[2]}.png`;
  }
  return "/social/default.png";
}

function htmlDocument(options: {
  route: string;
  title: string;
  description: string;
  body: string;
  robots?: string;
  ogType?: "website" | "article";
  jsonLd?: Record<string, unknown>;
  bodyOwnsHeading?: boolean;
}) {
  const canonical = new URL(options.route, siteUrl).toString();
  const socialImage = new URL(
    expectedSocialImagePath(options.route),
    siteUrl,
  ).toString();
  const socialImageAlt = `Social preview for ${options.title}`;
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
<meta property="og:image" content="${socialImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${socialImageAlt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${options.title}">
<meta name="twitter:description" content="${options.description}">
<meta name="twitter:image" content="${socialImage}">
<meta name="twitter:image:alt" content="${socialImageAlt}">
<link rel="icon" href="/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
${
  options.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(options.jsonLd)}</script>`
    : ""
}
</head><body><header><a class="site-name" href="/">Everyday Tech Insight</a></header><main>${options.bodyOwnsHeading ? options.body : `<h1>${options.title}</h1>${options.body}`}</main></body></html>`;
}

function trustShell(title: string, body: string, currentPath?: string) {
  return `<article class="trust-content trust-page">
    <header class="trust-page__intro"><h1>${title}</h1></header>
    ${body}
    <nav class="trust-page__related" aria-label="Related publication pages">
      ${relatedTrustPages
        .map(
          ({ path, label }) =>
            `<a href="${path}"${path === currentPath ? ' aria-current="page"' : ""}>${label}</a>`,
        )
        .join("")}
    </nav>
  </article>`;
}

function validBuiltFixture() {
  const articles = validPortfolio();
  const articleRoutes = articles.map(({ data }) => `/articles/${data.slug}/`);
  const categoryRoutes = categorySlugs.map((slug) => `/categories/${slug}/`);
  const fixedRoutes = [
    "/",
    "/categories/",
    "/articles/",
    "/toolkit/",
    "/toolkit/automation-candidate-screen/",
    "/toolkit/saas-evaluation-evidence-sheet/",
    "/toolkit/technology-risk-register/",
    "/toolkit/backup-restore-test-log/",
    ...trustRoutePaths,
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
    if (route === "/articles/") {
      body += categorySlugs
        .map(
          (
            category,
          ) => `<section class="guide-archive__category" data-category="${category}">
          ${articles
            .filter(({ data }) => data.category === category)
            .map(
              ({ data }) =>
                `<a href="/articles/${data.slug}/">${data.title}</a>`,
            )
            .join("")}
        </section>`,
        )
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
    if (route.startsWith("/articles/") && route !== "/articles/") {
      body += `<section class="fit-summary" aria-labelledby="fit-heading">
        <h2 id="fit-heading">At a glance</h2><dl><div><dt>Business problem</dt><dd>Problem</dd></div></dl>
      </section>
      <nav class="table-of-contents" aria-label="On this page">
        <p>On this page</p><ol><li><a href="#decision">Decision</a></li></ol>
      </nav>
      <div class="article-body"><h2 id="decision">Decision</h2></div>`;
    }

    const integrationCopy = integrationPublicCopy(siteConfig.integrations);
    if (route === "/privacy/") body += `<p>${integrationCopy.privacyState}</p>`;
    if (route === "/advertising-disclosure/") {
      body += `<p>${integrationCopy.disclosureState}</p><p>${integrationCopy.approvalBoundary}</p>`;
    }

    const isTrustRoute = trustRoutePaths.some((path) => path === route);
    if (isTrustRoute) body = trustShell(title, body, route);

    const routeFile =
      route === "/" ? "index.html" : `${route.slice(1)}index.html`;
    files.set(
      routeFile,
      htmlDocument({
        route,
        title,
        description: `A unique and complete page description number ${index + 1} for this practical technology resource.`,
        body,
        bodyOwnsHeading: isTrustRoute,
        ogType:
          route.startsWith("/articles/") && route !== "/articles/"
            ? "article"
            : "website",
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
      body: trustShell(
        "Page not found | Everyday Tech Insight",
        '<a href="/">Return home</a>',
      ),
      bodyOwnsHeading: true,
      robots: "noindex,follow",
    }),
  );
  files.set("favicon.svg", '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  files.set("apple-touch-icon.png", "[binary resource]");
  files.set(
    "manifest.webmanifest",
    JSON.stringify({
      name: "Everyday Tech Insight",
      short_name: "ETI",
      start_url: "/",
      display: "standalone",
      icons: [
        {
          src: "/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    }),
  );
  files.set("social/default.png", "[binary resource]");
  for (const category of categorySlugs) {
    files.set(`social/category-${category}.png`, "[binary resource]");
  }
  for (const { data } of articles) {
    files.set(`social/article-${data.slug}.png`, "[binary resource]");
  }
  files.set(
    "robots.txt",
    `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap-index.xml\n`,
  );
  files.set(
    "sitemap-index.xml",
    `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${siteUrl}sitemap-0.xml</loc></sitemap></sitemapindex>`,
  );
  files.set(
    "sitemap-0.xml",
    `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${indexableRoutes
      .map((route) => `<url><loc>${new URL(route, siteUrl)}</loc></url>`)
      .join("")}</urlset>`,
  );
  files.set(
    "rss.xml",
    `<?xml version="1.0"?><rss version="2.0"><channel><title>Everyday Tech Insight</title><link>${siteUrl}</link><description>Practical business technology guidance.</description>${articleRoutes
      .map(
        (route) =>
          `<item><title>${route}</title><link>${new URL(route, siteUrl)}</link><guid>${new URL(route, siteUrl)}</guid></item>`,
      )
      .join("")}</channel></rss>`,
  );

  return { articles, files };
}

function addExcludedLifecycleArticles(
  fixture: ReturnType<typeof validBuiltFixture>,
) {
  const excluded = ["draft", "review", "archived"].map((status, index) => {
    const article = validArticle(
      `${status}-lifecycle-entry`,
      categorySlugs[index]!,
      101 + index,
    );
    article.data.status = status;
    article.data.noindex = true;
    if (status === "archived") {
      Object.assign(article.data, { dateArchived: "2026-08-21" });
    }
    return article;
  });
  fixture.articles.push(...excluded);
  return excluded;
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

  it("discovers nested Markdown and MDX entries using the same recursive boundary as Astro", async () => {
    const root = await mkdtemp(join(tmpdir(), "eti-content-discovery-"));
    try {
      await mkdir(join(root, "nested"));
      const source = (slug: string) =>
        `---\ntitle: "A complete nested article title"\nslug: "${slug}"\nauthor: "Everyday Tech Insight"\nstatus: "draft"\n---\nSafe draft body.\n`;
      await writeFile(join(root, "top.md"), source("top"));
      await writeFile(join(root, "nested", "inside.mdx"), source("inside"));
      await writeFile(join(root, "nested", "ignored.txt"), "not content");

      const records = await readArticleRecords(root);

      expect(records.map(({ fileName }) => fileName)).toEqual([
        "nested/inside.mdx",
        "top.md",
      ]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("accepts a complete fifteen-article, three-per-category portfolio", () => {
    expect(
      validateContentPortfolio(validPortfolio(), { today: "2026-08-21" }),
    ).toEqual([]);
  });

  it("keeps count growth open while requiring a new unique visual registration", () => {
    const articles = [
      ...validPortfolio(),
      validArticle("ai-automation-guide-4", "ai-automation", 16),
    ];

    const codes = validateContentPortfolio(articles, {
      today: "2026-08-21",
    }).map(({ code }) => code);

    expect(codes).not.toContain("portfolio-count");
    expect(codes).not.toContain("category-count");
    expect(codes).toContain("duplicate-visual-key");
  });

  it("counts portfolio and category minimums from published entries only", () => {
    const articles = validPortfolio();
    for (const [index, status] of ["draft", "review", "archived"].entries()) {
      const article = articles[index]!;
      article.data.status = status;
      article.data.noindex = true;
      if (status === "archived") {
        Object.assign(article.data, { dateArchived: "2026-08-21" });
      }
    }

    const codes = validateContentPortfolio(articles, {
      today: "2026-08-21",
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining(["portfolio-count", "category-count"]),
    );
    expect(codes).not.toContain("status");
  });

  it("reports duplicate explanation fields between published articles", () => {
    const articles = validPortfolio();
    articles[1]!.data.guidePromise = articles[0]!.data.guidePromise;
    articles[2]!.data.deliverable = articles[0]!.data.deliverable;
    articles[3]!.data.whenToUse = articles[0]!.data.whenToUse;

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "duplicate-guide-promise",
        "duplicate-deliverable",
        "duplicate-when-to-use",
      ]),
    );
  });

  it("reports punctuation, Unicode, whitespace, and numeric-noise copies as near-duplicates", () => {
    const articles = validPortfolio();
    articles[1]!.data.guidePromise = articles[0]!.data.guidePromise
      .replaceAll(",", " — ")
      .replace(" approvals", "\tapprovals")
      .replace(".", "!");
    articles[2]!.data.deliverable = articles[0]!.data.deliverable.replace(
      "Invoice",
      "Ｉｎｖｏｉｃｅ",
    );
    articles[3]!.data.whenToUse = `${articles[0]!.data.whenToUse} 2`;

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "duplicate-guide-promise",
        "duplicate-deliverable",
        "duplicate-when-to-use",
      ]),
    );
  });

  it("reports a trivial one-token explanation variant at high overlap", () => {
    const articles = validPortfolio();
    articles[1]!.data.guidePromise = `${articles[0]!.data.guidePromise} Today.`;

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).toContain("duplicate-guide-promise");
  });

  it("reports contained copies for the reviewer example and minimum-length fields", () => {
    const articles = validPortfolio();
    const reviewerDeliverable = "Invoice approval workflow documentation.";
    const minimumDeliverable = "Invoice process map.";
    const minimumWhenToUse = "Use for invoice workflow rollout review.";
    expect(minimumDeliverable).toHaveLength(20);
    expect(minimumWhenToUse).toHaveLength(40);

    articles[0]!.data.deliverable = reviewerDeliverable;
    articles[1]!.data.deliverable = `${reviewerDeliverable} Today.`;
    articles[2]!.data.deliverable = minimumDeliverable;
    articles[3]!.data.deliverable = `${minimumDeliverable} Today.`;
    articles[4]!.data.whenToUse = minimumWhenToUse;
    articles[5]!.data.whenToUse = `${minimumWhenToUse} Today.`;
    for (const article of articles.slice(0, 6)) {
      article.body += `\n\n${article.data.deliverable} ${article.data.whenToUse}`;
    }

    const codes = validateContentPortfolio(articles, {
      today: "2026-08-21",
    }).map(({ code }) => code);
    expect(
      codes.filter((code) => code === "duplicate-deliverable"),
    ).toHaveLength(2);
    expect(codes).toContain("duplicate-when-to-use");
  });

  it("excludes draft, review, and archived explanations from published uniqueness", () => {
    const articles = validPortfolio();
    const excluded = ["draft", "review", "archived"].map((status, index) => {
      const article = validArticle(
        `${status}-duplicate-explanation`,
        categorySlugs[index]!,
        101 + index,
      );
      article.data.status = status;
      article.data.noindex = true;
      article.data.guidePromise = articles[0]!.data.guidePromise;
      article.data.deliverable = articles[0]!.data.deliverable;
      article.data.whenToUse = articles[0]!.data.whenToUse;
      if (status === "archived") {
        Object.assign(article.data, { dateArchived: "2026-08-21" });
      }
      return article;
    });

    const codes = validateContentPortfolio([...articles, ...excluded], {
      today: "2026-08-21",
    }).map(({ code }) => code);

    expect(
      codes.filter((code) =>
        [
          "duplicate-guide-promise",
          "duplicate-deliverable",
          "duplicate-when-to-use",
        ].includes(code),
      ),
    ).toEqual([]);
  });

  it("reports published explanation terms unsupported by title, summary, or body", () => {
    const articles = validPortfolio();
    articles[0]!.data.guidePromise =
      "Quasar metallurgy calibrates zirconium resonance chambers through lunar spectroscopy while nebula cartography directs isolated catalyst arrays.";
    articles[1]!.data.deliverable =
      "Zirconium nebula resonance ledger for lunar catalysts.";
    articles[2]!.data.whenToUse =
      "Use during quasar spectroscopy when lunar catalyst arrays require nebula calibration.";

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "unsupported-guide-promise",
        "unsupported-deliverable",
        "unsupported-when-to-use",
      ]),
    );
  });

  it.each([
    [
      "title",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.data.title = explanation;
      },
    ],
    [
      "HTML comments",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n<!-- ${explanation} -->`;
      },
    ],
    [
      "unclosed HTML comments",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n<!-- ${explanation}`;
      },
    ],
    [
      "fenced code",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n\`\`\`text\n${explanation}\n\`\`\``;
      },
    ],
    [
      "inline code",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n\`${explanation}\``;
      },
    ],
    [
      "indented code",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n    ${explanation}`;
      },
    ],
    [
      "five-space indented code",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n     ${explanation}`;
      },
    ],
    [
      "blockquoted fenced code",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n> \`\`\`text\n> ${explanation}\n> \`\`\``;
      },
    ],
    [
      "multiline code spans",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n\`\`${explanation.replace(" while ", "\nwhile ")}\`\``;
      },
    ],
    [
      "relative URL destinations",
      (article: ReturnType<typeof validArticle>) => {
        article.body +=
          "\n\n[Visible reference](/quasar-metallurgy-calibrates-zirconium-chambers-nebula-cartography-directs-catalyst-arrays/)";
      },
    ],
    [
      "non-visible raw HTML",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n<template>${explanation}</template>`;
      },
    ],
    [
      "non-public image alternative text",
      (article: ReturnType<typeof validArticle>, explanation: string) => {
        article.body += `\n\n![${explanation}](https://images.example.test/hidden.png)`;
      },
    ],
  ])(
    "does not accept explanation support found only in %s",
    (_name, injectSupport) => {
      const articles = validPortfolio();
      const article = articles[0]!;
      const explanation =
        "Quasar metallurgy calibrates zirconium chambers while nebula cartography directs catalyst arrays.";
      article.data.guidePromise = explanation;
      injectSupport(article, explanation);

      expect(
        validateContentPortfolio(articles, { today: "2026-08-21" }).map(
          ({ code }) => code,
        ),
      ).toContain("unsupported-guide-promise");
    },
  );

  it("excludes parsed document frontmatter from visible prose evidence", () => {
    const articles = validPortfolio();
    const article = articles[0]!;
    const explanation =
      "Quasar metallurgy calibrates zirconium chambers while nebula cartography directs catalyst arrays.";
    article.data.guidePromise = explanation;
    article.body = parseArticleMarkdown(
      `---\nqaEvidence: ${explanation}\n---\n${article.body}`,
      article.fileName,
    ).body;

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).toContain("unsupported-guide-promise");
  });

  it("retains visible Markdown link text as explanation support", () => {
    const articles = validPortfolio();
    const article = articles[0]!;
    const explanation =
      "Quasar metallurgy calibrates zirconium chambers while nebula cartography directs catalyst arrays.";
    article.data.guidePromise = explanation;
    article.body += `\n\n[${explanation}](/articles/visible-reference/)`;

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).not.toContain("unsupported-guide-promise");
  });

  it("retains normal blockquote prose as explanation support", () => {
    const articles = validPortfolio();
    const article = articles[0]!;
    const explanation =
      "Quasar metallurgy calibrates zirconium chambers while nebula cartography directs catalyst arrays.";
    article.data.guidePromise = explanation;
    article.body += `\n\n> ${explanation}`;

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).not.toContain("unsupported-guide-promise");
  });

  it.each([
    "<!-- hidden HTML comment -->",
    "<em>Ordinary raw markup is still outside the article contract.</em>",
    '<svg><use href="/images/articles/example.png"></use></svg>',
    '<object data="/images/articles/example.png"></object>',
    '<div style="background:url(/images/articles/example.png)">Visual</div>',
  ])("rejects raw HTML structurally across article content: %s", (rawHtml) => {
    const articles = validPortfolio();
    articles[0]!.body += `\n\n${rawHtml}`;

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).toContain("raw-html");
  });

  it.each(["draft", "review", "published", "archived"] as const)(
    "rejects raw HTML after a leading thematic break in the %s lifecycle state",
    (status) => {
      const articles = validPortfolio();
      articles[0]!.data.status = status;
      articles[0]!.body =
        '---\n\n<svg><image href="https://tracker.example/pixel.png"></image></svg>\n\nSafe draft body.';

      expect(
        validateContentPortfolio(articles, { today: "2026-08-21" }).map(
          ({ code }) => code,
        ),
      ).toContain("raw-html");
    },
  );

  it("retains visible prose after a leading thematic break", () => {
    const articles = validPortfolio();
    const article = articles[0]!;
    const explanation =
      "Quasar metallurgy calibrates zirconium chambers while nebula cartography directs catalyst arrays.";
    article.data.guidePromise = explanation;
    article.body = `---\n\n${explanation}\n\n${article.body}`;

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).not.toContain("unsupported-guide-promise");
  });

  it("collects visible prose below thousands of nested nodes without overflowing", () => {
    const articles = validPortfolio();
    const article = articles[0]!;
    const explanation =
      "Quasar metallurgy calibrates zirconium chambers while nebula cartography directs catalyst arrays.";
    article.data.guidePromise = explanation;
    article.body += `\n\n${"> ".repeat(6_500)}${explanation}`;

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).not.toContain("unsupported-guide-promise");
  });

  it("keeps slug uniqueness global across every lifecycle status", () => {
    const articles = validPortfolio();
    const draft = validArticle(
      articles[0]!.data.slug,
      "technology-strategy",
      99,
    );
    draft.fileName = "duplicate-draft-file.md";
    draft.data.status = "draft";
    draft.data.noindex = true;

    expect(
      validateContentPortfolio([...articles, draft], {
        today: "2026-08-21",
      }).map(({ code }) => code),
    ).toContain("duplicate-slug");
  });

  it("rejects published related links that are self, duplicate, missing, or non-published", () => {
    const articles = validPortfolio();
    const draft = validArticle("draft-related-target", "ai-automation", 99);
    draft.data.status = "draft";
    draft.data.noindex = true;
    const published = articles[0]!;
    published.data.relatedArticles = [
      published.data.slug,
      articles[1]!.data.slug,
      articles[1]!.data.slug,
      "missing-related-target",
      draft.data.slug,
    ];

    const codes = validateContentPortfolio([...articles, draft], {
      today: "2026-08-21",
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "related-self",
        "related-duplicate",
        "related-missing",
        "related-nonpublished",
      ]),
    );
  });

  it.each(["draft", "review", "published", "archived"])(
    "rejects unsafe Markdown bodies while an entry is %s",
    (status) => {
      const articles = validPortfolio();
      const article = articles[0]!;
      article.data.status = status;
      article.data.noindex = status === "published" ? false : true;
      if (status === "archived") {
        Object.assign(article.data, { dateArchived: "2026-08-21" });
      }
      article.body =
        '<script src="https://tracking.example/collect.js"></script>';

      expect(
        validateContentPortfolio(articles, {
          today: "2026-08-21",
        }).map(({ code }) => code),
      ).toContain("unsafe-body");
    },
  );

  it.each([
    ["empty body", "", "body-empty"],
    [
      "embedded frame",
      '<iframe src="https://example.org"></iframe>',
      "unsafe-body",
    ],
    [
      "embedded media",
      '<video src="https://example.org/demo.mp4"></video>',
      "unsafe-body",
    ],
    ["event handler", '<button onclick="submit()">Run</button>', "unsafe-body"],
    ["JavaScript URL", "[Run](javascript:submit())", "unsafe-body"],
    [
      "data HTML URL",
      "[Run](data:text/html,%3Ch1%3Eunsafe%3C/h1%3E)",
      "unsafe-body",
    ],
    [
      "remote image",
      "![Pixel](https://tracking.example/pixel.gif)",
      "path-hazard",
    ],
    ["tracking identifier", "Tracking G-ABC123XYZ9", "tracking-or-ad-code"],
    ["placeholder", "## TODO\nReplace this later.", "placeholder"],
    ["filesystem path", "[Private](C:\\Users\\owner\\file.txt)", "path-hazard"],
  ])("rejects a Markdown %s hazard", (_name, body, expectedCode) => {
    const articles = validPortfolio();
    articles[0]!.body = body;

    expect(
      validateContentPortfolio(articles, {
        today: "2026-08-21",
      }).map(({ code }) => code),
    ).toContain(expectedCode);
  });

  it("validates source shape and HTTPS without labeling substantive primariness", () => {
    const articles = validPortfolio();
    const oldUrl = articles[0]!.data.sourceList[0]!.url;
    const newUrl = "https://standards.example.org/guidance/source-record";
    articles[0]!.data.sourceList[0]!.url = newUrl;
    articles[0]!.body = articles[0]!.body.replace(oldUrl, newUrl);

    const codes = validateContentPortfolio(articles, {
      today: "2026-08-21",
    }).map(({ code }) => code);

    expect(codes).not.toContain("source-host");
  });

  it.each([
    "https://user:secret@www.nist.gov/record",
    "https://www.nist.gov/record?access_token=secret-value",
    "https://localhost/record",
    "https://evidence.internal/record",
    "https://127.0.0.1/record",
  ])("fails closed on the unsafe public source URL %s", (url) => {
    const articles = validPortfolio();
    const priorUrl = articles[0]!.data.sourceList[0]!.url;
    articles[0]!.data.sourceList[0]!.url = url;
    articles[0]!.body = articles[0]!.body.replace(priorUrl, url);

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).toContain("source-url");
  });

  it.each([
    "https://user:secret@www.nist.gov/image-record",
    "https://www.nist.gov/image-record?client_secret=secret-value",
    "https://media.local/image-record",
  ])("fails closed on the unsafe public hero evidence URL %s", (url) => {
    const articles = validPortfolio();
    Object.assign(articles[0]!.data, {
      heroImage: "/images/articles/automation-purpose.png",
      heroImageAlt: "An informative description of the intended hero image.",
      heroImageDecorative: false,
      heroImageSourceUrl: url,
    });

    expect(
      validateContentPortfolio(articles, { today: "2026-08-21" }).map(
        ({ code }) => code,
      ),
    ).toContain("hero-source-url");
  });

  it("enforces explanation ranges and the exact visual key/type pairing", () => {
    const articles = validPortfolio();
    articles[0]!.data.guidePromise = "Too short";
    articles[1]!.data.visual.type = "workflow";

    expect(
      validateContentPortfolio(articles, {
        today: "2026-08-21",
      }).map(({ code }) => code),
    ).toEqual(expect.arrayContaining(["guide-field", "visual-pair"]));
  });

  it("rejects duplicate visual keys across published guides", () => {
    const articles = validPortfolio();
    articles[1]!.data.visual = {
      ...articles[1]!.data.visual,
      key: articles[0]!.data.visual.key,
      type: articles[0]!.data.visual.type,
    };

    expect(
      validateContentPortfolio(articles, {
        today: "2026-08-21",
      }).map(({ code }) => code),
    ).toContain("duplicate-visual-key");
  });

  it.each(["webp", "png", "jpg", "jpeg"])(
    "accepts a lowercase .%s raster hero in content QA",
    (extension) => {
      const articles = validPortfolio();
      Object.assign(articles[0]!.data, {
        heroImage: `/images/articles/automation-purpose.${extension}`,
        heroImageAlt: "An informative description of the intended hero image.",
        heroImageDecorative: false,
      });

      expect(
        validateContentPortfolio(articles, {
          today: "2026-08-21",
        }).map(({ code }) => code),
      ).not.toContain("hero-path");
    },
  );

  it.each(["svg", "PNG", "WebP", "gif", "avif", "js"])(
    "rejects the nonapproved or mixed-case .%s hero extension in content QA",
    (extension) => {
      const articles = validPortfolio();
      Object.assign(articles[0]!.data, {
        heroImage: `/images/articles/automation-purpose.${extension}`,
        heroImageAlt: "An informative description of the intended hero image.",
        heroImageDecorative: false,
      });

      expect(
        validateContentPortfolio(articles, {
          today: "2026-08-21",
        }).map(({ code }) => code),
      ).toContain("hero-path");
    },
  );

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

  it.each([
    [
      "reserved ad gap",
      '<aside class="ad-slot" aria-label="Advertisement" style="min-height: 250px"><span>Advertisement</span></aside>',
    ],
    [
      "AdSense account meta",
      '<meta name="google-adsense-account" content="[REDACTED OWNER VALUE]">',
    ],
    [
      "advertising CMP marker",
      '<div data-cmp-provider="[REDACTED OWNER SELECTION]" class="consent-banner">Consent settings</div>',
    ],
  ])("rejects a public %s while monetization is off", (_name, markup) => {
    const fixture = validBuiltFixture();
    const home = fixture.files.get("index.html")!;
    fixture.files.set(
      "index.html",
      markup.startsWith("<meta")
        ? home.replace("</head>", `${markup}</head>`)
        : home.replace("</main>", `${markup}</main>`),
    );

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }).map(({ code }) => code),
    ).toContain("monetization-off");
  });

  it("requires privacy and disclosure wording to match the active mode", () => {
    const fixture = validBuiltFixture();
    for (const fileName of [
      "privacy/index.html",
      "advertising-disclosure/index.html",
    ]) {
      fixture.files.set(
        fileName,
        fixture.files
          .get(fileName)!
          .replaceAll("No advertising", "Advertising wording drifted"),
      );
    }

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }).map(({ code }) => code),
    ).toContain("monetization-copy");
  });

  it("propagates exact managed-image tuple validation through full built-output QA", () => {
    const fixture = validBuiltFixture();
    const article = fixture.articles[0]!;
    const publicUrl = `/images/articles/${article.data.slug}-decision-flow.png`;
    const articleFile = `articles/${article.data.slug}/index.html`;
    article.body += `\n\n![Decision workflow with approval and review steps](${publicUrl})`;
    fixture.files.set(publicUrl.slice(1), "[binary resource]");
    fixture.files.set(
      articleFile,
      fixture.files
        .get(articleFile)!
        .replace(
          '<div class="article-body"><h2 id="decision">Decision</h2></div>',
          `<div class="article-body"><h2 id="decision">Decision</h2><img src="${publicUrl}" alt="Decision workflow with approval and review steps" width="23" height="15" loading="lazy" decoding="async"></div>`,
        ),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
      managedImageAudit: {
        findings: [],
        publishedImages: [
          {
            articleSlug: article.data.slug,
            filename: `${article.data.slug}-decision-flow.png`,
            height: 16,
            publicUrl,
            width: 24,
          },
        ],
        referencedImages: [],
      },
    }).map(({ code }) => code);

    expect(codes).toContain("managed-image-rendered-tuple");
  });

  it("keeps draft, review, and archived entries out of every expected public inventory", () => {
    const fixture = validBuiltFixture();
    const excluded = addExcludedLifecycleArticles(fixture);

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }),
    ).toEqual([]);

    for (const article of excluded) {
      expect(
        fixture.files.has(`articles/${article.data.slug}/index.html`),
      ).toBe(false);
      expect(fixture.files.has(`social/article-${article.data.slug}.png`)).toBe(
        false,
      );
    }
  });

  it.each([
    ["home", "index.html"],
    ["article archive", "articles/index.html"],
    ["category", "categories/ai-automation/index.html"],
    ["publisher", "publisher/index.html"],
    ["HTML sitemap", "sitemap/index.html"],
    ["RSS", "rss.xml"],
    ["related reading", "articles/ai-automation-guide-1/index.html"],
  ])("detects non-published leakage in the %s sink", (_sink, fileName) => {
    const fixture = validBuiltFixture();
    const excluded = addExcludedLifecycleArticles(fixture);
    const current = fixture.files.get(fileName)!;
    fixture.files.set(
      fileName,
      `${current}\n${excluded.map(({ data }) => `${data.title} /articles/${data.slug}/`).join("\n")}`,
    );

    const leakage = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).filter(({ code }) => code === "nonpublished-leakage");

    expect(leakage).toHaveLength(3);
  });

  it("rejects a social image generated for a non-published entry", () => {
    const fixture = validBuiltFixture();
    const [draft] = addExcludedLifecycleArticles(fixture);
    fixture.files.set(
      `social/article-${draft!.data.slug}.png`,
      "[binary resource]",
    );

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }).map(({ code }) => code),
    ).toContain("social-image-set");
  });

  it("rejects duplicate required robots directives", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "robots.txt",
      `${fixture.files.get("robots.txt")!}User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap-index.xml\n`,
    );

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }),
    ).toContainEqual(expect.objectContaining({ code: "robots-file" }));
  });

  it.each(["/articles/", "/*"])(
    "rejects a nonempty robots Disallow rule for %s",
    (disallowedPath) => {
      const fixture = validBuiltFixture();
      fixture.files.set(
        "robots.txt",
        `${fixture.files.get("robots.txt")!}Disallow: ${disallowedPath}\n`,
      );

      expect(
        validateBuiltOutput({
          files: fixture.files,
          articles: fixture.articles,
          categorySlugs: [...categorySlugs],
          siteUrl,
        }),
      ).toContainEqual(expect.objectContaining({ code: "robots-file" }));
    },
  );

  it.each([
    ["sitemap-index.xml", "sitemapindex"],
    ["sitemap-0.xml", "urlset"],
  ])("requires the Sitemap 0.9 namespace on %s", (fileName, rootName) => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      fileName,
      fixture.files
        .get(fileName)!
        .replace(
          `<${rootName} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          `<${rootName}>`,
        ),
    );

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }),
    ).toContainEqual(expect.objectContaining({ code: "sitemap-structure" }));
  });

  it.each([
    {
      name: "missing RSS 2.0 version",
      mutate: (rss: string) => rss.replace('<rss version="2.0">', "<rss>"),
    },
    {
      name: "empty channel title",
      mutate: (rss: string) =>
        rss.replace("<title>Everyday Tech Insight</title>", "<title></title>"),
    },
    {
      name: "empty channel description",
      mutate: (rss: string) =>
        rss.replace(
          "<description>Practical business technology guidance.</description>",
          "<description></description>",
        ),
    },
    {
      name: "item without a nonempty title or description",
      mutate: (rss: string) =>
        rss.replace(/<item><title>[^<]+<\/title>/, "<item><title></title>"),
    },
  ])("rejects $name", ({ mutate }) => {
    const fixture = validBuiltFixture();
    fixture.files.set("rss.xml", mutate(fixture.files.get("rss.xml")!));

    expect(
      validateBuiltOutput({
        files: fixture.files,
        articles: fixture.articles,
        categorySlugs: [...categorySlugs],
        siteUrl,
      }),
    ).toContainEqual(expect.objectContaining({ code: "feed-structure" }));
  });

  it.each([
    {
      name: "missing Open Graph image",
      code: "social-image",
      mutate: (html: string) =>
        html.replace(/<meta property="og:image"[^>]+>/, ""),
    },
    {
      name: "wrong Open Graph width",
      code: "social-image-width",
      mutate: (html: string) => html.replace('content="1200"', 'content="600"'),
    },
    {
      name: "wrong Open Graph MIME type",
      code: "social-image-type",
      mutate: (html: string) =>
        html.replace('content="image/png"', 'content="image/jpeg"'),
    },
    {
      name: "Twitter image mismatch",
      code: "twitter-image",
      mutate: (html: string) =>
        html.replace(
          /<meta name="twitter:image"[^>]+>/,
          `<meta name="twitter:image" content="${siteUrl}social/other.png">`,
        ),
    },
    {
      name: "missing Apple icon link",
      code: "apple-touch-icon-link",
      mutate: (html: string) =>
        html.replace(/<link rel="apple-touch-icon"[^>]+>/, ""),
    },
    {
      name: "missing manifest link",
      code: "manifest-link",
      mutate: (html: string) => html.replace(/<link rel="manifest"[^>]+>/, ""),
    },
  ])("rejects $name", ({ code, mutate }) => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "about/index.html",
      mutate(fixture.files.get("about/index.html")!),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code: issueCode }) => issueCode);

    expect(codes).toContain(code);
  });

  it("rejects a default social image on an article route", () => {
    const fixture = validBuiltFixture();
    const fileName = "articles/ai-automation-guide-1/index.html";
    fixture.files.set(
      fileName,
      fixture.files
        .get(fileName)!
        .replaceAll(
          `${siteUrl}social/article-ai-automation-guide-1.png`,
          `${siteUrl}social/default.png`,
        ),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toContain("social-image-route");
  });

  it.each([
    {
      name: "missing social image",
      mutate: (files: Map<string, string>) =>
        files.delete("social/category-ai-automation.png"),
    },
    {
      name: "stale extra social image",
      mutate: (files: Map<string, string>) =>
        files.set("social/stale-preview.png", "[binary resource]"),
    },
  ])("rejects a $name in the generated portfolio", ({ mutate }) => {
    const fixture = validBuiltFixture();
    mutate(fixture.files);

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toContain("social-image-set");
  });

  it("treats the all-guides route as a website and scopes category membership to main", () => {
    const fixture = validBuiltFixture();
    const categoryFile = "categories/ai-automation/index.html";
    fixture.files.set(
      categoryFile,
      fixture.files
        .get(categoryFile)!
        .replace(
          "</body>",
          '<footer><a href="/articles/">Guides</a></footer></body>',
        ),
    );

    const issues = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    });

    expect(issues).toEqual([]);
  });

  it("keeps category membership in neutral stable slug order instead of promoting featured guides", () => {
    const fixture = validBuiltFixture();
    const categoryArticles = fixture.articles.filter(
      ({ data }) => data.category === "ai-automation",
    );
    categoryArticles[0]!.data.featured = false;
    categoryArticles[1]!.data.featured = true;

    const issues = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    });

    expect(issues).toEqual([]);
  });

  it("rejects incomplete all-guides archive membership", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "articles/index.html",
      fixture.files
        .get("articles/index.html")!
        .replace(/<a href="\/articles\/[^"]+\/">[^<]+<\/a>/, ""),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toContain("article-archive-membership");
  });

  it("rejects duplicate category guide occurrences even when the membership set remains complete", () => {
    const fixture = validBuiltFixture();
    const categoryFile = "categories/ai-automation/index.html";
    const duplicate = `<a href="/articles/ai-automation-guide-1/">Practical technology decision guide number 1</a>`;
    fixture.files.set(
      categoryFile,
      fixture.files
        .get(categoryFile)!
        .replace(duplicate, duplicate + duplicate),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(["category-membership"]);
  });

  it("rejects duplicate guide occurrences within an archive category", () => {
    const fixture = validBuiltFixture();
    const archiveFile = "articles/index.html";
    const duplicate = `<a href="/articles/ai-automation-guide-1/">Practical technology decision guide number 1</a>`;
    fixture.files.set(
      archiveFile,
      fixture.files.get(archiveFile)!.replace(duplicate, duplicate + duplicate),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual([
      "article-archive-membership",
      "article-archive-category-membership",
    ]);
  });

  it("rejects guides moved between archive categories while global membership remains complete", () => {
    const fixture = validBuiltFixture();
    const archiveFile = "articles/index.html";
    const first = `<a href="/articles/ai-automation-guide-1/">Practical technology decision guide number 1</a>`;
    const second = `<a href="/articles/business-software-guide-1/">Practical technology decision guide number 4</a>`;
    fixture.files.set(
      archiveFile,
      fixture.files
        .get(archiveFile)!
        .replace(first, "ARCHIVE-CATEGORY-SWAP")
        .replace(second, first)
        .replace("ARCHIVE-CATEGORY-SWAP", second),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(["article-archive-category-membership"]);
  });

  it("rejects duplicate article fit, TOC, heading-link, and ID structures", () => {
    const fixture = validBuiltFixture();
    const articleFile = "articles/ai-automation-guide-1/index.html";
    const article = fixture.files.get(articleFile)!;
    fixture.files.set(
      articleFile,
      article.replace(
        "</main>",
        `<section class="fit-summary fit-summary--mobile"><h2>At a glance</h2></section>
         <details class="table-of-contents__mobile"><summary>On this page</summary><a href="#decision">Decision</a></details>
         <div id="decision"></div></main>`,
      ),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "fit-summary-count",
        "at-a-glance-count",
        "toc-count",
        "toc-link-count",
        "duplicate-id",
      ]),
    );
  });

  it("requires the shared trust shell on all seven trust pages and the 404", () => {
    const fixture = validBuiltFixture();
    fixture.files.set(
      "about/index.html",
      fixture.files
        .get("about/index.html")!
        .replace("trust-content trust-page", "trust-content"),
    );
    fixture.files.set(
      "publisher/index.html",
      fixture.files
        .get("publisher/index.html")!
        .replace("trust-page__intro", "legacy-intro"),
    );
    fixture.files.set(
      "404.html",
      fixture.files
        .get("404.html")!
        .replace("trust-page__related", "legacy-related"),
    );

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "trust-page-shell",
        "trust-page-intro",
        "trust-page-related-nav",
      ]),
    );
  });

  it.each([
    {
      name: "a duplicate valid link replacing About",
      fileName: "publisher/index.html",
      code: "trust-page-related-links",
      mutate: (html: string) =>
        html.replace(
          '<a href="/about/">About</a>',
          '<a href="/publisher/">Publisher</a>',
        ),
    },
    {
      name: "a wrong link label",
      fileName: "publisher/index.html",
      code: "trust-page-related-links",
      mutate: (html: string) =>
        html.replace(
          '<a href="/privacy/">Privacy</a>',
          '<a href="/privacy/">Privacy policy</a>',
        ),
    },
    {
      name: "the canonical links in the wrong order",
      fileName: "publisher/index.html",
      code: "trust-page-related-links",
      mutate: (html: string) =>
        html
          .replace('<a href="/about/">About</a>', "__ABOUT_LINK__")
          .replace(
            '<a href="/publisher/" aria-current="page">Publisher</a>',
            '<a href="/about/">About</a>',
          )
          .replace(
            "__ABOUT_LINK__",
            '<a href="/publisher/" aria-current="page">Publisher</a>',
          ),
    },
    {
      name: "a missing current-page marker",
      fileName: "publisher/index.html",
      code: "trust-page-related-current",
      mutate: (html: string) =>
        html.replace(
          '<a href="/publisher/" aria-current="page">Publisher</a>',
          '<a href="/publisher/">Publisher</a>',
        ),
    },
    {
      name: "a current-page marker on the wrong trust link",
      fileName: "publisher/index.html",
      code: "trust-page-related-current",
      mutate: (html: string) =>
        html
          .replace(
            '<a href="/about/">About</a>',
            '<a href="/about/" aria-current="page">About</a>',
          )
          .replace(
            '<a href="/publisher/" aria-current="page">Publisher</a>',
            '<a href="/publisher/">Publisher</a>',
          ),
    },
    {
      name: "a current-page marker on the 404 navigation",
      fileName: "404.html",
      code: "trust-page-related-current",
      mutate: (html: string) =>
        html.replace(
          '<a href="/about/">About</a>',
          '<a href="/about/" aria-current="page">About</a>',
        ),
    },
  ])("rejects $name", ({ fileName, code, mutate }) => {
    const fixture = validBuiltFixture();
    const original = fixture.files.get(fileName)!;
    const mutated = mutate(original);
    expect(mutated).not.toBe(original);
    fixture.files.set(fileName, mutated);

    const codes = validateBuiltOutput({
      files: fixture.files,
      articles: fixture.articles,
      categorySlugs: [...categorySlugs],
      siteUrl,
    }).map(({ code: findingCode }) => findingCode);

    expect(codes).toContain(code);
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
    const duplicateTitle = about.match(/<title>([^<]+)<\/title>/)?.[1];
    const duplicateDescription = about.match(
      /<meta name="description" content="([^"]+)"/,
    )?.[1];
    if (!duplicateTitle || !duplicateDescription) {
      throw new Error(
        "The valid fixture must expose title and description metadata.",
      );
    }
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
        .replace(/(<title>)[^<]+/, `$1${duplicateTitle}`)
        .replace(
          /(<meta name="description" content=")[^"]+/,
          `$1${duplicateDescription}`,
        )
        .replace(
          /(<meta property="og:title" content=")[^"]+/,
          `$1${duplicateTitle}`,
        )
        .replace(
          /(<meta property="og:description" content=")[^"]+/,
          `$1${duplicateDescription}`,
        ),
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
        "nonpublished-leakage",
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
        .replace(`<link>${siteUrl}</link>`, "<link>/</link>")
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

  it("selects the run closest to every category median as representative", () => {
    const result = aggregateLighthouseScores([
      {
        performance: 0.9,
        accessibility: 1,
        "best-practices": 1,
        seo: 1,
      },
      {
        performance: 0.91,
        accessibility: 0.95,
        "best-practices": 0.95,
        seo: 0.95,
      },
      {
        performance: 0.92,
        accessibility: 0.99,
        "best-practices": 0.99,
        seo: 0.99,
      },
    ]);

    expect(result).toMatchObject({
      scores: {
        performance: 0.91,
        accessibility: 0.99,
        "best-practices": 0.99,
        seo: 0.99,
      },
      representativeRunIndex: 2,
    });
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

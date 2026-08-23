import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

type ProductionRoute = {
  path: string;
  expectedStatus: number;
  kind: "html" | "text";
  canonicalPath?: string;
};

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FixtureFetch = (input: FetchInput, init?: FetchInit) => Promise<Response>;

type FetchOverride = {
  body?: string;
  description?: string;
  error?: Error;
  headers?: Record<string, string>;
  status?: number;
  title?: string;
};

type ProductionSmokeModule =
  typeof import("../../scripts/check-production.mjs");
type FixtureProductionSmokeModule = Omit<
  ProductionSmokeModule,
  "inspectHtml" | "runProductionCheck"
> & {
  inspectHtml: (
    html: string,
    options: {
      origin: string;
      route?: string;
      canonicalPath?: string;
    },
  ) => ReturnType<ProductionSmokeModule["inspectHtml"]>;
  runProductionCheck: (options: {
    origin: string;
    fetchImpl?: FixtureFetch;
    routes?: ReadonlyArray<ProductionRoute>;
  }) => ReturnType<ProductionSmokeModule["runProductionCheck"]>;
};

function asFixtureProductionSmoke(
  productionSmoke: ProductionSmokeModule,
): FixtureProductionSmokeModule {
  return productionSmoke as unknown as FixtureProductionSmokeModule;
}

function fetchUrl(input: FetchInput) {
  return new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
}

const fixtureOrigin = "https://host.example";

function htmlFixture({
  title = "Fixture page | Everyday Tech Insight",
  description = "A distinct fixture description for production smoke validation.",
  canonical = `${fixtureOrigin}/fixture/`,
  socialImage = `${fixtureOrigin}/social/default.png`,
  extra = "",
} = {}) {
  return `<!doctype html>
    <html lang="en-US">
      <head>
        <title>${title}</title>
        <meta name="description" content="${description}">
        <link rel="canonical" href="${canonical}">
        <link rel="icon" href="/favicon.svg">
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
        <link rel="manifest" href="/manifest.webmanifest">
        <meta property="og:image" content="${socialImage}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:image:type" content="image/png">
        <meta property="og:image:alt" content="Social preview for this fixture page.">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:image" content="${socialImage}">
        <meta name="twitter:image:alt" content="Social preview for this fixture page.">
      </head>
      <body>
        <header><a href="/" aria-label="Everyday Tech Insight home">ETI</a></header>
        <main id="main-content">
          <h1 id="page-title">Fixture page</h1>
          <section class="fit-summary"><h2>At a glance</h2></section>
          <nav aria-label="On this page"><a href="#section-one">Section one</a></nav>
          <h2 id="section-one">Section one</h2>
          ${extra}
        </main>
        <footer>
          <nav><h2>Publication</h2></nav>
          <nav><h2>Topics</h2></nav>
          <nav><h2>Standards &amp; transparency</h2></nav>
          <nav><h2>Legal &amp; feeds</h2></nav>
        </footer>
      </body>
    </html>`;
}

function minifiedHtmlFixture(options: Parameters<typeof htmlFixture>[0] = {}) {
  return htmlFixture(options).replace(/>\s+</g, "><");
}

describe("normalizeOrigin", () => {
  it("returns a stable HTTP(S) origin and rejects non-origin input", async () => {
    const productionSmoke =
      await import("../../scripts/check-production.mjs").catch(() => ({}));

    expect(productionSmoke).toHaveProperty("normalizeOrigin");
    if (!("normalizeOrigin" in productionSmoke)) return;

    const { normalizeOrigin } = productionSmoke;
    expect(normalizeOrigin("  https://Host.Example:443/  ")).toBe(
      "https://host.example",
    );
    expect(normalizeOrigin("http://127.0.0.1:4321/")).toBe(
      "http://127.0.0.1:4321",
    );
    expect(() => normalizeOrigin("https://host.example/path")).toThrow(
      /origin/i,
    );
    expect(() => normalizeOrigin("ftp://host.example")).toThrow(/HTTP/i);
    expect(() => normalizeOrigin("https://user@host.example")).toThrow(
      /credentials/i,
    );
  });
});

function fixtureSocialImagePath(routePath: string) {
  const category = /^\/categories\/([^/]+)\/$/.exec(routePath)?.[1];
  if (category) return `/social/category-${category}.png`;
  const article = /^\/articles\/([^/]+)\/$/.exec(routePath)?.[1];
  if (article) return `/social/article-${article}.png`;
  return "/social/default.png";
}

describe("collectInternalAssets", () => {
  it("collects unique root-relative resources and downloadable files", async () => {
    const productionSmoke = await import("../../scripts/check-production.mjs");

    expect(productionSmoke).toHaveProperty("collectInternalAssets");
    if (!("collectInternalAssets" in productionSmoke)) return;

    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="/styles/site.css">
          <link rel="preload" href="/fonts/publication.woff2" as="font">
        </head>
        <body>
          <img src="/images/hero.png#crop" srcset="/images/hero-small.png 1x, /images/hero.png 2x">
          <video poster="/images/poster.jpg"><source src="/media/story.mp4"></video>
          <script src="/scripts/site.js?release=1"></script>
          <a href="/toolkit/checklist.csv" download>Download</a>
          <a href="/about/">Not an asset</a>
          <img src="https://cdn.example/external.png">
          <script src="//cdn.example/external.js"></script>
        </body>
      </html>
    `;

    expect(productionSmoke.collectInternalAssets(html)).toEqual([
      {
        expectedType: "font",
        reference: "link[as=font]",
        url: "/fonts/publication.woff2",
      },
      {
        expectedType: "image",
        reference: "img[srcset]",
        url: "/images/hero-small.png",
      },
      {
        expectedType: "image",
        reference: "img[src]",
        url: "/images/hero.png",
      },
      {
        expectedType: "image",
        reference: "img[srcset]",
        url: "/images/hero.png",
      },
      {
        expectedType: "image",
        reference: "video[poster]",
        url: "/images/poster.jpg",
      },
      {
        expectedType: "video",
        reference: "source[src]",
        url: "/media/story.mp4",
      },
      {
        expectedType: "script",
        reference: "script[src]",
        url: "/scripts/site.js?release=1",
      },
      {
        expectedType: "style",
        reference: "link[rel=stylesheet]",
        url: "/styles/site.css",
      },
      {
        expectedType: "text/csv",
        reference: "a[download]",
        url: "/toolkit/checklist.csv",
      },
    ]);
  });
});

describe("inspectHtml", () => {
  it("accepts the current publication shell and returns its metadata and assets", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    expect(productionSmoke).toHaveProperty("inspectHtml");
    if (!("inspectHtml" in productionSmoke)) return;

    expect(
      productionSmoke.inspectHtml(htmlFixture(), {
        origin: fixtureOrigin,
        route: "/fixture/",
      }),
    ).toEqual({
      assets: [
        {
          expectedType: "image",
          reference: "link[rel=icon]",
          url: "/apple-touch-icon.png",
        },
        {
          expectedType: "image",
          reference: "link[rel=icon]",
          url: "/favicon.svg",
        },
        {
          expectedType: "non-html",
          reference: "link[href]",
          url: "/manifest.webmanifest",
        },
        {
          expectedType: "image/png",
          reference: "meta[property=og:image]",
          url: "/social/default.png",
        },
      ],
      canonical: `${fixtureOrigin}/fixture/`,
      description:
        "A distinct fixture description for production smoke validation.",
      issues: [],
      title: "Fixture page | Everyday Tech Insight",
    });
  });

  it.each([
    {
      name: "missing masthead accessible-name signature",
      code: "masthead",
      html: () =>
        htmlFixture().replace(
          "Everyday Tech Insight home",
          "Different home label",
        ),
    },
    {
      name: "missing footer group signature",
      code: "footer-groups",
      html: () => htmlFixture().replace("<h2>Topics</h2>", "<h2>More</h2>"),
    },
    {
      name: "multiple H1 elements",
      code: "h1-count",
      html: () => htmlFixture({ extra: "<h1>Second page title</h1>" }),
    },
    {
      name: "zero H1 elements",
      code: "h1-count",
      html: () =>
        htmlFixture().replace('<h1 id="page-title">Fixture page</h1>', ""),
    },
    {
      name: "empty title",
      code: "title",
      html: () => htmlFixture({ title: " " }),
    },
    {
      name: "absent title",
      code: "title",
      html: () =>
        htmlFixture().replace(
          "<title>Fixture page | Everyday Tech Insight</title>",
          "",
        ),
    },
    {
      name: "empty description",
      code: "description",
      html: () => htmlFixture({ description: " " }),
    },
    {
      name: "absent description",
      code: "description",
      html: () =>
        htmlFixture().replace(
          '<meta name="description" content="A distinct fixture description for production smoke validation.">',
          "",
        ),
    },
    {
      name: "off-origin canonical",
      code: "canonical-origin",
      html: () => htmlFixture({ canonical: "https://wrong.example/fixture/" }),
    },
    {
      name: "same-origin wrong-path canonical",
      code: "canonical-origin",
      html: () => htmlFixture({ canonical: `${fixtureOrigin}/privacy/` }),
      route: "/about/",
    },
    {
      name: "same-path canonical with unexpected search",
      code: "canonical-origin",
      html: () => htmlFixture({ canonical: `${fixtureOrigin}/fixture/?ref=1` }),
    },
    {
      name: "duplicate fit summary",
      code: "duplicate-fit-summary",
      html: () =>
        htmlFixture({
          extra: '<section class="fit-summary"><h2>Business fit</h2></section>',
        }),
    },
    {
      name: "two minified At a glance signatures adjacent to following text",
      code: "duplicate-at-a-glance",
      html: () =>
        minifiedHtmlFixture({
          extra: "<p>At a glance</p><p>Next section</p>",
        }),
    },
    {
      name: "desktop nav and mobile details copies of On this page",
      code: "duplicate-toc",
      html: () =>
        minifiedHtmlFixture({
          extra:
            '<details><summary>On this page</summary><ol><li><a href="#section-one">Section one</a></li></ol></details>',
        }),
    },
    {
      name: "duplicate IDs",
      code: "duplicate-id",
      html: () => htmlFixture({ extra: '<div id="page-title"></div>' }),
    },
    {
      name: "missing social image metadata",
      code: "social-image",
      html: () => htmlFixture().replace(/<meta property="og:image"[^>]+>/, ""),
    },
    {
      name: "off-origin social image",
      code: "social-image",
      html: () =>
        htmlFixture().replaceAll(
          `${fixtureOrigin}/social/default.png`,
          "https://cdn.example/social/default.png",
        ),
    },
    {
      name: "default social image on a category route",
      code: "social-image",
      route: "/categories/ai-automation/",
      html: () =>
        htmlFixture({
          canonical: `${fixtureOrigin}/categories/ai-automation/`,
          socialImage: `${fixtureOrigin}/social/default.png`,
        }),
    },
    {
      name: "swapped social image on an article route",
      code: "social-image",
      route: "/articles/how-to-identify-business-tasks-for-automation/",
      html: () =>
        htmlFixture({
          canonical: `${fixtureOrigin}/articles/how-to-identify-business-tasks-for-automation/`,
          socialImage: `${fixtureOrigin}/social/article-evaluate-saas-with-a-practical-checklist.png`,
        }),
    },
    {
      name: "incomplete social image dimensions",
      code: "social-image-width",
      html: () =>
        htmlFixture().replace(
          '<meta property="og:image:width" content="1200">',
          "",
        ),
    },
    {
      name: "small Twitter card",
      code: "twitter-card",
      html: () => htmlFixture().replace("summary_large_image", "summary"),
    },
    {
      name: "mismatched Twitter image",
      code: "twitter-image",
      html: () =>
        htmlFixture().replace(
          `<meta name="twitter:image" content="${fixtureOrigin}/social/default.png">`,
          `<meta name="twitter:image" content="${fixtureOrigin}/social/other.png">`,
        ),
    },
  ])("rejects $name", async ({ code, html, route = "/fixture/" }) => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    expect(productionSmoke).toHaveProperty("inspectHtml");
    if (!("inspectHtml" in productionSmoke)) return;

    const result = productionSmoke.inspectHtml(html(), {
      origin: fixtureOrigin,
      route,
    });
    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).toContain(code);
  });

  it.each([
    {
      name: "Current issue",
      extra:
        '<section aria-labelledby="front-page-heading"><h2 id="front-page-heading" class="visually-hidden">Current issue</h2><p>Next guide</p></section>',
    },
    {
      name: "Complete issue",
      extra:
        '<div class="section-heading"><p class="section-heading__eyebrow">Complete issue</p><h2>Every guide</h2></div>',
    },
  ])(
    "rejects the minified homepage $name shell signature adjacent to following text",
    async ({ extra }) => {
      const productionSmoke = asFixtureProductionSmoke(
        await import("../../scripts/check-production.mjs"),
      );

      const result = productionSmoke.inspectHtml(
        minifiedHtmlFixture({
          canonical: `${fixtureOrigin}/`,
          extra,
        }),
        { origin: fixtureOrigin, route: "/" },
      );

      expect(
        result.issues.map((issue: { code: string }) => issue.code),
      ).toContain("legacy-shell");
    },
  );

  it("allows legacy-shell words in ordinary article prose", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );
    const route = "/articles/ordinary-prose/";

    const result = productionSmoke.inspectHtml(
      minifiedHtmlFixture({
        canonical: `${fixtureOrigin}${route}`,
        extra:
          "<p>The Current issue is discussed here, and the Complete issue is linked for context.</p>",
      }),
      { origin: fixtureOrigin, route },
    );

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).not.toContain("legacy-shell");
  });

  it("rejects executable analytics code without treating nearby prose as the signal", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        extra: `
          <p>This article explains why analytics and tracking claims need evidence.</p>
          <script>window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: "page_view" });</script>
        `,
      }),
      { origin: fixtureOrigin, route: "/fixture/" },
    );
    const codes = result.issues.map((issue: { code: string }) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining(["executable-script", "tracking-signature"]),
    );
  });

  it("rejects an external advertising script as executable, off-origin, and tracking-related", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        extra:
          '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456"></script>',
      }),
      { origin: fixtureOrigin, route: "/fixture/" },
    );
    const codes = result.issues.map((issue: { code: string }) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "executable-script",
        "external-resource-url",
        "tracking-signature",
      ]),
    );
  });

  it("rejects a generic external resource URL even when it has no tracking signature", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        extra: '<img src="https://static.example/illustration.png" alt="">',
      }),
      { origin: fixtureOrigin, route: "/fixture/" },
    );
    const codes = result.issues.map((issue: { code: string }) => issue.code);

    expect(codes).toContain("external-resource-url");
    expect(codes).not.toContain("tracking-signature");
  });

  it("rejects off-origin resources hidden in style elements and style attributes", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        extra: `
          <style>
            @import "https://styles.tracker.example/publication.css";
            .pixel { background-image: url(https://images.tracker.example/pixel.gif); }
          </style>
          <div style="background-image: url('//inline.tracker.example/pixel.gif')"></div>
        `,
      }),
      { origin: fixtureOrigin, route: "/fixture/" },
    );

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).toContain("external-resource-url");
  });

  it("rejects a mixed srcset when a data URL precedes an external candidate", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        extra: `
          <img
            alt=""
            srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw== 1x, https://images.tracker.example/pixel.gif 2x"
          >
        `,
      }),
      { origin: fixtureOrigin, route: "/fixture/" },
    );

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).toContain("external-resource-url");
  });

  it("allows same-origin and data-only URLs in inline CSS and srcset", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        extra: `
          <style>
            @import "/styles/print.css";
            .icon { background-image: url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E"); }
          </style>
          <div style="background-image: url('/images/local.svg')"></div>
          <img alt="" srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw== 1x">
        `,
      }),
      { origin: fixtureOrigin, route: "/fixture/" },
    );

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).not.toContain("external-resource-url");
  });

  it("allows JSON-LD and advertising, analytics, and tracking words in ordinary prose", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        extra: `
          <p>Advertising, analytics, and tracking are discussed as publication policy.</p>
          <script type="application/ld+json">{"@context":"https://schema.org","description":"No advertising analytics or tracking code is enabled."}</script>
          <a href="https://support.google.com/analytics/">Read an external source</a>
        `,
      }),
      { origin: fixtureOrigin, route: "/fixture/" },
    );
    const codes = result.issues.map((issue: { code: string }) => issue.code);

    for (const code of [
      "executable-script",
      "external-resource-url",
      "tracking-signature",
    ]) {
      expect(codes).not.toContain(code);
    }
  });
});

describe("production route smoke", () => {
  const requiredPaths = [
    "/",
    "/categories/",
    "/articles/",
    "/categories/ai-automation/",
    "/categories/business-software/",
    "/categories/cybersecurity-data-protection/",
    "/categories/digital-operations/",
    "/categories/technology-strategy/",
    "/articles/how-to-identify-business-tasks-for-automation/",
    "/articles/evaluate-saas-with-a-practical-checklist/",
    "/articles/back-up-business-files-with-the-3-2-1-method/",
    "/articles/create-a-shared-file-and-folder-system/",
    "/articles/calculate-the-total-cost-of-business-software/",
    "/articles/create-a-simple-technology-risk-register/",
    "/articles/crm-vs-project-management-software/",
    "/articles/document-a-repetitive-workflow-before-automating/",
    "/articles/evaluate-ai-output-quality-in-a-small-team-pilot/",
    "/articles/onboard-employees-and-contractors-to-business-technology/",
    "/articles/respond-to-a-suspected-phishing-message/",
    "/articles/roll-out-mfa-across-a-small-business/",
    "/articles/run-a-30-day-business-technology-pilot/",
    "/articles/test-data-export-and-integrations-before-saas-lock-in/",
    "/articles/write-a-practical-ai-acceptable-use-policy/",
    "/toolkit/",
    "/toolkit/automation-candidate-screen/",
    "/toolkit/saas-evaluation-evidence-sheet/",
    "/toolkit/technology-risk-register/",
    "/toolkit/backup-restore-test-log/",
    "/about/",
    "/publisher/",
    "/editorial-standards/",
    "/corrections/",
    "/contact/",
    "/privacy/",
    "/advertising-disclosure/",
    "/sitemap/",
    "/rss.xml",
    "/robots.txt",
    "/production-smoke-route-that-must-not-exist/",
  ];

  async function loadRunner() {
    const productionSmoke = await import("../../scripts/check-production.mjs");
    expect(productionSmoke).toHaveProperty("PRODUCTION_ROUTES");
    expect(productionSmoke).toHaveProperty("runProductionCheck");
    expect(productionSmoke).toHaveProperty("formatProductionReport");
    return asFixtureProductionSmoke(productionSmoke);
  }

  function makeFetch(
    routes: ReadonlyArray<ProductionRoute>,
    overrides: Record<string, FetchOverride> = {},
  ) {
    return vi.fn(async (input: FetchInput, init?: FetchInit) => {
      void init;
      const url = fetchUrl(input);
      const override = overrides[url.pathname] ?? {};
      if (override.error) throw override.error;

      if (
        url.pathname === "/favicon.svg" ||
        url.pathname === "/apple-touch-icon.png" ||
        (url.pathname.startsWith("/social/") && url.pathname.endsWith(".png"))
      ) {
        return new Response(override.body ?? "<svg></svg>", {
          status: override.status ?? 200,
          headers: {
            "content-type": url.pathname.endsWith(".svg")
              ? "image/svg+xml"
              : "image/png",
            ...override.headers,
          },
        });
      }
      if (url.pathname === "/manifest.webmanifest") {
        return new Response(override.body ?? "{}", {
          status: override.status ?? 200,
          headers: {
            "content-type": "application/manifest+json",
            ...override.headers,
          },
        });
      }

      const route = routes.find(({ path }) => path === url.pathname);
      if (!route) {
        if (Object.hasOwn(overrides, url.pathname)) {
          return new Response(override.body ?? "asset fixture", {
            status: override.status ?? 200,
            headers: override.headers,
          });
        }
        return new Response("missing fixture", { status: 404 });
      }

      const status = override.status ?? route.expectedStatus;
      if (status >= 300 && status < 400) {
        return new Response(null, {
          status,
          headers: override.headers,
        });
      }
      if (route.kind === "text") {
        const contentType =
          route.path === "/rss.xml"
            ? "application/rss+xml; charset=utf-8"
            : "text/plain; charset=utf-8";
        return new Response(
          override.body ??
            (route.path === "/rss.xml"
              ? '<?xml version="1.0"?><rss></rss>'
              : "User-agent: *\nAllow: /\n"),
          {
            status,
            headers: { "content-type": contentType, ...override.headers },
          },
        );
      }

      const routeKey = route.path.replaceAll("/", "-") || "home";
      return new Response(
        override.body ??
          htmlFixture({
            title: override.title ?? `Page ${routeKey} | Everyday Tech Insight`,
            description:
              override.description ??
              `Production smoke description for the unique route ${route.path}`,
            canonical: `${fixtureOrigin}${route.canonicalPath ?? route.path}`,
            socialImage: `${fixtureOrigin}${fixtureSocialImagePath(route.path)}`,
          }),
        {
          status,
          headers: { "content-type": "text/html", ...override.headers },
        },
      );
    });
  }

  it("checks every required route and root-relative asset without following redirects", async () => {
    const productionSmoke = await loadRunner();
    if (
      !("PRODUCTION_ROUTES" in productionSmoke) ||
      !("runProductionCheck" in productionSmoke)
    )
      return;

    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "html" | "text";
      canonicalPath?: string;
    }>;
    expect(routes.map(({ path }) => path)).toEqual(requiredPaths);
    expect(routes.at(-1)).toMatchObject({
      canonicalPath: "/404.html",
      expectedStatus: 404,
      kind: "html",
    });

    const fetchImpl = makeFetch(routes);
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl,
    });

    expect(result).toMatchObject({
      checkedAssets: 24,
      checkedRoutes: requiredPaths.length,
      issues: [],
      routeResults: requiredPaths.map((path) => ({ path, status: "PASS" })),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(requiredPaths.length + 24);
    for (const [, options] of fetchImpl.mock.calls) {
      expect(options).toMatchObject({ redirect: "manual" });
    }

    const output = productionSmoke.formatProductionReport(
      fixtureOrigin,
      result,
    );
    const lines = output.split("\n");
    expect(lines.slice(0, requiredPaths.length)).toEqual(
      requiredPaths.map((path) => `PASS ${path}`),
    );
    expect(lines).toHaveLength(requiredPaths.length + 1);
    expect(lines.at(-1)).toMatch(/^Production smoke: PASS /);
  });

  const routeFailureCases: ReadonlyArray<{
    name: string;
    code: string;
    overrides: Record<string, FetchOverride>;
  }> = [
    {
      name: "unexpected route status",
      code: "status",
      overrides: { "/about/": { status: 503 } },
    },
    {
      name: "missing published article detail",
      code: "status",
      overrides: {
        "/articles/respond-to-a-suspected-phishing-message/": { status: 404 },
      },
    },
    {
      name: "missing Toolkit detail",
      code: "status",
      overrides: {
        "/toolkit/technology-risk-register/": { status: 404 },
      },
    },
    {
      name: "redirect response",
      code: "unexpected-redirect",
      overrides: {
        "/about/": {
          status: 308,
          headers: { location: "https://host.example/about" },
        },
      },
    },
    {
      name: "non-HTML content for an HTML route",
      code: "content-type",
      overrides: {
        "/about/": { headers: { "content-type": "text/plain" } },
      },
    },
    {
      name: "200 HTML response for RSS",
      code: "content-type",
      overrides: {
        "/rss.xml": {
          body: "<!doctype html><title>Fallback</title>",
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      },
    },
    {
      name: "non-text response for robots",
      code: "content-type",
      overrides: {
        "/robots.txt": { headers: { "content-type": "application/json" } },
      },
    },
    {
      name: "broken internal asset",
      code: "asset-status",
      overrides: { "/favicon.svg": { status: 404 } },
    },
    {
      name: "broken social image asset",
      code: "asset-status",
      overrides: { "/social/default.png": { status: 404 } },
    },
    {
      name: "internal asset fetch error",
      code: "asset-fetch-error",
      overrides: { "/favicon.svg": { error: new Error("asset offline") } },
    },
    {
      name: "route fetch error",
      code: "fetch-error",
      overrides: { "/about/": { error: new Error("offline") } },
    },
  ];

  it.each(routeFailureCases)("reports $name", async ({ code, overrides }) => {
    const productionSmoke = await loadRunner();
    if (
      !("PRODUCTION_ROUTES" in productionSmoke) ||
      !("runProductionCheck" in productionSmoke)
    )
      return;
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "html" | "text";
      canonicalPath?: string;
    }>;
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, overrides),
    });

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).toContain(code);
  });

  it("rejects a 200 HTML fallback for a root-relative PNG asset", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "html" | "text";
      canonicalPath?: string;
    }>;
    const fetchImpl = makeFetch(routes, {
      "/about/": {
        body: htmlFixture({
          title: "About fixture | Everyday Tech Insight",
          description: "A unique about fixture with a missing PNG asset.",
          canonical: `${fixtureOrigin}/about/`,
          extra: '<img src="/missing.png" alt="">',
        }),
      },
      "/missing.png": {
        body: "<!doctype html><title>Fallback</title>",
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 200,
      },
    });
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "asset-content-type",
        route: "/missing.png",
      }),
    );
  });

  it.each(["image/jpeg", "image/svg+xml"])(
    "rejects a production social PNG served as %s",
    async (contentType) => {
      const productionSmoke = await loadRunner();
      const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
        path: string;
        expectedStatus: number;
        kind: "html" | "text";
        canonicalPath?: string;
      }>;
      const result = await productionSmoke.runProductionCheck({
        origin: fixtureOrigin,
        fetchImpl: makeFetch(routes, {
          "/social/default.png": {
            headers: { "content-type": contentType },
            status: 200,
          },
        }),
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "asset-content-type",
          route: "/social/default.png",
        }),
      );
      expect(result.routeResults).toContainEqual({ path: "/", status: "FAIL" });
    },
  );

  it("rejects JSON served with 200 status for a PNG reference", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "html" | "text";
      canonicalPath?: string;
    }>;
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, {
        "/about/": {
          body: htmlFixture({
            title: "About image fixture | Everyday Tech Insight",
            description: "A unique about fixture with a typed image asset.",
            canonical: `${fixtureOrigin}/about/`,
            extra: '<img src="/missing.png" alt="">',
          }),
        },
        "/missing.png": {
          body: '{"fallback":true}',
          headers: { "content-type": "application/json" },
          status: 200,
        },
      }),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "asset-content-type",
        route: "/missing.png",
      }),
    );
  });

  it("accepts HTML for a same-origin iframe document reference", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "html" | "text";
      canonicalPath?: string;
    }>;
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, {
        "/about/": {
          body: htmlFixture({
            title: "About iframe fixture | Everyday Tech Insight",
            description: "A unique about fixture with an embedded document.",
            canonical: `${fixtureOrigin}/about/`,
            extra: '<iframe src="/embedded-page/"></iframe>',
          }),
        },
        "/embedded-page/": {
          body: "<!doctype html><title>Embedded page</title>",
          headers: { "content-type": "text/html; charset=utf-8" },
          status: 200,
        },
      }),
    });

    expect(result.issues).toEqual([]);
  });

  it("marks every owning route failed when its asset validation fails", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "html" | "text";
      canonicalPath?: string;
    }>;
    const fetchImpl = makeFetch(routes, {
      "/": {
        body: htmlFixture({
          title: "Home owner fixture | Everyday Tech Insight",
          description: "A unique homepage fixture with an owned bad asset.",
          canonical: `${fixtureOrigin}/`,
          extra: '<img src="/owned.png" alt="">',
        }),
      },
      "/about/": {
        body: htmlFixture({
          title: "About shared owner fixture | Everyday Tech Insight",
          description: "A second route that owns the same invalid asset.",
          canonical: `${fixtureOrigin}/about/`,
          extra: '<img src="/owned.png" alt="">',
        }),
      },
      "/owned.png": {
        body: "not an image",
        headers: { "content-type": "application/json" },
        status: 200,
      },
    });
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl,
    });

    expect(result.routeResults).toContainEqual({ path: "/", status: "FAIL" });
    expect(result.routeResults).toContainEqual({
      path: "/about/",
      status: "FAIL",
    });
    expect(result.routeResults).toContainEqual({
      path: "/publisher/",
      status: "PASS",
    });
    expect(
      fetchImpl.mock.calls.filter(
        ([input]) => fetchUrl(input).pathname === "/owned.png",
      ),
    ).toHaveLength(1);
  });

  it("formats route failures separately from passing routes and the summary", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "html" | "text";
      canonicalPath?: string;
    }>;
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, { "/about/": { status: 503 } }),
    });

    const lines = productionSmoke
      .formatProductionReport(fixtureOrigin, result)
      .split("\n");
    expect(lines).toContain("PASS /");
    expect(lines).toContain("FAIL /about/");
    expect(lines).toContainEqual(
      expect.stringMatching(/^Production smoke: FAIL /),
    );
  });

  it("reports duplicate nonempty titles and descriptions across HTML routes", async () => {
    const productionSmoke = await loadRunner();
    if (
      !("PRODUCTION_ROUTES" in productionSmoke) ||
      !("runProductionCheck" in productionSmoke)
    )
      return;
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "html" | "text";
      canonicalPath?: string;
    }>;
    const duplicateMetadata = {
      title: "Duplicated title | Everyday Tech Insight",
      description: "Duplicated route description for production smoke testing.",
    };
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, {
        "/about/": duplicateMetadata,
        "/publisher/": duplicateMetadata,
      }),
    });

    expect(result.issues.map((issue: { code: string }) => issue.code)).toEqual(
      expect.arrayContaining(["duplicate-title", "duplicate-description"]),
    );
  });
});

describe("production CLI contract", () => {
  it("resolves --origin before PRODUCTION_ORIGIN and accepts either source", async () => {
    const productionSmoke = await import("../../scripts/check-production.mjs");
    expect(productionSmoke).toHaveProperty("resolveProductionOrigin");
    if (!("resolveProductionOrigin" in productionSmoke)) return;

    expect(
      productionSmoke.resolveProductionOrigin(
        ["--origin", "https://cli.example/"],
        { PRODUCTION_ORIGIN: "https://environment.example" },
      ),
    ).toBe("https://cli.example");
    expect(
      productionSmoke.resolveProductionOrigin([], {
        PRODUCTION_ORIGIN: "https://environment.example/",
      }),
    ).toBe("https://environment.example");
    expect(() => productionSmoke.resolveProductionOrigin([], {})).toThrow(
      /--origin|PRODUCTION_ORIGIN/,
    );
  });

  it("is exposed as the check:production package script", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["check:production"]).toBe(
      "node scripts/check-production.mjs",
    );
  });
});

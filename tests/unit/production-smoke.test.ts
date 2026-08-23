import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

const fixtureOrigin = "https://host.example";

function htmlFixture({
  title = "Fixture page | Everyday Tech Insight",
  description = "A distinct fixture description for production smoke validation.",
  canonical = `${fixtureOrigin}/fixture/`,
  extra = "",
} = {}) {
  return `<!doctype html>
    <html lang="en-US">
      <head>
        <title>${title}</title>
        <meta name="description" content="${description}">
        <link rel="canonical" href="${canonical}">
        <link rel="icon" href="/favicon.svg">
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
      "/fonts/publication.woff2",
      "/images/hero-small.png",
      "/images/hero.png",
      "/images/poster.jpg",
      "/media/story.mp4",
      "/scripts/site.js?release=1",
      "/styles/site.css",
      "/toolkit/checklist.csv",
    ]);
  });
});

describe("inspectHtml", () => {
  it("accepts the current publication shell and returns its metadata and assets", async () => {
    const productionSmoke = await import("../../scripts/check-production.mjs");

    expect(productionSmoke).toHaveProperty("inspectHtml");
    if (!("inspectHtml" in productionSmoke)) return;

    expect(
      productionSmoke.inspectHtml(htmlFixture(), {
        origin: fixtureOrigin,
        route: "/fixture/",
      }),
    ).toEqual({
      assets: ["/favicon.svg"],
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
      name: "empty title",
      code: "title",
      html: () => htmlFixture({ title: " " }),
    },
    {
      name: "empty description",
      code: "description",
      html: () => htmlFixture({ description: " " }),
    },
    {
      name: "off-origin canonical",
      code: "canonical-origin",
      html: () => htmlFixture({ canonical: "https://wrong.example/fixture/" }),
    },
    {
      name: "Current issue legacy shell",
      code: "legacy-shell",
      html: () => htmlFixture({ extra: "<p>Current issue</p>" }),
    },
    {
      name: "Complete issue legacy shell",
      code: "legacy-shell",
      html: () => htmlFixture({ extra: "<p>Complete issue</p>" }),
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
      name: "duplicate At a glance signature",
      code: "duplicate-at-a-glance",
      html: () => htmlFixture({ extra: "<p>At a glance</p>" }),
    },
    {
      name: "duplicate On this page navigation",
      code: "duplicate-toc",
      html: () =>
        htmlFixture({ extra: '<nav aria-label="On this page"></nav>' }),
    },
    {
      name: "duplicate IDs",
      code: "duplicate-id",
      html: () => htmlFixture({ extra: '<div id="page-title"></div>' }),
    },
  ])("rejects $name", async ({ code, html }) => {
    const productionSmoke = await import("../../scripts/check-production.mjs");

    expect(productionSmoke).toHaveProperty("inspectHtml");
    if (!("inspectHtml" in productionSmoke)) return;

    const result = productionSmoke.inspectHtml(html(), {
      origin: fixtureOrigin,
      route: "/fixture/",
    });
    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).toContain(code);
  });
});

describe("production route smoke", () => {
  const requiredPaths = [
    "/",
    "/categories/",
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
    "/toolkit/",
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
    return productionSmoke;
  }

  function makeFetch(
    routes: ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "html" | "text";
    }>,
    overrides: Record<
      string,
      {
        body?: string;
        description?: string;
        error?: Error;
        headers?: Record<string, string>;
        status?: number;
        title?: string;
      }
    > = {},
  ) {
    return vi.fn(
      async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        );
        const override = overrides[url.pathname] ?? {};
        if (override.error) throw override.error;

        if (url.pathname === "/favicon.svg") {
          return new Response(override.body ?? "<svg></svg>", {
            status: override.status ?? 200,
            headers: {
              "content-type": "image/svg+xml",
              ...override.headers,
            },
          });
        }

        const route = routes.find(({ path }) => path === url.pathname);
        if (!route) return new Response("missing fixture", { status: 404 });

        const status = override.status ?? route.expectedStatus;
        if (status >= 300 && status < 400) {
          return new Response(null, {
            status,
            headers: override.headers,
          });
        }
        if (route.kind === "text") {
          return new Response(
            override.body ??
              (route.path === "/rss.xml"
                ? '<?xml version="1.0"?><rss></rss>'
                : "User-agent: *\nAllow: /\n"),
            { status, headers: override.headers },
          );
        }

        const routeKey = route.path.replaceAll("/", "-") || "home";
        return new Response(
          override.body ??
            htmlFixture({
              title:
                override.title ?? `Page ${routeKey} | Everyday Tech Insight`,
              description:
                override.description ??
                `Production smoke description for the unique route ${route.path}`,
              canonical: `${fixtureOrigin}${
                route.expectedStatus === 404 ? "/404.html" : route.path
              }`,
            }),
          {
            status,
            headers: { "content-type": "text/html", ...override.headers },
          },
        );
      },
    );
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
    }>;
    expect(routes.map(({ path }) => path)).toEqual(requiredPaths);
    expect(routes.at(-1)).toMatchObject({
      expectedStatus: 404,
      kind: "html",
    });

    const fetchImpl = makeFetch(routes);
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl,
    });

    expect(result).toMatchObject({
      checkedAssets: 1,
      checkedRoutes: requiredPaths.length,
      issues: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(requiredPaths.length + 1);
    for (const [, options] of fetchImpl.mock.calls) {
      expect(options).toMatchObject({ redirect: "manual" });
    }
  });

  it.each([
    {
      name: "unexpected route status",
      code: "status",
      overrides: { "/about/": { status: 503 } },
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
      name: "broken internal asset",
      code: "asset-status",
      overrides: { "/favicon.svg": { status: 404 } },
    },
    {
      name: "route fetch error",
      code: "fetch-error",
      overrides: { "/about/": { error: new Error("offline") } },
    },
  ])("reports $name", async ({ code, overrides }) => {
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
    }>;
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, overrides),
    });

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).toContain(code);
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

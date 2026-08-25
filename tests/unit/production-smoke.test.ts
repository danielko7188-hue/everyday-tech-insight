import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

type ProductionRoute = {
  path: string;
  expectedStatus: number;
  kind: "absent" | "html" | "text";
  canonicalPath?: string;
};

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FixtureFetch = (input: FetchInput, init?: FetchInit) => Promise<Response>;

type FetchOverride = {
  body?: BodyInit;
  description?: string;
  error?: Error;
  headers?: Record<string, string>;
  omitSecurityHeaders?: string[];
  responseUrl?: string;
  status?: number;
  title?: string;
};

type HtmlFixtureOptions = {
  canonical?: string;
  description?: string;
  extra?: string;
  ogDescription?: string;
  ogTitle?: string;
  ogType?: string;
  ogUrl?: string;
  robots?: string;
  socialImage?: string;
  title?: string;
  twitterDescription?: string;
  twitterTitle?: string;
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
    canonicalOrigin?: string;
    deploymentMetadata?: Record<string, unknown>;
    expectedGitSha?: string;
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
const expectedGitSha = "0123456789abcdef0123456789abcdef01234567";
const securityHeadersFixture = {
  "content-security-policy":
    "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; upgrade-insecure-requests",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;

function responseAt(response: Response, url: string): Response {
  Object.defineProperty(response, "url", { configurable: true, value: url });
  return response;
}

function fixtureHeaders(
  override: FetchOverride,
  defaults: Record<string, string> = {},
) {
  const headers: Record<string, string> = {
    ...securityHeadersFixture,
    ...defaults,
    ...override.headers,
  };
  for (const name of override.omitSecurityHeaders ?? []) {
    delete headers[name.toLowerCase()];
  }
  return headers;
}

function deploymentMetadataFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    alias: ["host.example"],
    gitSource: {
      ref: "main",
      sha: expectedGitSha,
      type: "github",
    },
    id: "dpl_AbCdEf1234567890",
    readyState: "READY",
    source: "git",
    target: "production",
    url: "everyday-tech-insight-unique.vercel.app",
    ...overrides,
  };
}

async function generatedPngFixture(width: number, height: number) {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 26, g: 47, b: 68, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  return Uint8Array.from(buffer).buffer;
}

async function generatedJpegFixture(width: number, height: number) {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 26, g: 47, b: 68 },
    },
  })
    .jpeg()
    .toBuffer();
  return Uint8Array.from(buffer).buffer;
}

const socialPngFixture = generatedPngFixture(1200, 630);
const appleTouchPngFixture = generatedPngFixture(180, 180);

function htmlFixture({
  title = "Fixture page | Everyday Tech Insight",
  description = "A distinct fixture description for production smoke validation.",
  canonical = `${fixtureOrigin}/fixture/`,
  robots = "index,follow",
  ogType = "website",
  ogTitle = title,
  ogDescription = description,
  ogUrl = canonical,
  socialImage = `${fixtureOrigin}/social/default.png`,
  twitterTitle = title,
  twitterDescription = description,
  extra = "",
}: HtmlFixtureOptions = {}) {
  return `<!doctype html>
    <html lang="en-US">
      <head>
        <title>${title}</title>
        <meta name="description" content="${description}">
        <meta name="robots" content="${robots}">
        <link rel="canonical" href="${canonical}">
        <link rel="icon" href="/favicon.svg">
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
        <link rel="manifest" href="/manifest.webmanifest">
        <meta property="og:type" content="${ogType}">
        <meta property="og:title" content="${ogTitle}">
        <meta property="og:description" content="${ogDescription}">
        <meta property="og:url" content="${ogUrl}">
        <meta property="og:image" content="${socialImage}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:image:type" content="image/png">
        <meta property="og:image:alt" content="Social preview for this fixture page.">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${twitterTitle}">
        <meta name="twitter:description" content="${twitterDescription}">
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
  it("returns a stable HTTPS origin and rejects insecure or non-origin input", async () => {
    const productionSmoke =
      await import("../../scripts/check-production.mjs").catch(() => ({}));

    expect(productionSmoke).toHaveProperty("normalizeOrigin");
    if (!("normalizeOrigin" in productionSmoke)) return;

    const { normalizeOrigin } = productionSmoke;
    expect(normalizeOrigin("  https://Host.Example:443/  ")).toBe(
      "https://host.example",
    );
    expect(() => normalizeOrigin("http://127.0.0.1:4321/")).toThrow(/HTTPS/i);
    expect(() => normalizeOrigin("https://host.example/path")).toThrow(
      /origin/i,
    );
    expect(() => normalizeOrigin("ftp://host.example")).toThrow(/HTTPS/i);
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

function robotsFixture(origin = fixtureOrigin) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap-index.xml\n`;
}

function sitemapIndexFixture(origin = fixtureOrigin) {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}/sitemap-0.xml</loc></sitemap></sitemapindex>`;
}

function sitemapFixture(paths: readonly string[], origin = fixtureOrigin) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
}

function rssFixture(paths: readonly string[], origin = fixtureOrigin) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Everyday Tech Insight</title><link>${origin}/</link><description>Practical business technology guidance.</description>${paths.map((path) => `<item><title>${path}</title><link>${origin}${path}</link><guid>${origin}${path}</guid></item>`).join("")}</channel></rss>`;
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
      name: "missing robots metadata",
      code: "robots",
      html: () =>
        htmlFixture().replace(
          '<meta name="robots" content="index,follow">',
          "",
        ),
    },
    {
      name: "noindex robots metadata on an indexable route",
      code: "robots",
      html: () => htmlFixture({ robots: "noindex,follow" }),
    },
    {
      name: "mismatched Open Graph title",
      code: "og-title",
      html: () => htmlFixture({ ogTitle: "Different social title" }),
    },
    {
      name: "mismatched Open Graph description",
      code: "og-description",
      html: () => htmlFixture({ ogDescription: "Different description" }),
    },
    {
      name: "mismatched Open Graph URL",
      code: "og-url",
      html: () => htmlFixture({ ogUrl: `${fixtureOrigin}/wrong/` }),
    },
    {
      name: "website Open Graph type on an article route",
      code: "og-type",
      route: "/articles/how-to-identify-business-tasks-for-automation/",
      html: () =>
        htmlFixture({
          canonical: `${fixtureOrigin}/articles/how-to-identify-business-tasks-for-automation/`,
          ogType: "website",
          socialImage: `${fixtureOrigin}/social/article-how-to-identify-business-tasks-for-automation.png`,
        }),
    },
    {
      name: "mismatched Twitter title",
      code: "twitter-title",
      html: () => htmlFixture({ twitterTitle: "Different Twitter title" }),
    },
    {
      name: "mismatched Twitter description",
      code: "twitter-description",
      html: () =>
        htmlFixture({ twitterDescription: "Different Twitter description" }),
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

  it("allows noindex,follow only for the 404 document", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        canonical: `${fixtureOrigin}/404.html`,
        ogUrl: `${fixtureOrigin}/404.html`,
        robots: "noindex,follow",
      }),
      {
        canonicalPath: "/404.html",
        origin: fixtureOrigin,
        route: "/missing-page/",
      },
    );

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).not.toContain("robots");
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

  it.each(["speculationrules", "application/json", "text/plain"])(
    "rejects a non-JSON-LD script block with type %s",
    async (type) => {
      const productionSmoke = asFixtureProductionSmoke(
        await import("../../scripts/check-production.mjs"),
      );

      const result = productionSmoke.inspectHtml(
        htmlFixture({
          extra: `<script type="${type}">{"prefetch":[]}</script>`,
        }),
        { origin: fixtureOrigin, route: "/fixture/" },
      );

      expect(
        result.issues.map((issue: { code: string }) => issue.code),
      ).toContain("executable-script");
    },
  );

  it("allows a normalized JSON-LD script block", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        extra:
          '<script type=" APPLICATION/LD+JSON ; charset=utf-8">{"@context":"https://schema.org"}</script>',
      }),
      { origin: fixtureOrigin, route: "/fixture/" },
    );

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).not.toContain("executable-script");
  });

  it("rejects an external advertising script as executable, off-origin, and tracking-related", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(
      htmlFixture({
        extra:
          '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>',
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

  it("rejects an AdSense account connection meta without using a publisher ID fixture", async () => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const html = htmlFixture().replace(
      "</head>",
      '<meta name="google-adsense-account" content="[REDACTED PUBLISHER ID]"></head>',
    );
    const result = productionSmoke.inspectHtml(html, {
      origin: fixtureOrigin,
      route: "/fixture/",
    });

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).toContain("adsense-account-meta");
  });

  it.each([
    [
      "reserved advertising gap",
      '<aside class="ad-slot" aria-label="Advertisement" style="min-height:250px"><span>Advertisement</span></aside>',
      "ad-integration-marker",
    ],
    [
      "advertising consent platform",
      '<div class="consent-banner" data-cmp-provider="[REDACTED OWNER SELECTION]">Consent settings</div>',
      "consent-integration-marker",
    ],
  ])(
    "rejects a live %s while the release mode is off",
    async (_name, extra, code) => {
      const productionSmoke = asFixtureProductionSmoke(
        await import("../../scripts/check-production.mjs"),
      );

      const result = productionSmoke.inspectHtml(htmlFixture({ extra }), {
        origin: fixtureOrigin,
        route: "/fixture/",
      });

      expect(
        result.issues.map((issue: { code: string }) => issue.code),
      ).toContain(code);
    },
  );

  it.each([
    "data-ad-client",
    "data-ad-slot",
    "data-ad-format",
    "data-ad-layout",
  ])(
    "rejects the ad integration marker %s even with a redacted value",
    async (attribute) => {
      const productionSmoke = asFixtureProductionSmoke(
        await import("../../scripts/check-production.mjs"),
      );

      const result = productionSmoke.inspectHtml(
        htmlFixture({
          extra: `<ins ${attribute}="[REDACTED TEST VALUE]"></ins>`,
        }),
        { origin: fixtureOrigin, route: "/fixture/" },
      );

      expect(
        result.issues.map((issue: { code: string }) => issue.code),
      ).toContain("ad-integration-marker");
    },
  );

  it.each([
    {
      code: "embedded-content",
      markup: '<iframe src="/embedded/"></iframe>',
      name: "iframe",
    },
    {
      code: "embedded-content",
      markup: '<frame src="/embedded/">',
      name: "frame",
    },
    {
      code: "embedded-content",
      markup: '<embed src="/embedded.pdf">',
      name: "embed",
    },
    {
      code: "embedded-content",
      markup: '<object data="/embedded.pdf"></object>',
      name: "object",
    },
    {
      code: "form",
      markup: '<form action="/contact/" method="post"></form>',
      name: "form",
    },
    {
      code: "base-url",
      markup: '<base href="https://external.example/">',
      name: "base URL",
    },
    {
      code: "meta-refresh",
      markup:
        '<meta http-equiv="refresh" content="0;url=https://external.example/">',
      name: "meta refresh",
    },
    {
      code: "ping-attribute",
      markup:
        '<a href="/about/" ping="https://external.example/ping">About</a>',
      name: "anchor ping",
    },
    {
      code: "ping-attribute",
      markup:
        '<map name="links"><area href="/about/" ping="https://external.example/ping"></map>',
      name: "area ping",
    },
    {
      code: "attribution-source",
      markup:
        '<a href="/about/" attributionsrc="https://external.example/register">About</a>',
      name: "attribution source",
    },
  ])("rejects the unsupported $name surface", async ({ code, markup }) => {
    const productionSmoke = asFixtureProductionSmoke(
      await import("../../scripts/check-production.mjs"),
    );

    const result = productionSmoke.inspectHtml(htmlFixture({ extra: markup }), {
      origin: fixtureOrigin,
      route: "/fixture/",
    });

    expect(
      result.issues.map((issue: { code: string }) => issue.code),
    ).toContain(code);
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
    "/sitemap-index.xml",
    "/sitemap-0.xml",
    "/rss.xml",
    "/robots.txt",
    "/admin/",
    "/keystatic/",
    "/.pages.yml",
    "/articles/cms-fixture-minimum-draft/",
    "/ads.txt",
    "/production-smoke-route-that-must-not-exist/",
  ];
  const absentPaths = new Set([
    "/admin/",
    "/keystatic/",
    "/.pages.yml",
    "/articles/cms-fixture-minimum-draft/",
    "/ads.txt",
  ]);
  const expectedArticlePaths = requiredPaths.filter(
    (path) => /^\/articles\/[^/]+\/$/.test(path) && !absentPaths.has(path),
  );
  const expectedIndexablePaths = requiredPaths.filter(
    (path) =>
      !path.endsWith(".xml") &&
      path !== "/robots.txt" &&
      !absentPaths.has(path) &&
      path !== "/production-smoke-route-that-must-not-exist/",
  );

  async function loadRunner() {
    const productionSmoke = await import("../../scripts/check-production.mjs");
    expect(productionSmoke).toHaveProperty("PRODUCTION_ROUTES");
    expect(productionSmoke).toHaveProperty("runProductionCheck");
    expect(productionSmoke).toHaveProperty("formatProductionReport");
    return asFixtureProductionSmoke(productionSmoke);
  }

  it("derives every published article route from nested source files in stable order", async () => {
    const productionSmoke = await import("../../scripts/check-production.mjs");
    expect(productionSmoke).toHaveProperty("derivePublishedArticlePaths");
    if (!("derivePublishedArticlePaths" in productionSmoke)) return;

    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), "eti-production-articles-"),
    );
    const nestedDirectory = path.join(fixtureRoot, "nested");
    mkdirSync(nestedDirectory);
    writeFileSync(
      path.join(fixtureRoot, "zeta.md"),
      "---\nstatus: published\nslug: zeta-guide\n---\nPublished.\n",
    );
    writeFileSync(
      path.join(nestedDirectory, "alpha.mdx"),
      "---\nstatus: published\nslug: alpha-guide\n---\nPublished.\n",
    );
    writeFileSync(
      path.join(fixtureRoot, "draft.md"),
      "---\nstatus: draft\nslug: excluded-draft\n---\nDraft.\n",
    );
    writeFileSync(
      path.join(fixtureRoot, "historical.md"),
      "---\nstatus: archived\nslug: historical-launch-guide\n---\nArchived.\n",
    );

    try {
      const derivePublishedArticlePaths = productionSmoke[
        "derivePublishedArticlePaths"
      ] as (
        directory: string,
        options?: { requiredHistoricalPaths?: readonly string[] },
      ) => Promise<readonly string[]>;
      await expect(
        derivePublishedArticlePaths(fixtureRoot, {
          requiredHistoricalPaths: ["/articles/historical-launch-guide/"],
        }),
      ).resolves.toEqual(["/articles/alpha-guide/", "/articles/zeta-guide/"]);
      await expect(
        derivePublishedArticlePaths(fixtureRoot, {
          requiredHistoricalPaths: ["/articles/missing-launch-guide/"],
        }),
      ).rejects.toThrow(/missing historical article routes/i);
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

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
        const defaultBody =
          url.pathname === "/favicon.svg"
            ? "<svg></svg>"
            : url.pathname === "/apple-touch-icon.png"
              ? (await appleTouchPngFixture).slice(0)
              : (await socialPngFixture).slice(0);
        return responseAt(
          new Response(override.body ?? defaultBody, {
            status: override.status ?? 200,
            headers: fixtureHeaders(override, {
              "content-type": url.pathname.endsWith(".svg")
                ? "image/svg+xml"
                : "image/png",
            }),
          }),
          override.responseUrl ?? url.href,
        );
      }
      if (url.pathname === "/manifest.webmanifest") {
        return responseAt(
          new Response(override.body ?? "{}", {
            status: override.status ?? 200,
            headers: fixtureHeaders(override, {
              "content-type": "application/manifest+json",
            }),
          }),
          override.responseUrl ?? url.href,
        );
      }

      const route = routes.find(({ path }) => path === url.pathname);
      if (!route) {
        if (Object.hasOwn(overrides, url.pathname)) {
          return responseAt(
            new Response(override.body ?? "asset fixture", {
              status: override.status ?? 200,
              headers: fixtureHeaders(override),
            }),
            override.responseUrl ?? url.href,
          );
        }
        return responseAt(
          new Response("missing fixture", {
            status: 404,
            headers: fixtureHeaders(override),
          }),
          override.responseUrl ?? url.href,
        );
      }

      const status = override.status ?? route.expectedStatus;
      if (status >= 300 && status < 400) {
        return responseAt(
          new Response(null, {
            status,
            headers: fixtureHeaders(override),
          }),
          override.responseUrl ?? url.href,
        );
      }
      if (route.kind === "text") {
        const indexablePaths = routes
          .filter(
            (candidate) =>
              candidate.kind === "html" && candidate.expectedStatus === 200,
          )
          .map(({ path }) => path);
        const articlePaths = routes
          .filter(
            (candidate) =>
              candidate.kind === "html" &&
              candidate.expectedStatus === 200 &&
              /^\/articles\/[^/]+\/$/.test(candidate.path),
          )
          .map(({ path }) => path);
        const contentType =
          route.path === "/rss.xml"
            ? "application/rss+xml; charset=utf-8"
            : route.path.endsWith(".xml")
              ? "application/xml; charset=utf-8"
              : "text/plain; charset=utf-8";
        const fixtureBody =
          route.path === "/rss.xml"
            ? rssFixture(articlePaths)
            : route.path === "/robots.txt"
              ? robotsFixture()
              : route.path === "/sitemap-index.xml"
                ? sitemapIndexFixture()
                : route.path === "/sitemap-0.xml"
                  ? sitemapFixture(indexablePaths)
                  : "";
        return responseAt(
          new Response(override.body ?? fixtureBody, {
            status,
            headers: fixtureHeaders(override, {
              "content-type": contentType,
            }),
          }),
          override.responseUrl ?? url.href,
        );
      }

      const routeKey = route.path.replaceAll("/", "-") || "home";
      return responseAt(
        new Response(
          override.body ??
            htmlFixture({
              title:
                override.title ?? `Page ${routeKey} | Everyday Tech Insight`,
              description:
                override.description ??
                `Production smoke description for the unique route ${route.path}`,
              canonical: `${fixtureOrigin}${route.canonicalPath ?? route.path}`,
              ogType: /^\/articles\/[^/]+\/$/.test(route.path)
                ? "article"
                : "website",
              robots:
                route.canonicalPath === "/404.html"
                  ? "noindex,follow"
                  : "index,follow",
              socialImage: `${fixtureOrigin}${fixtureSocialImagePath(route.path)}`,
            }),
          {
            status,
            headers: fixtureHeaders(override, {
              "content-type": "text/html",
            }),
          },
        ),
        override.responseUrl ?? url.href,
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
      kind: "absent" | "html" | "text";
      canonicalPath?: string;
    }>;
    expect(productionSmoke.LAUNCH_ARTICLE_PATHS).toEqual(expectedArticlePaths);
    expect(productionSmoke.PUBLISHED_ARTICLE_PATHS).toEqual(
      expect.arrayContaining(expectedArticlePaths),
    );
    expect(routes.map(({ path }) => path)).toEqual(requiredPaths);
    for (const path of absentPaths) {
      expect(routes.find((route) => route.path === path)).toEqual({
        expectedStatus: 404,
        kind: "absent",
        path,
      });
    }
    expect(routes.at(-1)).toMatchObject({
      canonicalPath: "/404.html",
      expectedStatus: 404,
      kind: "html",
    });

    const fetchImpl = makeFetch(routes);
    const result = await productionSmoke.runProductionCheck({
      canonicalOrigin: fixtureOrigin,
      deploymentMetadata: deploymentMetadataFixture(),
      expectedGitSha,
      origin: fixtureOrigin,
      fetchImpl,
    });

    expect(result).toMatchObject({
      checkedAssets: 24,
      checkedRoutes: requiredPaths.length,
      canonicalOrigin: fixtureOrigin,
      deployment: {
        deploymentId: "dpl_AbCdEf1234567890",
        gitShaStatus: "MATCH",
        status: "PASS",
      },
      issues: [],
      metadataParity: { status: "PASS" },
      monetization: { mode: "off", status: "PASS" },
      monetizationMode: "off",
      routeResults: requiredPaths.map((path) => ({ path, status: "PASS" })),
      securityHeaders: {
        checkedResponses: requiredPaths.length + 24,
        status: "PASS",
      },
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

  it("checks an injected additional published guide across its route, sitemap, RSS, and social image", async () => {
    const productionSmoke = await loadRunner();
    const additionalArticlePath = "/articles/future-published-guide/";
    const baseRoutes =
      productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<ProductionRoute>;
    const routes = baseRoutes.flatMap<ProductionRoute>((route) =>
      route.path === "/toolkit/"
        ? [
            {
              expectedStatus: 200,
              kind: "html" as const,
              path: additionalArticlePath,
            },
            route,
          ]
        : [route],
    );
    const fetchImpl = makeFetch(routes);

    const result = await productionSmoke.runProductionCheck({
      canonicalOrigin: fixtureOrigin,
      deploymentMetadata: deploymentMetadataFixture(),
      expectedGitSha,
      origin: fixtureOrigin,
      fetchImpl,
      routes,
    });

    expect(result.issues).toEqual([]);
    expect(result.routeResults).toContainEqual({
      path: additionalArticlePath,
      status: "PASS",
    });
    for (const pathname of [
      additionalArticlePath,
      "/sitemap-0.xml",
      "/rss.xml",
      "/social/article-future-published-guide.png",
    ]) {
      expect(fetchImpl).toHaveBeenCalledWith(
        expect.objectContaining({ pathname }),
        expect.objectContaining({ redirect: "manual" }),
      );
    }
  });

  it("rejects a response URL that differs from the exact requested URL", async () => {
    const productionSmoke = await loadRunner();
    const routes = [
      { path: "/about/", expectedStatus: 200, kind: "html" as const },
    ];
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      routes,
      fetchImpl: makeFetch(routes, {
        "/about/": { responseUrl: `${fixtureOrigin}/about` },
      }),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "response-url", route: "/about/" }),
    );
  });

  it("fails when a deployed response omits or changes a required security header", async () => {
    const productionSmoke = await loadRunner();
    const routes = [
      { path: "/about/", expectedStatus: 200, kind: "html" as const },
    ];
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      routes,
      fetchImpl: makeFetch(routes, {
        "/about/": {
          headers: { "x-frame-options": "SAMEORIGIN" },
          omitSecurityHeaders: ["strict-transport-security"],
        },
      }),
    });

    expect(
      result.issues.filter(
        (issue: { code: string; route: string }) =>
          issue.code === "security-header" && issue.route === "/about/",
      ),
    ).toHaveLength(2);
    expect(result.securityHeaders).toMatchObject({ status: "FAIL" });
  });

  it("rejects a requested origin that is not the configured canonical alias", async () => {
    const productionSmoke = await loadRunner();
    const routes = [
      { path: "/about/", expectedStatus: 200, kind: "html" as const },
    ];
    const result = await productionSmoke.runProductionCheck({
      canonicalOrigin: "https://canonical.example",
      origin: fixtureOrigin,
      routes,
      fetchImpl: makeFetch(routes),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "requested-origin" }),
    );
  });

  it("summarizes canonical, Open Graph, and Twitter shell parity", async () => {
    const productionSmoke = await loadRunner();
    const routes = [
      { path: "/about/", expectedStatus: 200, kind: "html" as const },
    ];
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      routes,
      fetchImpl: makeFetch(routes, {
        "/about/": {
          body: htmlFixture({
            canonical: `${fixtureOrigin}/about/`,
            ogTitle: "Mismatched Open Graph title",
          }),
        },
      }),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "og-title", route: "/about/" }),
    );
    expect(result.metadataParity).toMatchObject({ status: "FAIL" });
  });

  it("validates trusted Vercel deployment identity and authoritative Git SHA metadata", async () => {
    const productionSmoke = await loadRunner();
    const routes = [
      { path: "/about/", expectedStatus: 200, kind: "html" as const },
    ];
    const matching = await productionSmoke.runProductionCheck({
      deploymentMetadata: deploymentMetadataFixture(),
      expectedGitSha,
      origin: fixtureOrigin,
      routes,
      fetchImpl: makeFetch(routes),
    });
    expect(matching.deployment).toMatchObject({
      gitShaStatus: "MATCH",
      status: "PASS",
    });

    for (const [metadata, code] of [
      [
        deploymentMetadataFixture({
          gitSource: {
            ref: "main",
            sha: "f".repeat(40),
            type: "github",
          },
        }),
        "deployment-git-sha",
      ],
      [
        deploymentMetadataFixture({
          gitSource: undefined,
          meta: { githubCommitSha: expectedGitSha },
        }),
        "deployment-git-sha-unavailable",
      ],
      [deploymentMetadataFixture({ source: "cli" }), "deployment-source"],
      [
        deploymentMetadataFixture({
          gitSource: {
            ref: "feature",
            sha: expectedGitSha,
            type: "github",
          },
        }),
        "deployment-git-ref",
      ],
      [
        deploymentMetadataFixture({ readyState: "BUILDING" }),
        "deployment-state",
      ],
      [deploymentMetadataFixture({ alias: [] }), "deployment-alias"],
    ] as const) {
      const result = await productionSmoke.runProductionCheck({
        deploymentMetadata: metadata,
        expectedGitSha,
        origin: fixtureOrigin,
        routes,
        fetchImpl: makeFetch(routes),
      });
      expect(
        result.issues.map((issue: { code: string }) => issue.code),
      ).toContain(code);
      expect(result.deployment).toMatchObject({ status: "FAIL" });
    }
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
      name: "unexpected live ads.txt seller file",
      code: "status",
      overrides: { "/ads.txt": { status: 200 } },
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
      name: "redirecting CMS admin route",
      code: "unexpected-redirect",
      overrides: {
        "/admin/": {
          status: 308,
          headers: { location: `${fixtureOrigin}/login/` },
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
      name: "HTML response for sitemap XML",
      code: "content-type",
      overrides: {
        "/sitemap-0.xml": { headers: { "content-type": "text/html" } },
      },
    },
    {
      name: "malformed sitemap index XML",
      code: "sitemap-xml",
      overrides: {
        "/sitemap-index.xml": { body: "<sitemapindex><sitemap>" },
      },
    },
    {
      name: "empty sitemap XML",
      code: "sitemap-xml",
      overrides: { "/sitemap-0.xml": { body: "" } },
    },
    {
      name: "off-origin sitemap index location",
      code: "sitemap-url",
      overrides: {
        "/sitemap-index.xml": {
          body: sitemapIndexFixture("https://wrong.example"),
        },
      },
    },
    {
      name: "sitemap index without the sitemap namespace",
      code: "sitemap-structure",
      overrides: {
        "/sitemap-index.xml": {
          body: sitemapIndexFixture().replace(
            ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
            "",
          ),
        },
      },
    },
    {
      name: "incomplete sitemap indexable membership",
      code: "sitemap-membership",
      overrides: {
        "/sitemap-0.xml": {
          body: sitemapFixture(expectedIndexablePaths.slice(1)),
        },
      },
    },
    {
      name: "sitemap URL set without the sitemap namespace",
      code: "sitemap-structure",
      overrides: {
        "/sitemap-0.xml": {
          body: sitemapFixture(expectedIndexablePaths).replace(
            ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
            "",
          ),
        },
      },
    },
    {
      name: "incorrect robots sitemap directive",
      code: "robots-body",
      overrides: {
        "/robots.txt": {
          body: robotsFixture("https://wrong.example"),
        },
      },
    },
    {
      name: "missing robots allow rule",
      code: "robots-body",
      overrides: {
        "/robots.txt": {
          body: `User-agent: *\nSitemap: ${fixtureOrigin}/sitemap-index.xml\n`,
        },
      },
    },
    {
      name: "robots rule blocking article routes",
      code: "robots-body",
      overrides: {
        "/robots.txt": {
          body: `${robotsFixture()}Disallow: /articles/\n`,
        },
      },
    },
    {
      name: "robots wildcard disallow rule",
      code: "robots-body",
      overrides: {
        "/robots.txt": {
          body: `${robotsFixture()}Disallow: /*\n`,
        },
      },
    },
    {
      name: "malformed RSS XML",
      code: "feed-xml",
      overrides: { "/rss.xml": { body: "<rss><channel>" } },
    },
    {
      name: "RSS document without version 2.0",
      code: "feed-structure",
      overrides: {
        "/rss.xml": {
          body: rssFixture(expectedArticlePaths).replace(
            '<rss version="2.0">',
            "<rss>",
          ),
        },
      },
    },
    {
      name: "RSS channel without a title",
      code: "feed-structure",
      overrides: {
        "/rss.xml": {
          body: rssFixture(expectedArticlePaths).replace(
            "<title>Everyday Tech Insight</title>",
            "",
          ),
        },
      },
    },
    {
      name: "RSS channel without a description",
      code: "feed-structure",
      overrides: {
        "/rss.xml": {
          body: rssFixture(expectedArticlePaths).replace(
            "<description>Practical business technology guidance.</description>",
            "",
          ),
        },
      },
    },
    {
      name: "RSS channel with empty required text",
      code: "feed-structure",
      overrides: {
        "/rss.xml": {
          body: rssFixture(expectedArticlePaths)
            .replace("<title>Everyday Tech Insight</title>", "<title></title>")
            .replace(
              "<description>Practical business technology guidance.</description>",
              "<description></description>",
            ),
        },
      },
    },
    {
      name: "RSS item without a title or description",
      code: "feed-structure",
      overrides: {
        "/rss.xml": {
          body: rssFixture(expectedArticlePaths).replace(
            `<title>${expectedArticlePaths[0]}</title>`,
            "",
          ),
        },
      },
    },
    {
      name: "RSS item with only an empty title",
      code: "feed-structure",
      overrides: {
        "/rss.xml": {
          body: rssFixture(expectedArticlePaths).replace(
            `<title>${expectedArticlePaths[0]}</title>`,
            "<title></title>",
          ),
        },
      },
    },
    {
      name: "incomplete RSS article membership",
      code: "feed-membership",
      overrides: {
        "/rss.xml": { body: rssFixture(expectedArticlePaths.slice(1)) },
      },
    },
    {
      name: "mismatched RSS item guid",
      code: "feed-item-url",
      overrides: {
        "/rss.xml": {
          body: rssFixture(expectedArticlePaths).replace(
            `<guid>${fixtureOrigin}${expectedArticlePaths[0]}</guid>`,
            `<guid>${fixtureOrigin}${expectedArticlePaths[1]}</guid>`,
          ),
        },
      },
    },
    {
      name: "off-origin RSS item URLs",
      code: "feed-url",
      overrides: {
        "/rss.xml": {
          body: rssFixture(expectedArticlePaths)
            .replace(
              `<link>${fixtureOrigin}${expectedArticlePaths[0]}</link>`,
              `<link>https://wrong.example${expectedArticlePaths[0]}</link>`,
            )
            .replace(
              `<guid>${fixtureOrigin}${expectedArticlePaths[0]}</guid>`,
              `<guid>https://wrong.example${expectedArticlePaths[0]}</guid>`,
            ),
        },
      },
    },
    {
      name: "incorrect RSS channel link",
      code: "feed-channel",
      overrides: {
        "/rss.xml": {
          body: rssFixture(expectedArticlePaths).replace(
            `<link>${fixtureOrigin}/</link>`,
            `<link>${fixtureOrigin}/about/</link>`,
          ),
        },
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
      kind: "absent" | "html" | "text";
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
      kind: "absent" | "html" | "text";
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
        kind: "absent" | "html" | "text";
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

  it.each([
    {
      name: "an empty MIME-only response",
      body: async () => new ArrayBuffer(0),
    },
    {
      name: "a PNG signature and IHDR without IDAT or IEND",
      body: async () => (await socialPngFixture).slice(0, 33),
    },
    {
      name: "a corrupt PNG signature",
      body: async () => {
        const bytes = new Uint8Array((await socialPngFixture).slice(0));
        bytes[0] = 0;
        return bytes.buffer;
      },
    },
    {
      name: "JPEG bytes labeled as PNG",
      body: async () => generatedJpegFixture(1200, 630),
    },
  ])("rejects a social image containing $name", async ({ body }) => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "absent" | "html" | "text";
      canonicalPath?: string;
    }>;
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, {
        "/social/default.png": {
          body: await body(),
          headers: { "content-type": "image/png" },
          status: 200,
        },
      }),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "asset-image-content",
        route: "/social/default.png",
      }),
    );
    expect(result.routeResults).toContainEqual({ path: "/", status: "FAIL" });
  });

  it("rejects a decodable social PNG with incorrect dimensions", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "absent" | "html" | "text";
      canonicalPath?: string;
    }>;
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, {
        "/social/default.png": {
          body: await generatedPngFixture(1199, 630),
        },
      }),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "asset-image-content",
        route: "/social/default.png",
      }),
    );
  });

  it("rejects an Apple touch PNG that is not 180 by 180", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "absent" | "html" | "text";
      canonicalPath?: string;
    }>;
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, {
        "/apple-touch-icon.png": {
          body: await generatedPngFixture(180, 179),
        },
      }),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "asset-image-content",
        route: "/apple-touch-icon.png",
      }),
    );
  });

  it("rejects an exact PNG asset whose declared body exceeds the decode limit", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "absent" | "html" | "text";
      canonicalPath?: string;
    }>;
    const result = await productionSmoke.runProductionCheck({
      origin: fixtureOrigin,
      fetchImpl: makeFetch(routes, {
        "/social/default.png": {
          body: (await socialPngFixture).slice(0),
          headers: { "content-length": "100000000" },
        },
      }),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "asset-image-content",
        route: "/social/default.png",
      }),
    );
  });

  it("rejects JSON served with 200 status for a PNG reference", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "absent" | "html" | "text";
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

  it("rejects HTML containing a same-origin iframe document reference", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "absent" | "html" | "text";
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

    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "embedded-content", route: "/about/" }),
    );
    expect(result.routeResults).toContainEqual({
      path: "/about/",
      status: "FAIL",
    });
  });

  it("marks every owning route failed when its asset validation fails", async () => {
    const productionSmoke = await loadRunner();
    const routes = productionSmoke.PRODUCTION_ROUTES as ReadonlyArray<{
      path: string;
      expectedStatus: number;
      kind: "absent" | "html" | "text";
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
      kind: "absent" | "html" | "text";
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
      kind: "absent" | "html" | "text";
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

  it("requires explicit trusted SHA and deployment-metadata inputs for release orchestration", async () => {
    const productionSmoke = await import("../../scripts/check-production.mjs");
    expect(productionSmoke).toHaveProperty("parseProductionArguments");
    if (!("parseProductionArguments" in productionSmoke)) return;

    expect(
      productionSmoke.parseProductionArguments(
        [
          "--origin",
          "https://publication.example",
          "--expected-sha",
          expectedGitSha,
          "--deployment-metadata",
          ".vercel/deployment.json",
        ],
        {},
      ),
    ).toEqual({
      deploymentMetadataPath: ".vercel/deployment.json",
      expectedGitSha,
      origin: "https://publication.example",
    });
    expect(
      productionSmoke.parseProductionArguments([], {
        PRODUCTION_EXPECTED_GIT_SHA: expectedGitSha,
        PRODUCTION_ORIGIN: "https://publication.example/",
        VERCEL_DEPLOYMENT_METADATA_PATH: ".vercel/deployment.json",
      }),
    ).toEqual({
      deploymentMetadataPath: ".vercel/deployment.json",
      expectedGitSha,
      origin: "https://publication.example",
    });

    for (const args of [
      ["--origin", "https://publication.example"],
      [
        "--origin",
        "https://publication.example",
        "--expected-sha",
        "main",
        "--deployment-metadata",
        ".vercel/deployment.json",
      ],
      [
        "--origin",
        "https://publication.example",
        "--expected-sha",
        expectedGitSha,
        "--deployment-metadata",
        ".vercel/deployment.json",
        "--unknown",
        "value",
      ],
    ]) {
      expect(() => productionSmoke.parseProductionArguments(args, {})).toThrow(
        /expected-sha|deployment-metadata|unknown|SHA/i,
      );
    }
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

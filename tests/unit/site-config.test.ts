import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_URL,
  resolveSiteUrl,
  siteConfig,
  siteOrigin,
  siteUrl,
} from "../../site.config.mjs";

const expectedCategorySlugs = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
] as const;

function readJson(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  ) as unknown;
}

describe("publication identity", () => {
  it("uses the approved public identity and canonical production URL", async () => {
    const { site } = await import("../../src/data/site");

    expect(site).toMatchObject({
      name: "Everyday Tech Insight",
      tagline:
        "Practical guidance for choosing, using, and securing business technology.",
      publicationByline: "Everyday Tech Insight",
      locale: "en-US",
      timeZone: "America/Los_Angeles",
      intendedAudience: "small-business decision makers",
      url: siteUrl,
      contact: {
        method: "github-issues",
        url: "https://github.com/danielko7188-hue/everyday-tech-insight/issues",
      },
    });
    expect(site).toBe(siteConfig);
  });

  it("contains no placeholder identity values", async () => {
    const { site } = await import("../../src/data/site");
    const serialized = JSON.stringify(site);

    expect(serialized).not.toMatch(
      /\b(?:todo|tbd|changeme|placeholder|your[-_ ]?(?:name|email|id)|example\.com)\b/i,
    );
  });

  it("keeps monetization, analytics, and consent tooling disabled without IDs", async () => {
    const { site } = await import("../../src/data/site");

    expect(site.integrations).toEqual({
      monetization: { enabled: false, provider: null },
      analytics: { enabled: false, provider: null },
      consentManagementPlatform: { enabled: false, provider: null },
    });

    expect(Object.keys(site.integrations).join(" ")).not.toMatch(
      /(?:publisher|measurement|tracking|account|client)[-_ ]?id/i,
    );
    expect(JSON.stringify(site.integrations)).not.toMatch(
      /(?:ca-)?pub-\d{10,}|UA-\d+-\d+|G-[A-Z0-9]{6,}|GTM-[A-Z0-9]{4,}/i,
    );
  });
});

describe("category taxonomy", () => {
  it("defines exactly the five approved category slugs in editorial order", async () => {
    const { categories, categorySlugs } =
      await import("../../src/data/categories");

    expect(categorySlugs).toEqual(expectedCategorySlugs);
    expect(categories.map(({ slug }) => slug)).toEqual(expectedCategorySlugs);
    expect(categories).toHaveLength(5);
  });

  it("uses unique, non-placeholder labels and descriptions", async () => {
    const { categories } = await import("../../src/data/categories");

    expect(new Set(categories.map(({ slug }) => slug)).size).toBe(5);
    expect(new Set(categories.map(({ name }) => name)).size).toBe(5);

    for (const category of categories) {
      expect(category.name.length).toBeGreaterThan(3);
      expect(category.description.length).toBeGreaterThan(20);
      expect(`${category.name} ${category.description}`).not.toMatch(
        /\b(?:todo|tbd|changeme|placeholder)\b/i,
      );
    }
  });
});

describe("static deployment configuration", () => {
  it("normalizes the explicit canonical HTTPS origin with one trailing slash", () => {
    expect(resolveSiteUrl("https://business.example")).toBe(
      "https://business.example/",
    );
    expect(resolveSiteUrl("https://business.example/")).toBe(
      "https://business.example/",
    );
    expect(siteOrigin).toBe(new URL(siteUrl).origin);
  });

  it("falls back only when the candidate is undefined", () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);

    for (const candidate of [null, "", "   "]) {
      expect(() => resolveSiteUrl(candidate)).toThrow(/HTTPS origin/i);
    }
  });

  it.each([
    "http://business.example",
    "https://user:secret@business.example",
    "https://business.example/path",
    "https://business.example/?preview=1",
    "https://business.example/#preview",
    "business.example",
    "not a URL",
  ])("rejects a noncanonical supplied site URL: %s", (candidate) => {
    expect(() => resolveSiteUrl(candidate)).toThrow(/HTTPS origin/i);
  });

  it("reads only PUBLIC_SITE_URL and ignores Vercel preview variables", () => {
    const source = readFileSync(
      new URL("../../site.config.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("process.env.PUBLIC_SITE_URL");
    expect(source).not.toMatch(/process\.env\.(?:VERCEL|VERCEL_URL|URL)/);
    expect(siteUrl).toBe(resolveSiteUrl(process.env.PUBLIC_SITE_URL));
  });

  it("uses PUBLIC_SITE_URL in a fresh process while ignoring poisoned preview hosts", () => {
    const moduleUrl = new URL("../../site.config.mjs", import.meta.url).href;
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `const config = await import(${JSON.stringify(moduleUrl)}); process.stdout.write(config.siteUrl);`,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PUBLIC_SITE_URL: "https://canonical.example",
          VERCEL_ENV: "preview",
          VERCEL_PROJECT_PRODUCTION_URL: "poisoned-production.example",
          VERCEL_URL: "poisoned-preview.example",
        },
      },
    );

    expect(output).toBe("https://canonical.example/");
  });

  it("builds a canonical static site with trailing slashes and no adapter", async () => {
    const { default: astroConfig } = await import("../../astro.config.mjs");

    expect(astroConfig).toMatchObject({
      output: "static",
      site: siteUrl,
      trailingSlash: "always",
    });
    expect(astroConfig).not.toHaveProperty("adapter");
  });

  it("provides the complete foundation script surface", () => {
    const packageJson = readJson("../../package.json") as {
      scripts?: Record<string, string>;
    };

    expect(Object.keys(packageJson.scripts ?? {})).toEqual(
      expect.arrayContaining([
        "dev",
        "build",
        "preview",
        "format",
        "format:check",
        "lint",
        "typecheck",
        "test",
        "test:e2e",
        "setup:browsers",
        "setup:browsers:linux",
        "check:links",
        "check:content",
        "check:seo",
        "lighthouse",
        "qa",
      ]),
    );
    expect(packageJson.scripts?.["setup:browsers"]).toBe(
      "playwright install chromium",
    );
    expect(packageJson.scripts?.["setup:browsers:linux"]).toBe(
      "playwright install --with-deps chromium",
    );
    expect(packageJson.scripts?.qa).not.toContain("playwright install");
  });

  it("supports maintained Node releases while excluding Node 23", () => {
    const packageJson = readJson("../../package.json") as {
      engines?: { node?: string };
    };

    expect(packageJson.engines?.node).toBe("^22.19.0 || >=24.0.0");
  });

  it("uses Node 22 types for the lowest supported runtime", () => {
    const packageJson = readJson("../../package.json") as {
      engines?: { node?: string };
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.engines?.node).toBe("^22.19.0 || >=24.0.0");
    expect(packageJson.devDependencies?.["@types/node"]).toBe("22.20.1");
  });

  it("pins Sharp directly and generates social images before every build", () => {
    const packageJson = readJson("../../package.json") as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.sharp).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageJson.scripts?.["generate:social"]).toBe(
      "node scripts/generate-social-images.mjs",
    );
    expect(packageJson.scripts?.build).toBe(
      "npm run generate:social && astro build",
    );
  });

  it("uses Vercel's trailing-slash setting without broad redirects", () => {
    const vercelConfig = readJson("../../vercel.json") as {
      trailingSlash?: boolean;
      redirects?: unknown;
    };

    expect(vercelConfig.trailingSlash).toBe(true);
    expect(vercelConfig).not.toHaveProperty("redirects");
  });

  it("does not allow inline executable scripts in the production CSP", () => {
    const vercelConfig = readJson("../../vercel.json") as {
      headers?: Array<{
        headers: Array<{ key: string; value: string }>;
      }>;
    };
    const contentSecurityPolicy = vercelConfig.headers?.[0]?.headers.find(
      ({ key }) => key === "Content-Security-Policy",
    )?.value;
    const scriptDirective = contentSecurityPolicy
      ?.split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("script-src"));

    expect(scriptDirective).toBe("script-src 'self'");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
  });

  it("sets conservative static security headers including frame protection", () => {
    const vercelConfig = readJson("../../vercel.json") as {
      headers?: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };
    const headerSet = Object.fromEntries(
      vercelConfig.headers?.[0]?.headers.map(({ key, value }) => [
        key,
        value,
      ]) ?? [],
    );

    expect(vercelConfig.headers?.[0]?.source).toBe("/(.*)");
    expect(headerSet["X-Content-Type-Options"]).toBe("nosniff");
    expect(headerSet["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerSet["Permissions-Policy"]).toContain("camera=()");
    expect(headerSet["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headerSet["Content-Security-Policy"]).not.toMatch(/https?:\/\//);
  });
});

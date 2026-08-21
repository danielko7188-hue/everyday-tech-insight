import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

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
      url: "https://everyday-tech-insight.vercel.app/",
      contact: {
        method: "github-issues",
        url: "https://github.com/danielko7188-hue/everyday-tech-insight/issues",
      },
    });
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
  it("builds a canonical static site with trailing slashes and no adapter", async () => {
    const { default: astroConfig } = await import("../../astro.config.mjs");

    expect(astroConfig).toMatchObject({
      output: "static",
      site: "https://everyday-tech-insight.vercel.app/",
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
        "check:links",
        "check:content",
        "check:seo",
        "lighthouse",
        "qa",
      ]),
    );
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
    expect(headerSet["Content-Security-Policy"]).not.toMatch(
      /https?:\/\/(?!everyday-tech-insight\.vercel\.app)/,
    );
  });
});

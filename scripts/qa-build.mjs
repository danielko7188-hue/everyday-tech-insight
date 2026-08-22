import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { load } from "cheerio";

import {
  printFindings,
  readArticleRecords,
  REQUIRED_CATEGORY_SLUGS,
} from "./qa-content.mjs";

const FIXED_INDEXABLE_ROUTES = [
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
const PLACEHOLDER_PATTERN =
  /\b(?:todo|tbd|changeme|lorem ipsum|replace[-_ ]?me|your[-_ ]?(?:name|email|id))\b/i;
const TRACKING_PATTERN =
  /(?:googlesyndication|doubleclick|google-analytics|googletagmanager|adsbygoogle|(?:ca-)?pub-\d{10,}|\bUA-\d{4,}-\d+\b|\bG-[A-Z0-9]{6,}\b|\bGTM-[A-Z0-9]{4,}\b)/i;

function finding(code, file, message) {
  return { code, file, message };
}

function normalizeFileName(fileName) {
  return fileName.replaceAll("\\", "/").replace(/^\.\//, "");
}

function htmlFileToRoute(fileName) {
  const normalized = normalizeFileName(fileName);
  if (normalized === "index.html") return "/";
  if (normalized === "404.html") return "/404.html";
  if (normalized.endsWith("/index.html")) {
    return `/${normalized.slice(0, -"index.html".length)}`;
  }
  return `/${normalized}`;
}

function normalizedAbsolute(value, siteUrl) {
  try {
    const url = new URL(value, siteUrl);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

function routeToFileName(route) {
  const urlPath = new URL(route, "https://local.invalid").pathname;
  if (urlPath === "/") return "index.html";
  if (urlPath.endsWith("/")) return `${urlPath.slice(1)}index.html`;
  return urlPath.slice(1);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  return [...left].every((value) => right.has(value));
}

function setDifference(left, right) {
  return sorted([...left].filter((value) => !right.has(value)));
}

function membershipMessage(actual, expected) {
  const missing = setDifference(expected, actual);
  const extra = setDifference(actual, expected);
  return `missing [${missing.join(", ") || "none"}]; extra [${extra.join(", ") || "none"}].`;
}

function structuredDataTypes(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) structuredDataTypes(item, result);
    return result;
  }
  if (!value || typeof value !== "object") return result;
  if (typeof value["@type"] === "string") result.push(value["@type"]);
  for (const nested of Object.values(value))
    structuredDataTypes(nested, result);
  return result;
}

function internalTarget(value, siteUrl) {
  if (!value || value.startsWith("#")) return null;
  try {
    const base = new URL(siteUrl);
    const target = new URL(value, base);
    if (target.origin !== base.origin) return null;
    target.hash = "";
    target.search = "";
    return target.pathname;
  } catch {
    return null;
  }
}

function validatePage({
  fileName,
  html,
  route,
  files,
  siteUrl,
  expectedIndexableRoutes,
}) {
  const issues = [];
  const $ = load(html);
  const isNotFound = route === "/404.html";
  const expectedCanonical = new URL(route, siteUrl).toString();

  if ($("h1").length !== 1) {
    issues.push(
      finding(
        "h1-count",
        fileName,
        `expected one H1; found ${$("h1").length}.`,
      ),
    );
  }

  const title = $("head > title").text().trim();
  if (
    $("head > title").length !== 1 ||
    title.length < 10 ||
    title.length > 100
  ) {
    issues.push(
      finding(
        "title",
        fileName,
        "title must be unique markup with 10-100 characters.",
      ),
    );
  }

  const descriptions = $('meta[name="description"]');
  const description = descriptions.attr("content")?.trim() ?? "";
  if (
    descriptions.length !== 1 ||
    description.length < 50 ||
    description.length > 180
  ) {
    issues.push(
      finding(
        "description",
        fileName,
        `meta description must contain 50-180 characters; found ${description.length}.`,
      ),
    );
  }

  const robots = $('meta[name="robots"]');
  const expectedRobots = isNotFound ? "noindex,follow" : "index,follow";
  if (robots.length !== 1 || robots.attr("content") !== expectedRobots) {
    issues.push(
      finding("robots", fileName, `robots must be ${expectedRobots}.`),
    );
  }

  const canonical = $('link[rel="canonical"]');
  if (canonical.length !== 1 || canonical.attr("href") !== expectedCanonical) {
    issues.push(
      finding("canonical", fileName, `canonical must be ${expectedCanonical}.`),
    );
  }

  const expectedOgType = route.startsWith("/articles/") ? "article" : "website";
  const ogChecks = [
    ["og:type", expectedOgType, "og-type"],
    ["og:title", title, "og-title"],
    ["og:description", description, "og-description"],
    ["og:url", expectedCanonical, "og-url"],
  ];
  for (const [property, expected, code] of ogChecks) {
    const nodes = $(`meta[property="${property}"]`);
    if (nodes.length !== 1 || nodes.attr("content") !== expected) {
      issues.push(
        finding(code, fileName, `${property} must match the page metadata.`),
      );
    }
  }

  const jsonLdTypes = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      const parsed = JSON.parse($(element).text());
      structuredDataTypes(parsed, jsonLdTypes);
    } catch {
      issues.push(finding("json-ld", fileName, "JSON-LD must parse as JSON."));
    }
  });
  const prohibitedTypes = jsonLdTypes.filter((type) =>
    ["Person", "Organization"].includes(type),
  );
  if (prohibitedTypes.length > 0) {
    issues.push(
      finding(
        "json-ld-entity-claim",
        fileName,
        `unsubstantiated structured-data types: ${prohibitedTypes.join(", ")}.`,
      ),
    );
  }
  if (!isNotFound && route === "/" && !jsonLdTypes.includes("WebSite")) {
    issues.push(
      finding("json-ld-website", fileName, "home must expose WebSite JSON-LD."),
    );
  }
  if (!isNotFound && route !== "/" && !jsonLdTypes.includes("BreadcrumbList")) {
    issues.push(
      finding(
        "json-ld-breadcrumb",
        fileName,
        "indexable inner pages need BreadcrumbList JSON-LD.",
      ),
    );
  }

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const target = internalTarget(href, siteUrl);
    if (!target) return;
    const targetFile = routeToFileName(target);
    if (!files.has(targetFile)) {
      issues.push(
        finding(
          "broken-internal-link",
          fileName,
          `${href} does not resolve in dist.`,
        ),
      );
    }
  });

  $(
    "img[src], source[src], video[src], audio[src], link[rel='icon'][href], link[rel='stylesheet'][href], link[rel='preload'][href]",
  ).each((_index, element) => {
    const value = $(element).attr("src") ?? $(element).attr("href");
    const target = internalTarget(value, siteUrl);
    if (!target) return;
    const targetFile = target.replace(/^\//, "");
    if (!files.has(targetFile)) {
      issues.push(
        finding(
          "missing-resource",
          fileName,
          `${value} does not resolve in dist.`,
        ),
      );
    }
  });

  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    const target = internalTarget(ogImage, siteUrl);
    if (target && !files.has(target.replace(/^\//, ""))) {
      issues.push(
        finding(
          "missing-resource",
          fileName,
          `${ogImage} does not resolve in dist.`,
        ),
      );
    }
  }

  const nonJsonScripts = $("script").filter(
    (_index, element) => $(element).attr("type") !== "application/ld+json",
  );
  if (nonJsonScripts.length > 0 || $("script[src]").length > 0) {
    issues.push(
      finding(
        "client-script",
        fileName,
        "public HTML contains executable client script.",
      ),
    );
  }
  if (PLACEHOLDER_PATTERN.test(html)) {
    issues.push(
      finding(
        "placeholder",
        fileName,
        "public HTML contains placeholder text.",
      ),
    );
  }
  if (TRACKING_PATTERN.test(html)) {
    issues.push(
      finding(
        "tracking-or-ad-code",
        fileName,
        "public HTML contains advertising or analytics code.",
      ),
    );
  }

  if (!isNotFound && !expectedIndexableRoutes.has(route)) {
    issues.push(
      finding(
        "unexpected-indexable-route",
        fileName,
        `${route} is not in the public route contract.`,
      ),
    );
  }

  return { issues, title, description, $ };
}

function xmlLocations(xml, selector, siteUrl) {
  const $ = load(xml, { xmlMode: true });
  return new Set(
    $(selector)
      .map((_index, element) =>
        normalizedAbsolute($(element).text().trim(), siteUrl),
      )
      .get()
      .filter(Boolean),
  );
}

export function validateBuiltOutput({
  files,
  articles,
  categorySlugs,
  siteUrl,
}) {
  const normalizedFiles = new Map(
    [...files].map(([fileName, contents]) => [
      normalizeFileName(fileName),
      contents,
    ]),
  );
  const issues = [];
  const publishedArticles = articles.filter(
    ({ data }) => data.status === "published",
  );
  const excludedArticles = articles.filter(
    ({ data }) => data.status !== "published",
  );
  const expectedArticleRoutes = new Set(
    publishedArticles.map(({ data }) => `/articles/${data.slug}/`),
  );
  const expectedCategoryRoutes = new Set(
    categorySlugs.map((slug) => `/categories/${slug}/`),
  );
  const expectedIndexableRoutes = new Set([
    ...FIXED_INDEXABLE_ROUTES,
    ...expectedCategoryRoutes,
    ...expectedArticleRoutes,
  ]);
  const htmlFiles = [...normalizedFiles]
    .filter(([fileName]) => fileName.endsWith(".html"))
    .sort(([left], [right]) => left.localeCompare(right));
  const actualIndexableRoutes = new Set(
    htmlFiles
      .map(([fileName]) => htmlFileToRoute(fileName))
      .filter((route) => route !== "/404.html"),
  );

  if (!sameSet(actualIndexableRoutes, expectedIndexableRoutes)) {
    issues.push(
      finding(
        "indexable-route-set",
        "dist",
        membershipMessage(actualIndexableRoutes, expectedIndexableRoutes),
      ),
    );
  }

  const titles = new Map();
  const descriptions = new Map();
  const parsedPages = new Map();
  for (const [fileName, html] of htmlFiles) {
    const route = htmlFileToRoute(fileName);
    const result = validatePage({
      fileName,
      html,
      route,
      files: normalizedFiles,
      siteUrl,
      expectedIndexableRoutes,
    });
    issues.push(...result.issues);
    parsedPages.set(route, result.$);

    if (route !== "/404.html") {
      if (titles.has(result.title)) {
        issues.push(
          finding(
            "duplicate-title",
            fileName,
            `title duplicates ${titles.get(result.title)}.`,
          ),
        );
      } else {
        titles.set(result.title, fileName);
      }
      if (descriptions.has(result.description)) {
        issues.push(
          finding(
            "duplicate-description",
            fileName,
            `description duplicates ${descriptions.get(result.description)}.`,
          ),
        );
      } else {
        descriptions.set(result.description, fileName);
      }
    }
  }

  const combinedPublicOutput = [...normalizedFiles]
    .filter(([fileName]) => /\.(?:html|xml|txt)$/.test(fileName))
    .map(([, contents]) => contents)
    .join("\n");
  for (const { data, fileName } of excludedArticles) {
    if (
      combinedPublicOutput.includes(`/articles/${data.slug}/`) ||
      combinedPublicOutput.includes(data.title)
    ) {
      issues.push(
        finding(
          "draft-leakage",
          fileName,
          "non-published content appears in public output.",
        ),
      );
    }
  }
  if (normalizedFiles.has("ads.txt")) {
    issues.push(
      finding(
        "ads-file",
        "ads.txt",
        "ads.txt must remain absent while monetization is disabled.",
      ),
    );
  }

  const robots = normalizedFiles.get("robots.txt");
  if (!robots) {
    issues.push(finding("robots-file", "robots.txt", "robots.txt is missing."));
  } else {
    const expectedSitemapLine = `Sitemap: ${new URL("/sitemap-index.xml", siteUrl)}`;
    if (
      !robots.includes("User-agent: *") ||
      !robots.includes("Allow: /") ||
      !robots.includes(expectedSitemapLine)
    ) {
      issues.push(
        finding(
          "robots-file",
          "robots.txt",
          "robots.txt does not expose the configured sitemap.",
        ),
      );
    }
    if (/^Disallow:\s*\/$/m.test(robots)) {
      issues.push(
        finding(
          "robots-file",
          "robots.txt",
          "robots.txt blocks the entire site.",
        ),
      );
    }
  }

  const sitemapIndex = normalizedFiles.get("sitemap-index.xml");
  const sitemap = normalizedFiles.get("sitemap-0.xml");
  if (!sitemapIndex || !sitemap) {
    issues.push(
      finding(
        "sitemap-file",
        "sitemap",
        "sitemap-index.xml and sitemap-0.xml are required.",
      ),
    );
  } else {
    const indexedSitemaps = xmlLocations(
      sitemapIndex,
      "sitemap > loc",
      siteUrl,
    );
    const expectedSitemap = new Set([
      new URL("/sitemap-0.xml", siteUrl).toString(),
    ]);
    if (!sameSet(indexedSitemaps, expectedSitemap)) {
      issues.push(
        finding(
          "sitemap-index",
          "sitemap-index.xml",
          membershipMessage(indexedSitemaps, expectedSitemap),
        ),
      );
    }
    const actualSitemapRoutes = new Set(
      [...xmlLocations(sitemap, "url > loc", siteUrl)].map(
        (absolute) => new URL(absolute).pathname,
      ),
    );
    if (!sameSet(actualSitemapRoutes, expectedIndexableRoutes)) {
      issues.push(
        finding(
          "sitemap-membership",
          "sitemap-0.xml",
          membershipMessage(actualSitemapRoutes, expectedIndexableRoutes),
        ),
      );
    }
  }

  const rss = normalizedFiles.get("rss.xml");
  if (!rss) {
    issues.push(finding("feed-file", "rss.xml", "RSS feed is missing."));
  } else {
    const actualFeedRoutes = new Set(
      [...xmlLocations(rss, "item > link", siteUrl)].map(
        (absolute) => new URL(absolute).pathname,
      ),
    );
    if (!sameSet(actualFeedRoutes, expectedArticleRoutes)) {
      issues.push(
        finding(
          "feed-membership",
          "rss.xml",
          membershipMessage(actualFeedRoutes, expectedArticleRoutes),
        ),
      );
    }
  }

  for (const categorySlug of categorySlugs) {
    const route = `/categories/${categorySlug}/`;
    const $ = parsedPages.get(route);
    if (!$) continue;
    const actual = new Set(
      $("a[href]")
        .map((_index, element) =>
          internalTarget($(element).attr("href"), siteUrl),
        )
        .get()
        .filter((target) => target?.startsWith("/articles/")),
    );
    const expected = new Set(
      publishedArticles
        .filter(({ data }) => data.category === categorySlug)
        .map(({ data }) => `/articles/${data.slug}/`),
    );
    if (!sameSet(actual, expected)) {
      issues.push(
        finding(
          "category-membership",
          route,
          membershipMessage(actual, expected),
        ),
      );
    }
  }

  const home = parsedPages.get("/");
  if (home) {
    const actualHomeCategories = new Set(
      home("a[href]")
        .map((_index, element) =>
          internalTarget(home(element).attr("href"), siteUrl),
        )
        .get()
        .filter((target) => expectedCategoryRoutes.has(target)),
    );
    if (!sameSet(actualHomeCategories, expectedCategoryRoutes)) {
      issues.push(
        finding(
          "home-category-membership",
          "/",
          membershipMessage(actualHomeCategories, expectedCategoryRoutes),
        ),
      );
    }
  }

  const htmlSitemap = parsedPages.get("/sitemap/");
  if (htmlSitemap) {
    const actualHtmlSitemapRoutes = new Set(
      htmlSitemap("a[href]")
        .map((_index, element) =>
          internalTarget(htmlSitemap(element).attr("href"), siteUrl),
        )
        .get()
        .filter((target) => expectedIndexableRoutes.has(target)),
    );
    if (!sameSet(actualHtmlSitemapRoutes, expectedIndexableRoutes)) {
      issues.push(
        finding(
          "html-sitemap-membership",
          "/sitemap/",
          membershipMessage(actualHtmlSitemapRoutes, expectedIndexableRoutes),
        ),
      );
    }
  }

  return issues;
}

export async function readBuildFiles(
  distDirectory = path.join(process.cwd(), "dist"),
) {
  const files = new Map();
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else {
        const relative = normalizeFileName(
          path.relative(distDirectory, absolute),
        );
        if (/\.(?:html|xml|txt|css|js|svg|json|webmanifest)$/i.test(relative)) {
          files.set(relative, await readFile(absolute, "utf8"));
        } else {
          files.set(relative, "[binary resource]");
        }
      }
    }
  }
  await walk(distDirectory);
  return files;
}

async function main() {
  const articles = await readArticleRecords();
  const files = await readBuildFiles();
  const issues = validateBuiltOutput({
    files,
    articles,
    categorySlugs: REQUIRED_CATEGORY_SLUGS,
    siteUrl: "https://everyday-tech-insight.vercel.app/",
  });
  printFindings("Built-output QA", issues);
  if (issues.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `Built-output QA: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

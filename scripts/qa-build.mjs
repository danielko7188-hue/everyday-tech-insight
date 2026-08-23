import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { load } from "cheerio";
import { SaxesParser } from "saxes";

import {
  printFindings,
  readArticleRecords,
  REQUIRED_CATEGORY_SLUGS,
} from "./qa-content.mjs";
import { siteConfig, siteUrl as configuredSiteUrl } from "../site.config.mjs";

const TRUST_NAVIGATION = JSON.parse(
  await readFile(
    new URL("../src/data/trust-navigation.json", import.meta.url),
    "utf8",
  ),
);

const FIXED_INDEXABLE_ROUTES = [
  "/",
  "/categories/",
  "/articles/",
  "/toolkit/",
  ...TRUST_NAVIGATION.map(({ path: routePath }) => routePath),
  "/sitemap/",
];
const TRUST_PAGE_ROUTES = new Set([
  ...TRUST_NAVIGATION.map(({ path: routePath }) => routePath),
  "/404.html",
]);
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

function hasExactObjectKeys(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function validatePublicAbsoluteUrl(value, siteUrl) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, message: "must be an absolute HTTPS URL." };
  }

  const configured = new URL(siteUrl);
  if (url.protocol !== "https:") {
    return { valid: false, message: "must be an absolute HTTPS URL." };
  }
  if (url.origin !== configured.origin || url.username || url.password) {
    return { valid: false, message: "must use the configured origin." };
  }
  if (value.includes("?") || value.includes("#")) {
    return { valid: false, message: "must not contain a query or fragment." };
  }
  return { valid: true, absolute: url.toString() };
}

function visibleBreadcrumbItems($, expectedCanonical, siteUrl) {
  return $("nav.breadcrumbs[aria-label='Breadcrumb'] ol > li")
    .map((_index, element) => {
      const node = $(element);
      const anchor = node.find("a[href]").first();
      return {
        name: node.text().replace(/\s+/g, " ").trim(),
        item:
          anchor.length > 0
            ? new URL(anchor.attr("href"), siteUrl).toString()
            : expectedCanonical,
      };
    })
    .get();
}

function validateStructuredData({
  $,
  fileName,
  route,
  siteUrl,
  expectedCanonical,
  description,
  isNotFound,
}) {
  const issues = [];
  const documents = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      documents.push(JSON.parse($(element).text()));
    } catch {
      issues.push(finding("json-ld", fileName, "JSON-LD must parse as JSON."));
    }
  });

  const allowedTypes = new Set(["WebSite", "BreadcrumbList", "ListItem"]);
  const allowedTopLevelTypes = new Set(["WebSite", "BreadcrumbList"]);
  const types = documents.flatMap((document) => structuredDataTypes(document));
  const unsupported = [
    ...new Set(types.filter((type) => !allowedTypes.has(type))),
  ];
  if (unsupported.length > 0) {
    issues.push(
      finding(
        "json-ld-type",
        fileName,
        `unsupported structured-data types: ${unsupported.join(", ")}.`,
      ),
    );
  }

  const reportShapeIssue = () => {
    if (issues.some(({ code }) => code === "json-ld-shape")) return;
    issues.push(
      finding(
        "json-ld-shape",
        fileName,
        "JSON-LD documents must use only the exact implemented WebSite or BreadcrumbList shapes.",
      ),
    );
  };
  if (
    documents.some(
      (document) =>
        !document ||
        typeof document !== "object" ||
        Array.isArray(document) ||
        !allowedTopLevelTypes.has(document["@type"]),
    )
  ) {
    reportShapeIssue();
  }

  if (isNotFound) {
    if (documents.length > 0) {
      issues.push(
        finding(
          "json-ld-404",
          fileName,
          "the non-indexable 404 page must not publish structured-data claims.",
        ),
      );
    }
    return issues;
  }

  const websiteDocuments = documents.filter(
    (document) => document?.["@type"] === "WebSite",
  );
  const breadcrumbDocuments = documents.filter(
    (document) => document?.["@type"] === "BreadcrumbList",
  );

  if (route === "/") {
    if (websiteDocuments.length !== 1 || breadcrumbDocuments.length !== 0) {
      issues.push(
        finding(
          "json-ld-website",
          fileName,
          "home must expose exactly one WebSite JSON-LD document.",
        ),
      );
      return issues;
    }

    const website = websiteDocuments[0];
    if (
      !hasExactObjectKeys(website, [
        "@context",
        "@type",
        "name",
        "url",
        "description",
        "inLanguage",
      ])
    ) {
      reportShapeIssue();
    }
    const visibleName = $(".site-name")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const visibleLanguage = $("html").attr("lang")?.trim();
    if (
      website?.["@context"] !== "https://schema.org" ||
      website?.name !== siteConfig.name ||
      website?.name !== visibleName ||
      website?.url !== expectedCanonical ||
      website?.url !== siteUrl ||
      website?.description !== description ||
      website?.inLanguage !== siteConfig.locale ||
      website?.inLanguage !== visibleLanguage
    ) {
      issues.push(
        finding(
          "json-ld-website-visible",
          fileName,
          "WebSite JSON-LD must match the configured name, canonical URL, visible name, meta description, and page language.",
        ),
      );
    }
    return issues;
  }

  if (breadcrumbDocuments.length !== 1 || websiteDocuments.length !== 0) {
    issues.push(
      finding(
        "json-ld-breadcrumb",
        fileName,
        "indexable inner pages need exactly one BreadcrumbList JSON-LD document.",
      ),
    );
    return issues;
  }

  const breadcrumb = breadcrumbDocuments[0];
  const structuredItems = Array.isArray(breadcrumb?.itemListElement)
    ? breadcrumb.itemListElement
    : [];
  const visibleItems = visibleBreadcrumbItems($, expectedCanonical, siteUrl);
  if (
    !hasExactObjectKeys(breadcrumb, ["@context", "@type", "itemListElement"]) ||
    structuredItems.some(
      (item) =>
        !hasExactObjectKeys(item, ["@type", "position", "name", "item"]),
    )
  ) {
    reportShapeIssue();
  }
  let mismatch =
    breadcrumb?.["@context"] !== "https://schema.org" ||
    structuredItems.length === 0 ||
    structuredItems.length !== visibleItems.length;
  for (const [index, visible] of visibleItems.entries()) {
    const item = structuredItems[index];
    const itemUrl = validatePublicAbsoluteUrl(item?.item, siteUrl);
    if (
      item?.["@type"] !== "ListItem" ||
      item?.position !== index + 1 ||
      item?.name !== visible.name ||
      !itemUrl.valid ||
      itemUrl.absolute !== visible.item
    ) {
      mismatch = true;
    }
  }
  if (mismatch) {
    issues.push(
      finding(
        "json-ld-breadcrumb-visible",
        fileName,
        "BreadcrumbList names, positions, and URLs must match the visible breadcrumb trail and canonical page.",
      ),
    );
  }

  return issues;
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

  const idCounts = new Map();
  $("[id]").each((_index, element) => {
    const id = $(element).attr("id");
    if (!id) return;
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  });
  const duplicateIds = [...idCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  if (duplicateIds.length > 0) {
    issues.push(
      finding(
        "duplicate-id",
        fileName,
        `IDs must be globally unique; duplicated: ${duplicateIds.join(", ")}.`,
      ),
    );
  }

  if (route.startsWith("/articles/") && route !== "/articles/") {
    const fitSummaries = $(".fit-summary");
    if (fitSummaries.length !== 1) {
      issues.push(
        finding(
          "fit-summary-count",
          fileName,
          `article must expose exactly one fit summary; found ${fitSummaries.length}.`,
        ),
      );
    }

    const atAGlanceHeadings = $("h1, h2, h3, h4, h5, h6").filter(
      (_index, element) =>
        $(element).text().replace(/\s+/g, " ").trim() === "At a glance",
    );
    if (atAGlanceHeadings.length !== 1) {
      issues.push(
        finding(
          "at-a-glance-count",
          fileName,
          `article must expose exactly one At a glance heading; found ${atAGlanceHeadings.length}.`,
        ),
      );
    }

    const tocStructures = $(
      'nav[aria-label="On this page"], details:has(> summary)',
    ).filter((_index, element) => {
      const node = $(element);
      if (node.is("nav")) return true;
      return (
        node.children("summary").first().text().replace(/\s+/g, " ").trim() ===
        "On this page"
      );
    });
    if (tocStructures.length !== 1) {
      issues.push(
        finding(
          "toc-count",
          fileName,
          `article must expose exactly one table of contents; found ${tocStructures.length}.`,
        ),
      );
    }

    const tocTargetCounts = new Map();
    tocStructures.find('a[href^="#"]').each((_index, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      let target = href.slice(1);
      try {
        target = decodeURIComponent(target);
      } catch {
        // Keep the raw fragment so the missing-target check can report it.
      }
      tocTargetCounts.set(target, (tocTargetCounts.get(target) ?? 0) + 1);
    });
    const invalidTocTargets = [...tocTargetCounts.entries()]
      .filter(
        ([target, linkCount]) =>
          linkCount !== 1 || (idCounts.get(target) ?? 0) !== 1,
      )
      .map(([target]) => target);
    const bodyHeadingIds = $(
      ".article-body h2[id], .article-body h3[id], .article-body h4[id], .article-body h5[id], .article-body h6[id]",
    )
      .map((_index, element) => $(element).attr("id"))
      .get();
    const missingTocTargets = bodyHeadingIds.filter(
      (id) => (tocTargetCounts.get(id) ?? 0) !== 1,
    );
    const reportedTocTargets = [
      ...new Set([...invalidTocTargets, ...missingTocTargets]),
    ];
    if (tocTargetCounts.size === 0 || reportedTocTargets.length > 0) {
      issues.push(
        finding(
          "toc-link-count",
          fileName,
          `each article heading ID must have one TOC link and one matching ID; invalid: ${reportedTocTargets.join(", ") || "no links"}.`,
        ),
      );
    }
  }

  if (TRUST_PAGE_ROUTES.has(route)) {
    const trustPages = $(".trust-page");
    if (trustPages.length !== 1) {
      issues.push(
        finding(
          "trust-page-shell",
          fileName,
          `trust route must expose exactly one shared trust-page shell; found ${trustPages.length}.`,
        ),
      );
    }
    const trustIntros = trustPages.children(".trust-page__intro");
    if (trustIntros.length !== 1) {
      issues.push(
        finding(
          "trust-page-intro",
          fileName,
          `trust route must expose exactly one direct intro; found ${trustIntros.length}.`,
        ),
      );
    }
    const relatedNavs = trustPages.find(
      'nav.trust-page__related[aria-label="Related publication pages"]',
    );
    if (relatedNavs.length !== 1) {
      issues.push(
        finding(
          "trust-page-related-nav",
          fileName,
          `trust route must expose exactly one related publication nav; found ${relatedNavs.length}.`,
        ),
      );
    }

    const actualRelatedLinks = relatedNavs
      .find("a")
      .map((_index, element) => ({
        href: $(element).attr("href") ?? "",
        label: $(element).text().replace(/\s+/g, " ").trim(),
      }))
      .get();
    const hasCanonicalRelatedLinks =
      actualRelatedLinks.length === TRUST_NAVIGATION.length &&
      TRUST_NAVIGATION.every(
        (expectedLink, index) =>
          actualRelatedLinks[index]?.href === expectedLink.path &&
          actualRelatedLinks[index]?.label === expectedLink.label,
      );
    if (!hasCanonicalRelatedLinks) {
      issues.push(
        finding(
          "trust-page-related-links",
          fileName,
          "related publication links must match the canonical ordered href and label list.",
        ),
      );
    }

    const currentNodes = relatedNavs.find("[aria-current]");
    const expectedCurrentPath = isNotFound ? null : route;
    const hasCorrectCurrentPage = expectedCurrentPath
      ? currentNodes.length === 1 &&
        currentNodes.first().is("a") &&
        currentNodes.first().attr("aria-current") === "page" &&
        currentNodes.first().attr("href") === expectedCurrentPath
      : currentNodes.length === 0;
    if (!hasCorrectCurrentPage) {
      issues.push(
        finding(
          "trust-page-related-current",
          fileName,
          expectedCurrentPath
            ? `related publication links must mark only ${expectedCurrentPath} as the current page.`
            : "the 404 related publication links must not mark a current page.",
        ),
      );
    }
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

  const expectedOgType =
    route.startsWith("/articles/") && route !== "/articles/"
      ? "article"
      : "website";
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

  issues.push(
    ...validateStructuredData({
      $,
      fileName,
      route,
      siteUrl,
      expectedCanonical,
      description,
      isNotFound,
    }),
  );

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

function xmlLocations(xml, selector, { siteUrl, fileName, code, issues }) {
  const $ = load(xml, { xmlMode: true });
  const locations = new Set();
  const rawLocations = [];
  const absoluteLocations = [];
  $(selector).each((_index, element) => {
    const raw = $(element).text().trim();
    rawLocations.push(raw);
    const result = validatePublicAbsoluteUrl(raw, siteUrl);
    if (!result.valid) {
      issues.push(
        finding(code, fileName, `${raw || "[empty URL]"} ${result.message}`),
      );
    } else {
      locations.add(result.absolute);
      absoluteLocations.push(result.absolute);
    }
  });
  return { $, absoluteLocations, locations, rawLocations };
}

function hasSingleXmlRoot($, rootName) {
  const roots = $.root().children();
  return roots.length === 1 && roots.filter(rootName).length === 1;
}

export function isWellFormedXml(xml) {
  try {
    new SaxesParser().write(xml).close();
    return true;
  } catch {
    return false;
  }
}

function everyElement($, selector, predicate) {
  let valid = true;
  $(selector).each((_index, element) => {
    if (!predicate($(element))) valid = false;
  });
  return valid;
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
    if (!isWellFormedXml(sitemapIndex)) {
      issues.push(
        finding(
          "sitemap-xml",
          "sitemap-index.xml",
          "sitemap index must be well-formed XML.",
        ),
      );
    }
    if (!isWellFormedXml(sitemap)) {
      issues.push(
        finding(
          "sitemap-xml",
          "sitemap-0.xml",
          "sitemap must be well-formed XML.",
        ),
      );
    }
    const sitemapIndexParsed = load(sitemapIndex, { xmlMode: true });
    const sitemapIndexEntries = sitemapIndexParsed("sitemapindex > sitemap");
    const validSitemapIndexStructure =
      hasSingleXmlRoot(sitemapIndexParsed, "sitemapindex") &&
      sitemapIndexEntries.length > 0 &&
      sitemapIndexEntries.length === sitemapIndexParsed("sitemap").length &&
      everyElement(
        sitemapIndexParsed,
        "sitemapindex > sitemap",
        (entry) => entry.children("loc").length === 1,
      ) &&
      sitemapIndexParsed("sitemapindex > sitemap > loc").length ===
        sitemapIndexParsed("loc").length;
    if (!validSitemapIndexStructure) {
      issues.push(
        finding(
          "sitemap-structure",
          "sitemap-index.xml",
          "sitemap index needs one sitemapindex root and one direct loc in every direct sitemap entry.",
        ),
      );
    }
    const {
      absoluteLocations: indexedSitemapValues,
      locations: indexedSitemaps,
    } = xmlLocations(sitemapIndex, "sitemapindex > sitemap > loc", {
      siteUrl,
      fileName: "sitemap-index.xml",
      code: "sitemap-url",
      issues,
    });
    const expectedSitemap = new Set([
      new URL("/sitemap-0.xml", siteUrl).toString(),
    ]);
    if (new Set(indexedSitemapValues).size !== indexedSitemapValues.length) {
      issues.push(
        finding(
          "sitemap-duplicate",
          "sitemap-index.xml",
          "sitemap index locations must be unique.",
        ),
      );
    }
    if (!sameSet(indexedSitemaps, expectedSitemap)) {
      issues.push(
        finding(
          "sitemap-index",
          "sitemap-index.xml",
          membershipMessage(indexedSitemaps, expectedSitemap),
        ),
      );
    }
    const sitemapParsed = load(sitemap, { xmlMode: true });
    const sitemapEntries = sitemapParsed("urlset > url");
    const validSitemapStructure =
      hasSingleXmlRoot(sitemapParsed, "urlset") &&
      sitemapEntries.length > 0 &&
      sitemapEntries.length === sitemapParsed("url").length &&
      everyElement(
        sitemapParsed,
        "urlset > url",
        (entry) => entry.children("loc").length === 1,
      ) &&
      sitemapParsed("urlset > url > loc").length ===
        sitemapParsed("loc").length;
    if (!validSitemapStructure) {
      issues.push(
        finding(
          "sitemap-structure",
          "sitemap-0.xml",
          "sitemap needs one urlset root and one direct loc in every direct url entry.",
        ),
      );
    }
    const { absoluteLocations: sitemapValues, locations: sitemapLocations } =
      xmlLocations(sitemap, "urlset > url > loc", {
        siteUrl,
        fileName: "sitemap-0.xml",
        code: "sitemap-url",
        issues,
      });
    if (new Set(sitemapValues).size !== sitemapValues.length) {
      issues.push(
        finding(
          "sitemap-duplicate",
          "sitemap-0.xml",
          "sitemap URL locations must be unique.",
        ),
      );
    }
    const actualSitemapRoutes = new Set(
      [...sitemapLocations].map((absolute) => new URL(absolute).pathname),
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
    if (!isWellFormedXml(rss)) {
      issues.push(
        finding("feed-xml", "rss.xml", "RSS feed must be well-formed XML."),
      );
    }
    const rssParsed = load(rss, { xmlMode: true });
    const channels = rssParsed("rss > channel");
    const feedItems = rssParsed("rss > channel > item");
    const validFeedStructure =
      hasSingleXmlRoot(rssParsed, "rss") &&
      channels.length === 1 &&
      channels.length === rssParsed("channel").length &&
      feedItems.length === rssParsed("item").length &&
      channels.first().children("link").length === 1 &&
      everyElement(
        rssParsed,
        "rss > channel > item",
        (item) =>
          item.children("link").length === 1 &&
          item.children("guid").length === 1,
      ) &&
      rssParsed("rss > channel > item > link").length ===
        rssParsed("item link").length &&
      rssParsed("rss > channel > item > guid").length ===
        rssParsed("item guid").length;
    if (!validFeedStructure) {
      issues.push(
        finding(
          "feed-structure",
          "rss.xml",
          "RSS needs one channel under one rss root, direct items under that channel, and one direct link and guid per item.",
        ),
      );
    }
    const channel = xmlLocations(rss, "rss > channel > link", {
      siteUrl,
      fileName: "rss.xml",
      code: "feed-url",
      issues,
    });
    if (
      channel.$("rss > channel > link").length !== 1 ||
      !sameSet(channel.locations, new Set([new URL(siteUrl).toString()]))
    ) {
      issues.push(
        finding(
          "feed-channel",
          "rss.xml",
          "RSS channel link must be the configured canonical home URL.",
        ),
      );
    }
    const itemLinks = xmlLocations(rss, "rss > channel > item > link", {
      siteUrl,
      fileName: "rss.xml",
      code: "feed-url",
      issues,
    });
    const itemGuids = xmlLocations(rss, "rss > channel > item > guid", {
      siteUrl,
      fileName: "rss.xml",
      code: "feed-url",
      issues,
    });
    const itemCount = itemLinks.$("rss > channel > item").length;
    let itemPairMismatch = false;
    const seenItemLinks = new Set();
    itemLinks.$("rss > channel > item").each((_index, element) => {
      const item = itemLinks.$(element);
      const links = item.children("link");
      const guids = item.children("guid");
      const link = validatePublicAbsoluteUrl(
        links.first().text().trim(),
        siteUrl,
      );
      const guid = validatePublicAbsoluteUrl(
        guids.first().text().trim(),
        siteUrl,
      );
      if (
        links.length !== 1 ||
        guids.length !== 1 ||
        !link.valid ||
        !guid.valid ||
        link.absolute !== guid.absolute ||
        seenItemLinks.has(link.absolute)
      ) {
        itemPairMismatch = true;
      }
      if (link.valid) seenItemLinks.add(link.absolute);
    });
    if (
      itemLinks.$("rss > channel > item > link").length !== itemCount ||
      itemLinks.$("rss > channel > item > guid").length !== itemCount ||
      itemLinks.locations.size !== itemCount ||
      itemGuids.locations.size !== itemCount ||
      !sameSet(itemLinks.locations, itemGuids.locations) ||
      itemPairMismatch
    ) {
      issues.push(
        finding(
          "feed-item-url",
          "rss.xml",
          "every RSS item must have matching validated link and guid URLs.",
        ),
      );
    }
    const actualFeedRoutes = new Set(
      [...itemLinks.locations].map((absolute) => new URL(absolute).pathname),
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
      $("main a[href]")
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

  const articleArchive = parsedPages.get("/articles/");
  if (articleArchive) {
    const archiveRoutes = articleArchive("main a[href]")
      .map((_index, element) =>
        internalTarget(articleArchive(element).attr("href"), siteUrl),
      )
      .get()
      .filter(
        (target) => target?.startsWith("/articles/") && target !== "/articles/",
      );
    const actualArchiveRoutes = new Set(archiveRoutes);
    if (
      archiveRoutes.length !== expectedArticleRoutes.size ||
      !sameSet(actualArchiveRoutes, expectedArticleRoutes)
    ) {
      issues.push(
        finding(
          "article-archive-membership",
          "/articles/",
          membershipMessage(actualArchiveRoutes, expectedArticleRoutes),
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
    siteUrl: configuredSiteUrl,
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

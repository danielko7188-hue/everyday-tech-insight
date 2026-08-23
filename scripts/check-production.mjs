import { load } from "cheerio";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SaxesParser } from "saxes";
import sharp from "sharp";

export const PUBLISHED_ARTICLE_PATHS = Object.freeze([
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
]);

export const TOOLKIT_DETAIL_PATHS = Object.freeze([
  "/toolkit/automation-candidate-screen/",
  "/toolkit/saas-evaluation-evidence-sheet/",
  "/toolkit/technology-risk-register/",
  "/toolkit/backup-restore-test-log/",
]);

export const PRODUCTION_ROUTES = Object.freeze([
  { path: "/", expectedStatus: 200, kind: "html" },
  { path: "/categories/", expectedStatus: 200, kind: "html" },
  { path: "/articles/", expectedStatus: 200, kind: "html" },
  {
    path: "/categories/ai-automation/",
    expectedStatus: 200,
    kind: "html",
  },
  {
    path: "/categories/business-software/",
    expectedStatus: 200,
    kind: "html",
  },
  {
    path: "/categories/cybersecurity-data-protection/",
    expectedStatus: 200,
    kind: "html",
  },
  {
    path: "/categories/digital-operations/",
    expectedStatus: 200,
    kind: "html",
  },
  {
    path: "/categories/technology-strategy/",
    expectedStatus: 200,
    kind: "html",
  },
  ...PUBLISHED_ARTICLE_PATHS.map((articlePath) => ({
    path: articlePath,
    expectedStatus: 200,
    kind: "html",
  })),
  { path: "/toolkit/", expectedStatus: 200, kind: "html" },
  ...TOOLKIT_DETAIL_PATHS.map((toolkitPath) => ({
    path: toolkitPath,
    expectedStatus: 200,
    kind: "html",
  })),
  { path: "/about/", expectedStatus: 200, kind: "html" },
  { path: "/publisher/", expectedStatus: 200, kind: "html" },
  {
    path: "/editorial-standards/",
    expectedStatus: 200,
    kind: "html",
  },
  { path: "/corrections/", expectedStatus: 200, kind: "html" },
  { path: "/contact/", expectedStatus: 200, kind: "html" },
  { path: "/privacy/", expectedStatus: 200, kind: "html" },
  {
    path: "/advertising-disclosure/",
    expectedStatus: 200,
    kind: "html",
  },
  { path: "/sitemap/", expectedStatus: 200, kind: "html" },
  { path: "/sitemap-index.xml", expectedStatus: 200, kind: "text" },
  { path: "/sitemap-0.xml", expectedStatus: 200, kind: "text" },
  { path: "/rss.xml", expectedStatus: 200, kind: "text" },
  { path: "/robots.txt", expectedStatus: 200, kind: "text" },
  { path: "/ads.txt", expectedStatus: 404, kind: "absent" },
  {
    path: "/production-smoke-route-that-must-not-exist/",
    expectedStatus: 404,
    kind: "html",
    canonicalPath: "/404.html",
  },
]);

export function normalizeOrigin(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Production origin is required.");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Production origin must be an absolute HTTPS URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Production origin must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Production origin must not include credentials.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Production origin must contain only an origin.");
  }

  return url.origin;
}

function rootRelativeAsset(value) {
  const candidate = value?.trim();
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) return null;

  const url = new URL(candidate, "https://internal.invalid");
  return `${url.pathname}${url.search}`;
}

export function collectInternalAssets(html) {
  const $ = load(html);
  const assets = new Map();

  function addAsset(value, reference, expectedType) {
    const url = rootRelativeAsset(value);
    if (!url) return;
    const asset = { expectedType, reference, url };
    assets.set(`${url}\0${reference}\0${expectedType}`, asset);
  }

  function declaredType(element) {
    return ($(element).attr("type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
  }

  function extensionExpectation(url) {
    const pathname = new URL(url, "https://internal.invalid").pathname;
    const extension = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
    if (
      [
        ".avif",
        ".gif",
        ".ico",
        ".jpeg",
        ".jpg",
        ".png",
        ".svg",
        ".webp",
      ].includes(extension)
    )
      return "image";
    if ([".js", ".mjs"].includes(extension)) return "script";
    if (extension === ".css") return "style";
    if ([".eot", ".otf", ".ttf", ".woff", ".woff2"].includes(extension))
      return "font";
    if ([".mp4", ".ogv", ".webm"].includes(extension)) return "video";
    if ([".aac", ".m4a", ".mp3", ".oga", ".ogg", ".wav"].includes(extension))
      return "audio";
    if (extension === ".vtt") return "text/vtt";
    if ([".htm", ".html"].includes(extension)) return "document";
    if (extension === ".csv") return "text/csv";
    if (extension === ".json") return "application/json";
    if (extension === ".pdf") return "application/pdf";
    if (extension === ".txt") return "text/plain";
    if (extension === ".xml") return "xml";
    if (extension === ".zip") return "archive";
    return "non-html";
  }

  $("link[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const rel = new Set(
      ($(element).attr("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean),
    );
    const as = ($(element).attr("as") ?? "").toLowerCase();
    if (rel.has("stylesheet")) {
      addAsset(href, "link[rel=stylesheet]", "style");
    } else if (
      rel.has("icon") ||
      rel.has("apple-touch-icon") ||
      rel.has("mask-icon")
    ) {
      addAsset(href, "link[rel=icon]", "image");
    } else if (rel.has("modulepreload")) {
      addAsset(href, "link[rel=modulepreload]", "script");
    } else if (rel.has("preload")) {
      const expectedType =
        {
          audio: "audio",
          font: "font",
          image: "image",
          script: "script",
          style: "style",
          video: "video",
        }[as] ?? declaredType(element);
      const url = rootRelativeAsset(href);
      addAsset(
        href,
        `link[as=${as || "unknown"}]`,
        expectedType || (url ? extensionExpectation(url) : "non-html"),
      );
    } else {
      const url = rootRelativeAsset(href);
      addAsset(
        href,
        "link[href]",
        declaredType(element) || (url ? extensionExpectation(url) : "non-html"),
      );
    }
  });

  for (const [selector, attribute, reference, expectedType] of [
    ["script[src]", "src", "script[src]", "script"],
    ["img[src]", "src", "img[src]", "image"],
    ["video[src]", "src", "video[src]", "video"],
    ["video[poster]", "poster", "video[poster]", "image"],
    ["audio[src]", "src", "audio[src]", "audio"],
    ["track[src]", "src", "track[src]", "text/vtt"],
    ["iframe[src]", "src", "iframe[src]", "document"],
  ]) {
    $(selector).each((_index, element) => {
      addAsset($(element).attr(attribute), reference, expectedType);
    });
  }

  $("source[src]").each((_index, element) => {
    const parent = $(element).parent().prop("tagName")?.toLowerCase();
    const expectedType =
      parent === "picture"
        ? "image"
        : parent === "audio"
          ? "audio"
          : parent === "video"
            ? "video"
            : declaredType(element) || "non-html";
    addAsset($(element).attr("src"), "source[src]", expectedType);
  });

  $("object[data]").each((_index, element) => {
    const value = $(element).attr("data");
    const url = rootRelativeAsset(value);
    addAsset(
      value,
      "object[data]",
      declaredType(element) || (url ? extensionExpectation(url) : "non-html"),
    );
  });

  $("a[download][href]").each((_index, element) => {
    const value = $(element).attr("href");
    const url = rootRelativeAsset(value);
    addAsset(
      value,
      "a[download]",
      declaredType(element) || (url ? extensionExpectation(url) : "non-html"),
    );
  });

  $("img[srcset], source[srcset]").each((_index, element) => {
    const reference = `${$(element).prop("tagName").toLowerCase()}[srcset]`;
    for (const candidate of ($(element).attr("srcset") ?? "").split(",")) {
      addAsset(candidate.trim().split(/\s+/, 1)[0], reference, "image");
    }
  });

  return [...assets.values()].sort(
    (left, right) =>
      left.url.localeCompare(right.url) ||
      left.reference.localeCompare(right.reference) ||
      left.expectedType.localeCompare(right.expectedType),
  );
}

const FOOTER_GROUPS = [
  "Publication",
  "Topics",
  "Standards & transparency",
  "Legal & feeds",
];

function finding(code, route, message) {
  return { code, route, message };
}

function normalizedText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedBodyText($) {
  const body = $("body").clone();
  body.find("*").each((_index, element) => {
    $(element).after(" ");
  });
  return normalizedText(body.text());
}

function hasLegacyHomepageShell($, route) {
  if (route !== "/") return false;

  const structuralText = [
    "main h1",
    "main h2",
    "main h3",
    "main h4",
    "main h5",
    "main h6",
    "main .eyebrow",
    "main .section-heading__eyebrow",
  ]
    .flatMap((selector) => $(selector).toArray())
    .map((element) => normalizedText($(element).text()).toLowerCase());

  return structuralText.some(
    (text) => text === "current issue" || text === "complete issue",
  );
}

const RESOURCE_URL_LOCATIONS = Object.freeze([
  ["link[href]", "href"],
  ["script[src]", "src"],
  ["img[src]", "src"],
  ["source[src]", "src"],
  ["video[src]", "src"],
  ["video[poster]", "poster"],
  ["audio[src]", "src"],
  ["track[src]", "src"],
  ["iframe[src]", "src"],
  ["embed[src]", "src"],
  ["object[data]", "data"],
  ['input[type="image"][src]', "src"],
  ["image[href]", "href"],
  ["use[href]", "href"],
  ["a[download][href]", "href"],
]);

const TRACKING_SIGNATURES = Object.freeze([
  {
    label: "Google advertising",
    pattern:
      /(?:pagead2\.googlesyndication\.com|securepubads\.g\.doubleclick\.net|adsbygoogle|ca-pub-\d{6,})/i,
  },
  {
    label: "Google Analytics or Tag Manager",
    pattern:
      /(?:google-analytics\.com|googletagmanager\.com|(?:^|[^\w])gtag\s*\(|\bdataLayer\s*(?:=|\.push\s*\())/i,
  },
  {
    label: "Meta Pixel",
    pattern:
      /(?:connect\.facebook\.net\/[^\s"']*fbevents\.js|(?:^|[^\w])fbq\s*\()/i,
  },
  {
    label: "Plausible Analytics",
    pattern: /(?:plausible\.io\/js\/script[^\s"']*\.js)/i,
  },
  {
    label: "Cloudflare Web Analytics",
    pattern:
      /(?:static\.cloudflareinsights\.com\/beacon(?:\.min)?\.js|__cfBeacon)/i,
  },
  {
    label: "Microsoft Clarity",
    pattern: /(?:clarity\.ms\/(?:tag|collect)|(?:^|[^\w])clarity\s*\()/i,
  },
  {
    label: "Hotjar",
    pattern: /(?:static\.hotjar\.com|_hjSettings)/i,
  },
  {
    label: "Segment",
    pattern: /(?:cdn\.segment\.com\/analytics\.js|analytics\.load\s*\()/i,
  },
  {
    label: "Matomo",
    pattern: /(?:matomo\.js|_paq\.push\s*\()/i,
  },
  {
    label: "Mixpanel",
    pattern: /(?:cdn\.mxpnl\.com|mixpanel\.init\s*\()/i,
  },
  {
    label: "PostHog",
    pattern: /(?:(?:app|us\.i)\.posthog\.com|posthog\.init\s*\()/i,
  },
  {
    label: "Fathom Analytics",
    pattern: /(?:cdn\.usefathom\.com\/script\.js)/i,
  },
]);

function normalizedScriptType($, element) {
  return ($(element).attr("type") ?? "").split(";", 1)[0].trim().toLowerCase();
}

function isDisallowedScriptType(type) {
  return type !== "application/ld+json";
}

function srcsetCandidates(value) {
  const normalized = value.trim();
  if (!normalized) return [];
  if (normalized.toLowerCase().startsWith("data:")) {
    const payload = normalized.slice(normalized.indexOf(",") + 1);
    const hasAdditionalCandidate =
      /\s+\d+(?:\.\d+)?[wx]\s*,\s*\S/i.test(payload) ||
      /,\s+(?=\S)/.test(payload) ||
      /,\s*(?=(?:https?:)?\/\/)/i.test(payload);
    return [{ forceUnsafe: hasAdditionalCandidate, value: normalized }];
  }
  return normalized
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
    .filter(Boolean)
    .map((candidate) => ({ forceUnsafe: false, value: candidate }));
}

function cssResourceUrls(value) {
  const css = value.replace(/\/\*[\s\S]*?\*\//g, "");
  const urls = [];

  for (const match of css.matchAll(
    /url\(\s*(?:(['"])(.*?)\1|([^)]*?))\s*\)/gis,
  )) {
    const candidate = (match[2] ?? match[3] ?? "").trim();
    if (candidate) urls.push(candidate);
  }

  for (const match of css.matchAll(/@import\s+(['"])(.*?)\1/gis)) {
    const candidate = (match[2] ?? "").trim();
    if (candidate) urls.push(candidate);
  }

  return urls;
}

function collectResourceUrlAttributes($) {
  const entries = new Map();

  function add(element, attribute, value, forceUnsafe = false) {
    const normalized = value?.trim();
    if (!normalized) return;
    const tag = $(element).prop("tagName")?.toLowerCase() ?? "element";
    const key = `${tag}\0${attribute}\0${normalized}\0${forceUnsafe}`;
    entries.set(key, {
      attribute,
      forceUnsafe,
      tag,
      value: normalized,
    });
  }

  for (const [selector, attribute] of RESOURCE_URL_LOCATIONS) {
    $(selector).each((_index, element) => {
      add(element, attribute, $(element).attr(attribute));
    });
  }

  $("img[srcset], source[srcset]").each((_index, element) => {
    for (const { forceUnsafe, value } of srcsetCandidates(
      $(element).attr("srcset") ?? "",
    )) {
      add(element, "srcset", value, forceUnsafe);
    }
  });

  $("style").each((_index, element) => {
    for (const value of cssResourceUrls($(element).html() ?? "")) {
      add(element, "text", value);
    }
  });

  $("[style]").each((_index, element) => {
    for (const value of cssResourceUrls($(element).attr("style") ?? "")) {
      add(element, "style", value);
    }
  });

  return [...entries.values()];
}

function isExternalOrUnsafeResourceUrl(value, expectedOrigin, route) {
  if (value.startsWith("#")) return false;

  let url;
  try {
    const base = new URL(route, `${expectedOrigin}/`);
    url = new URL(value, base);
  } catch {
    return true;
  }

  if (url.protocol === "data:") return false;
  if (url.protocol === "blob:") return url.origin !== expectedOrigin;
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  return url.origin !== expectedOrigin;
}

function inspectPrivacyBoundary($, { html, origin, route }) {
  const issues = [];
  const signatureInputs = [];
  const executableContexts = [];
  const resourceEntries = collectResourceUrlAttributes($);
  const adsenseAccountMeta = $("meta[name]").filter((_index, element) => {
    return (
      ($(element).attr("name") ?? "").trim().toLowerCase() ===
      "google-adsense-account"
    );
  });
  if (adsenseAccountMeta.length > 0) {
    issues.push(
      finding(
        "adsense-account-meta",
        route,
        "google-adsense-account metadata must remain absent while monetization is disabled.",
      ),
    );
  }

  const adIntegrationMarkers = $("*").filter((_index, element) =>
    Object.keys(element.attribs ?? {}).some((name) => /^data-ad-/i.test(name)),
  );
  if (adIntegrationMarkers.length > 0) {
    issues.push(
      finding(
        "ad-integration-marker",
        route,
        "data-ad-* integration markers must remain absent while monetization is disabled.",
      ),
    );
  }

  if ($("iframe, frame, embed, object").length > 0 || /<frame\b/i.test(html)) {
    issues.push(
      finding(
        "embedded-content",
        route,
        "iframe, frame, embed, and object elements are unsupported by the publication CSP and privacy contract.",
      ),
    );
  }
  if ($("form").length > 0) {
    issues.push(
      finding(
        "form",
        route,
        "form elements must remain absent while the publication states that it collects no form submissions.",
      ),
    );
  }
  if ($("base[href]").length > 0) {
    issues.push(
      finding(
        "base-url",
        route,
        "base URL elements are not allowed because they can rebase publication resources.",
      ),
    );
  }
  const refreshMeta = $("meta[http-equiv]").filter((_index, element) => {
    return (
      ($(element).attr("http-equiv") ?? "").trim().toLowerCase() === "refresh"
    );
  });
  if (refreshMeta.length > 0) {
    issues.push(
      finding("meta-refresh", route, "meta refresh navigation is not allowed."),
    );
  }
  if ($("a[ping], area[ping]").length > 0) {
    issues.push(
      finding(
        "ping-attribute",
        route,
        "anchor and area ping attributes are not allowed.",
      ),
    );
  }
  if ($("[attributionsrc]").length > 0) {
    issues.push(
      finding(
        "attribution-source",
        route,
        "attributionsrc measurement requests are not allowed.",
      ),
    );
  }

  $("script").each((_index, element) => {
    const type = normalizedScriptType($, element);
    if (!isDisallowedScriptType(type)) return;

    executableContexts.push(
      type ? `script[type=${type}]` : "script without a type",
    );
    signatureInputs.push($(element).attr("src") ?? "", $(element).html() ?? "");
  });

  $("*").each((_index, element) => {
    for (const [name, value] of Object.entries(element.attribs ?? {})) {
      if (/^on[a-z]+$/i.test(name) || /^\s*javascript:/i.test(value)) {
        executableContexts.push(
          `${$(element).prop("tagName").toLowerCase()}[${name}]`,
        );
        signatureInputs.push(value);
      }
      if (/^(?:class|id|data-ad-.+|data-analytics-id)$/i.test(name)) {
        signatureInputs.push(`${name}=${value}`);
      }
    }
  });

  signatureInputs.push(...resourceEntries.map(({ value }) => value));

  if (executableContexts.length > 0) {
    issues.push(
      finding(
        "executable-script",
        route,
        `executable client-side code is not allowed; found ${[
          ...new Set(executableContexts),
        ].join(", ")}. Only inert JSON-LD script data is expected.`,
      ),
    );
  }

  const externalResources = resourceEntries.filter(
    ({ forceUnsafe, value }) =>
      forceUnsafe || isExternalOrUnsafeResourceUrl(value, origin, route),
  );
  if (externalResources.length > 0) {
    issues.push(
      finding(
        "external-resource-url",
        route,
        `resource URL attributes must stay same-origin; found ${externalResources
          .map(({ attribute, tag, value }) => `${tag}[${attribute}]=${value}`)
          .join(", ")}.`,
      ),
    );
  }

  const signatureMatches = TRACKING_SIGNATURES.filter(({ pattern }) =>
    signatureInputs.some((value) => pattern.test(value)),
  ).map(({ label }) => label);
  if (signatureMatches.length > 0) {
    issues.push(
      finding(
        "tracking-signature",
        route,
        `advertising, analytics, or tracking signature detected: ${signatureMatches.join(", ")}.`,
      ),
    );
  }

  return issues;
}

export function expectedSocialImagePath(route) {
  if (typeof route !== "string") return "/social/default.png";
  const categorySlug = /^\/categories\/([^/]+)\/$/.exec(route)?.[1];
  if (categorySlug) return `/social/category-${categorySlug}.png`;
  const articleSlug = /^\/articles\/([^/]+)\/$/.exec(route)?.[1];
  if (articleSlug) return `/social/article-${articleSlug}.png`;
  return "/social/default.png";
}

export function inspectHtml(
  html,
  { origin, route = "[HTML page]", canonicalPath = route } = {},
) {
  const expectedOrigin = normalizeOrigin(origin);
  const expectedCanonical = new URL(canonicalPath, `${expectedOrigin}/`);
  const $ = load(html);
  const issues = [];
  issues.push(
    ...inspectPrivacyBoundary($, {
      html,
      origin: expectedOrigin,
      route,
    }),
  );

  const masthead = $(`header a[aria-label="Everyday Tech Insight home"]`);
  if (masthead.length !== 1) {
    issues.push(
      finding(
        "masthead",
        route,
        `expected one masthead link named "Everyday Tech Insight home"; found ${masthead.length}.`,
      ),
    );
  }

  const footerHeadingCounts = new Map(
    FOOTER_GROUPS.map((signature) => [signature, 0]),
  );
  $("footer h1, footer h2, footer h3, footer h4, footer h5, footer h6").each(
    (_index, element) => {
      const text = normalizedText($(element).text());
      if (footerHeadingCounts.has(text)) {
        footerHeadingCounts.set(text, footerHeadingCounts.get(text) + 1);
      }
    },
  );
  const invalidFooterGroups = [...footerHeadingCounts]
    .filter(([, count]) => count !== 1)
    .map(([signature, count]) => `${signature} (${count})`);
  if (invalidFooterGroups.length > 0) {
    issues.push(
      finding(
        "footer-groups",
        route,
        `footer group signatures must appear once: ${invalidFooterGroups.join(", ")}.`,
      ),
    );
  }

  const h1Count = $("h1").length;
  if (h1Count !== 1) {
    issues.push(
      finding("h1-count", route, `expected one H1; found ${h1Count}.`),
    );
  }

  const titleElements = $("head > title");
  const title = normalizedText(titleElements.text());
  if (titleElements.length !== 1 || title.length === 0) {
    issues.push(
      finding("title", route, "expected one nonempty document title."),
    );
  }

  const descriptionElements = $('meta[name="description"]');
  const description = descriptionElements.attr("content")?.trim() ?? "";
  if (descriptionElements.length !== 1 || description.length === 0) {
    issues.push(
      finding("description", route, "expected one nonempty meta description."),
    );
  }

  const canonicalElements = $('link[rel="canonical"]');
  const canonical = canonicalElements.attr("href")?.trim() ?? "";
  let canonicalMatches = canonicalElements.length === 1;
  if (canonicalMatches) {
    try {
      const canonicalUrl = new URL(canonical);
      canonicalMatches =
        (canonicalUrl.protocol === "http:" ||
          canonicalUrl.protocol === "https:") &&
        !canonicalUrl.username &&
        !canonicalUrl.password &&
        canonicalUrl.origin === expectedOrigin &&
        canonicalUrl.pathname === expectedCanonical.pathname &&
        canonicalUrl.search === expectedCanonical.search &&
        canonicalUrl.hash === "";
    } catch {
      canonicalMatches = false;
    }
  }
  if (!canonicalMatches) {
    issues.push(
      finding(
        "canonical-origin",
        route,
        `expected one canonical URL matching ${expectedCanonical.href}.`,
      ),
    );
  }

  function requireMeta(selector, expected, code, label) {
    const nodes = $(selector);
    const actual = nodes.attr("content")?.trim() ?? "";
    if (nodes.length !== 1 || actual !== expected) {
      issues.push(
        finding(
          code,
          route,
          `${label} must appear once and equal ${expected}.`,
        ),
      );
    }
  }

  const expectedRobots =
    expectedCanonical.pathname === "/404.html"
      ? "noindex,follow"
      : "index,follow";
  const expectedOpenGraphType = /^\/articles\/[^/]+\/$/.test(route)
    ? "article"
    : "website";
  requireMeta('meta[name="robots"]', expectedRobots, "robots", "robots");
  requireMeta(
    'meta[property="og:type"]',
    expectedOpenGraphType,
    "og-type",
    "og:type",
  );
  requireMeta('meta[property="og:title"]', title, "og-title", "og:title");
  requireMeta(
    'meta[property="og:description"]',
    description,
    "og-description",
    "og:description",
  );
  requireMeta(
    'meta[property="og:url"]',
    expectedCanonical.href,
    "og-url",
    "og:url",
  );
  requireMeta(
    'meta[name="twitter:title"]',
    title,
    "twitter-title",
    "twitter:title",
  );
  requireMeta(
    'meta[name="twitter:description"]',
    description,
    "twitter-description",
    "twitter:description",
  );

  const socialImageNodes = $('meta[property="og:image"]');
  const socialImage = socialImageNodes.attr("content")?.trim() ?? "";
  const expectedSocialPath = expectedSocialImagePath(route);
  let socialImagePath;
  let validSocialImage = socialImageNodes.length === 1;
  if (validSocialImage) {
    try {
      const socialImageUrl = new URL(socialImage);
      validSocialImage =
        socialImageUrl.origin === expectedOrigin &&
        socialImageUrl.pathname === expectedSocialPath &&
        !socialImageUrl.search &&
        !socialImageUrl.hash;
      if (validSocialImage) socialImagePath = socialImageUrl.pathname;
    } catch {
      validSocialImage = false;
    }
  }
  if (!validSocialImage) {
    issues.push(
      finding(
        "social-image",
        route,
        `expected one absolute social image at ${expectedOrigin}${expectedSocialPath}.`,
      ),
    );
  }

  for (const [property, expected, code] of [
    ["og:image:width", "1200", "social-image-width"],
    ["og:image:height", "630", "social-image-height"],
    ["og:image:type", "image/png", "social-image-type"],
  ]) {
    const nodes = $(`meta[property="${property}"]`);
    if (nodes.length !== 1 || nodes.attr("content") !== expected) {
      issues.push(finding(code, route, `${property} must be ${expected}.`));
    }
  }

  const socialAltNodes = $('meta[property="og:image:alt"]');
  const socialAlt = socialAltNodes.attr("content")?.trim() ?? "";
  if (socialAltNodes.length !== 1 || !socialAlt) {
    issues.push(
      finding(
        "social-image-alt",
        route,
        "expected one nonempty Open Graph image alt value.",
      ),
    );
  }

  const twitterCard = $('meta[name="twitter:card"]');
  if (
    twitterCard.length !== 1 ||
    twitterCard.attr("content") !== "summary_large_image"
  ) {
    issues.push(
      finding(
        "twitter-card",
        route,
        "twitter:card must be summary_large_image.",
      ),
    );
  }
  const twitterImage = $('meta[name="twitter:image"]');
  if (
    twitterImage.length !== 1 ||
    twitterImage.attr("content") !== socialImage
  ) {
    issues.push(
      finding("twitter-image", route, "twitter:image must match og:image."),
    );
  }
  const twitterAlt = $('meta[name="twitter:image:alt"]');
  if (
    twitterAlt.length !== 1 ||
    !socialAlt ||
    twitterAlt.attr("content") !== socialAlt
  ) {
    issues.push(
      finding(
        "twitter-image-alt",
        route,
        "twitter:image:alt must match the nonempty Open Graph image alt.",
      ),
    );
  }

  const bodyText = normalizedBodyText($);
  if (hasLegacyHomepageShell($, route)) {
    issues.push(
      finding(
        "legacy-shell",
        route,
        'legacy "Current issue" or "Complete issue" shell text remains.',
      ),
    );
  }

  const fitSummaryCount = $(".fit-summary").length;
  if (fitSummaryCount > 1) {
    issues.push(
      finding(
        "duplicate-fit-summary",
        route,
        `expected at most one .fit-summary; found ${fitSummaryCount}.`,
      ),
    );
  }

  const atAGlanceCount = (bodyText.match(/\bAt\s+a\s+glance\b/gi) ?? []).length;
  if (atAGlanceCount > 1) {
    issues.push(
      finding(
        "duplicate-at-a-glance",
        route,
        `expected at most one "At a glance" signature; found ${atAGlanceCount}.`,
      ),
    );
  }

  const tocStructures = $('nav[aria-label="On this page"]').toArray();
  $("details").each((_index, element) => {
    const summary = $(element).children("summary").first();
    if (normalizedText(summary.text()).toLowerCase() === "on this page") {
      tocStructures.push(element);
    }
  });
  const tocLinkCounts = new Map();
  for (const structure of tocStructures) {
    $(structure)
      .find('a[href^="#"]')
      .each((_index, element) => {
        const href = $(element).attr("href");
        tocLinkCounts.set(href, (tocLinkCounts.get(href) ?? 0) + 1);
      });
  }
  const duplicateTocLinks = [...tocLinkCounts]
    .filter(([, count]) => count > 1)
    .map(([href]) => href);
  if (tocStructures.length > 1 || duplicateTocLinks.length > 0) {
    issues.push(
      finding(
        "duplicate-toc",
        route,
        `expected at most one "On this page" content structure; found ${tocStructures.length}${
          duplicateTocLinks.length > 0
            ? ` with repeated heading links ${duplicateTocLinks.join(", ")}`
            : ""
        }.`,
      ),
    );
  }

  const idCounts = new Map();
  $("[id]").each((_index, element) => {
    const id = $(element).attr("id") ?? "";
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  });
  const duplicateIds = [...idCounts]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort((left, right) => left.localeCompare(right));
  if (duplicateIds.length > 0) {
    issues.push(
      finding(
        "duplicate-id",
        route,
        `duplicate IDs: ${duplicateIds.map((id) => `#${id}`).join(", ")}.`,
      ),
    );
  }

  const assets = collectInternalAssets(html);
  if (socialImagePath) {
    assets.push({
      expectedType: "image/png",
      reference: "meta[property=og:image]",
      url: socialImagePath,
    });
    assets.sort(
      (left, right) =>
        left.url.localeCompare(right.url) ||
        left.reference.localeCompare(right.reference) ||
        left.expectedType.localeCompare(right.expectedType),
    );
  }

  return {
    assets,
    canonical,
    description,
    issues,
    title,
  };
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

function requestOptions() {
  return {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  };
}

function responseMediaType(response) {
  return (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

function expectedRouteMediaTypes(route) {
  if (route.kind === "html") return ["text/html", "application/xhtml+xml"];
  if (route.path === "/rss.xml") {
    return ["application/rss+xml", "application/xml", "text/xml"];
  }
  if (route.path === "/sitemap-index.xml" || route.path === "/sitemap-0.xml") {
    return ["application/xml", "text/xml"];
  }
  if (route.path === "/robots.txt") return ["text/plain"];
  return [];
}

function isWellFormedXml(xml) {
  if (!xml.trim()) return false;
  try {
    new SaxesParser().write(xml).close();
    return true;
  } catch {
    return false;
  }
}

function sameSet(left, right) {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function hasSingleXmlRoot($, rootName) {
  const roots = $.root().children();
  return roots.length === 1 && roots.filter(rootName).length === 1;
}

function checkedAbsoluteUrl(raw, origin) {
  try {
    const url = new URL(raw);
    const valid =
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      url.origin === origin &&
      !url.search &&
      !url.hash;
    return { href: url.href, valid };
  } catch {
    return { href: raw, valid: false };
  }
}

function inspectRobots(body, { origin, route }) {
  const expectedSitemap = `Sitemap: ${
    new URL("/sitemap-index.xml", `${origin}/`).href
  }`;
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const sitemapLines = lines.filter((line) => /^sitemap:/i.test(line));
  const valid =
    lines.filter((line) => line === "User-agent: *").length === 1 &&
    lines.filter((line) => line === "Allow: /").length === 1 &&
    sitemapLines.length === 1 &&
    sitemapLines[0] === expectedSitemap &&
    !lines.some((line) => /^Disallow:\s*\S+/i.test(line));

  return valid
    ? []
    : [
        finding(
          "robots-body",
          route,
          `robots.txt must contain one User-agent: *, one Allow: /, exactly ${expectedSitemap}, and no nonempty Disallow rule.`,
        ),
      ];
}

function inspectSitemapIndex(xml, { origin, route }) {
  const issues = [];
  if (!isWellFormedXml(xml)) {
    issues.push(
      finding(
        "sitemap-xml",
        route,
        "sitemap index must be nonempty well-formed XML.",
      ),
    );
  }
  const $ = load(xml, { xmlMode: true });
  const entries = $("sitemapindex > sitemap");
  const locations = $("sitemapindex > sitemap > loc");
  const validStructure =
    hasSingleXmlRoot($, "sitemapindex") &&
    $("sitemapindex").first().attr("xmlns") ===
      "http://www.sitemaps.org/schemas/sitemap/0.9" &&
    entries.length === 1 &&
    entries.length === $("sitemap").length &&
    locations.length === 1 &&
    locations.length === $("loc").length &&
    entries.first().children("loc").length === 1;
  if (!validStructure) {
    issues.push(
      finding(
        "sitemap-structure",
        route,
        "sitemap index must contain one sitemapindex root and one direct sitemap location.",
      ),
    );
  }

  const expected = new URL("/sitemap-0.xml", `${origin}/`).href;
  const rawLocations = locations
    .map((_index, element) => $(element).text().trim())
    .get();
  const checkedLocations = rawLocations.map((raw) =>
    checkedAbsoluteUrl(raw, origin),
  );
  if (checkedLocations.some(({ valid }) => !valid)) {
    issues.push(
      finding(
        "sitemap-url",
        route,
        "sitemap index locations must be absolute URLs on the checked origin without query strings or fragments.",
      ),
    );
  }
  if (checkedLocations.length !== 1 || checkedLocations[0]?.href !== expected) {
    issues.push(
      finding(
        "sitemap-index",
        route,
        `sitemap index must reference exactly ${expected}.`,
      ),
    );
  }
  return issues;
}

function inspectSitemap(xml, { origin, route }) {
  const issues = [];
  if (!isWellFormedXml(xml)) {
    issues.push(
      finding(
        "sitemap-xml",
        route,
        "sitemap must be nonempty well-formed XML.",
      ),
    );
  }
  const $ = load(xml, { xmlMode: true });
  const entries = $("urlset > url");
  const locations = $("urlset > url > loc");
  const validStructure =
    hasSingleXmlRoot($, "urlset") &&
    $("urlset").first().attr("xmlns") ===
      "http://www.sitemaps.org/schemas/sitemap/0.9" &&
    entries.length > 0 &&
    entries.length === $("url").length &&
    locations.length === entries.length &&
    locations.length === $("loc").length &&
    entries.toArray().every((entry) => $(entry).children("loc").length === 1);
  if (!validStructure) {
    issues.push(
      finding(
        "sitemap-structure",
        route,
        "sitemap must contain one urlset root and one direct location per URL entry.",
      ),
    );
  }

  const rawLocations = locations
    .map((_index, element) => $(element).text().trim())
    .get();
  const checkedLocations = rawLocations.map((raw) =>
    checkedAbsoluteUrl(raw, origin),
  );
  if (checkedLocations.some(({ valid }) => !valid)) {
    issues.push(
      finding(
        "sitemap-url",
        route,
        "sitemap locations must be absolute URLs on the checked origin without query strings or fragments.",
      ),
    );
  }
  const actual = new Set(
    checkedLocations.filter(({ valid }) => valid).map(({ href }) => href),
  );
  const expected = new Set(
    PRODUCTION_ROUTES.filter(
      ({ expectedStatus, kind }) => kind === "html" && expectedStatus === 200,
    ).map(({ path: expectedPath }) => new URL(expectedPath, `${origin}/`).href),
  );
  if (checkedLocations.length !== expected.size || !sameSet(actual, expected)) {
    issues.push(
      finding(
        "sitemap-membership",
        route,
        "sitemap locations must exactly match every indexable production HTML route.",
      ),
    );
  }
  return issues;
}

function inspectRss(xml, { origin, route }) {
  const issues = [];
  if (!isWellFormedXml(xml)) {
    issues.push(
      finding("feed-xml", route, "RSS feed must be nonempty well-formed XML."),
    );
  }
  const $ = load(xml, { xmlMode: true });
  const channels = $("rss > channel");
  const items = $("rss > channel > item");
  const validStructure =
    hasSingleXmlRoot($, "rss") &&
    $("rss").first().attr("version") === "2.0" &&
    channels.length === 1 &&
    channels.length === $("channel").length &&
    items.length === $("item").length &&
    channels.first().children("title").length === 1 &&
    channels.first().children("title").first().text().trim().length > 0 &&
    channels.first().children("link").length === 1 &&
    channels.first().children("description").length === 1 &&
    channels.first().children("description").first().text().trim().length > 0 &&
    items.toArray().every((item) => {
      const itemElement = $(item);
      const titleNodes = itemElement.children("title");
      const descriptionNodes = itemElement.children("description");
      const titleCount = titleNodes.length;
      const descriptionCount = descriptionNodes.length;
      return (
        itemElement.children("link").length === 1 &&
        itemElement.children("guid").length === 1 &&
        titleCount <= 1 &&
        descriptionCount <= 1 &&
        (titleNodes.first().text().trim().length > 0 ||
          descriptionNodes.first().text().trim().length > 0)
      );
    });
  if (!validStructure) {
    issues.push(
      finding(
        "feed-structure",
        route,
        "RSS 2.0 must contain one channel with title, link, and description, plus one direct link and guid and at least a title or description per direct item.",
      ),
    );
  }

  const channelRaw = channels.first().children("link").first().text().trim();
  const channelUrl = checkedAbsoluteUrl(channelRaw, origin);
  const expectedChannel = new URL("/", `${origin}/`).href;
  if (!channelUrl.valid || channelUrl.href !== expectedChannel) {
    issues.push(
      finding(
        "feed-channel",
        route,
        `RSS channel link must be exactly ${expectedChannel}.`,
      ),
    );
  }

  const actualLinks = [];
  const seenLinks = new Set();
  let invalidItemUrl = false;
  items.each((_index, element) => {
    const item = $(element);
    const linkNodes = item.children("link");
    const guidNodes = item.children("guid");
    const link = checkedAbsoluteUrl(linkNodes.first().text().trim(), origin);
    const guid = checkedAbsoluteUrl(guidNodes.first().text().trim(), origin);
    if (
      linkNodes.length !== 1 ||
      guidNodes.length !== 1 ||
      !link.valid ||
      !guid.valid ||
      link.href !== guid.href ||
      seenLinks.has(link.href)
    ) {
      invalidItemUrl = true;
    }
    if (link.valid) {
      actualLinks.push(link.href);
      seenLinks.add(link.href);
    }
  });
  if (invalidItemUrl) {
    issues.push(
      finding(
        "feed-item-url",
        route,
        "every RSS item must have one unique same-origin link and an exactly matching guid.",
      ),
    );
  }
  if (
    items.toArray().some((item) => {
      const link = checkedAbsoluteUrl(
        $(item).children("link").first().text().trim(),
        origin,
      );
      const guid = checkedAbsoluteUrl(
        $(item).children("guid").first().text().trim(),
        origin,
      );
      return !link.valid || !guid.valid;
    })
  ) {
    issues.push(
      finding(
        "feed-url",
        route,
        "RSS links and guids must be absolute URLs on the checked origin without query strings or fragments.",
      ),
    );
  }

  const expectedLinks = new Set(
    PUBLISHED_ARTICLE_PATHS.map(
      (articlePath) => new URL(articlePath, `${origin}/`).href,
    ),
  );
  const actual = new Set(actualLinks);
  if (
    actualLinks.length !== expectedLinks.size ||
    !sameSet(actual, expectedLinks)
  ) {
    issues.push(
      finding(
        "feed-membership",
        route,
        "RSS item links must exactly match every published article route.",
      ),
    );
  }
  return issues;
}

function inspectTextRoute(body, { origin, route }) {
  if (route === "/robots.txt") return inspectRobots(body, { origin, route });
  if (route === "/sitemap-index.xml") {
    return inspectSitemapIndex(body, { origin, route });
  }
  if (route === "/sitemap-0.xml") {
    return inspectSitemap(body, { origin, route });
  }
  if (route === "/rss.xml") return inspectRss(body, { origin, route });
  return [];
}

function assetMediaTypeMatches(mediaType, expectedType) {
  if (!mediaType) return false;
  if (expectedType === "image") return mediaType.startsWith("image/");
  if (expectedType === "video") return mediaType.startsWith("video/");
  if (expectedType === "audio") return mediaType.startsWith("audio/");
  if (expectedType === "style") return mediaType === "text/css";
  if (expectedType === "script") {
    return [
      "application/ecmascript",
      "application/javascript",
      "application/x-javascript",
      "text/ecmascript",
      "text/javascript",
    ].includes(mediaType);
  }
  if (expectedType === "font") {
    return (
      mediaType.startsWith("font/") ||
      [
        "application/font-woff",
        "application/vnd.ms-fontobject",
        "application/x-font-opentype",
        "application/x-font-ttf",
      ].includes(mediaType)
    );
  }
  if (expectedType === "document") {
    return ["application/pdf", "application/xhtml+xml", "text/html"].includes(
      mediaType,
    );
  }
  if (expectedType === "xml") {
    return (
      mediaType === "application/xml" ||
      mediaType === "text/xml" ||
      mediaType.endsWith("+xml")
    );
  }
  if (expectedType === "archive") {
    return ["application/x-zip-compressed", "application/zip"].includes(
      mediaType,
    );
  }
  if (expectedType === "non-html") {
    return !["application/xhtml+xml", "text/html"].includes(mediaType);
  }
  return mediaType === expectedType;
}

const MAX_EXACT_PNG_BYTES = 8 * 1024 * 1024;
const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);

function exactPngExpectation(asset) {
  if (
    [...asset.references.values()].some(
      ({ expectedType, reference }) =>
        expectedType === "image/png" && reference === "meta[property=og:image]",
    )
  ) {
    return { height: 630, label: "social image", width: 1200 };
  }

  const pathname = new URL(asset.url, "https://internal.invalid").pathname;
  if (pathname === "/apple-touch-icon.png") {
    return { height: 180, label: "Apple touch icon", width: 180 };
  }
  return null;
}

async function readBoundedResponseBytes(response, maximumBytes) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const declaredBytes = Number(declaredLength);
    if (
      !Number.isSafeInteger(declaredBytes) ||
      declaredBytes < 0 ||
      declaredBytes > maximumBytes
    ) {
      throw new RangeError("response exceeds the byte limit");
    }
  }

  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RangeError("response exceeds the byte limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function hasExpectedPngHeader(bytes, { height, width }) {
  if (bytes.byteLength < 33) return false;
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return false;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return (
    view.getUint32(8) === 13 &&
    bytes[12] === 73 &&
    bytes[13] === 72 &&
    bytes[14] === 68 &&
    bytes[15] === 82 &&
    view.getUint32(16) === width &&
    view.getUint32(20) === height
  );
}

async function isDecodableExpectedPng(bytes, expectation) {
  if (!hasExpectedPngHeader(bytes, expectation)) return false;

  try {
    const options = {
      failOn: "error",
      limitInputPixels: expectation.width * expectation.height,
    };
    const metadata = await sharp(bytes, options).metadata();
    if (
      metadata.format !== "png" ||
      metadata.width !== expectation.width ||
      metadata.height !== expectation.height
    ) {
      return false;
    }

    const { info } = await sharp(bytes, options)
      .raw()
      .toBuffer({ resolveWithObject: true });
    return (
      info.width === expectation.width && info.height === expectation.height
    );
  } catch {
    return false;
  }
}

export async function runProductionCheck({
  origin,
  fetchImpl = fetch,
  routes = PRODUCTION_ROUTES,
} = {}) {
  const normalizedOrigin = normalizeOrigin(origin);
  const issues = [];
  const assets = new Map();
  const failedAssetOwners = new Set();
  const inspectedPages = [];

  for (const route of routes) {
    const url = new URL(route.path, `${normalizedOrigin}/`);
    let response;
    try {
      response = await fetchImpl(url, requestOptions());
    } catch (error) {
      issues.push(
        finding(
          "fetch-error",
          route.path,
          error instanceof Error ? error.message : String(error),
        ),
      );
      continue;
    }

    if (isRedirect(response.status)) {
      const location = response.headers.get("location") ?? "[no Location]";
      issues.push(
        finding(
          "unexpected-redirect",
          route.path,
          `received ${response.status} redirect to ${location}.`,
        ),
      );
    }
    if (response.status !== route.expectedStatus) {
      issues.push(
        finding(
          "status",
          route.path,
          `expected ${route.expectedStatus}; received ${response.status}.`,
        ),
      );
      continue;
    }
    if (route.kind === "absent") continue;

    const mediaType = responseMediaType(response);
    const expectedMediaTypes = expectedRouteMediaTypes(route);
    if (!expectedMediaTypes.includes(mediaType)) {
      issues.push(
        finding(
          "content-type",
          route.path,
          `expected ${expectedMediaTypes.join(" or ")}; received ${
            mediaType || "no Content-Type"
          }.`,
        ),
      );
      continue;
    }
    let body;
    try {
      body = await response.text();
    } catch (error) {
      issues.push(
        finding(
          "fetch-error",
          route.path,
          `could not read response body: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
      continue;
    }
    if (route.kind !== "html") {
      issues.push(
        ...inspectTextRoute(body, {
          origin: normalizedOrigin,
          route: route.path,
        }),
      );
      continue;
    }

    const inspection = inspectHtml(body, {
      canonicalPath: route.canonicalPath ?? route.path,
      origin: normalizedOrigin,
      route: route.path,
    });
    issues.push(...inspection.issues);
    inspectedPages.push({ route: route.path, ...inspection });
    for (const asset of inspection.assets) {
      let registeredAsset = assets.get(asset.url);
      if (!registeredAsset) {
        registeredAsset = {
          owners: new Set(),
          references: new Map(),
          url: asset.url,
        };
        assets.set(asset.url, registeredAsset);
      }
      registeredAsset.owners.add(route.path);
      registeredAsset.references.set(
        `${asset.reference}\0${asset.expectedType}`,
        asset,
      );
    }
  }

  for (const field of ["title", "description"]) {
    const owners = new Map();
    for (const page of inspectedPages) {
      const value = page[field].trim();
      if (!value) continue;
      const key = value.toLocaleLowerCase("en-US");
      if (owners.has(key)) {
        issues.push(
          finding(
            `duplicate-${field}`,
            page.route,
            `${field} duplicates ${owners.get(key)}.`,
          ),
        );
      } else {
        owners.set(key, page.route);
      }
    }
  }

  function addAssetFinding(asset, code, message) {
    issues.push(finding(code, asset.url, message));
    for (const owner of asset.owners) failedAssetOwners.add(owner);
  }

  for (const asset of [...assets.values()].sort((left, right) =>
    left.url.localeCompare(right.url),
  )) {
    let response;
    try {
      response = await fetchImpl(
        new URL(asset.url, `${normalizedOrigin}/`),
        requestOptions(),
      );
    } catch (error) {
      addAssetFinding(
        asset,
        "asset-fetch-error",
        error instanceof Error ? error.message : String(error),
      );
      continue;
    }
    if (isRedirect(response.status)) {
      addAssetFinding(
        asset,
        "unexpected-redirect",
        `asset returned redirect status ${response.status}.`,
      );
    }
    if (!response.ok) {
      addAssetFinding(
        asset,
        "asset-status",
        `expected a successful response; received ${response.status}.`,
      );
      continue;
    }

    const mediaType = responseMediaType(response);
    const invalidReferences = [...asset.references.values()].filter(
      ({ expectedType }) => !assetMediaTypeMatches(mediaType, expectedType),
    );
    if (invalidReferences.length > 0) {
      addAssetFinding(
        asset,
        "asset-content-type",
        `received ${mediaType || "no Content-Type"}; ${invalidReferences
          .map(
            ({ expectedType, reference }) =>
              `${reference} expects ${expectedType}`,
          )
          .join(", ")}.`,
      );
    }

    const pngExpectation = exactPngExpectation(asset);
    if (pngExpectation && mediaType === "image/png") {
      let validPng;
      try {
        const bytes = await readBoundedResponseBytes(
          response,
          MAX_EXACT_PNG_BYTES,
        );
        validPng = await isDecodableExpectedPng(bytes, pngExpectation);
      } catch {
        validPng = false;
      }
      if (!validPng) {
        addAssetFinding(
          asset,
          "asset-image-content",
          `${pngExpectation.label} must be a fully decodable ${pngExpectation.width}x${pngExpectation.height} PNG no larger than ${MAX_EXACT_PNG_BYTES / (1024 * 1024)} MiB.`,
        );
      }
    }
  }

  const routePaths = new Set(routes.map((route) => route.path));
  const failedRoutes = new Set(
    issues.map((issue) => issue.route).filter((route) => routePaths.has(route)),
  );
  for (const owner of failedAssetOwners) failedRoutes.add(owner);
  const routeResults = routes.map((route) => ({
    path: route.path,
    status: failedRoutes.has(route.path) ? "FAIL" : "PASS",
  }));

  return {
    checkedAssets: assets.size,
    checkedRoutes: routes.length,
    issues,
    routeResults,
  };
}

export function resolveProductionOrigin(args = [], env = process.env) {
  let cliOrigin;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--origin") {
      if (cliOrigin !== undefined) {
        throw new Error("--origin may be supplied only once.");
      }
      cliOrigin = args[index + 1];
      if (!cliOrigin || cliOrigin.startsWith("--")) {
        throw new Error("--origin requires an HTTPS origin value.");
      }
      index += 1;
    } else if (argument.startsWith("--origin=")) {
      if (cliOrigin !== undefined) {
        throw new Error("--origin may be supplied only once.");
      }
      cliOrigin = argument.slice("--origin=".length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const value = cliOrigin ?? env.PRODUCTION_ORIGIN;
  if (!value) {
    throw new Error(
      "Provide --origin https://host.example or set PRODUCTION_ORIGIN.",
    );
  }
  return normalizeOrigin(value);
}

export function formatProductionReport(origin, result) {
  const lines = result.routeResults.map(
    ({ path: route, status }) => `${status} ${route}`,
  );
  if (result.issues.length === 0) {
    lines.push(
      `Production smoke: PASS (${result.checkedRoutes} routes, ${result.checkedAssets} root-relative assets at ${origin})`,
    );
    return lines.join("\n");
  }

  lines.push(
    `Production smoke: FAIL (${result.issues.length} finding${
      result.issues.length === 1 ? "" : "s"
    })`,
  );
  for (const issue of result.issues) {
    lines.push(`- [${issue.code}] ${issue.route}: ${issue.message}`);
  }
  return lines.join("\n");
}

function printResult(origin, result) {
  const output = formatProductionReport(origin, result);
  if (result.issues.length === 0) console.log(output);
  else console.error(output);
}

async function main() {
  const origin = resolveProductionOrigin(process.argv.slice(2), process.env);
  const result = await runProductionCheck({ origin });
  printResult(origin, result);
  if (result.issues.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `Production smoke: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

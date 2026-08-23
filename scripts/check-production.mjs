import { load } from "cheerio";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_ROUTES = Object.freeze([
  { path: "/", expectedStatus: 200, kind: "html" },
  { path: "/categories/", expectedStatus: 200, kind: "html" },
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
  {
    path: "/articles/how-to-identify-business-tasks-for-automation/",
    expectedStatus: 200,
    kind: "html",
  },
  {
    path: "/articles/evaluate-saas-with-a-practical-checklist/",
    expectedStatus: 200,
    kind: "html",
  },
  {
    path: "/articles/back-up-business-files-with-the-3-2-1-method/",
    expectedStatus: 200,
    kind: "html",
  },
  {
    path: "/articles/create-a-shared-file-and-folder-system/",
    expectedStatus: 200,
    kind: "html",
  },
  {
    path: "/articles/calculate-the-total-cost-of-business-software/",
    expectedStatus: 200,
    kind: "html",
  },
  { path: "/toolkit/", expectedStatus: 200, kind: "html" },
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
  { path: "/rss.xml", expectedStatus: 200, kind: "text" },
  { path: "/robots.txt", expectedStatus: 200, kind: "text" },
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
    throw new Error("Production origin must be an absolute HTTP(S) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Production origin must use HTTP or HTTPS.");
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
  const assets = new Set();
  const attributes = [
    ["link[href]", "href"],
    ["script[src]", "src"],
    ["img[src]", "src"],
    ["source[src]", "src"],
    ["video[src]", "src"],
    ["video[poster]", "poster"],
    ["audio[src]", "src"],
    ["track[src]", "src"],
    ["iframe[src]", "src"],
    ["object[data]", "data"],
    ["a[download][href]", "href"],
  ];

  for (const [selector, attribute] of attributes) {
    $(selector).each((_index, element) => {
      const asset = rootRelativeAsset($(element).attr(attribute));
      if (asset) assets.add(asset);
    });
  }

  $("img[srcset], source[srcset]").each((_index, element) => {
    for (const candidate of ($(element).attr("srcset") ?? "").split(",")) {
      const asset = rootRelativeAsset(candidate.trim().split(/\s+/, 1)[0]);
      if (asset) assets.add(asset);
    }
  });

  return [...assets].sort((left, right) => left.localeCompare(right));
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

export function inspectHtml(
  html,
  { origin, route = "[HTML page]", canonicalPath = route } = {},
) {
  const expectedOrigin = normalizeOrigin(origin);
  const expectedCanonical = new URL(canonicalPath, `${expectedOrigin}/`);
  const $ = load(html);
  const issues = [];

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

  return {
    assets: collectInternalAssets(html),
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
  if (route.path === "/robots.txt") return ["text/plain"];
  return [];
}

export async function runProductionCheck({
  origin,
  fetchImpl = fetch,
  routes = PRODUCTION_ROUTES,
} = {}) {
  const normalizedOrigin = normalizeOrigin(origin);
  const issues = [];
  const assets = new Set();
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
    if (route.kind !== "html") continue;

    let html;
    try {
      html = await response.text();
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
    const inspection = inspectHtml(html, {
      canonicalPath: route.canonicalPath ?? route.path,
      origin: normalizedOrigin,
      route: route.path,
    });
    issues.push(...inspection.issues);
    inspectedPages.push({ route: route.path, ...inspection });
    for (const asset of inspection.assets) assets.add(asset);
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

  for (const asset of [...assets].sort((left, right) =>
    left.localeCompare(right),
  )) {
    let response;
    try {
      response = await fetchImpl(
        new URL(asset, `${normalizedOrigin}/`),
        requestOptions(),
      );
    } catch (error) {
      issues.push(
        finding(
          "asset-fetch-error",
          asset,
          error instanceof Error ? error.message : String(error),
        ),
      );
      continue;
    }
    if (isRedirect(response.status)) {
      issues.push(
        finding(
          "unexpected-redirect",
          asset,
          `asset returned redirect status ${response.status}.`,
        ),
      );
    }
    if (!response.ok) {
      issues.push(
        finding(
          "asset-status",
          asset,
          `expected a successful response; received ${response.status}.`,
        ),
      );
    } else if (
      ["text/html", "application/xhtml+xml"].includes(
        responseMediaType(response),
      )
    ) {
      issues.push(
        finding(
          "asset-content-type",
          asset,
          `expected a non-HTML asset response; received ${responseMediaType(
            response,
          )}.`,
        ),
      );
    }
  }

  const routePaths = new Set(routes.map((route) => route.path));
  const failedRoutes = new Set(
    issues.map((issue) => issue.route).filter((route) => routePaths.has(route)),
  );
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
        throw new Error("--origin requires an HTTP(S) origin value.");
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

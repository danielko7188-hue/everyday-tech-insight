import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { load as loadYaml } from "js-yaml";

import { siteConfig, siteOrigin } from "../site.config.mjs";

export const REQUIRED_CATEGORY_SLUGS = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
];

const CONTENT_TYPES = new Set([
  "guide",
  "checklist",
  "framework",
  "comparison",
]);
const PLACEHOLDER_PATTERN =
  /\b(?:todo|tbd|changeme|lorem ipsum|replace[-_ ]?me|your[-_ ]?(?:name|email|id))\b/i;
const TRACKING_PATTERN =
  /(?:googlesyndication|doubleclick|google-analytics|googletagmanager|adsbygoogle|(?:ca-)?pub-\d{10,}|\bUA-\d{4,}-\d+\b|\bG-[A-Z0-9]{6,}\b|\bGTM-[A-Z0-9]{4,}\b)/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRIMARY_VENDOR_HOSTS = [
  "apple.com",
  "atlassian.com",
  "aws.amazon.com",
  "google.com",
  "microsoft.com",
  "salesforce.com",
];

function finding(code, file, message) {
  return { code, file, message };
}

function textLength(value) {
  return typeof value === "string" ? value.trim().length : 0;
}

function isRealDate(value) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function todayInPublicationTimeZone(
  now = new Date(),
  timeZone = siteConfig.timeZone,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function isApprovedPrimaryHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === "gov" || host.endsWith(".gov")) return true;
  return PRIMARY_VENDOR_HOSTS.some(
    (approved) => host === approved || host.endsWith(`.${approved}`),
  );
}

export function parseArticleMarkdown(raw, fileName) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`${fileName} has no valid YAML frontmatter block.`);
  }

  const data = loadYaml(match[1]);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${fileName} frontmatter must be a YAML object.`);
  }

  return { fileName, data, body: match[2] };
}

export async function readArticleRecords(
  articlesDirectory = path.join(process.cwd(), "src", "content", "articles"),
) {
  const fileNames = (await readdir(articlesDirectory))
    .filter((fileName) => /\.mdx?$/.test(fileName))
    .sort();

  return Promise.all(
    fileNames.map(async (fileName) =>
      parseArticleMarkdown(
        await readFile(path.join(articlesDirectory, fileName), "utf8"),
        fileName,
      ),
    ),
  );
}

function validateArticle(article, allSlugs, { launchDate, today }) {
  const issues = [];
  const { body, data, fileName } = article;
  const slug = data.slug;

  const requiredLengths = {
    title: [10, 100],
    description: [50, 180],
    businessProblem: [20, 500],
    technologyFocus: [20, 500],
    intendedAudience: [20, 300],
    readerOutcome: [20, 500],
    summary: [40, 500],
  };
  for (const [field, [minimum, maximum]] of Object.entries(requiredLengths)) {
    const length = textLength(data[field]);
    if (length < minimum || length > maximum) {
      issues.push(
        finding(
          "required-field",
          fileName,
          `${field} must contain ${minimum}-${maximum} trimmed characters.`,
        ),
      );
    }
  }

  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    issues.push(
      finding("slug", fileName, "slug must use lowercase kebab-case."),
    );
  } else if (path.basename(fileName, path.extname(fileName)) !== slug) {
    issues.push(
      finding("slug-file", fileName, "slug must match the Markdown file name."),
    );
  }

  if (!REQUIRED_CATEGORY_SLUGS.includes(data.category)) {
    issues.push(
      finding(
        "category",
        fileName,
        "category is not one of the five public categories.",
      ),
    );
  }
  if (data.author !== siteConfig.publicationByline) {
    issues.push(
      finding(
        "author",
        fileName,
        `author must be ${siteConfig.publicationByline}.`,
      ),
    );
  }
  if (data.status !== "published") {
    issues.push(
      finding(
        "status",
        fileName,
        "launch portfolio entries must be published.",
      ),
    );
  }
  if (!CONTENT_TYPES.has(data.contentType)) {
    issues.push(
      finding("content-type", fileName, "contentType is not supported."),
    );
  }
  if (data.verificationStatus !== "source-checked") {
    issues.push(
      finding(
        "verification-status",
        fileName,
        "published launch content must be source-checked; tested requires real test evidence.",
      ),
    );
  }
  if (data.noindex !== false) {
    issues.push(
      finding("noindex", fileName, "published content must remain indexable."),
    );
  }

  for (const field of [
    "businessProblem",
    "technologyFocus",
    "intendedAudience",
    "readerOutcome",
  ]) {
    if (textLength(data[field]) < 20) {
      issues.push(
        finding(
          "fit-field",
          fileName,
          `${field} does not pass the topic-fit minimum.`,
        ),
      );
    }
  }

  if (
    !isRealDate(data.datePublished) ||
    data.datePublished < launchDate ||
    data.datePublished > today
  ) {
    issues.push(
      finding(
        "publication-date",
        fileName,
        `datePublished must be a real date from launch (${launchDate}) through today (${today}).`,
      ),
    );
  }
  if (
    !isRealDate(data.lastReviewed) ||
    data.lastReviewed < launchDate ||
    data.lastReviewed > today ||
    (isRealDate(data.datePublished) && data.lastReviewed < data.datePublished)
  ) {
    issues.push(
      finding(
        "review-date",
        fileName,
        `lastReviewed must be no earlier than publication and no later than today (${today}).`,
      ),
    );
  }
  if (data.dateModified !== undefined) {
    if (
      !isRealDate(data.dateModified) ||
      !isRealDate(data.datePublished) ||
      data.dateModified <= data.datePublished ||
      data.dateModified > today
    ) {
      issues.push(
        finding(
          "modification-date",
          fileName,
          "dateModified is allowed only after a later substantive update; omit it at initial publication.",
        ),
      );
    }
  }
  if (
    isRealDate(data.datePublished) &&
    isRealDate(data.lastReviewed) &&
    data.lastReviewed < data.datePublished
  ) {
    issues.push(
      finding(
        "date-order",
        fileName,
        "reviewed date cannot precede publication.",
      ),
    );
  }

  if (!Array.isArray(data.sourceList) || data.sourceList.length < 2) {
    issues.push(
      finding(
        "source-count",
        fileName,
        "published content requires at least two sources.",
      ),
    );
  } else {
    const sourceUrls = new Set();
    for (const [index, source] of data.sourceList.entries()) {
      const label = `sourceList[${index}]`;
      if (!source || typeof source !== "object") {
        issues.push(
          finding(
            "source-record",
            fileName,
            `${label} must be a source object.`,
          ),
        );
        continue;
      }
      if (textLength(source.title) < 3 || textLength(source.publisher) < 2) {
        issues.push(
          finding(
            "source-record",
            fileName,
            `${label} needs a title and publisher.`,
          ),
        );
      }
      let parsedUrl;
      try {
        parsedUrl = new URL(source.url);
      } catch {
        issues.push(
          finding("source-url", fileName, `${label} is not a valid URL.`),
        );
      }
      if (parsedUrl) {
        if (parsedUrl.protocol !== "https:") {
          issues.push(
            finding("source-url", fileName, `${label} must use HTTPS.`),
          );
        }
        if (!isApprovedPrimaryHost(parsedUrl.hostname)) {
          issues.push(
            finding(
              "source-host",
              fileName,
              `${parsedUrl.hostname} is not an approved government or first-party vendor host.`,
            ),
          );
        }
        if (sourceUrls.has(parsedUrl.href)) {
          issues.push(
            finding(
              "duplicate-source",
              fileName,
              `${label} duplicates another source URL.`,
            ),
          );
        }
        sourceUrls.add(parsedUrl.href);
        if (!body.includes(source.url)) {
          issues.push(
            finding(
              "uncited-source",
              fileName,
              `${label} is not cited in the article body.`,
            ),
          );
        }
      }
      if (
        !isRealDate(source.accessed) ||
        source.accessed < launchDate ||
        source.accessed > today
      ) {
        issues.push(
          finding(
            "source-accessed",
            fileName,
            `${label} has an invalid or future access date.`,
          ),
        );
      }
    }
  }

  if (wordCount(body) < 650) {
    issues.push(
      finding(
        "body-word-count",
        fileName,
        "article body must contain at least 650 words.",
      ),
    );
  }
  if ((body.match(/^##\s+\S/gm) ?? []).length < 4) {
    issues.push(
      finding(
        "body-section-count",
        fileName,
        "article body must contain at least four H2 sections.",
      ),
    );
  }
  if (
    !/\b(?:limitation|limits|does not prove|not a substitute|not a guarantee)\b/i.test(
      body,
    )
  ) {
    issues.push(
      finding(
        "body-limitation",
        fileName,
        "article must state a limitation explicitly.",
      ),
    );
  }
  if (
    /\b(?:I|we)\s+(?:tested|used|reviewed|found|observed|measured|deployed)\b/.test(
      body,
    )
  ) {
    issues.push(
      finding(
        "firsthand-claim",
        fileName,
        "article contains an unsupported first-hand claim.",
      ),
    );
  }

  const related = Array.isArray(data.relatedArticles)
    ? data.relatedArticles
    : [];
  for (const relatedSlug of related) {
    if (relatedSlug === slug || !allSlugs.has(relatedSlug)) {
      issues.push(
        finding(
          "related-article",
          fileName,
          `related article ${relatedSlug} is invalid.`,
        ),
      );
    }
  }

  if (Boolean(data.heroImage) !== Boolean(data.heroImageAlt)) {
    issues.push(
      finding(
        "hero-pair",
        fileName,
        "heroImage and heroImageAlt must be supplied together.",
      ),
    );
  }
  if (
    data.heroImage &&
    (typeof data.heroImage !== "string" ||
      !data.heroImage.startsWith("/") ||
      data.heroImage.startsWith("//"))
  ) {
    issues.push(
      finding(
        "hero-path",
        fileName,
        "heroImage must be a root-relative local path.",
      ),
    );
  }
  if (data.canonicalOverride) {
    try {
      const canonicalOverride = new URL(data.canonicalOverride);
      if (
        canonicalOverride.protocol !== "https:" ||
        canonicalOverride.origin !== siteOrigin ||
        canonicalOverride.username ||
        canonicalOverride.password
      ) {
        issues.push(
          finding(
            "canonical-override",
            fileName,
            "canonicalOverride must stay on the site origin.",
          ),
        );
      }
    } catch {
      issues.push(
        finding(
          "canonical-override",
          fileName,
          "canonicalOverride must be a valid HTTPS URL.",
        ),
      );
    }
  }

  const publicText = `${JSON.stringify(data)}\n${body}`;
  if (PLACEHOLDER_PATTERN.test(publicText)) {
    issues.push(
      finding("placeholder", fileName, "content contains placeholder text."),
    );
  }
  if (TRACKING_PATTERN.test(publicText)) {
    issues.push(
      finding(
        "tracking-or-ad-code",
        fileName,
        "content contains an advertising or analytics identifier.",
      ),
    );
  }

  return issues;
}

export function validateContentPortfolio(
  articles,
  {
    launchDate = siteConfig.launchDate,
    today = todayInPublicationTimeZone(),
  } = {},
) {
  const issues = [];
  if (articles.length < 15) {
    issues.push(
      finding(
        "portfolio-count",
        "portfolio",
        `expected at least 15 articles; found ${articles.length}.`,
      ),
    );
  }

  for (const category of REQUIRED_CATEGORY_SLUGS) {
    const count = articles.filter(
      ({ data }) => data.category === category,
    ).length;
    if (count < 3) {
      issues.push(
        finding(
          "category-count",
          category,
          `expected at least 3 articles; found ${count}.`,
        ),
      );
    }
  }

  for (const field of ["slug", "title", "description"]) {
    const seen = new Map();
    for (const article of articles) {
      const value = article.data[field];
      if (typeof value !== "string") continue;
      const normalized = value.trim().toLowerCase();
      if (seen.has(normalized)) {
        issues.push(
          finding(
            `duplicate-${field}`,
            article.fileName,
            `${field} duplicates ${seen.get(normalized)}.`,
          ),
        );
      } else {
        seen.set(normalized, article.fileName);
      }
    }
  }

  const allSlugs = new Set(
    articles
      .map(({ data }) => data.slug)
      .filter((slug) => typeof slug === "string"),
  );
  for (const article of articles) {
    issues.push(...validateArticle(article, allSlugs, { launchDate, today }));
  }

  return issues;
}

export function printFindings(label, issues) {
  if (issues.length === 0) {
    console.log(`${label}: PASS`);
    return;
  }
  console.error(
    `${label}: FAIL (${issues.length} finding${issues.length === 1 ? "" : "s"})`,
  );
  for (const issue of issues) {
    console.error(`- [${issue.code}] ${issue.file}: ${issue.message}`);
  }
}

async function main() {
  const articles = await readArticleRecords();
  const issues = validateContentPortfolio(articles);
  printFindings("Content QA", issues);
  if (issues.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `Content QA: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

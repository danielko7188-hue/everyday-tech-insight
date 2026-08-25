import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { load as loadYaml } from "js-yaml";
import { fromMarkdown } from "mdast-util-from-markdown";

import { siteConfig } from "../site.config.mjs";
import { visitTreeIterative } from "../src/utils/managed-image-ast.mjs";
import { publicEvidenceUrlIssue } from "../src/utils/public-evidence-url.mjs";

export const REQUIRED_CATEGORY_SLUGS = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
];

const ARTICLE_STATUSES = new Set(["draft", "review", "published", "archived"]);
const CONTENT_TYPES = new Set([
  "guide",
  "checklist",
  "framework",
  "comparison",
]);
const VERIFICATION_STATUSES = new Set([
  "unverified",
  "source-checked",
  "tested",
]);
const PUBLICATION_VERIFICATION_STATUSES = new Set(["source-checked", "tested"]);
const VISUAL_TYPE_BY_KEY = new Map([
  ["automation-candidate-screen", "decision-tree"],
  ["ai-quality-scorecard", "comparison"],
  ["ai-use-governance", "governance"],
  ["saas-evidence-checklist", "checklist"],
  ["work-object-comparison", "comparison"],
  ["saas-exit-data-flow", "data-flow"],
  ["mfa-rollout-boundary", "security-boundary"],
  ["phishing-response-workflow", "workflow"],
  ["three-two-one-topology", "backup-topology"],
  ["shared-file-architecture", "information-architecture"],
  ["workflow-exception-lane", "process-lane"],
  ["access-onboarding-checklist", "checklist"],
  ["technology-risk-matrix", "risk-matrix"],
  ["software-cost-stack", "cost-stack"],
  ["thirty-day-pilot-timeline", "timeline"],
]);

const PLACEHOLDER_PATTERN =
  /\b(?:todo|tbd|changeme|placeholder|lorem ipsum|replace[-_ ]?me|your[-_ ]?(?:name|email|id))\b/i;
const TRACKING_PATTERN =
  /(?:googlesyndication|doubleclick|google-analytics|googletagmanager|adsbygoogle|(?:ca-)?pub-\d{10,}|\bUA-\d{4,}-\d+\b|\bG-[A-Z0-9]{6,}\b|\bGTM-[A-Z0-9]{4,}\b)/i;
const SCRIPT_OR_EMBED_PATTERN =
  /<(?:script|iframe|object|embed|applet|video|audio|source|track)\b/i;
const EVENT_HANDLER_PATTERN = /\son[a-z]+\s*=/i;
const JAVASCRIPT_URI_PATTERN = /javascript\s*:/i;
const DATA_HTML_URI_PATTERN = /\]\(\s*data\s*:\s*text\/html\b/i;
const REMOTE_IMAGE_PATTERN =
  /(?:!\[[^\]]*\]\(\s*(?:https?:\/\/|\/\/)|<img\b[^>]*\bsrc\s*=\s*["'](?:https?:\/\/|\/\/))/i;
const PATH_HAZARD_PATTERN =
  /(?:\]\(\s*(?:file:|[a-z]:[\\/]|\\\\|\/\/|\.\.?(?:[\\/]))|(?:src|href)\s*=\s*["'](?:file:|[a-z]:[\\/]|\\\\|\/\/|\.\.?(?:[\\/])))/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HERO_IMAGE_PATTERN =
  /^\/images\/articles\/(?![^/]*\.\.)[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|png|jpe?g)$/;
const PUBLISHED_EXPLANATION_RULES = [
  {
    field: "guidePromise",
    duplicateCode: "duplicate-guide-promise",
    unsupportedCode: "unsupported-guide-promise",
    minimumSupportedTerms: 3,
  },
  {
    field: "deliverable",
    duplicateCode: "duplicate-deliverable",
    unsupportedCode: "unsupported-deliverable",
    minimumSupportedTerms: 2,
  },
  {
    field: "whenToUse",
    duplicateCode: "duplicate-when-to-use",
    unsupportedCode: "unsupported-when-to-use",
    minimumSupportedTerms: 2,
  },
];
const EXPLANATION_SUPPORT_RATIO = 0.25;
// Dice catches broadly copied wording; minimum-set containment also catches a
// short valid field copied intact with only a small amount of added noise.
const EXPLANATION_NEAR_DUPLICATE_THRESHOLD = 0.9;
const EXPLANATION_STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "already",
  "before",
  "being",
  "between",
  "both",
  "could",
  "during",
  "each",
  "from",
  "have",
  "into",
  "other",
  "should",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "until",
  "using",
  "when",
  "where",
  "which",
  "while",
  "with",
  "without",
  "would",
]);

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

function significantExplanationTerms(value) {
  const tokens =
    value
      .normalize("NFKC")
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [];

  return new Set(
    tokens
      .filter(
        (token) =>
          token.length >= 4 &&
          /[a-z]/.test(token) &&
          !EXPLANATION_STOPWORDS.has(token),
      )
      // Six-character term families handle common inflections such as
      // compare/comparing and automate/automation without fuzzy matching.
      .map((token) => (token.length > 6 ? token.slice(0, 6) : token)),
  );
}

function significantExplanationSignature(value) {
  return [...significantExplanationTerms(value)].sort();
}

function significantTokenOverlap(left, right) {
  if (left.length === 0 || right.length === 0) return 0;
  const rightTerms = new Set(right);
  const intersectionSize = left.filter((term) => rightTerms.has(term)).length;
  return (2 * intersectionSize) / (left.length + right.length);
}

function significantTokenContainment(left, right) {
  if (left.length === 0 || right.length === 0) return 0;
  const rightTerms = new Set(right);
  const intersectionSize = left.filter((term) => rightTerms.has(term)).length;
  return intersectionSize / Math.min(left.length, right.length);
}

function explanationSignaturesNearDuplicate(left, right) {
  const exactSignature =
    left.length === right.length &&
    left.every((term, index) => term === right[index]);
  return (
    exactSignature ||
    significantTokenOverlap(left, right) >=
      EXPLANATION_NEAR_DUPLICATE_THRESHOLD ||
    significantTokenContainment(left, right) >=
      EXPLANATION_NEAR_DUPLICATE_THRESHOLD
  );
}

const NON_PROSE_MARKDOWN_NODE_TYPES = new Set([
  "code",
  "definition",
  "html",
  "image",
  "imageReference",
  "inlineCode",
  "toml",
  "yaml",
]);
const NON_VISIBLE_HTML_ELEMENT_NAMES = new Set([
  "head",
  "noscript",
  "script",
  "style",
  "template",
]);

function updateHiddenHtmlStack(html, stack) {
  const closingTag = html.match(/^<\s*\/\s*([a-z][\w:-]*)/i);
  if (closingTag) {
    const matchingIndex = stack.lastIndexOf(closingTag[1].toLowerCase());
    if (matchingIndex !== -1) stack.splice(matchingIndex);
    return;
  }

  const openingTag = html.match(/^<\s*([a-z][\w:-]*)\b([^>]*)>/i);
  if (!openingTag || /\/\s*>$/.test(html)) return;
  const name = openingTag[1].toLowerCase();
  const attributes = openingTag[2];
  if (
    NON_VISIBLE_HTML_ELEMENT_NAMES.has(name) ||
    /(?:^|\s)hidden(?:\s|=|$)/i.test(attributes) ||
    /(?:^|\s)aria-hidden\s*=\s*["']?true(?:["']|\s|$)/i.test(attributes)
  ) {
    stack.push(name);
  }
}

function collectVisibleMarkdownText(root, output, hiddenHtmlStack = []) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (node.type === "html" || node.type === "raw") {
      updateHiddenHtmlStack(node.value ?? "", hiddenHtmlStack);
      continue;
    }
    if (NON_PROSE_MARKDOWN_NODE_TYPES.has(node.type)) continue;
    if (node.type === "text" && hiddenHtmlStack.length === 0) {
      output.push(node.value);
    }
    if (!Array.isArray(node.children)) continue;
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]);
    }
  }
}

function containsRawMarkdownHtml(markdown) {
  const tree = fromMarkdown(markdown);
  let containsRawHtml = false;
  visitTreeIterative(tree, (node) => {
    if (node.type === "html" || node.type === "raw") {
      containsRawHtml = true;
    }
  });
  return containsRawHtml;
}

export function visibleMarkdownProse(markdown) {
  const tree = fromMarkdown(markdown);
  const visibleText = [];
  collectVisibleMarkdownText(tree, visibleText);
  return visibleText.join(" ");
}

export function countReaderVisibleWords(markdown) {
  return wordCount(visibleMarkdownProse(markdown));
}

function validatePublishedExplanations(publishedArticles) {
  const issues = [];
  const seenByField = new Map(
    PUBLISHED_EXPLANATION_RULES.map(({ field }) => [field, []]),
  );

  for (const article of publishedArticles) {
    const evidence = [
      article.data.summary,
      typeof article.body === "string"
        ? visibleMarkdownProse(article.body)
        : "",
    ]
      .filter((value) => typeof value === "string")
      .join("\n");
    const evidenceTerms = significantExplanationTerms(evidence);

    for (const rule of PUBLISHED_EXPLANATION_RULES) {
      const value = article.data[rule.field];
      if (typeof value !== "string" || value.trim() === "") continue;

      const signature = significantExplanationSignature(value);
      const seen = seenByField.get(rule.field);
      const nearDuplicate = seen.find(({ signature: priorSignature }) =>
        explanationSignaturesNearDuplicate(signature, priorSignature),
      );
      if (nearDuplicate !== undefined) {
        const diceOverlap = significantTokenOverlap(
          signature,
          nearDuplicate.signature,
        );
        const containmentOverlap = significantTokenContainment(
          signature,
          nearDuplicate.signature,
        );
        issues.push(
          finding(
            rule.duplicateCode,
            article.fileName,
            `${rule.field} near-duplicates ${nearDuplicate.fileName} (${Math.round(diceOverlap * 100)}% Dice overlap; ${Math.round(containmentOverlap * 100)}% containment; threshold ${EXPLANATION_NEAR_DUPLICATE_THRESHOLD * 100}%).`,
          ),
        );
      }
      seen.push({ fileName: article.fileName, signature });

      // This is mechanical terminology traceability, not semantic or editorial
      // proof. Only summary and extracted visible body prose can provide support.
      const explanationTerms = significantExplanationTerms(value);
      const supportedCount = [...explanationTerms].filter((term) =>
        evidenceTerms.has(term),
      ).length;
      const requiredCount = Math.max(
        rule.minimumSupportedTerms,
        Math.ceil(explanationTerms.size * EXPLANATION_SUPPORT_RATIO),
      );
      if (supportedCount < requiredCount) {
        issues.push(
          finding(
            rule.unsupportedCode,
            article.fileName,
            `${rule.field} has ${supportedCount} significant terms represented in the summary or visible body prose; expected at least ${requiredCount} for mechanical terminology support.`,
          ),
        );
      }
    }
  }

  return issues;
}

function normalizedOptionalData(data) {
  const normalized = { ...data };
  for (const field of [
    "description",
    "guidePromise",
    "deliverable",
    "whenToUse",
    "businessProblem",
    "technologyFocus",
    "intendedAudience",
    "readerOutcome",
    "datePublished",
    "dateModified",
    "lastReviewed",
    "dateArchived",
    "summary",
    "heroImage",
    "heroImageCaption",
    "heroImageCredit",
    "heroImageSourceUrl",
    "heroImageLicense",
  ]) {
    if (
      typeof normalized[field] === "string" &&
      normalized[field].trim() === ""
    ) {
      delete normalized[field];
    }
  }
  if (
    normalized.heroImage === undefined &&
    typeof normalized.heroImageAlt === "string" &&
    normalized.heroImageAlt.trim() === ""
  ) {
    delete normalized.heroImageAlt;
  }
  return normalized;
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
  async function discover(directory, relativeDirectory = "") {
    const records = [];
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      if (entry.isDirectory()) {
        records.push(
          ...(await discover(path.join(directory, entry.name), relativePath)),
        );
      } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
        records.push(relativePath);
      }
    }
    return records;
  }

  const fileNames = await discover(articlesDirectory);

  return Promise.all(
    fileNames.map(async (fileName) =>
      parseArticleMarkdown(
        await readFile(path.join(articlesDirectory, fileName), "utf8"),
        fileName,
      ),
    ),
  );
}

function validateTextField(
  issues,
  fileName,
  data,
  field,
  minimum,
  maximum,
  code = "required-field",
) {
  const length = textLength(data[field]);
  if (length < minimum || length > maximum) {
    issues.push(
      finding(
        code,
        fileName,
        `${field} must contain ${minimum}-${maximum} trimmed characters.`,
      ),
    );
  }
}

function validateDateValue(issues, fileName, field, value, launchDate, today) {
  if (!isRealDate(value) || value < launchDate || value > today) {
    issues.push(
      finding(
        `${field === "datePublished" ? "publication" : field === "lastReviewed" ? "review" : field === "dateModified" ? "modification" : "archive"}-date`,
        fileName,
        `${field} must be a real date from launch (${launchDate}) through today (${today}).`,
      ),
    );
    return false;
  }
  return true;
}

function validateVisual(issues, fileName, visual, required) {
  if (!visual || typeof visual !== "object" || Array.isArray(visual)) {
    if (required) {
      issues.push(
        finding(
          "visual",
          fileName,
          "review, published, and archived content requires an informative visual.",
        ),
      );
    }
    return;
  }

  const expectedType = VISUAL_TYPE_BY_KEY.get(visual.key);
  if (!expectedType || visual.type !== expectedType) {
    issues.push(
      finding(
        "visual-pair",
        fileName,
        "visual key and type must use the controlled exact pairing.",
      ),
    );
  }
  if (
    textLength(visual.alt) < 10 ||
    textLength(visual.alt) > 240 ||
    visual.decorative !== false
  ) {
    issues.push(
      finding(
        "visual-alt",
        fileName,
        "editorial visuals must be informative, non-decorative, and have meaningful alternative text.",
      ),
    );
  }
  if (
    visual.caption !== undefined &&
    (textLength(visual.caption) < 10 || textLength(visual.caption) > 300)
  ) {
    issues.push(
      finding(
        "visual-caption",
        fileName,
        "visual caption must contain 10-300 trimmed characters when supplied.",
      ),
    );
  }
}

function validateSources(
  issues,
  fileName,
  data,
  body,
  minimum,
  launchDate,
  today,
) {
  if (!Array.isArray(data.sourceList) || data.sourceList.length < minimum) {
    if (minimum > 0) {
      issues.push(
        finding(
          "source-count",
          fileName,
          `${data.status} content requires at least ${minimum} source${minimum === 1 ? "" : "s"}.`,
        ),
      );
    }
    if (!Array.isArray(data.sourceList)) return;
  }

  const sourceUrls = new Set();
  for (const [index, source] of (data.sourceList ?? []).entries()) {
    const label = `sourceList[${index}]`;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      issues.push(
        finding("source-record", fileName, `${label} must be a source object.`),
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

    const urlIssue = publicEvidenceUrlIssue(source.url);
    let parsedUrl;
    if (urlIssue) {
      issues.push(
        finding(
          "source-url",
          fileName,
          `${label} must use a safe public HTTPS URL: ${urlIssue}.`,
        ),
      );
    } else {
      parsedUrl = new URL(source.url);
    }
    if (parsedUrl) {
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

function validateHero(issues, fileName, data) {
  const ancillaryFields = [
    "heroImageAlt",
    "heroImageDecorative",
    "heroImageCaption",
    "heroImageCredit",
    "heroImageSourceUrl",
    "heroImageLicense",
  ];

  if (data.heroImage === undefined) {
    for (const field of ancillaryFields) {
      if (data[field] !== undefined) {
        issues.push(
          finding(
            "hero-pair",
            fileName,
            `${field} cannot be supplied without heroImage.`,
          ),
        );
      }
    }
    return;
  }

  if (
    typeof data.heroImage !== "string" ||
    !HERO_IMAGE_PATTERN.test(data.heroImage)
  ) {
    issues.push(
      finding(
        "hero-path",
        fileName,
        "heroImage must be a safe flat path under /images/articles/.",
      ),
    );
  }
  if (typeof data.heroImageDecorative !== "boolean") {
    issues.push(
      finding(
        "hero-pair",
        fileName,
        "heroImageDecorative is required with heroImage.",
      ),
    );
  }
  if (typeof data.heroImageAlt !== "string") {
    issues.push(
      finding(
        "hero-pair",
        fileName,
        "heroImageAlt is required with heroImage.",
      ),
    );
  } else if (
    (data.heroImageDecorative === true && data.heroImageAlt !== "") ||
    (data.heroImageDecorative === false && textLength(data.heroImageAlt) < 10)
  ) {
    issues.push(
      finding(
        "hero-alt",
        fileName,
        "decorative hero images require empty alt text; informative images require meaningful alt text.",
      ),
    );
  }

  for (const [field, minimum, maximum] of [
    ["heroImageCaption", 10, 300],
    ["heroImageCredit", 2, 200],
    ["heroImageLicense", 2, 120],
  ]) {
    if (
      data[field] !== undefined &&
      (textLength(data[field]) < minimum || textLength(data[field]) > maximum)
    ) {
      issues.push(
        finding(
          "hero-metadata",
          fileName,
          `${field} must contain ${minimum}-${maximum} trimmed characters.`,
        ),
      );
    }
  }
  if (data.heroImageSourceUrl !== undefined) {
    const urlIssue = publicEvidenceUrlIssue(data.heroImageSourceUrl);
    if (urlIssue) {
      issues.push(
        finding(
          "hero-source-url",
          fileName,
          `heroImageSourceUrl must use a safe public HTTPS URL: ${urlIssue}.`,
        ),
      );
    }
  }
}

function validateArticle(
  article,
  { launchDate, today, entriesBySlug, publishedSlugs },
) {
  const issues = [];
  const { body, fileName } = article;
  const data = normalizedOptionalData(article.data);
  const slug = data.slug;
  const status = data.status;

  validateTextField(issues, fileName, data, "title", 10, 100);
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    issues.push(
      finding("slug", fileName, "slug must use lowercase kebab-case."),
    );
  } else if (path.basename(fileName, path.extname(fileName)) !== slug) {
    issues.push(
      finding("slug-file", fileName, "slug must match the Markdown file name."),
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
  if (!ARTICLE_STATUSES.has(status)) {
    issues.push(
      finding(
        "status",
        fileName,
        "status must be draft, review, published, or archived.",
      ),
    );
  }

  const requiresReviewMetadata = ["review", "published", "archived"].includes(
    status,
  );
  const requiresPublicationMetadata = ["published", "archived"].includes(
    status,
  );

  if (requiresReviewMetadata) {
    validateTextField(issues, fileName, data, "description", 50, 180);
    validateTextField(
      issues,
      fileName,
      data,
      "guidePromise",
      90,
      180,
      "guide-field",
    );
    validateTextField(
      issues,
      fileName,
      data,
      "deliverable",
      20,
      150,
      "guide-field",
    );
    validateTextField(
      issues,
      fileName,
      data,
      "whenToUse",
      40,
      180,
      "guide-field",
    );
    validateTextField(issues, fileName, data, "summary", 40, 500);
    if (!REQUIRED_CATEGORY_SLUGS.includes(data.category)) {
      issues.push(
        finding(
          "category",
          fileName,
          "category is not one of the five public categories.",
        ),
      );
    }
    if (!CONTENT_TYPES.has(data.contentType)) {
      issues.push(
        finding("content-type", fileName, "contentType is not supported."),
      );
    }
    for (const [field, maximum] of [
      ["businessProblem", 500],
      ["technologyFocus", 500],
      ["intendedAudience", 300],
      ["readerOutcome", 500],
    ]) {
      validateTextField(
        issues,
        fileName,
        data,
        field,
        20,
        maximum,
        "fit-field",
      );
    }
    validateVisual(issues, fileName, data.visual, true);
  } else {
    if (
      data.category !== undefined &&
      !REQUIRED_CATEGORY_SLUGS.includes(data.category)
    ) {
      issues.push(
        finding(
          "category",
          fileName,
          "category is not one of the five public categories.",
        ),
      );
    }
    if (
      data.contentType !== undefined &&
      !CONTENT_TYPES.has(data.contentType)
    ) {
      issues.push(
        finding("content-type", fileName, "contentType is not supported."),
      );
    }
    validateVisual(issues, fileName, data.visual, false);
  }

  if (
    data.verificationStatus !== undefined &&
    !VERIFICATION_STATUSES.has(data.verificationStatus)
  ) {
    issues.push(
      finding(
        "verification-status",
        fileName,
        "verificationStatus is not supported.",
      ),
    );
  }
  if (
    requiresPublicationMetadata &&
    !PUBLICATION_VERIFICATION_STATUSES.has(data.verificationStatus)
  ) {
    issues.push(
      finding(
        "verification-status",
        fileName,
        "published and archived content must be source-checked or tested.",
      ),
    );
  }

  if (status === "published" && data.noindex !== false) {
    issues.push(
      finding("noindex", fileName, "published content must remain indexable."),
    );
  }
  if (["review", "archived"].includes(status) && data.noindex !== true) {
    issues.push(
      finding(
        "noindex",
        fileName,
        `${status} content must remain excluded from indexing.`,
      ),
    );
  }
  if (status === "draft" && data.noindex === false) {
    issues.push(
      finding("noindex", fileName, "draft content cannot be indexable."),
    );
  }

  for (const field of ["datePublished", "dateModified", "lastReviewed"]) {
    if (data[field] !== undefined) {
      validateDateValue(
        issues,
        fileName,
        field,
        data[field],
        launchDate,
        today,
      );
    }
  }
  if (requiresPublicationMetadata) {
    if (data.datePublished === undefined) {
      issues.push(
        finding(
          "publication-date",
          fileName,
          "published and archived content requires datePublished.",
        ),
      );
    }
    if (data.lastReviewed === undefined) {
      issues.push(
        finding(
          "review-date",
          fileName,
          "published and archived content requires lastReviewed.",
        ),
      );
    }
  }
  if (
    data.dateModified !== undefined &&
    (data.datePublished === undefined ||
      data.dateModified <= data.datePublished ||
      data.dateModified > today)
  ) {
    issues.push(
      finding(
        "modification-date",
        fileName,
        "dateModified is allowed only after a later substantive update.",
      ),
    );
  }
  if (
    data.datePublished !== undefined &&
    data.lastReviewed !== undefined &&
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
  if (status === "archived") {
    const validArchiveDate = validateDateValue(
      issues,
      fileName,
      "dateArchived",
      data.dateArchived,
      launchDate,
      today,
    );
    if (
      validArchiveDate &&
      [data.datePublished, data.dateModified, data.lastReviewed]
        .filter(Boolean)
        .some((date) => data.dateArchived < date)
    ) {
      issues.push(
        finding(
          "archive-date",
          fileName,
          "dateArchived cannot precede publication, modification, or review.",
        ),
      );
    }
  }

  const minimumSources = requiresPublicationMetadata
    ? 2
    : status === "review"
      ? 1
      : 0;
  validateSources(
    issues,
    fileName,
    data,
    body,
    minimumSources,
    launchDate,
    today,
  );

  if (body.trim().length === 0) {
    issues.push(
      finding("body-empty", fileName, "article Markdown body cannot be empty."),
    );
  }
  if (containsRawMarkdownHtml(body)) {
    issues.push(
      finding(
        "raw-html",
        fileName,
        "article Markdown cannot contain raw HTML; use Markdown structures instead.",
      ),
    );
  }
  if (
    SCRIPT_OR_EMBED_PATTERN.test(body) ||
    EVENT_HANDLER_PATTERN.test(body) ||
    JAVASCRIPT_URI_PATTERN.test(body) ||
    DATA_HTML_URI_PATTERN.test(body)
  ) {
    issues.push(
      finding(
        "unsafe-body",
        fileName,
        "article Markdown cannot contain scripts, embeds, event handlers, or JavaScript URLs.",
      ),
    );
  }
  if (PATH_HAZARD_PATTERN.test(body) || REMOTE_IMAGE_PATTERN.test(body)) {
    issues.push(
      finding(
        "path-hazard",
        fileName,
        "article Markdown cannot contain filesystem, traversal, or protocol-relative paths.",
      ),
    );
  }

  if (requiresPublicationMetadata) {
    if (countReaderVisibleWords(body) < 650) {
      issues.push(
        finding(
          "body-word-count",
          fileName,
          "published and archived article bodies must contain at least 650 whitespace-delimited tokens.",
        ),
      );
    }
    if ((body.match(/^##\s+\S/gm) ?? []).length < 4) {
      issues.push(
        finding(
          "body-section-count",
          fileName,
          "published and archived article bodies must contain at least four H2 sections.",
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
          "published and archived articles must state a limitation explicitly.",
        ),
      );
    }
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

  if (status === "published") {
    const related = Array.isArray(data.relatedArticles)
      ? data.relatedArticles
      : [];
    const seenRelated = new Set();
    for (const relatedSlug of related) {
      if (seenRelated.has(relatedSlug)) {
        issues.push(
          finding(
            "related-duplicate",
            fileName,
            `related article ${relatedSlug} appears more than once.`,
          ),
        );
      }
      seenRelated.add(relatedSlug);
      if (relatedSlug === slug) {
        issues.push(
          finding(
            "related-self",
            fileName,
            "a published article cannot relate to itself.",
          ),
        );
      } else if (!entriesBySlug.has(relatedSlug)) {
        issues.push(
          finding(
            "related-missing",
            fileName,
            `related article ${relatedSlug} does not exist.`,
          ),
        );
      } else if (!publishedSlugs.has(relatedSlug)) {
        issues.push(
          finding(
            "related-nonpublished",
            fileName,
            `related article ${relatedSlug} is not published.`,
          ),
        );
      }
    }
  }

  validateHero(issues, fileName, data);

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
  const normalizedArticles = articles.map((article) => ({
    ...article,
    data: normalizedOptionalData(article.data),
  }));
  const publishedArticles = normalizedArticles.filter(
    ({ data }) => data.status === "published",
  );

  if (publishedArticles.length < 15) {
    issues.push(
      finding(
        "portfolio-count",
        "portfolio",
        `expected at least 15 published articles; found ${publishedArticles.length}.`,
      ),
    );
  }

  for (const category of REQUIRED_CATEGORY_SLUGS) {
    const count = publishedArticles.filter(
      ({ data }) => data.category === category,
    ).length;
    if (count < 3) {
      issues.push(
        finding(
          "category-count",
          category,
          `expected at least 3 published articles; found ${count}.`,
        ),
      );
    }
  }

  const entriesBySlug = new Map();
  for (const article of normalizedArticles) {
    const slug = article.data.slug;
    if (typeof slug !== "string") continue;
    if (entriesBySlug.has(slug)) {
      issues.push(
        finding(
          "duplicate-slug",
          article.fileName,
          `slug duplicates ${entriesBySlug.get(slug).fileName}.`,
        ),
      );
    } else {
      entriesBySlug.set(slug, article);
    }
  }

  for (const field of ["title", "description"]) {
    const seen = new Map();
    for (const article of publishedArticles) {
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

  issues.push(...validatePublishedExplanations(publishedArticles));

  const publishedSlugs = new Set(
    publishedArticles
      .map(({ data }) => data.slug)
      .filter((slug) => typeof slug === "string"),
  );
  for (const article of normalizedArticles) {
    issues.push(
      ...validateArticle(article, {
        launchDate,
        today,
        entriesBySlug,
        publishedSlugs,
      }),
    );
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

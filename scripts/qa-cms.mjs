import { isDeepStrictEqual } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { load as loadYaml } from "js-yaml";

const ARTICLE_STATUSES = ["draft", "review", "published", "archived"];
const CATEGORY_SLUGS = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
];
const CONTENT_TYPES = ["guide", "checklist", "framework", "comparison"];
const VERIFICATION_STATUSES = ["unverified", "source-checked", "tested"];
const VISUAL_TYPES = [
  "workflow",
  "decision-tree",
  "comparison",
  "cost-stack",
  "security-boundary",
  "backup-topology",
  "process-lane",
  "risk-matrix",
  "checklist",
  "timeline",
  "data-flow",
  "governance",
  "information-architecture",
];
const VISUAL_KEYS = [
  "automation-candidate-screen",
  "ai-quality-scorecard",
  "ai-use-governance",
  "saas-evidence-checklist",
  "work-object-comparison",
  "saas-exit-data-flow",
  "mfa-rollout-boundary",
  "phishing-response-workflow",
  "three-two-one-topology",
  "shared-file-architecture",
  "workflow-exception-lane",
  "access-onboarding-checklist",
  "technology-risk-matrix",
  "software-cost-stack",
  "thirty-day-pilot-timeline",
];
const FIELD_ORDER = [
  "title",
  "description",
  "slug",
  "category",
  "author",
  "status",
  "contentType",
  "guidePromise",
  "deliverable",
  "whenToUse",
  "businessProblem",
  "technologyFocus",
  "intendedAudience",
  "readerOutcome",
  "verificationStatus",
  "datePublished",
  "dateModified",
  "lastReviewed",
  "dateArchived",
  "featured",
  "summary",
  "visual",
  "sourceList",
  "relatedArticles",
  "heroImage",
  "heroImageAlt",
  "heroImageDecorative",
  "heroImageCaption",
  "heroImageCredit",
  "heroImageSourceUrl",
  "heroImageLicense",
  "canonicalOverride",
  "noindex",
  "body",
];
const FIELD_TYPES = new Map([
  ["title", "string"],
  ["description", "text"],
  ["slug", "string"],
  ["category", "select"],
  ["author", "string"],
  ["status", "select"],
  ["contentType", "select"],
  ["guidePromise", "text"],
  ["deliverable", "text"],
  ["whenToUse", "text"],
  ["businessProblem", "text"],
  ["technologyFocus", "text"],
  ["intendedAudience", "text"],
  ["readerOutcome", "text"],
  ["verificationStatus", "select"],
  ["datePublished", "date"],
  ["dateModified", "date"],
  ["lastReviewed", "date"],
  ["dateArchived", "date"],
  ["featured", "boolean"],
  ["summary", "text"],
  ["visual", "object"],
  ["sourceList", "object"],
  ["relatedArticles", "reference"],
  ["heroImage", "image"],
  ["heroImageAlt", "text"],
  ["heroImageDecorative", "boolean"],
  ["heroImageCaption", "text"],
  ["heroImageCredit", "string"],
  ["heroImageSourceUrl", "string"],
  ["heroImageLicense", "string"],
  ["canonicalOverride", "string"],
  ["noindex", "boolean"],
  ["body", "rich-text"],
]);
const FIELD_HELPERS = new Map([
  [
    "description",
    "Required before review. Summarize the guide plainly in 50–180 characters without promises the article cannot support.",
  ],
  [
    "slug",
    "Use the canonical lowercase words-and-hyphens form. This value also owns the Markdown filename.",
  ],
  [
    "category",
    "Required before review. Choose one public category only after the guide's scope is clear.",
  ],
  [
    "author",
    "Publication-name byline. It does not identify a person or legal entity.",
  ],
  [
    "contentType",
    "Required before review. Select the structure the completed guide actually uses.",
  ],
  [
    "guidePromise",
    "Required before review. State the bounded help the guide actually delivers in 90–180 characters.",
  ],
  [
    "deliverable",
    "Required before review. Name the concrete record, decision, or working output in 20–150 characters.",
  ],
  [
    "whenToUse",
    "Required before review. Describe the real decision context in 40–180 characters.",
  ],
  [
    "businessProblem",
    "Required before review. Describe the operational problem without inventing results.",
  ],
  [
    "technologyFocus",
    "Required before review. Name the relevant technology and control boundary.",
  ],
  [
    "intendedAudience",
    "Required before review. Identify the reader who can use this guidance.",
  ],
  [
    "readerOutcome",
    "Required before review. State what the reader can decide or produce after following the guide.",
  ],
  [
    "verificationStatus",
    "Keep unverified until the stated evidence work has actually been completed.",
  ],
  [
    "datePublished",
    "Leave empty for drafts and review. Add only when publication really occurs.",
  ],
  [
    "dateModified",
    "Leave empty on initial publication. Add only after a later substantive edit.",
  ],
  [
    "lastReviewed",
    "Record the date of a completed review; do not advance it for planned work.",
  ],
  [
    "dateArchived",
    "Required only when status is archived and archival actually occurs.",
  ],
  [
    "summary",
    "Required before review. Summarize the practical guidance in 40–500 characters.",
  ],
  [
    "visual",
    "Required before review. The repository validates the controlled visual key and type pair.",
  ],
  [
    "sourceList",
    "Add only sources actually reviewed and cited in the Markdown body.",
  ],
  [
    "heroImage",
    "Optional owned or licensed raster image stored in the article image folder.",
  ],
  [
    "heroImageAlt",
    "Supply meaningful text for an informative hero, or an empty value only when the hero is decorative.",
  ],
  [
    "heroImageDecorative",
    "Set this only with a hero image. Decorative heroes require empty alternative text.",
  ],
  [
    "canonicalOverride",
    "Optional same-site HTTPS canonical URL. Leave empty unless a reviewed canonical exception is required.",
  ],
  [
    "noindex",
    "Draft, review, and archived entries stay excluded. Published entries must be deliberately changed to false.",
  ],
  [
    "body",
    "Write the article in Markdown. Add only evidence-backed claims, cite sources in the text, and keep the status at draft until editorial review is complete.",
  ],
]);
const RASTER_EXTENSIONS = ["webp", "png", "jpg", "jpeg"];
const DATE_FIELDS = [
  "datePublished",
  "dateModified",
  "lastReviewed",
  "dateArchived",
];
const LENGTH_FIELDS = new Map([
  ["title", [10, 100]],
  ["description", [50, 180]],
  ["slug", [1, 120]],
  ["guidePromise", [90, 180]],
  ["deliverable", [20, 150]],
  ["whenToUse", [40, 180]],
  ["businessProblem", [20, 500]],
  ["technologyFocus", [20, 500]],
  ["intendedAudience", [20, 300]],
  ["readerOutcome", [20, 500]],
  ["summary", [40, 500]],
]);
const VIEW = {
  primary: "title",
  fields: [
    "title",
    "status",
    "category",
    "contentType",
    "datePublished",
    "lastReviewed",
    "featured",
  ],
  search: ["title", "slug", "summary", "category", "status", "contentType"],
  sort: ["datePublished", "lastReviewed", "title", "category", "status"],
  default: { sort: "datePublished", order: "desc" },
};
const SETTINGS = {
  content: { merge: true },
  commit: {
    identity: "app",
    templates: {
      create: "content(create): {path}",
      update: "content(update): {path}",
      delete: "content(delete): {path}",
      rename: "content(rename): {oldPath} -> {newPath}",
    },
  },
};
const FORBIDDEN_KEY_PATTERN =
  /^(?:actions?|workflow|deploy|secret|token|password|credential|api.?key|publisher.?id|analytics.?id|verification.?code|client.?(?:id|secret))$/i;
const TRACKING_OR_SECRET_PATTERN =
  /(?:\b(?:ca-)?pub-\d{10,}\b|\bUA-\d{4,}-\d+\b|\bG-[A-Z0-9]{6,}\b|\bGTM-[A-Z0-9]{4,}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const HOSTED_CONTEXT_PATTERN = /\b(?:pages\s+cms|cms|hosted)\b/i;
const HOSTED_OPERATION_PATTERN =
  /\b(?:auth(?:entication|orization)?|sign[ -]?in|sav(?:e|es|ed|ing)|round[ -]?trip)\b/i;
const FIELD_SEMANTIC_KEYS = [
  "type",
  "required",
  "default",
  "options",
  "pattern",
  "hidden",
  "readonly",
  "list",
  "component",
  "fields",
];
const FIELD_ALLOWED_KEYS = new Set([
  "name",
  "label",
  "description",
  ...FIELD_SEMANTIC_KEYS,
]);

function finding(code, location, message) {
  return { code, location, message };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fieldByName(collection, name) {
  return Array.isArray(collection?.fields)
    ? collection.fields.find((field) => field?.name === name)
    : undefined;
}

function fieldConstraintSnapshot(field) {
  return {
    type: field?.type,
    required: field?.required,
    default: field?.default,
    options: field?.options,
    pattern: field?.pattern,
    hidden: field?.hidden,
    readonly: field?.readonly,
    list: field?.list,
    component: field?.component,
    fields: Array.isArray(field?.fields)
      ? field.fields.map((child) => child?.name)
      : field?.fields,
    unexpectedKeys: isRecord(field)
      ? Object.keys(field)
          .filter((key) => !FIELD_ALLOWED_KEYS.has(key))
          .sort()
      : [],
  };
}

function expectedFieldConstraintSnapshot(overrides) {
  return {
    type: undefined,
    required: undefined,
    default: undefined,
    options: undefined,
    pattern: undefined,
    hidden: undefined,
    readonly: undefined,
    list: undefined,
    component: undefined,
    fields: undefined,
    unexpectedKeys: [],
    ...overrides,
  };
}

function addExactFinding(findings, code, location, actual, expected) {
  if (!isDeepStrictEqual(actual, expected)) {
    findings.push(
      finding(
        code,
        location,
        `Expected ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}.`,
      ),
    );
  }
}

function containsHostedOutcomeLanguage(value) {
  return (
    HOSTED_CONTEXT_PATTERN.test(value) && HOSTED_OPERATION_PATTERN.test(value)
  );
}

function scanForbidden(value, location, findings) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanForbidden(item, `${location}[${index}]`, findings),
    );
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === "string") {
      if (TRACKING_OR_SECRET_PATTERN.test(value)) {
        findings.push(
          finding(
            "secret-or-identifier",
            location,
            "CMS configuration cannot contain credentials, publisher IDs, analytics IDs, or private keys.",
          ),
        );
      }
      if (containsHostedOutcomeLanguage(value)) {
        findings.push(
          finding(
            "hosted-outcome-language",
            location,
            "Hosted CMS outcome language is not allowed in configuration; document external validation state separately.",
          ),
        );
      }
    }
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childLocation = location ? `${location}.${key}` : key;
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      findings.push(
        finding(
          key === "actions" || key === "action" || key === "workflow"
            ? "actions-or-workflow"
            : "forbidden-key",
          childLocation,
          "Actions, workflows, deployment controls, credentials, and private identifiers are outside this CMS contract.",
        ),
      );
    }
    scanForbidden(child, childLocation, findings);
  }
}

function validateFieldContract(collection, findings) {
  const fields = Array.isArray(collection?.fields) ? collection.fields : [];
  addExactFinding(
    findings,
    "field-order",
    "content[0].fields",
    fields.map((field) => field?.name),
    FIELD_ORDER,
  );

  const known = new Set(FIELD_ORDER);
  for (const [index, field] of fields.entries()) {
    if (!known.has(field?.name)) {
      findings.push(
        finding(
          "unknown-field",
          `content[0].fields[${index}]`,
          `Unknown article field ${JSON.stringify(field?.name)}.`,
        ),
      );
    }
  }
  for (const name of FIELD_ORDER) {
    if (!fields.some((field) => field?.name === name)) {
      findings.push(
        finding(
          "missing-field",
          "content[0].fields",
          `Missing article field ${name}.`,
        ),
      );
    }
  }

  const requiredTopLevelFields = new Set([
    "title",
    "slug",
    "author",
    "status",
    "body",
  ]);
  for (const [name, type] of FIELD_TYPES) {
    const articleField = fieldByName(collection, name);
    addExactFinding(
      findings,
      "field-type",
      `fields.${name}.type`,
      articleField?.type,
      type,
    );
    addExactFinding(
      findings,
      "field-requiredness",
      `fields.${name}.required`,
      articleField?.required,
      requiredTopLevelFields.has(name) ? true : undefined,
    );
  }
  for (const [name, helper] of FIELD_HELPERS) {
    addExactFinding(
      findings,
      "field-helper",
      `fields.${name}.description`,
      fieldByName(collection, name)?.description,
      helper,
    );
  }

  for (const name of ["title", "slug", "author", "status", "body"]) {
    addExactFinding(
      findings,
      "required-field",
      `fields.${name}.required`,
      fieldByName(collection, name)?.required,
      true,
    );
  }
  for (const [name, [minlength, maxlength]] of LENGTH_FIELDS) {
    addExactFinding(
      findings,
      "field-length",
      `fields.${name}.options`,
      fieldByName(collection, name)?.options,
      { minlength, maxlength },
    );
  }
  addExactFinding(
    findings,
    "slug-pattern",
    "fields.slug.pattern",
    fieldByName(collection, "slug")?.pattern?.regex,
    "^[a-z0-9]+(?:-[a-z0-9]+)*$",
  );
  addExactFinding(
    findings,
    "author-contract",
    "fields.author",
    {
      default: fieldByName(collection, "author")?.default,
      readonly: fieldByName(collection, "author")?.readonly,
    },
    { default: "Everyday Tech Insight", readonly: true },
  );
  for (const [name, values] of [
    ["category", CATEGORY_SLUGS],
    ["status", ARTICLE_STATUSES],
    ["contentType", CONTENT_TYPES],
    ["verificationStatus", VERIFICATION_STATUSES],
  ]) {
    addExactFinding(
      findings,
      "enum-options",
      `fields.${name}.options.values`,
      fieldByName(collection, name)?.options?.values,
      values,
    );
  }
  addExactFinding(
    findings,
    "status-default",
    "fields.status.default",
    fieldByName(collection, "status")?.default,
    "draft",
  );
  addExactFinding(
    findings,
    "verification-default",
    "fields.verificationStatus.default",
    fieldByName(collection, "verificationStatus")?.default,
    "unverified",
  );
  addExactFinding(
    findings,
    "featured-default",
    "fields.featured.default",
    fieldByName(collection, "featured")?.default,
    false,
  );
  addExactFinding(
    findings,
    "related-default",
    "fields.relatedArticles.default",
    fieldByName(collection, "relatedArticles")?.default,
    [],
  );
  addExactFinding(
    findings,
    "noindex-default",
    "fields.noindex.default",
    fieldByName(collection, "noindex")?.default,
    true,
  );

  for (const name of DATE_FIELDS) {
    const dateField = fieldByName(collection, name);
    addExactFinding(
      findings,
      "date-contract",
      `fields.${name}`,
      {
        type: dateField?.type,
        default: dateField?.default,
        format: dateField?.options?.format,
      },
      { type: "date", default: "", format: "yyyy-MM-dd" },
    );
  }

  const visual = fieldByName(collection, "visual");
  addExactFinding(
    findings,
    "visual-object-contract",
    "fields.visual",
    fieldConstraintSnapshot(visual),
    expectedFieldConstraintSnapshot({
      type: "object",
      fields: ["type", "key", "alt", "caption", "decorative"],
    }),
  );
  addExactFinding(
    findings,
    "visual-fields",
    "fields.visual.fields",
    visual?.fields?.map((field) => field?.name),
    ["type", "key", "alt", "caption", "decorative"],
  );
  addExactFinding(
    findings,
    "visual-type-options",
    "fields.visual.type.options.values",
    fieldByName(visual, "type")?.options?.values,
    VISUAL_TYPES,
  );
  addExactFinding(
    findings,
    "visual-key-options",
    "fields.visual.key.options.values",
    fieldByName(visual, "key")?.options?.values,
    VISUAL_KEYS,
  );
  for (const [name, type, required] of [
    ["type", "select", true],
    ["key", "select", true],
    ["alt", "text", true],
    ["caption", "text", undefined],
    ["decorative", "boolean", true],
  ]) {
    const visualField = fieldByName(visual, name);
    addExactFinding(
      findings,
      "visual-child-contract",
      `fields.visual.${name}`,
      { type: visualField?.type, required: visualField?.required },
      { type, required },
    );
  }
  const visualChildConstraints = new Map([
    [
      "type",
      expectedFieldConstraintSnapshot({
        type: "select",
        required: true,
        options: { values: VISUAL_TYPES },
      }),
    ],
    [
      "key",
      expectedFieldConstraintSnapshot({
        type: "select",
        required: true,
        options: { values: VISUAL_KEYS },
      }),
    ],
    [
      "alt",
      expectedFieldConstraintSnapshot({
        type: "text",
        required: true,
        options: { minlength: 10, maxlength: 240 },
      }),
    ],
    [
      "caption",
      expectedFieldConstraintSnapshot({
        type: "text",
        options: { minlength: 10, maxlength: 300 },
      }),
    ],
    [
      "decorative",
      expectedFieldConstraintSnapshot({
        type: "boolean",
        required: true,
        default: false,
      }),
    ],
  ]);
  for (const [name, expected] of visualChildConstraints) {
    addExactFinding(
      findings,
      "visual-child-contract",
      `fields.visual.${name}`,
      fieldConstraintSnapshot(fieldByName(visual, name)),
      expected,
    );
  }
  addExactFinding(
    findings,
    "visual-default",
    "fields.visual.decorative.default",
    fieldByName(visual, "decorative")?.default,
    false,
  );
  for (const [name, options] of [
    ["alt", { minlength: 10, maxlength: 240 }],
    ["caption", { minlength: 10, maxlength: 300 }],
  ]) {
    addExactFinding(
      findings,
      "visual-child-options",
      `fields.visual.${name}.options`,
      fieldByName(visual, name)?.options,
      options,
    );
  }
  if (!/repository.*validates.*pair/i.test(visual?.description ?? "")) {
    findings.push(
      finding(
        "visual-helper",
        "fields.visual.description",
        "Visual helper must explain that the repository validates the key/type pair.",
      ),
    );
  }

  const sourceList = fieldByName(collection, "sourceList");
  addExactFinding(
    findings,
    "source-list",
    "fields.sourceList",
    fieldConstraintSnapshot(sourceList),
    expectedFieldConstraintSnapshot({
      type: "object",
      list: {
        collapsible: { collapsed: true, summary: "{fields.title}" },
      },
      fields: ["title", "publisher", "url", "accessed"],
    }),
  );
  for (const name of ["title", "publisher", "url", "accessed"]) {
    addExactFinding(
      findings,
      "source-child-required",
      `fields.sourceList.${name}.required`,
      fieldByName(sourceList, name)?.required,
      true,
    );
  }
  for (const [name, type] of [
    ["title", "string"],
    ["publisher", "string"],
    ["url", "string"],
    ["accessed", "date"],
  ]) {
    addExactFinding(
      findings,
      "source-child-type",
      `fields.sourceList.${name}.type`,
      fieldByName(sourceList, name)?.type,
      type,
    );
  }
  for (const [name, options] of [
    ["title", { minlength: 3, maxlength: 200 }],
    ["publisher", { minlength: 2, maxlength: 120 }],
  ]) {
    addExactFinding(
      findings,
      "source-child-options",
      `fields.sourceList.${name}.options`,
      fieldByName(sourceList, name)?.options,
      options,
    );
  }
  const sourceChildConstraints = new Map([
    [
      "title",
      expectedFieldConstraintSnapshot({
        type: "string",
        required: true,
        options: { minlength: 3, maxlength: 200 },
      }),
    ],
    [
      "publisher",
      expectedFieldConstraintSnapshot({
        type: "string",
        required: true,
        options: { minlength: 2, maxlength: 120 },
      }),
    ],
    [
      "url",
      expectedFieldConstraintSnapshot({
        type: "string",
        required: true,
        pattern: {
          regex: "^https://[^\\s]+$",
          message: "Use a complete HTTPS source URL.",
        },
      }),
    ],
    [
      "accessed",
      expectedFieldConstraintSnapshot({
        type: "date",
        required: true,
        default: "",
        options: { format: "yyyy-MM-dd" },
      }),
    ],
  ]);
  for (const [name, expected] of sourceChildConstraints) {
    addExactFinding(
      findings,
      "source-child-contract",
      `fields.sourceList.${name}`,
      fieldConstraintSnapshot(fieldByName(sourceList, name)),
      expected,
    );
  }
  addExactFinding(
    findings,
    "source-url-pattern",
    "fields.sourceList.url.pattern",
    fieldByName(sourceList, "url")?.pattern,
    {
      regex: "^https://[^\\s]+$",
      message: "Use a complete HTTPS source URL.",
    },
  );
  const sourceAccessed = fieldByName(sourceList, "accessed");
  addExactFinding(
    findings,
    "source-date",
    "fields.sourceList.accessed",
    {
      type: sourceAccessed?.type,
      default: sourceAccessed?.default,
      format: sourceAccessed?.options?.format,
    },
    { type: "date", default: "", format: "yyyy-MM-dd" },
  );

  const related = fieldByName(collection, "relatedArticles");
  addExactFinding(
    findings,
    "reference-contract",
    "fields.relatedArticles",
    { type: related?.type, options: related?.options },
    {
      type: "reference",
      options: {
        collection: "articles",
        multiple: true,
        max: 4,
        search: "title,slug",
        value: "{fields.slug}",
        label: "{fields.title}",
      },
    },
  );

  const hero = fieldByName(collection, "heroImage");
  addExactFinding(
    findings,
    "hero-media",
    "fields.heroImage",
    fieldConstraintSnapshot(hero),
    expectedFieldConstraintSnapshot({
      type: "image",
      options: {
        media: "article_images",
        extensions: RASTER_EXTENSIONS,
        categories: ["image"],
        rename: "safe",
      },
    }),
  );
  const heroAndSeoConstraints = new Map([
    [
      "heroImageAlt",
      expectedFieldConstraintSnapshot({
        type: "text",
        options: { maxlength: 240 },
      }),
    ],
    [
      "heroImageDecorative",
      expectedFieldConstraintSnapshot({
        type: "boolean",
      }),
    ],
    [
      "heroImageCaption",
      expectedFieldConstraintSnapshot({
        type: "text",
        options: { minlength: 10, maxlength: 300 },
      }),
    ],
    [
      "heroImageCredit",
      expectedFieldConstraintSnapshot({
        type: "string",
        options: { minlength: 2, maxlength: 200 },
      }),
    ],
    [
      "heroImageSourceUrl",
      expectedFieldConstraintSnapshot({
        type: "string",
        pattern: {
          regex: "^https://[^\\s]+$",
          message: "Use a complete HTTPS source URL.",
        },
      }),
    ],
    [
      "heroImageLicense",
      expectedFieldConstraintSnapshot({
        type: "string",
        options: { minlength: 2, maxlength: 120 },
      }),
    ],
    [
      "canonicalOverride",
      expectedFieldConstraintSnapshot({
        type: "string",
      }),
    ],
    [
      "noindex",
      expectedFieldConstraintSnapshot({
        type: "boolean",
        default: true,
      }),
    ],
  ]);
  for (const [name, expected] of heroAndSeoConstraints) {
    const articleField = fieldByName(collection, name);
    addExactFinding(
      findings,
      "hero-seo-contract",
      `fields.${name}`,
      fieldConstraintSnapshot(articleField),
      expected,
    );
  }

  const body = fieldByName(collection, "body");
  addExactFinding(
    findings,
    "body-contract",
    "fields.body",
    { type: body?.type, options: body?.options },
    {
      type: "rich-text",
      options: {
        format: "markdown",
        switcher: true,
        media: "article_images",
        extensions: RASTER_EXTENSIONS,
        categories: ["image"],
        rename: "safe",
      },
    },
  );
  if (!/Markdown.*evidence.*review/i.test(body?.description ?? "")) {
    findings.push(
      finding(
        "body-helper",
        "fields.body.description",
        "Body helper must plainly describe Markdown, evidence, and editorial review.",
      ),
    );
  }
}

export async function readPagesCmsConfig(
  configPath = path.join(process.cwd(), ".pages.yml"),
) {
  const raw = await readFile(configPath, "utf8");
  const config = loadYaml(raw);
  if (!isRecord(config)) {
    throw new Error(`${configPath} must contain a YAML object.`);
  }
  return config;
}

export function validatePagesCmsConfig(config) {
  const findings = [];
  if (!isRecord(config)) {
    return [
      finding(
        "config-object",
        ".pages.yml",
        "Configuration must be an object.",
      ),
    ];
  }

  addExactFinding(
    findings,
    "top-level-keys",
    ".pages.yml",
    Object.keys(config),
    ["media", "content", "settings"],
  );
  addExactFinding(findings, "media-contract", "media", config.media, [
    {
      name: "article_images",
      label: "Article images",
      input: "public/images/articles",
      output: "/images/articles",
      extensions: RASTER_EXTENSIONS,
      categories: ["image"],
      rename: "safe",
    },
  ]);

  if (!Array.isArray(config.content) || config.content.length !== 1) {
    findings.push(
      finding(
        "content-count",
        "content",
        "Configuration must expose exactly one articles collection.",
      ),
    );
  }
  const collection = config.content?.[0];
  if (isRecord(collection)) {
    addExactFinding(
      findings,
      "collection-keys",
      "content[0]",
      Object.keys(collection),
      [
        "name",
        "label",
        "type",
        "path",
        "format",
        "subfolders",
        "filename",
        "operations",
        "view",
        "fields",
      ],
    );
    addExactFinding(
      findings,
      "collection-identity",
      "content[0]",
      {
        name: collection.name,
        label: collection.label,
        type: collection.type,
        path: collection.path,
        format: collection.format,
        subfolders: collection.subfolders,
        filename: collection.filename,
        operations: collection.operations,
        view: collection.view,
      },
      {
        name: "articles",
        label: "Guides",
        type: "collection",
        path: "src/content/articles",
        format: "yaml-frontmatter",
        subfolders: false,
        filename: { template: "{fields.slug}.md", field: false },
        operations: { create: true, rename: false, delete: false },
        view: VIEW,
      },
    );
    validateFieldContract(collection, findings);
  } else {
    findings.push(
      finding(
        "collection-object",
        "content[0]",
        "Collection must be an object.",
      ),
    );
  }

  addExactFinding(
    findings,
    "settings-contract",
    "settings",
    config.settings,
    SETTINGS,
  );
  scanForbidden(config, "", findings);

  return findings;
}

export function printCmsFindings(findings) {
  if (findings.length === 0) {
    console.log("CMS QA: PASS");
    return;
  }
  console.error(
    `CMS QA: FAIL (${findings.length} finding${findings.length === 1 ? "" : "s"})`,
  );
  for (const issue of findings) {
    console.error(`- [${issue.code}] ${issue.location}: ${issue.message}`);
  }
}

async function main() {
  const config = await readPagesCmsConfig();
  const findings = validatePagesCmsConfig(config);
  printCmsFindings(findings);
  if (findings.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `CMS QA: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

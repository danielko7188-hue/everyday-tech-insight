import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { JSON_SCHEMA, load as loadYaml } from "js-yaml";
import { z } from "zod";

import { countReaderVisibleWords, readArticleRecords } from "./qa-content.mjs";
import {
  findPublicSafetyIssues,
  isSecretLikeQueryKey,
} from "../src/utils/public-content-safety.mjs";

export { findPublicSafetyIssues } from "../src/utils/public-content-safety.mjs";

export const LAUNCH_GUIDE_SLUGS = Object.freeze([
  "back-up-business-files-with-the-3-2-1-method",
  "calculate-the-total-cost-of-business-software",
  "create-a-shared-file-and-folder-system",
  "create-a-simple-technology-risk-register",
  "crm-vs-project-management-software",
  "document-a-repetitive-workflow-before-automating",
  "evaluate-ai-output-quality-in-a-small-team-pilot",
  "evaluate-saas-with-a-practical-checklist",
  "how-to-identify-business-tasks-for-automation",
  "onboard-employees-and-contractors-to-business-technology",
  "respond-to-a-suspected-phishing-message",
  "roll-out-mfa-across-a-small-business",
  "run-a-30-day-business-technology-pilot",
  "test-data-export-and-integrations-before-saas-lock-in",
  "write-a-practical-ai-acceptable-use-policy",
]);

export const RELEASE_GATE_VALUES = Object.freeze([
  "software-blocker",
  "publication-blocker",
  "owner-action",
  "clear",
]);

export const PUBLIC_SAFETY_PATHS = Object.freeze([
  ".pages.yml",
  "README.md",
  "src/data/authors.ts",
  "docs/OWNER_INPUTS_REQUIRED.md",
  "docs/CONTENT_QUALITY_REVIEW_QUEUE.md",
  "docs/PUBLISHING_GUIDE.md",
  "docs/editorial-operations.yml",
  "docs/CMS_BRAND_ADSENSE_SOURCE_LOG.md",
  "docs/superpowers/specs/2026-08-25-cms-purple-signal-publication-maturity-design.md",
  "docs/superpowers/plans/2026-08-25-pages-cms-content-workflow.md",
  "docs/superpowers/plans/2026-08-25-publication-maturity-release.md",
]);

const OWNER_STATUSES = ["UNKNOWN", "OWNER ACTION REQUIRED", "VERIFIED"];
const HUMAN_REVIEW_STATUSES = ["OWNER REVIEW REQUIRED", "COMPLETE"];
const ARTICLE_STATUSES = ["draft", "review", "published", "archived"];
const CATEGORY_SLUGS = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function containsControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}
const SAFE_TEXT = z
  .string()
  .min(1, "must be nonempty")
  .refine((value) => value.trim() === value, "must be trimmed")
  .refine((value) => !containsControlCharacter(value), {
    message: "cannot contain control characters",
  });
const NON_PLACEHOLDER_TEXT = SAFE_TEXT.refine(
  (value) =>
    !/^(?:tbd|todo|to be determined|pending (?:verification|approval)|coming soon|unknown|n\/?a|not applicable|placeholder(?:\s+\w+)?|(?:dummy|test)(?:\s+\w+)?|(?:john|jane) doe|(?:(?:owner|owner designated|designated) )?(?:reviewer|editor))$/i.test(
      value
        .normalize("NFKC")
        .replace(/[\p{P}\p{S}_]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  "must identify a real reviewer rather than a placeholder",
);
const GENERIC_REVIEWER_WORDS = new Set([
  "a",
  "admin",
  "administrator",
  "be",
  "designated",
  "editor",
  "editorial",
  "evidence",
  "example",
  "no",
  "owner",
  "pending",
  "person",
  "proof",
  "reviewer",
  "sample",
  "staff",
  "supplied",
  "team",
  "to",
  "unknown",
  "user",
]);
const REVIEWER_NAME = NON_PLACEHOLDER_TEXT.refine((value) => {
  const words = value.normalize("NFKC").split(/\s+/);
  return (
    words.length >= 2 &&
    words.every(
      (word) =>
        /^[\p{L}][\p{L}\p{M}'’.-]*$/u.test(word) &&
        !GENERIC_REVIEWER_WORDS.has(word.toLowerCase()),
    )
  );
}, "must contain the real reviewer's name, not a role or pending value");
const NEGATIVE_EVIDENCE_LANGUAGE =
  /\b(?:(?:no|without) (?:support(?:ing)?|proof|record|reference|documentation|(?:supporting |external |review )?evidence)|(?:proof|record|reference|documentation|evidence) (?:does not exist|is )?(?:missing|absent|unavailable|unverified|pending|incomplete)|still unresolved|pending(?: evidence| review| verification| approval)?|to be (?:supplied|provided|determined)|not (?:available|provided|supplied|verified|reviewed|complete)|unresolved|incomplete)\b/i;
const CLEAR_CONTRADICTION_LANGUAGE =
  /\b(?:blocked|blocker|cannot ship|do not ship|must not ship|not clear|failed|failure|missing|unresolved|incomplete|pending)\b/i;
const NEGATIVE_RIGHTS_LANGUAGE =
  /\b(?:(?:not|never) (?:cleared|licensed|approved|resolved|verified)|no (?:license|rights|permission|authorization|evidence)|incomplete|pending|unresolved|unknown|missing|absent|uncleared|unlicensed)\b/i;

function expertReviewIsNotRequired(value) {
  if (!/^NO\s+—\s+/.test(value)) return false;
  const resolvedPhrase =
    /\b(?:requires? no expert review|does not require expert review|no expert review (?:is )?(?:required|needed)|expert review (?:is )?not (?:required|needed))\b/i;
  if (!resolvedPhrase.test(value)) return false;
  const remainder = value.replace(resolvedPhrase, "");
  return !/(?:\b(?:expert|specialist|review)\b.{0,100}\b(?:required|needed|must|should)\b|\b(?:required|needed|must|should)\b.{0,100}\b(?:expert|specialist|review)\b|\bnot true\b)/i.test(
    remainder,
  );
}

function mediaRightsAreCleared(value) {
  return /^CLEARED\s+—\s+/.test(value) && !NEGATIVE_RIGHTS_LANGUAGE.test(value);
}

function isConcreteEvidenceReference(value) {
  const lexicalUrls = value.match(/https:\/\/\S+/g) ?? [];
  const referenceUrls = lexicalUrls.map((url) => url.replace(/[.,;:!?]+$/, ""));
  return (
    !NEGATIVE_EVIDENCE_LANGUAGE.test(value) &&
    referenceUrls.every(safeHttpsUrl) &&
    (referenceUrls.length > 0 ||
      /\b[A-Z][A-Z0-9]{1,11}[-/]\d{2,}(?:[-/]\d+)*\b/.test(value) ||
      /\b[0-9a-f]{7,40}\b/i.test(value))
  );
}

const VERIFIED_EVIDENCE_REFERENCE = SAFE_TEXT.min(10).refine(
  isConcreteEvidenceReference,
  "must contain a concrete nonsecret reference and cannot describe missing or unresolved evidence",
);

function actualUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function isRealDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const DATE = z
  .string()
  .refine(isRealDate, "must be a real YYYY-MM-DD date")
  .refine((value) => value <= actualUtcDate(), "cannot be in the future");

function safeHttpsUrl(value) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    containsControlCharacter(value)
  ) {
    return false;
  }
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const labels = hostname.split(".");
    const validDnsName =
      !url.hostname.endsWith(".") &&
      labels.length >= 2 &&
      labels.every(
        (part) =>
          part.length >= 1 &&
          part.length <= 63 &&
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part),
      ) &&
      /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(labels.at(-1));
    const reservedHostname =
      ["localhost", "example.com", "example.org", "example.net"].some(
        (reserved) =>
          hostname === reserved || hostname.endsWith(`.${reserved}`),
      ) ||
      [
        ".invalid",
        ".test",
        ".example",
        ".localhost",
        ".local",
        ".internal",
        ".home.arpa",
      ].some((suffix) => hostname.endsWith(suffix));
    const addressLiteral =
      hostname.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    const hasSecretQuery = [...url.searchParams.keys()].some(
      isSecretLikeQueryKey,
    );
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.port &&
      validDnsName &&
      !reservedHostname &&
      !addressLiteral &&
      !hasSecretQuery
    );
  } catch {
    return false;
  }
}

const RELEASE_GATE = z
  .object({
    status: z.enum(RELEASE_GATE_VALUES),
    rationale: SAFE_TEXT.min(20),
    evidenceReference: SAFE_TEXT.min(10),
  })
  .strict();

const OWNER_GATE = z
  .object({
    number: z.number().int().min(1).max(18),
    name: SAFE_TEXT,
    status: z.enum(OWNER_STATUSES),
    reason: SAFE_TEXT.min(10),
    acceptedEvidence: SAFE_TEXT.min(10),
    publicEffect: SAFE_TEXT.min(10),
    nextAction: SAFE_TEXT.min(10),
    evidenceReference: VERIFIED_EVIDENCE_REFERENCE.nullable(),
    verifiedBy: REVIEWER_NAME.nullable(),
    verifiedAt: DATE.nullable(),
  })
  .strict()
  .superRefine((gate, context) => {
    const transitionFields = [
      ["evidenceReference", gate.evidenceReference],
      ["verifiedBy", gate.verifiedBy],
      ["verifiedAt", gate.verifiedAt],
    ];
    if (gate.status === "VERIFIED") {
      for (const [field, value] of transitionFields) {
        if (value === null) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} is required when status is VERIFIED`,
          });
        }
      }
    } else {
      for (const [field, value] of transitionFields) {
        if (value !== null) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} must remain null until status is VERIFIED`,
          });
        }
      }
    }
  });

const QUALITY_RECORD = z
  .object({
    slug: z.string().regex(SLUG),
    title: SAFE_TEXT,
    category: z.enum(CATEGORY_SLUGS),
    publicationStatus: z.enum(ARTICLE_STATUSES),
    wordCount: z.number().int().positive(),
    reader: SAFE_TEXT,
    businessNeed: SAFE_TEXT,
    guidePromise: SAFE_TEXT,
    deliverable: SAFE_TEXT,
    whenToUse: SAFE_TEXT,
    sourceUrls: z
      .array(z.string().refine(safeHttpsUrl, "must be a safe HTTPS URL"))
      .min(2),
    sourceSuitability: SAFE_TEXT.min(40),
    sourceLastChecked: DATE.nullable(),
    originalMethod: SAFE_TEXT.min(30),
    originalVisual: SAFE_TEXT.min(20),
    toolkitContribution: SAFE_TEXT.min(20),
    claimRisks: SAFE_TEXT.min(30),
    repetitionRisks: SAFE_TEXT.min(30),
    evidenceLimits: SAFE_TEXT.min(30),
    mediaRights: SAFE_TEXT.min(20),
    automationReview: SAFE_TEXT.min(40),
    humanEditorialReview: z.enum(HUMAN_REVIEW_STATUSES),
    expertReviewNeeded: SAFE_TEXT.regex(/^(?:YES|CONDITIONAL|NO)\b/),
    recommendation: SAFE_TEXT.regex(/^(?:KEEP|REVISE|ARCHIVE)\b/),
    ownerAction: SAFE_TEXT.min(30),
    reviewedBy: REVIEWER_NAME.nullable(),
    reviewedAt: DATE.nullable(),
    releaseGate: RELEASE_GATE,
  })
  .strict()
  .superRefine((record, context) => {
    if (record.humanEditorialReview === "COMPLETE") {
      if (record.reviewedBy === null) {
        context.addIssue({
          code: "custom",
          path: ["reviewedBy"],
          message: "reviewedBy is required when human review is COMPLETE",
        });
      }
      if (record.reviewedAt === null) {
        context.addIssue({
          code: "custom",
          path: ["reviewedAt"],
          message: "reviewedAt is required when human review is COMPLETE",
        });
      }
    } else if (record.reviewedBy !== null || record.reviewedAt !== null) {
      context.addIssue({
        code: "custom",
        path: ["humanEditorialReview"],
        message: "Reviewer identity and date require COMPLETE human review",
      });
    }

    if (record.releaseGate.status === "clear") {
      if (
        record.sourceLastChecked === null ||
        record.humanEditorialReview !== "COMPLETE" ||
        !expertReviewIsNotRequired(record.expertReviewNeeded) ||
        !mediaRightsAreCleared(record.mediaRights) ||
        !isConcreteEvidenceReference(record.releaseGate.evidenceReference) ||
        CLEAR_CONTRADICTION_LANGUAGE.test(record.releaseGate.rationale)
      ) {
        context.addIssue({
          code: "custom",
          path: ["releaseGate"],
          message:
            "clear requires a source-check date, complete human review, resolved expert review, and resolved media rights",
        });
      }
    }

    if (!/repository-observable/i.test(record.automationReview)) {
      context.addIssue({
        code: "custom",
        path: ["automationReview"],
        message: "automationReview must remain repository-observable",
      });
    }
    if (!/does not prove/i.test(record.automationReview)) {
      context.addIssue({
        code: "custom",
        path: ["automationReview"],
        message: "automationReview must state what automation does not prove",
      });
    }
  });

const EDITORIAL_SOURCE = z
  .object({
    ownerGates: z.array(OWNER_GATE),
    qualityRecords: z.array(QUALITY_RECORD).min(15),
  })
  .strict();

function validationError(label, issues) {
  const details = issues
    .map(({ path: issuePath, message }) => {
      const location = issuePath.length > 0 ? issuePath.join(".") : "source";
      return `${location}: ${message}`;
    })
    .join("; ");
  return new TypeError(`${label}: ${details}`);
}

export function parseEditorialSource(sourceText) {
  if (typeof sourceText !== "string") {
    throw new TypeError("Editorial source must be YAML text.");
  }
  return loadYaml(sourceText, {
    filename: "docs/editorial-operations.yml",
    schema: JSON_SCHEMA,
  });
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value))
      throw new TypeError(`${label} contains duplicate ${value}.`);
    seen.add(value);
  }
}

export function validateEditorialSource(input, { articles }) {
  const result = EDITORIAL_SOURCE.safeParse(input);
  if (!result.success) {
    throw validationError("Editorial source is invalid", result.error.issues);
  }
  if (!Array.isArray(articles)) {
    throw new TypeError("Editorial validation requires article records.");
  }
  const source = result.data;

  if (source.ownerGates.length !== 18) {
    throw new TypeError(
      `Owner gate record must contain exactly 18 gates; found ${source.ownerGates.length}.`,
    );
  }
  const expectedNumbers = Array.from({ length: 18 }, (_, index) => index + 1);
  if (
    source.ownerGates.some(
      ({ number }, index) => number !== expectedNumbers[index],
    )
  ) {
    throw new TypeError(
      "Owner gate numbers must be unique and sequential 1–18.",
    );
  }
  assertUnique(
    source.ownerGates.map(({ name }) => name),
    "Owner gate names",
  );
  assertUnique(
    source.qualityRecords.map(({ slug }) => slug),
    "Quality records",
  );
  for (const field of [
    "claimRisks",
    "repetitionRisks",
    "evidenceLimits",
    "ownerAction",
  ]) {
    assertUnique(
      source.qualityRecords.map((record) => record[field]),
      `Quality ${field}`,
    );
  }

  const articleBySlug = new Map(
    articles
      .filter(({ data }) => typeof data?.slug === "string")
      .map((article) => [article.data.slug, article]),
  );
  const recordBySlug = new Map(
    source.qualityRecords.map((record) => [record.slug, record]),
  );
  for (const slug of LAUNCH_GUIDE_SLUGS) {
    if (!recordBySlug.has(slug)) {
      throw new TypeError(`Quality records are missing launch guide ${slug}.`);
    }
  }
  for (const article of articles.filter(
    ({ data }) => data?.status === "published",
  )) {
    if (!recordBySlug.has(article.data.slug)) {
      throw new TypeError(
        `Quality records are missing published guide ${article.data.slug}.`,
      );
    }
  }

  const parityFields = [
    ["title", "title"],
    ["category", "category"],
    ["publicationStatus", "status"],
    ["reader", "intendedAudience"],
    ["businessNeed", "businessProblem"],
    ["guidePromise", "guidePromise"],
    ["deliverable", "deliverable"],
    ["whenToUse", "whenToUse"],
  ];
  for (const record of source.qualityRecords) {
    const article = articleBySlug.get(record.slug);
    if (!article) {
      throw new TypeError(
        `Quality record ${record.slug} has no article source.`,
      );
    }
    for (const [recordField, articleField] of parityFields) {
      if (record[recordField] !== article.data[articleField]) {
        throw new TypeError(
          `${record.slug}.${recordField} must equal article ${articleField}.`,
        );
      }
    }
    const wordCount = countReaderVisibleWords(article.body ?? "");
    if (record.wordCount !== wordCount) {
      throw new TypeError(
        `${record.slug}.wordCount must equal ${wordCount} reader-visible prose words.`,
      );
    }
    const sourceUrls = (article.data.sourceList ?? []).map(({ url }) => url);
    if (JSON.stringify(record.sourceUrls) !== JSON.stringify(sourceUrls)) {
      throw new TypeError(
        `${record.slug}.sourceUrls must equal the article source URL order.`,
      );
    }
    if (
      !record.originalVisual.includes(article.data.visual?.type ?? "") ||
      !record.originalVisual.includes(article.data.visual?.key ?? "")
    ) {
      throw new TypeError(
        `${record.slug}.originalVisual must identify the article visual type and key.`,
      );
    }
  }

  return source;
}

function ownerValueLines(gate) {
  const lines = [
    `- \`status\`: ${gate.status}`,
    `- \`reason\`: ${gate.reason}`,
    `- \`accepted evidence\`: ${gate.acceptedEvidence}`,
    `- \`public effect\`: ${gate.publicEffect}`,
    `- \`next action\`: ${gate.nextAction}`,
  ];
  if (gate.status === "VERIFIED") {
    lines.push(
      `- \`evidence reference\`: ${gate.evidenceReference}`,
      `- \`verified by\`: ${gate.verifiedBy}`,
      `- \`verified at\`: ${gate.verifiedAt}`,
    );
  }
  return lines.join("\n");
}

function renderOwnerInputs(source) {
  const introduction = [
    "# Owner Inputs Required",
    "",
    "This is repository-tracked, non-deployed source in a public GitHub repository. Every committed file and branch is publicly visible. Commit only the nonsecret status and reference fields defined here. Confidential identity, account, legal, authorization, and rights evidence must remain outside Git in an owner-approved system.",
    "",
    "Unresolved gates use `OWNER ACTION REQUIRED` or `UNKNOWN`; neither is an error in the ads-off static build. A `VERIFIED` transition is valid only with a nonsecret evidence reference, the real verifier, and the real verification date. A public claim that depends on an unresolved gate must remain absent.",
  ];
  const sections = source.ownerGates.map((gate) => [
    `## Gate ${String(gate.number).padStart(2, "0")}: ${gate.name}`,
    "",
    ownerValueLines(gate),
  ]);
  return [...introduction, ...sections.flatMap((section) => ["", ...section])]
    .join("\n")
    .concat("\n");
}

function queueValue(field, value) {
  if (field === "sourceUrls") return value.join(" | ");
  if (field === "sourceLastChecked") return value ?? "UNKNOWN";
  if (field === "reviewedBy" || field === "reviewedAt") return value ?? "";
  if (field === "releaseGate") {
    return `${value.status} — ${value.rationale} Evidence: ${value.evidenceReference}`;
  }
  return String(value);
}

const QUALITY_FIELDS = [
  "slug",
  "title",
  "category",
  "publicationStatus",
  "wordCount",
  "reader",
  "businessNeed",
  "guidePromise",
  "deliverable",
  "whenToUse",
  "sourceUrls",
  "sourceSuitability",
  "sourceLastChecked",
  "originalMethod",
  "originalVisual",
  "toolkitContribution",
  "claimRisks",
  "repetitionRisks",
  "evidenceLimits",
  "mediaRights",
  "automationReview",
  "humanEditorialReview",
  "expertReviewNeeded",
  "recommendation",
  "ownerAction",
  "reviewedBy",
  "reviewedAt",
  "releaseGate",
];

function renderQualityQueue(source) {
  const introduction = [
    "# Content Quality Review Queue",
    "",
    `This is repository-tracked, non-deployed source for the ${LAUNCH_GUIDE_SLUGS.length}-guide launch subset and every currently published guide. Every committed file and branch is publicly visible. Confidential review or rights evidence must remain outside Git; commit only a nonsecret evidence reference and truthful status. Repository-derived fields are validated against article source by automation. Editorial judgments remain bounded risk notes, not proof of originality, rights, firsthand use, expertise, human acceptance, legal sufficiency, or Google approval.`,
    "",
    "An empty `sourceLastChecked` renders as `UNKNOWN`; `reviewedBy` and `reviewedAt` stay empty until a real review supplies evidence. A guide stays `OWNER REVIEW REQUIRED` until a completed review records its real reviewer and date. Every `releaseGate` includes one of the four documented statuses plus a guide-specific rationale and nonsecret evidence reference.",
  ];
  const sections = source.qualityRecords.map((record, index) => {
    const fieldLines = QUALITY_FIELDS.map((field) => {
      const value = queueValue(field, record[field]);
      return value === "" ? `- \`${field}\`:` : `- \`${field}\`: ${value}`;
    });
    return [
      `## Guide ${String(index + 1).padStart(2, "0")}: \`${record.slug}\``,
      "",
      ...fieldLines,
    ];
  });
  return [...introduction, ...sections.flatMap((section) => ["", ...section])]
    .join("\n")
    .concat("\n");
}

export function renderEditorialDocuments(source) {
  const shape = EDITORIAL_SOURCE.safeParse(source);
  if (!shape.success) {
    throw validationError("Editorial source is invalid", shape.error.issues);
  }
  return {
    ownerInputs: renderOwnerInputs(shape.data),
    qualityQueue: renderQualityQueue(shape.data),
  };
}

export function assertGeneratedDocument(actual, expected, label) {
  if (actual !== expected) {
    throw new TypeError(
      `${label} does not byte-match generated source; it contains stale or unparsed content.`,
    );
  }
}

function designGateNames(designSpec) {
  const section = designSpec.match(
    /contains 18 numbered gates[\s\S]*?\n\n([\s\S]*?)\n\n## 12\./,
  )?.[1];
  if (!section) throw new TypeError("Approved design gate section is missing.");
  return [...section.matchAll(/^\d+\. (.+?)[.;]$/gm)].map((match) => {
    const plainName = match[1].replaceAll("`", "");
    return `${plainName[0].toUpperCase()}${plainName.slice(1)}`;
  });
}

export async function checkEditorialRepository({
  repositoryRoot = process.cwd(),
  write = false,
  readFileImpl = readFile,
  writeFileImpl = writeFile,
  readArticleRecordsImpl = readArticleRecords,
} = {}) {
  const sourcePath = path.join(
    repositoryRoot,
    "docs",
    "editorial-operations.yml",
  );
  const ownerPath = path.join(
    repositoryRoot,
    "docs",
    "OWNER_INPUTS_REQUIRED.md",
  );
  const queuePath = path.join(
    repositoryRoot,
    "docs",
    "CONTENT_QUALITY_REVIEW_QUEUE.md",
  );
  const designPath = path.join(
    repositoryRoot,
    "docs",
    "superpowers",
    "specs",
    "2026-08-25-cms-purple-signal-publication-maturity-design.md",
  );
  const [sourceText, articles, designSpec] = await Promise.all([
    readFileImpl(sourcePath, "utf8"),
    readArticleRecordsImpl(
      path.join(repositoryRoot, "src", "content", "articles"),
    ),
    readFileImpl(designPath, "utf8"),
  ]);
  const source = validateEditorialSource(parseEditorialSource(sourceText), {
    articles,
  });
  const exactGateNames = designGateNames(designSpec);
  if (
    JSON.stringify(source.ownerGates.map(({ name }) => name)) !==
    JSON.stringify(exactGateNames)
  ) {
    throw new TypeError(
      "Owner gate names do not match the approved design specification.",
    );
  }
  const rendered = renderEditorialDocuments(source);
  if (!write) {
    const [ownerDocument, qualityDocument] = await Promise.all([
      readFileImpl(ownerPath, "utf8"),
      readFileImpl(queuePath, "utf8"),
    ]);
    assertGeneratedDocument(ownerDocument, rendered.ownerInputs, ownerPath);
    assertGeneratedDocument(qualityDocument, rendered.qualityQueue, queuePath);
  }

  const generatedSafetyContent = new Map([
    ["docs/OWNER_INPUTS_REQUIRED.md", rendered.ownerInputs],
    ["docs/CONTENT_QUALITY_REVIEW_QUEUE.md", rendered.qualityQueue],
  ]);
  const safetyFiles = await Promise.all(
    PUBLIC_SAFETY_PATHS.map(async (relativePath) => {
      const generatedContent = generatedSafetyContent.get(relativePath);
      return {
        relativePath,
        content:
          generatedContent ??
          (await readFileImpl(path.join(repositoryRoot, relativePath), "utf8")),
      };
    }),
  );
  const safetyIssues = safetyFiles.flatMap(({ relativePath, content }) =>
    findPublicSafetyIssues(content, relativePath),
  );
  if (safetyIssues.length > 0) {
    throw new TypeError(
      `Public-repository safety scan failed: ${safetyIssues
        .map(({ label, kind }) => `${label}: ${kind}`)
        .join("; ")}`,
    );
  }
  if (write) {
    await Promise.all([
      writeFileImpl(ownerPath, rendered.ownerInputs, "utf8"),
      writeFileImpl(queuePath, rendered.qualityQueue, "utf8"),
    ]);
  }
  return {
    ownerGates: source.ownerGates.length,
    qualityRecords: source.qualityRecords.length,
    safetyFiles: safetyFiles.length,
  };
}

async function main() {
  const result = await checkEditorialRepository({
    write: process.argv.includes("--write"),
  });
  console.log(
    `Editorial QA: PASS (${result.ownerGates} owner gates; ${result.qualityRecords} quality records; ${result.safetyFiles} public-repository files passed the defined safety scan).`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `Editorial QA: FAIL\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

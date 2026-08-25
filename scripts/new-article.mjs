import { lstat, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { dump as dumpYaml } from "js-yaml";

import {
  parseArticleMarkdown,
  validateContentPortfolio,
} from "./qa-content.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const defaultArticlesDirectory = path.join(
  repositoryRoot,
  "src",
  "content",
  "articles",
);
const CANONICAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_TITLE_PATTERN =
  /\b(?:todo|tbd|changeme|placeholder|lorem ipsum|replace[-_ ]?me|your[-_ ]?(?:name|email|id))\b|(?:\b(?:ca-)?pub-\d{10,}\b|\bUA-\d{4,}-\d+\b|\bG-[A-Z0-9]{6,}\b|\bGTM-[A-Z0-9]{4,}\b)/i;
const RESERVED_FILE_STEMS = /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])$/i;
const DRAFT_BODY = `## Frame the decision

Describe the practical business-technology decision this guide will address. Add only claims that can be supported by reviewed evidence, and keep limitations explicit before changing the editorial status.
`;

export function parseNewArticleArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("Arguments must be supplied as an array.");
  }
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if ((name !== "--title" && name !== "--slug") || value === undefined) {
      throw new Error(
        'Usage: npm run new:article -- --title "Article title" [--slug canonical-slug]',
      );
    }
    const key = name.slice(2);
    if (Object.hasOwn(parsed, key)) {
      throw new Error(`Argument ${name} may be supplied only once.`);
    }
    parsed[key] = value;
  }
  if (!Object.hasOwn(parsed, "title")) {
    throw new Error(
      'Usage: npm run new:article -- --title "Article title" [--slug canonical-slug]',
    );
  }
  return parsed;
}

export function validateArticleTitle(value) {
  if (typeof value !== "string") {
    throw new TypeError("Article title must be a string.");
  }
  const title = value.trim();
  if (title.length < 10 || title.length > 100) {
    throw new Error("Article title must contain 10–100 trimmed characters.");
  }
  if (FORBIDDEN_TITLE_PATTERN.test(title)) {
    throw new Error(
      "Article title cannot contain editorial placeholders, advertising IDs, or analytics IDs.",
    );
  }
  return title;
}

export function slugifyArticleTitle(value) {
  if (typeof value !== "string") {
    throw new TypeError("Article title must be a string.");
  }
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function validateArticleSlug(value) {
  if (
    typeof value !== "string" ||
    value.length > 120 ||
    !CANONICAL_SLUG_PATTERN.test(value)
  ) {
    throw new Error(
      "Article slug must use 1–120 lowercase ASCII letters or numbers separated by single hyphens.",
    );
  }
  if (RESERVED_FILE_STEMS.test(value)) {
    throw new Error(`Article slug ${value} is reserved by the filesystem.`);
  }
  return value;
}

export function resolveArticleTarget(articlesDirectory, slug) {
  const validatedSlug = validateArticleSlug(slug);
  const resolvedDirectory = path.resolve(articlesDirectory);
  const fileName = `${validatedSlug}.md`;
  const target = path.resolve(resolvedDirectory, fileName);
  if (
    path.dirname(target) !== resolvedDirectory ||
    path.basename(target) !== fileName
  ) {
    throw new Error(
      "Article target must be a direct child of the article directory.",
    );
  }
  return target;
}

function isMissingPathError(error) {
  return error && typeof error === "object" && error.code === "ENOENT";
}

async function assertNoLinkedPathComponents(candidate) {
  const resolved = path.resolve(candidate);
  const { root } = path.parse(resolved);
  const parts = path.relative(root, resolved).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    const stats = await lstat(current);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Article path contains a symbolic link or junction: ${current}`,
      );
    }
  }
}

function assertCanonicalContainment(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} escapes its canonical article directory.`);
  }
}

export async function resolveSafeArticleTarget(articlesDirectory, slug) {
  const target = resolveArticleTarget(articlesDirectory, slug);
  const resolvedDirectory = path.resolve(articlesDirectory);
  await assertNoLinkedPathComponents(resolvedDirectory);
  const directoryStats = await lstat(resolvedDirectory);
  if (!directoryStats.isDirectory()) {
    throw new Error("Article directory must be an existing regular directory.");
  }
  const canonicalDirectory = await realpath(resolvedDirectory);
  const canonicalParent = await realpath(path.dirname(target));
  assertCanonicalContainment(
    canonicalDirectory,
    canonicalParent,
    "Article target parent",
  );

  try {
    const targetStats = await lstat(target);
    if (targetStats.isSymbolicLink()) {
      throw new Error(
        `Article target contains a symbolic link or junction: ${target}`,
      );
    }
    if (!targetStats.isFile()) {
      throw new Error(`Article target is not a regular file: ${target}`);
    }
    const canonicalTarget = await realpath(target);
    assertCanonicalContainment(
      canonicalDirectory,
      canonicalTarget,
      "Article target",
    );
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }
  return target;
}

function resolveDraftIdentity({ title: rawTitle, slug: rawSlug }) {
  const title = validateArticleTitle(rawTitle);
  const automaticSlug = slugifyArticleTitle(title);
  if (rawSlug === undefined && automaticSlug === "") {
    throw new Error(
      "Automatic ASCII slugification produced no valid slug; supply an explicit canonical --slug.",
    );
  }
  const slug = validateArticleSlug(rawSlug ?? automaticSlug);
  return { title, slug };
}

export function renderArticleDraft(input) {
  const { title, slug } = resolveDraftIdentity(input);
  const data = {
    title,
    slug,
    author: "Everyday Tech Insight",
    status: "draft",
    verificationStatus: "unverified",
    featured: false,
    relatedArticles: [],
    noindex: true,
  };
  const frontmatter = dumpYaml(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    sortKeys: false,
  }).trimEnd();
  const source = `---\n${frontmatter}\n---\n\n${DRAFT_BODY}`;
  const record = parseArticleMarkdown(source, `${slug}.md`);
  const articleFindings = validateContentPortfolio([record]).filter(
    (issue) => issue.file === record.fileName,
  );
  if (articleFindings.length > 0) {
    throw new Error(
      `Generated draft failed local content safety: ${articleFindings
        .map((issue) => `[${issue.code}] ${issue.message}`)
        .join("; ")}`,
    );
  }
  return source;
}

/**
 * @param {{ title: string, slug?: string, articlesDirectory?: string }} options
 */
export async function createArticleDraft({
  title,
  slug = undefined,
  articlesDirectory = defaultArticlesDirectory,
}) {
  const identity = resolveDraftIdentity({ title, slug });
  const target = await resolveSafeArticleTarget(
    articlesDirectory,
    identity.slug,
  );
  const source = renderArticleDraft(identity);
  try {
    await writeFile(target, source, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      throw new Error(
        `Refusing to overwrite existing article ${path.basename(target)}.`,
        { cause: error },
      );
    }
    throw error;
  }
  return target;
}

async function main() {
  const options = parseNewArticleArgs(process.argv.slice(2));
  const target = await createArticleDraft(options);
  console.log(`Created draft ${path.relative(repositoryRoot, target)}.`);
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

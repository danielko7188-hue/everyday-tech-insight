import path from "node:path";
import { fileURLToPath } from "node:url";

import { readArticleRecords } from "./qa-content.mjs";
import {
  parseManagedArticleImageUrl,
  scanManagedImagesInMarkdown,
} from "../src/utils/managed-article-images.mjs";

const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * @typedef {{
 *   primary: string | null;
 *   saasEvaluation: string | null;
 *   securityWorkflow: string | null;
 *   operationsArchitecture: string | null;
 *   strategyCost: string | null;
 *   backup: string | null;
 *   table: string | null;
 * }} RepresentativeArticlePaths
 */

/**
 * @typedef {{
 *   category: string;
 *   dateModified?: string;
 *   datePublished: string;
 *   path: string;
 *   slug: string;
 *   visual: { alt: string; caption?: string; key: string; type: string };
 * }} RepresentativeArticleDetails
 */

/**
 * @typedef {{
 *   primary: RepresentativeArticleDetails | null;
 *   saasEvaluation: RepresentativeArticleDetails | null;
 *   securityWorkflow: RepresentativeArticleDetails | null;
 *   operationsArchitecture: RepresentativeArticleDetails | null;
 *   strategyCost: RepresentativeArticleDetails | null;
 *   backup: RepresentativeArticleDetails | null;
 *   table: RepresentativeArticleDetails | null;
 * }} RepresentativeArticles
 */

export const REPRESENTATIVE_ARTICLE_SLOTS = Object.freeze([
  Object.freeze({ key: "primary", visualType: "decision-tree" }),
  Object.freeze({
    category: "business-software",
    key: "saasEvaluation",
    visualType: "checklist",
  }),
  Object.freeze({
    category: "cybersecurity-data-protection",
    key: "securityWorkflow",
    visualType: "workflow",
  }),
  Object.freeze({
    category: "digital-operations",
    key: "operationsArchitecture",
    visualType: "information-architecture",
  }),
  Object.freeze({
    category: "technology-strategy",
    key: "strategyCost",
    visualType: "cost-stack",
  }),
  Object.freeze({ key: "backup", visualType: "backup-topology" }),
]);

function articlePathForSlug(slug) {
  return `/articles/${slug}/`;
}

function assertCanonicalRecord(record) {
  const { data, fileName } = record;
  if (typeof data.slug !== "string" || !ARTICLE_SLUG_PATTERN.test(data.slug)) {
    throw new Error(`Article ${fileName} must have a canonical article slug.`);
  }
  if (typeof data.status !== "string") {
    throw new Error(
      `Article ${fileName} must have an explicit lifecycle status.`,
    );
  }
}

function managedImagePathsForArticle(article) {
  const paths = new Set();
  const { data, fileName } = article;
  if (data.heroImage !== undefined) {
    paths.add(parseManagedArticleImageUrl(data.heroImage, data.slug).publicUrl);
  }
  const bodyImages = scanManagedImagesInMarkdown(article.body ?? "", {
    articleSlug: data.slug,
    fileName,
  });
  if (bodyImages.findings.length > 0) {
    throw new Error(
      `Article ${fileName} has invalid managed image references: ${bodyImages.findings
        .map(({ code }) => code)
        .join(", ")}.`,
    );
  }
  for (const reference of bodyImages.references) paths.add(reference.publicUrl);
  return paths;
}

function hasMarkdownTable(body) {
  const lines = String(body ?? "").split(/\r?\n/);
  return lines.some((line, index) => {
    const separator = lines[index + 1] ?? "";
    return (
      line.includes("|") &&
      /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)\|?\s*$/.test(separator)
    );
  });
}

function representativeArticleDetails(article) {
  const { data } = article;
  return Object.freeze({
    category: data.category,
    ...(typeof data.dateModified === "string"
      ? { dateModified: data.dateModified }
      : {}),
    datePublished: data.datePublished,
    path: articlePathForSlug(data.slug),
    slug: data.slug,
    visual: Object.freeze({ ...data.visual }),
  });
}

function selectRepresentativeArticles(publishedRecords) {
  if (publishedRecords.length === 0) {
    const emptyPaths = Object.freeze({
      backup: null,
      operationsArchitecture: null,
      primary: null,
      saasEvaluation: null,
      securityWorkflow: null,
      strategyCost: null,
      table: null,
    });
    const emptyArticles = Object.freeze({ ...emptyPaths });
    return Object.freeze({ articles: emptyArticles, paths: emptyPaths });
  }
  const unused = new Set(publishedRecords.map(({ data }) => data.slug));
  const selected = /** @type {RepresentativeArticlePaths} */ ({});
  const selectedArticles = /** @type {RepresentativeArticles} */ ({});

  for (const slot of REPRESENTATIVE_ARTICLE_SLOTS) {
    const exact = publishedRecords.find(
      ({ data }) =>
        unused.has(data.slug) &&
        data.visual?.type === slot.visualType &&
        (slot.category === undefined || data.category === slot.category),
    );
    const sameCategory = publishedRecords.find(
      ({ data }) =>
        unused.has(data.slug) &&
        slot.category !== undefined &&
        data.category === slot.category,
    );
    const fallback =
      exact ??
      sameCategory ??
      publishedRecords.find(({ data }) => unused.has(data.slug)) ??
      publishedRecords[0];
    selected[slot.key] = articlePathForSlug(fallback.data.slug);
    selectedArticles[slot.key] = representativeArticleDetails(fallback);
    unused.delete(fallback.data.slug);
  }

  const tableArticle = publishedRecords.find(({ body }) =>
    hasMarkdownTable(body),
  );
  selected.table = tableArticle
    ? articlePathForSlug(tableArticle.data.slug)
    : null;
  selectedArticles.table = tableArticle
    ? representativeArticleDetails(tableArticle)
    : null;

  return Object.freeze({
    articles: Object.freeze(selectedArticles),
    paths: Object.freeze(selected),
  });
}

export function createPublicationRouteInventory(
  articleRecords,
  { requiredHistoricalPaths = [] } = {},
) {
  for (const record of articleRecords) assertCanonicalRecord(record);
  const historicalArticlePaths = articleRecords.map(({ data }) =>
    articlePathForSlug(data.slug),
  );
  if (new Set(historicalArticlePaths).size !== historicalArticlePaths.length) {
    throw new Error("Article source-history routes must be unique.");
  }
  const historicalPathSet = new Set(historicalArticlePaths);
  const missingHistoricalPaths = requiredHistoricalPaths.filter(
    (articlePath) => !historicalPathSet.has(articlePath),
  );
  if (missingHistoricalPaths.length > 0) {
    throw new Error(
      `Article source is missing historical article routes: ${missingHistoricalPaths.join(", ")}.`,
    );
  }

  const publishedRecords = articleRecords
    .filter(({ data }) => data.status === "published")
    .sort((left, right) => left.data.slug.localeCompare(right.data.slug, "en"));
  const archivedRecords = articleRecords
    .filter(({ data }) => data.status === "archived")
    .sort((left, right) => left.data.slug.localeCompare(right.data.slug, "en"));
  const publishedManagedImagePaths = new Set(
    publishedRecords.flatMap((article) => [
      ...managedImagePathsForArticle(article),
    ]),
  );
  const archivedManagedImagePaths = new Set(
    archivedRecords.flatMap((article) => [
      ...managedImagePathsForArticle(article),
    ]),
  );
  const representativeArticles = selectRepresentativeArticles(publishedRecords);

  return Object.freeze({
    archivedArticlePaths: Object.freeze(
      archivedRecords.map(({ data }) => articlePathForSlug(data.slug)),
    ),
    archivedOnlyManagedImagePaths: Object.freeze(
      [...archivedManagedImagePaths]
        .filter((imagePath) => !publishedManagedImagePaths.has(imagePath))
        .sort((left, right) => left.localeCompare(right, "en")),
    ),
    historicalArticlePaths: Object.freeze(
      [...historicalArticlePaths].sort((left, right) =>
        left.localeCompare(right, "en"),
      ),
    ),
    publishedArticlePaths: Object.freeze(
      publishedRecords.map(({ data }) => articlePathForSlug(data.slug)),
    ),
    representativeArticlePaths: representativeArticles.paths,
    representativeArticles: representativeArticles.articles,
  });
}

export async function derivePublicationRouteInventory(
  articlesDirectory = path.join(repositoryRoot, "src", "content", "articles"),
  options = {},
) {
  return createPublicationRouteInventory(
    await readArticleRecords(articlesDirectory),
    options,
  );
}

export async function derivePublishedArticlePaths(
  articlesDirectory = path.join(repositoryRoot, "src", "content", "articles"),
  options = {},
) {
  return (await derivePublicationRouteInventory(articlesDirectory, options))
    .publishedArticlePaths;
}

export const CURRENT_PUBLICATION_ROUTE_INVENTORY =
  await derivePublicationRouteInventory();
export const REPRESENTATIVE_ARTICLE_PATHS =
  CURRENT_PUBLICATION_ROUTE_INVENTORY.representativeArticlePaths;
export const REPRESENTATIVE_ARTICLES =
  CURRENT_PUBLICATION_ROUTE_INVENTORY.representativeArticles;

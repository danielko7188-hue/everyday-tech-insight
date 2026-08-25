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
 *   primary: string;
 *   saasEvaluation: string;
 *   securityWorkflow: string;
 *   operationsArchitecture: string;
 *   strategyCost: string;
 *   backup: string;
 * }} RepresentativeArticlePaths
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

function selectRepresentativeArticlePaths(publishedRecords) {
  if (publishedRecords.length === 0) {
    throw new Error(
      "Representative verification requires at least one published article.",
    );
  }
  const unused = new Set(publishedRecords.map(({ data }) => data.slug));
  const selected = /** @type {RepresentativeArticlePaths} */ ({});

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
    unused.delete(fallback.data.slug);
  }

  return Object.freeze(selected);
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
    representativeArticlePaths:
      selectRepresentativeArticlePaths(publishedRecords),
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

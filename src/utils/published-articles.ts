import type { CollectionEntry } from "astro:content";

import type {
  ArticleFrontmatter,
  PublishedArticleFrontmatter as ContractPublishedArticleFrontmatter,
} from "./content-contract";

export type PublishedArticleFrontmatter = ContractPublishedArticleFrontmatter;
export type PublishedArticleEntry = CollectionEntry<"articles"> & {
  data: PublishedArticleFrontmatter;
};

type EntryWithStatus = {
  data: ArticleFrontmatter;
};

export function isPublishedArticle<T extends EntryWithStatus>(
  article: T,
): article is T & { data: PublishedArticleFrontmatter } {
  return article.data.status === "published";
}

export function filterPublishedArticles<T extends EntryWithStatus>(
  articles: readonly T[],
): Array<T & { data: PublishedArticleFrontmatter }> {
  return articles.filter(isPublishedArticle);
}

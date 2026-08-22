export interface CategoryEdition<T> {
  lead: T | undefined;
  features: T[];
  remainder: T[];
}

export function partitionCategoryEdition<T>(
  articles: readonly T[],
): CategoryEdition<T> {
  return {
    lead: articles[0],
    features: articles.slice(1, 3),
    remainder: articles.slice(3),
  };
}

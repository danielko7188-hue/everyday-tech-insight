export type CategoryLayout = "compact" | "editorial" | "archive";

export type CategoryEdition<T> =
  | {
      layout: "compact";
      articles: T[];
    }
  | {
      layout: "editorial";
      lead: T;
      features: T[];
      remainder: T[];
    }
  | {
      layout: "archive";
      featured: T[];
      recent: T[];
      archive: T[];
    };

export function selectCategoryLayout(count: number): CategoryLayout {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Category article count must be a non-negative integer.");
  }
  if (count < 6) return "compact";
  if (count < 12) return "editorial";
  return "archive";
}

export function partitionCategoryEdition<T>(
  articles: readonly T[],
): CategoryEdition<T> {
  const layout = selectCategoryLayout(articles.length);

  if (layout === "compact") {
    return { layout, articles: [...articles] };
  }
  if (layout === "editorial") {
    return {
      layout,
      lead: articles[0]!,
      features: articles.slice(1, 3),
      remainder: articles.slice(3),
    };
  }
  return {
    layout,
    featured: articles.slice(0, 3),
    recent: articles.slice(3, 6),
    archive: articles.slice(6),
  };
}

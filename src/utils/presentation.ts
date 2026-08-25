const DEFAULT_WORDS_PER_MINUTE = 225;

export type StoryTreatment =
  "lead" | "feature" | "standard" | "compact" | "list";

export interface StoryTreatmentContract {
  compactMeta: boolean;
  showDeliverable: boolean;
  showFullMeta: boolean;
  showPromise: boolean;
  showVisual: boolean;
}

const storyTreatments = {
  lead: {
    compactMeta: false,
    showDeliverable: true,
    showFullMeta: true,
    showPromise: true,
    showVisual: true,
  },
  feature: {
    compactMeta: false,
    showDeliverable: false,
    showFullMeta: false,
    showPromise: true,
    showVisual: true,
  },
  standard: {
    compactMeta: false,
    showDeliverable: false,
    showFullMeta: true,
    showPromise: true,
    showVisual: true,
  },
  compact: {
    compactMeta: true,
    showDeliverable: false,
    showFullMeta: false,
    showPromise: true,
    showVisual: false,
  },
  list: {
    compactMeta: true,
    showDeliverable: false,
    showFullMeta: false,
    showPromise: true,
    showVisual: false,
  },
} as const satisfies Record<StoryTreatment, StoryTreatmentContract>;

export function resolveStoryTreatment(
  treatment: StoryTreatment,
): StoryTreatmentContract {
  return storyTreatments[treatment];
}

function markdownToReadableText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, " ")
    .replace(/<https?:\/\/[^>]+>/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_~#>|]/g, " ")
    .replace(/^\s*(?:[-+]\s+|\d+[.)]\s+)/gm, " ");
}

export function estimateReadingTime(
  markdown: string,
  wordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
): number {
  const readingRate =
    Number.isFinite(wordsPerMinute) && wordsPerMinute > 0
      ? wordsPerMinute
      : DEFAULT_WORDS_PER_MINUTE;
  const words = markdownToReadableText(markdown).match(
    /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu,
  );

  return Math.max(1, Math.ceil((words?.length ?? 0) / readingRate));
}

export interface PublicationDateFormatOptions {
  timeZone: string;
  compact?: boolean;
  locale?: string;
}

export function formatPublicationDate(
  publicationDate: string,
  { timeZone, compact = false, locale = "en-US" }: PublicationDateFormatOptions,
): string {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(publicationDate);
  const date = new Date(
    isDateOnly ? `${publicationDate}T00:00:00Z` : publicationDate,
  );

  if (Number.isNaN(date.valueOf())) {
    return publicationDate;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: compact ? "short" : "long",
    day: "numeric",
    timeZone: isDateOnly ? "UTC" : timeZone,
  }).format(date);
}

export function visualVariantForSlug(slug: string, range: number): number {
  if (!Number.isSafeInteger(range) || range <= 0) {
    return 0;
  }

  let hash = 2_166_136_261;

  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) % range;
}

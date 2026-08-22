const DEFAULT_WORDS_PER_MINUTE = 225;

function markdownToReadableText(markdown: string): string {
  return markdown
    .replace(/^---\s*$[\s\S]*?^---\s*$/m, " ")
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

import { categorySlugs, type CategorySlug } from "./categories";

// Presentation-only artwork. Article visual metadata continues to describe
// the informative diagram in the guide itself.
const widths = [480, 960, 1536] as const;

interface EditorialCoverRecord {
  src: string;
  avifSrcSet: string;
  webpSrcSet: string;
  width: number;
  height: number;
  credit: string;
}

export const editorialCovers = Object.fromEntries(
  categorySlugs.map((category) => [
    category,
    {
      src: `/images/editorial/${category}-960.webp`,
      avifSrcSet: widths
        .map((width) => `/images/editorial/${category}-${width}.avif ${width}w`)
        .join(", "),
      webpSrcSet: widths
        .map((width) => `/images/editorial/${category}-${width}.webp ${width}w`)
        .join(", "),
      width: 1536,
      height: 1024,
      credit: "AI-generated editorial illustration",
    },
  ]),
) as Record<CategorySlug, EditorialCoverRecord>;

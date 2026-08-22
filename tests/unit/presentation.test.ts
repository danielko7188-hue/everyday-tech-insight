import { describe, expect, it } from "vitest";

import {
  estimateReadingTime,
  formatPublicationDate,
  visualVariantForSlug,
} from "../../src/utils/presentation";

describe("estimateReadingTime", () => {
  it("returns a one-minute minimum for empty content", () => {
    expect(estimateReadingTime("")).toBe(1);
  });

  it("rounds 225 words to one minute", () => {
    expect(estimateReadingTime(Array(225).fill("word").join(" "))).toBe(1);
  });

  it("rounds 226 words up to two minutes", () => {
    expect(estimateReadingTime(Array(226).fill("word").join(" "))).toBe(2);
  });

  it("does not count Markdown syntax or link destinations as words", () => {
    const prose = Array(223).fill("word").join(" ");
    const markdown = `${prose}\n> **final** [source](https://example.com/a/long/path)`;

    expect(estimateReadingTime(markdown)).toBe(1);
  });

  it("preserves article-body text between thematic breaks", () => {
    const firstSection = Array(225).fill("first").join(" ");
    const secondSection = Array(225).fill("second").join(" ");
    const markdown = `${firstSection}\n\n---\n\n${secondSection}\n\n---`;

    expect(estimateReadingTime(markdown)).toBe(2);
  });
});

describe("visualVariantForSlug", () => {
  it("returns a stable integer inside the requested range", () => {
    const first = visualVariantForSlug("evaluate-saas", 5);
    const second = visualVariantForSlug("evaluate-saas", 5);

    expect(second).toBe(first);
    expect(Number.isInteger(first)).toBe(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(5);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns zero for the invalid range %s",
    (range) => {
      expect(visualVariantForSlug("evaluate-saas", range)).toBe(0);
    },
  );
});

describe("formatPublicationDate", () => {
  const publicationOptions = {
    timeZone: "America/Los_Angeles",
  } as const;

  it("formats a date-only value without a timezone shift", () => {
    expect(formatPublicationDate("2026-08-21", publicationOptions)).toBe(
      "August 21, 2026",
    );
  });

  it("formats a timestamp in the publication timezone", () => {
    expect(
      formatPublicationDate("2026-08-21T23:30:00Z", publicationOptions),
    ).toBe("August 21, 2026");
  });
});

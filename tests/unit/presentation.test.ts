import { describe, expect, it } from "vitest";

import {
  estimateReadingTime,
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

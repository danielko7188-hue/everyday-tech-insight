import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SOCIAL_IMAGE_RECORDS } from "../../scripts/generate-social-images.mjs";
import { categories, categoryAccents } from "../../src/data/categories";

describe("Apple editorial palette parity", () => {
  it("keeps all five named topics without retired category colors", () => {
    expect(categories).toHaveLength(5);
    expect(new Set(categories.map(({ slug }) => slug)).size).toBe(5);
    expect(Object.values(categoryAccents)).toEqual(Array(5).fill("#0066cc"));
    for (const category of categories) {
      expect(category.accent).toBe("#0066cc");
      expect(category.name.length).toBeGreaterThan(5);
      expect(category.description.length).toBeGreaterThan(30);
    }
  });

  it("uses the same blue family in every generated sharing preview", () => {
    expect(SOCIAL_IMAGE_RECORDS.length).toBeGreaterThanOrEqual(6);
    for (const record of SOCIAL_IMAGE_RECORDS) {
      expect(record.accent, record.fileName).toBe("#0066cc");
    }
  });

  it("removes retired decorative hues from the active token source", () => {
    const css = readFileSync(
      join(process.cwd(), "src/styles/global.css"),
      "utf8",
    );
    expect(css).toMatch(/--brand-visited:\s*#004080;/);
    for (const hue of ["#6e3cbc", "#216e4e", "#9a4a00", "#4141a5", "#663b80"]) {
      expect(css.toLowerCase()).not.toContain(hue);
    }
  });
});

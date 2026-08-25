import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EDITORIAL_VISUAL_KEYS,
  EDITORIAL_VISUAL_TYPE_BY_KEY,
} from "../../src/utils/content-contract";

const visualSource = readFileSync(
  join(process.cwd(), "src", "components", "EditorialVisual.astro"),
  "utf8",
);
const symbolSource = readFileSync(
  join(process.cwd(), "src", "components", "EditorialVisualSymbols.astro"),
  "utf8",
);

describe("Purple Signal editorial visuals", () => {
  it("defines exactly 15 typed and structurally distinct story symbols", () => {
    expect(EDITORIAL_VISUAL_KEYS).toHaveLength(15);
    expect(new Set(EDITORIAL_VISUAL_KEYS).size).toBe(15);
    expect(Object.keys(EDITORIAL_VISUAL_TYPE_BY_KEY).sort()).toEqual(
      [...EDITORIAL_VISUAL_KEYS].sort(),
    );

    const symbolBodies = new Map<string, string>();
    for (const key of EDITORIAL_VISUAL_KEYS) {
      expect(symbolSource, key).toContain(`<symbol id="${key}"`);
      const body = symbolSource.match(
        new RegExp(`<symbol id="${key}"[\\s\\S]*?<\\/symbol>`),
      )?.[0];
      expect(body, `${key} symbol body`).toBeDefined();
      expect(body?.length ?? 0, `${key} explanatory structure`).toBeGreaterThan(
        300,
      );
      symbolBodies.set(key, body ?? "");
    }
    expect(new Set(symbolBodies.values()).size).toBe(15);
  });

  it("keeps informative visuals named and category motifs decorative", () => {
    expect(visualSource).toContain('role="img"');
    expect(visualSource).toContain("aria-labelledby");
    expect(visualSource).toContain("<title");
    expect(visualSource).toContain("<desc");
    expect(visualSource).toContain('aria-hidden="true"');
    expect(visualSource).toContain("data-visual-type");
  });

  it("uses Purple Signal surfaces and meaningful boundaries, not retired colors", () => {
    const source = `${visualSource}\n${symbolSource}`.toLowerCase();
    expect(source).toContain("var(--brand-boundary");
    expect(source).toContain("var(--brand-paper");
    for (const retired of ["#d84a2f", "#fffdf8", "#171918", "#c9c5ba"]) {
      expect(source).not.toContain(retired);
    }
  });
});

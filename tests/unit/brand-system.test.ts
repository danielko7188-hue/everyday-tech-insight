import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { categoryAccents } from "../../src/data/categories";

const css = readFileSync(
  join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

const requiredTokens = {
  "--brand-night": "#0d0618",
  "--brand-deep": "#17102a",
  "--brand-surface-dark": "#24143d",
  "--brand-ink": "#171221",
  "--brand-paper": "#faf8ff",
  "--brand-mist": "#f4f0ff",
  "--brand-white": "#ffffff",
  "--brand-violet": "#7c3aed",
  "--brand-violet-dark": "#5b21b6",
  "--brand-violet-light": "#a78bfa",
  "--brand-lavender": "#c4b5fd",
  "--brand-magenta": "#d946ef",
  "--brand-pink": "#ec4899",
  "--brand-rule-light": "#ddd6fe",
  "--brand-rule-dark": "#3a2e51",
  "--brand-boundary": "#756884",
  "--brand-text-muted-light": "#5b5566",
  "--brand-text-muted-dark": "#c9c3d8",
  "--brand-focus-dark": "#fde047",
  "--brand-focus-light": "#5b21b6",
  "--brand-error": "#b42318",
  "--brand-success": "#166534",
} as const;

const requiredCategoryAccents = {
  "ai-automation": "#6d28d9",
  "business-software": "#4338ca",
  "cybersecurity-data-protection": "#a21caf",
  "digital-operations": "#5b21b6",
  "technology-strategy": "#be185d",
} as const;

function channel(value: string): number {
  const normalized = Number.parseInt(value, 16) / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  return (
    channel(value.slice(0, 2)) * 0.2126 +
    channel(value.slice(2, 4)) * 0.7152 +
    channel(value.slice(4, 6)) * 0.0722
  );
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("Purple Signal brand system", () => {
  it("defines the approved exact token contract and limited gradient", () => {
    for (const [name, value] of Object.entries(requiredTokens)) {
      expect(css, name).toMatch(
        new RegExp(`${name}\\s*:\\s*${value.replace("#", "\\#")}\\s*;`, "i"),
      );
    }

    expect(css).toMatch(
      /--brand-gradient\s*:\s*linear-gradient\(\s*135deg,\s*#7c3aed 0%,\s*#a855f7 48%,\s*#d946ef 100%\s*\)/i,
    );
    expect(
      (css.match(/var\(--brand-gradient\)/g) ?? []).length,
    ).toBeLessThanOrEqual(8);
  });

  it("uses the coherent category family", () => {
    expect(categoryAccents).toEqual(requiredCategoryAccents);
  });

  it("records passing and deliberately prohibited contrast pairings", () => {
    const passingPairs = [
      ["#ffffff", "#0d0618", 7],
      ["#ffffff", "#7c3aed", 4.5],
      ["#c4b5fd", "#0d0618", 7],
      ["#c9c3d8", "#24143d", 4.5],
      ["#171221", "#faf8ff", 7],
      ["#5b5566", "#faf8ff", 4.5],
      ["#5b21b6", "#faf8ff", 4.5],
      ["#171221", "#d946ef", 4.5],
      ["#fde047", "#0d0618", 3],
    ] as const;

    for (const [foreground, background, threshold] of passingPairs) {
      expect(
        contrast(foreground, background),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(threshold);
    }

    expect(contrast("#ffffff", "#d946ef")).toBeLessThan(4.5);
    expect(contrast("#fde047", "#faf8ff")).toBeLessThan(3);
  });

  it("provides contextual focus and reduced-motion contracts", () => {
    expect(css).toMatch(
      /\.surface-dark[\s\S]*:focus-visible[\s\S]*--brand-focus-dark/,
    );
    expect(css).toMatch(
      /\.surface-light[\s\S]*:focus-visible[\s\S]*--brand-focus-light/,
    );
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it("removes the retired orange and beige visual palette", () => {
    for (const retired of [
      "#d84a2f",
      "#8f2f20",
      "#f2b134",
      "#f2efe7",
      "#fffdf8",
      "#c9c5ba",
    ]) {
      expect(css.toLowerCase()).not.toContain(retired);
    }
  });
});

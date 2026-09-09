import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { categoryAccents } from "../../src/data/categories";

const css = ["global.css", "apple-editorial.css"]
  .map((file) =>
    readFileSync(join(process.cwd(), "src", "styles", file), "utf8"),
  )
  .join("\n");

const source = (path: string) =>
  readFileSync(join(process.cwd(), ...path.split("/")), "utf8");

const requiredTokens = {
  "--brand-night": "#1d1d1f",
  "--brand-deep": "#242426",
  "--brand-surface-dark": "#343436",
  "--brand-ink": "#1d1d1f",
  "--brand-paper": "#ffffff",
  "--brand-mist": "#f5f5f7",
  "--brand-white": "#ffffff",
  "--brand-accent": "#0066cc",
  "--brand-violet": "#0066cc",
  "--brand-violet-dark": "#0055aa",
  "--brand-violet-light": "#9ac8ff",
  "--brand-lavender": "#d7eaff",
  "--brand-magenta": "#0066cc",
  "--brand-pink": "#0066cc",
  "--brand-rule-light": "#d2d2d7",
  "--brand-rule-dark": "#515154",
  "--brand-boundary": "#86868b",
  "--brand-text-muted-light": "#515154",
  "--brand-text-muted-dark": "#d2d2d7",
  "--brand-focus-dark": "#9ac8ff",
  "--brand-focus-light": "#0066cc",
  "--brand-error": "#b42318",
  "--brand-success": "#166534",
} as const;

const requiredCategoryAccents = {
  "ai-automation": "#0066cc",
  "business-software": "#0066cc",
  "cybersecurity-data-protection": "#0066cc",
  "digital-operations": "#0066cc",
  "technology-strategy": "#0066cc",
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

describe("Apple editorial brand system", () => {
  it("defines the neutral surface and restrained blue action token contract", () => {
    for (const [name, value] of Object.entries(requiredTokens)) {
      expect(css, name).toMatch(
        new RegExp(`${name}\\s*:\\s*${value.replace("#", "\\#")}\\s*;`, "i"),
      );
    }

    expect(css).not.toMatch(/--brand-gradient\s*:|var\(--brand-gradient\)/i);
    expect(css).toMatch(
      /--font-body\s*:\s*-apple-system,\s*BlinkMacSystemFont/,
    );
    expect(css).toMatch(/--font-display\s*:\s*var\(--font-body\)/);
    expect(css).not.toMatch(/font-family:\s*"Newsreader Variable"/);
    expect(source("src/layouts/BaseLayout.astro")).toMatch(
      /import "\.\.\/styles\/global\.css";\s*import "\.\.\/styles\/apple-editorial\.css";/,
    );
  });

  it("uses the coherent category family", () => {
    expect(categoryAccents).toEqual(requiredCategoryAccents);
  });

  it("records passing and deliberately prohibited contrast pairings", () => {
    const passingPairs = [
      ["#1d1d1f", "#ffffff", 7],
      ["#1d1d1f", "#f5f5f7", 7],
      ["#515154", "#ffffff", 4.5],
      ["#515154", "#f5f5f7", 4.5],
      ["#0066cc", "#ffffff", 4.5],
      ["#0066cc", "#f5f5f7", 4.5],
      ["#ffffff", "#0066cc", 4.5],
      ["#004080", "#ffffff", 4.5],
      ["#004080", "#f5f5f7", 4.5],
      ["#d2d2d7", "#343436", 4.5],
      ["#9ac8ff", "#343436", 3],
    ] as const;

    for (const [foreground, background, threshold] of passingPairs) {
      expect(
        contrast(foreground, background),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(threshold);
    }

    for (const accent of Object.values(requiredCategoryAccents)) {
      expect(contrast(accent, "#ffffff"), accent).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast("#d2d2d7", "#ffffff")).toBeLessThan(4.5);
    expect(contrast("#9ac8ff", "#ffffff")).toBeLessThan(3);
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

  it("defines the semantic 4px-derived spatial spacing contract", () => {
    const semanticSpacing = {
      "--space-section-mobile": "var\\(--space-12\\)",
      "--space-section-tablet": "var\\(--space-16\\)",
      "--space-section-wide": "var\\(--space-20\\)",
      "--space-heading-body": "var\\(--space-6\\)",
      "--space-card-major": "var\\(--space-6\\)",
      "--space-card-compact": "var\\(--space-5\\)",
      "--space-grid-standard": "var\\(--space-6\\)",
      "--space-grid-compact": "var\\(--space-4\\)",
    } as const;

    for (const [name, value] of Object.entries(semanticSpacing)) {
      expect(css, name).toMatch(new RegExp(`${name}\\s*:\\s*${value}\\s*;`));
    }
  });

  it("uses native static-first spatial motion with complete fallback controls", () => {
    expect(css).toMatch(
      /@view-transition\s*\{\s*navigation\s*:\s*auto\s*;\s*\}/,
    );
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*no-preference\)/);
    expect(css).toMatch(/@supports\s*\(animation-timeline:\s*scroll\(\)\)/);
    expect(css).toMatch(/@supports\s*\(animation-timeline:\s*view\(\)\)/);
    expect(css).toMatch(/@media[^{}]*\(prefers-reduced-data:\s*reduce\)/);
    expect(css).toMatch(/@media[^{}]*\(pointer:\s*coarse\)/);
    expect(css).toMatch(/@media[^{}]*\(update:\s*slow\)/);
    expect(css).not.toMatch(
      /animation(?:-iteration-count)?\s*:[^;]*\binfinite\b/i,
    );

    const noPreferenceBlock = css.match(
      /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[\s\S]*?(?=\n@media|\s*$)/,
    )?.[0];
    expect(noPreferenceBlock).toBeTruthy();
    expect(noPreferenceBlock).toMatch(/::view-transition-old\(root\)/);
    expect(noPreferenceBlock).toMatch(/::view-transition-new\(root\)/);
    expect(noPreferenceBlock).toMatch(/200ms/);
  });

  it("keeps spatial components local, inert, and free of executable scripts", () => {
    for (const path of [
      "src/components/SignalField.astro",
      "src/components/ReadingProgress.astro",
      "src/components/ToolkitStructurePreview.astro",
    ]) {
      const component = source(path);
      expect(component, path).not.toMatch(/<script(?:\s|>)/i);
      expect(component, path).not.toMatch(
        /ClientRouter|three|webgl|lenis|motion/i,
      );
    }

    const signal = source("src/components/SignalField.astro");
    expect(signal).toContain("data-signal-field");
    expect(signal).not.toContain("data-editorial-visual");
    expect(signal).not.toMatch(/<use(?:\s|>)/i);
  });

  it("removes the retired orange, beige, and dominant purple visual palettes", () => {
    for (const retired of [
      "#d84a2f",
      "#8f2f20",
      "#f2b134",
      "#f2efe7",
      "#fffdf8",
      "#c9c5ba",
      "#0d0618",
      "#7c3aed",
      "#d946ef",
      "#faf8ff",
    ]) {
      expect(css.toLowerCase()).not.toContain(retired);
    }
  });
});

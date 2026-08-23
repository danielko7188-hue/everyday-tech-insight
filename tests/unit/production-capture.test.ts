import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CAPTURE_ROUTES,
  CAPTURE_WIDTHS,
  buildCapturePlan,
  normalizeCaptureOrigin,
  parseCaptureOrigin,
} from "../../scripts/capture-production-screenshots.mjs";

describe("production screenshot capture contract", () => {
  it("defines the original eight audited routes", () => {
    expect(CAPTURE_ROUTES).toEqual([
      { alias: "home", path: "/", status: 200 },
      {
        alias: "category",
        path: "/categories/cybersecurity-data-protection/",
        status: 200,
      },
      {
        alias: "article",
        path: "/articles/back-up-business-files-with-the-3-2-1-method/",
        status: 200,
      },
      { alias: "toolkit", path: "/toolkit/", status: 200 },
      { alias: "about", path: "/about/", status: 200 },
      {
        alias: "editorial-standards",
        path: "/editorial-standards/",
        status: 200,
      },
      { alias: "contact", path: "/contact/", status: 200 },
      {
        alias: "404",
        path: "/publication-after-capture-route-that-does-not-exist/",
        status: 404,
      },
    ]);
    expect(CAPTURE_WIDTHS).toEqual([390, 768, 1440]);
  });

  it("builds exactly 48 unique, deterministic output names", () => {
    const plan = buildCapturePlan("https://publication.example");
    const fileNames = plan.map(({ fileName }) => fileName);

    expect(plan).toHaveLength(48);
    expect(new Set(fileNames).size).toBe(48);
    expect(fileNames).toEqual([
      ...CAPTURE_WIDTHS.flatMap((width) =>
        CAPTURE_ROUTES.flatMap(({ alias }) => [
          `${width}-${alias}-above-fold.png`,
          `${width}-${alias}-full.png`,
        ]),
      ),
    ]);
    expect(plan.every(({ height }) => height === 900)).toBe(true);
    expect(plan.every(({ deviceScaleFactor }) => deviceScaleFactor === 1)).toBe(
      true,
    );
    expect(plan[0]?.url).toBe("https://publication.example/");
    expect(plan.at(-1)?.url).toBe(
      "https://publication.example/publication-after-capture-route-that-does-not-exist/",
    );
  });

  it("accepts only an explicit canonical HTTPS origin", () => {
    expect(normalizeCaptureOrigin("https://publication.example")).toBe(
      "https://publication.example",
    );
    expect(normalizeCaptureOrigin("https://publication.example/")).toBe(
      "https://publication.example",
    );

    for (const candidate of [
      "",
      " https://publication.example",
      "http://publication.example",
      "https://user:secret@publication.example",
      "https://publication.example/path",
      "https://publication.example/a/..",
      "https://publication.example/?",
      "https://publication.example/#",
      "publication.example",
    ]) {
      expect(() => normalizeCaptureOrigin(candidate)).toThrow(/HTTPS origin/i);
    }
  });

  it("requires exactly one --origin CLI option", () => {
    expect(
      parseCaptureOrigin(["--origin", "https://publication.example/"]),
    ).toBe("https://publication.example");
    expect(() => parseCaptureOrigin([])).toThrow(/--origin/i);
    expect(() => parseCaptureOrigin(["--origin"])).toThrow(/--origin/i);
    expect(() =>
      parseCaptureOrigin([
        "--origin",
        "https://one.example",
        "--origin",
        "https://two.example",
      ]),
    ).toThrow(/exactly one/i);
    expect(() =>
      parseCaptureOrigin([
        "--origin",
        "https://publication.example",
        "--output",
        "elsewhere",
      ]),
    ).toThrow(/unexpected/i);
  });

  it("exposes the capture command through the package scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["capture:production"]).toBe(
      "node scripts/capture-production-screenshots.mjs",
    );
  });
});

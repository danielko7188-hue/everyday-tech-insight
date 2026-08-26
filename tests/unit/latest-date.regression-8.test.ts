import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as presentation from "../../src/utils/presentation";

type LatestDateApi = {
  resolveStoryDate?: (
    dates: { datePublished: string; dateModified?: string },
    mode: "published" | "latest",
  ) => { date: string; label?: string };
};

const api = presentation as LatestDateApi;

describe("ISSUE-008 Latest guide date presentation", () => {
  it("labels a substantive modification as the event that made a guide latest", () => {
    expect(api.resolveStoryDate).toBeTypeOf("function");
    if (!api.resolveStoryDate) return;

    expect(
      api.resolveStoryDate(
        { datePublished: "2026-08-21", dateModified: "2026-08-25" },
        "latest",
      ),
    ).toEqual({ date: "2026-08-25", label: "Updated" });
    expect(
      api.resolveStoryDate({ datePublished: "2026-08-24" }, "latest"),
    ).toEqual({ date: "2026-08-24", label: "Published" });
  });

  it("opts the homepage Latest module into latest-event labeling", () => {
    const homepage = readFileSync(
      new URL("../../src/pages/index.astro", import.meta.url),
      "utf8",
    );

    expect(homepage).toMatch(
      /briefingArticles\.map[\s\S]*?<ArticleCard[\s\S]*?dateMode="latest"/,
    );
  });
});

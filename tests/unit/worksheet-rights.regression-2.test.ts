import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("ISSUE-002 worksheet rights boundary", () => {
  it("does not present unresolved worksheet ownership as first-party fact", () => {
    const publicAndCurrentDocumentation = [
      source("../../src/pages/toolkit.astro"),
      source("../../README.md"),
      source("../../docs/ADSENSE_READINESS_AUDIT_2026-08-22.md"),
    ].join("\n");

    expect(publicAndCurrentDocumentation).not.toMatch(
      /first-party[^\n]{0,80}worksheet|worksheet[^\n]{0,80}first-party/i,
    );
    expect(source("../../src/pages/toolkit.astro")).toContain(
      "Four blank worksheets",
    );
  });
});

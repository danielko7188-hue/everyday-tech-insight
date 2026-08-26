import { readFileSync } from "node:fs";

import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

type CmsField = {
  name: string;
  label?: string;
  readonly?: boolean;
  default?: unknown;
  description?: string;
};

type CmsConfig = {
  content: Array<{ fields: CmsField[] }>;
};

describe("ISSUE-007 featured metadata CMS contract", () => {
  it("lets editors control homepage featured selection with truthful guidance", () => {
    const config = load(
      readFileSync(new URL("../../.pages.yml", import.meta.url), "utf8"),
    ) as CmsConfig;
    const featured = config.content[0]!.fields.find(
      ({ name }) => name === "featured",
    );

    expect(featured).toMatchObject({
      label: "Feature on homepage",
      default: false,
    });
    expect(featured?.readonly).not.toBe(true);
    expect(featured?.description).toMatch(/three.*published.*homepage/i);
    expect(featured?.description).not.toMatch(/does not control/i);
  });
});

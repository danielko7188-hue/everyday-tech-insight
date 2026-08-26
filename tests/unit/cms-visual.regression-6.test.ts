import { readFileSync } from "node:fs";

import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

type CmsField = {
  name: string;
  readonly?: boolean;
  default?: unknown;
  description?: string;
  fields?: CmsField[];
};

type CmsConfig = {
  content: Array<{ fields: CmsField[] }>;
};

describe("ISSUE-006 CMS editorial-visual semantics", () => {
  it("does not offer a decorative state that the publication contract rejects", () => {
    const config = load(
      readFileSync(new URL("../../.pages.yml", import.meta.url), "utf8"),
    ) as CmsConfig;
    const articleFields = config.content[0]!.fields;
    const visual = articleFields.find(({ name }) => name === "visual")!;
    const decorative = visual.fields!.find(({ name }) => name === "decorative");

    expect(decorative).toMatchObject({ readonly: true, default: false });
    expect(decorative?.description).toMatch(/informative/i);
  });
});

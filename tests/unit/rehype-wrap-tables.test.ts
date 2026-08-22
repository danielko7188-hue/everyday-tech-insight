import { describe, expect, it } from "vitest";

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
};

const loadTransformer = async () => {
  const modulePath = "../../src/utils/rehype-wrap-tables.mjs";
  const module = await import(modulePath);
  return module.default() as (tree: HastNode) => void;
};

describe("rehypeWrapTables", () => {
  it("wraps every nested table once without changing its subtree", async () => {
    const firstTable: HastNode = {
      type: "element",
      tagName: "table",
      properties: { className: ["comparison"] },
      children: [
        {
          type: "element",
          tagName: "tbody",
          children: [
            {
              type: "element",
              tagName: "tr",
              children: [{ type: "text", value: "Preserved cell" }],
            },
          ],
        },
      ],
    };
    const secondTable: HastNode = {
      type: "element",
      tagName: "table",
      properties: { dataSource: "markdown" },
      children: [],
    };
    const tree: HastNode = {
      type: "root",
      children: [
        { type: "text", value: "Before" },
        firstTable,
        {
          type: "element",
          tagName: "section",
          children: [{ type: "text", value: "Middle" }, secondTable],
        },
        { type: "text", value: "After" },
      ],
    };

    const transform = await loadTransformer();
    transform(tree);
    transform(tree);

    const outerWrapper = tree.children?.[1];
    const nestedWrapper = tree.children?.[2]?.children?.[1];
    for (const wrapper of [outerWrapper, nestedWrapper]) {
      expect(wrapper).toMatchObject({
        type: "element",
        tagName: "div",
        properties: {
          className: ["table-scroll"],
          dataHorizontalScroll: "",
          tabIndex: 0,
          role: "region",
          ariaLabel: "Scrollable data table",
        },
      });
      expect(wrapper?.children).toHaveLength(1);
      expect(wrapper?.children?.[0]?.tagName).toBe("table");
    }

    expect(outerWrapper?.children?.[0]).toBe(firstTable);
    expect(nestedWrapper?.children?.[0]).toBe(secondTable);
    expect(firstTable.properties).toEqual({ className: ["comparison"] });
    expect(firstTable.children?.[0]?.children?.[0]?.children?.[0]?.value).toBe(
      "Preserved cell",
    );
    expect(tree.children?.map((child) => child.value ?? child.tagName)).toEqual(
      ["Before", "div", "section", "After"],
    );
  });

  it("leaves a tree without tables unchanged", async () => {
    const tree: HastNode = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          properties: { className: ["lede"] },
          children: [{ type: "text", value: "No table here" }],
        },
      ],
    };
    const before = structuredClone(tree);

    const transform = await loadTransformer();
    transform(tree);

    expect(tree).toEqual(before);
  });
});

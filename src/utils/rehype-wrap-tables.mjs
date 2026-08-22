const isTable = (node) => node?.type === "element" && node.tagName === "table";

const isTableScrollWrapper = (node) => {
  if (node?.type !== "element" || node.tagName !== "div") return false;

  const className = node.properties?.className;
  return Array.isArray(className)
    ? className.includes("table-scroll")
    : className === "table-scroll";
};

const createWrapper = (table) => ({
  type: "element",
  tagName: "div",
  properties: {
    className: ["table-scroll"],
    dataHorizontalScroll: "",
    tabIndex: 0,
    role: "region",
    ariaLabel: "Scrollable data table",
  },
  children: [table],
});

const wrapTables = (node) => {
  if (!node || !Array.isArray(node.children)) return;

  node.children = node.children.map((child) => {
    if (isTableScrollWrapper(child)) return child;

    wrapTables(child);
    return isTable(child) ? createWrapper(child) : child;
  });
};

export default function rehypeWrapTables() {
  return (tree) => wrapTables(tree);
}

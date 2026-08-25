import path from "node:path";

import {
  inspectManagedArticleImage,
  isMeaningfulManagedImageAlt,
  MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT,
} from "./managed-article-images.mjs";

function visitElements(node, visitor) {
  if (node?.type === "element") visitor(node);
  if (Array.isArray(node?.children)) {
    for (const child of node.children) visitElements(child, visitor);
  }
}

function articleSlugFromFile(file) {
  const filePath = file?.path ?? file?.history?.[0];
  if (typeof filePath !== "string") return undefined;
  const basename = path.basename(filePath);
  return basename.match(/^(.+)\.mdx?$/)?.[1];
}

export default function rehypeManagedArticleImages() {
  return async function transformManagedArticleImages(tree, file) {
    const managedNodes = [];
    visitElements(tree, (node) => {
      if (node.tagName !== "img") return;
      const src = node.properties?.src;
      if (
        typeof src === "string" &&
        src.startsWith(`${MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT}/`)
      ) {
        managedNodes.push(node);
      }
    });
    if (managedNodes.length === 0) return;

    const articleSlug = articleSlugFromFile(file);
    if (!articleSlug) {
      throw new Error(
        "Managed article images require an article Markdown file path.",
      );
    }
    const repositoryRoot =
      typeof file?.cwd === "string" ? file.cwd : process.cwd();

    for (const node of managedNodes) {
      const publicUrl = node.properties.src;
      const inspected = await inspectManagedArticleImage({
        articleSlug,
        publicUrl,
        repositoryRoot,
      });
      if (
        !isMeaningfulManagedImageAlt(node.properties?.alt, inspected.filename)
      ) {
        throw new Error(
          `Managed body image ${inspected.filename} requires meaningful alternative text.`,
        );
      }
      node.properties = {
        ...node.properties,
        width: inspected.width,
        height: inspected.height,
        loading: "lazy",
        decoding: "async",
      };
    }
  };
}

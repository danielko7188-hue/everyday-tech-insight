import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { load } from "cheerio";

import { readArticleRecords } from "../../../scripts/qa-content.mjs";

/** Count source tables through Astro's Markdown renderer, independently of the built DOM. */
export async function expectedArticleTableCount(
  articlePath: string,
): Promise<number> {
  const article = (await readArticleRecords()).find(
    ({ data }) =>
      data.status === "published" && `/articles/${data.slug}/` === articlePath,
  );
  if (!article) throw new Error(`No published source for ${articlePath}.`);
  const markdown = await createMarkdownProcessor({ syntaxHighlight: false });
  const rendered = await markdown.render(String(article.body ?? ""));
  const count = load(rendered.code)("table").length;
  if (count === 0) throw new Error(`No source tables in ${articlePath}.`);
  return count;
}

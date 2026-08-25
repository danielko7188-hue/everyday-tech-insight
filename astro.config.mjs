import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

import { siteUrl } from "./site.config.mjs";
import rehypeManagedArticleImages from "./src/utils/rehype-managed-article-images.mjs";
import rehypeWrapTables from "./src/utils/rehype-wrap-tables.mjs";

export default defineConfig({
  site: siteUrl,
  output: "static",
  trailingSlash: "always",
  build: {
    inlineStylesheets: "always",
  },
  markdown: {
    processor: unified({
      rehypePlugins: [rehypeWrapTables, rehypeManagedArticleImages],
    }),
  },
  integrations: [sitemap()],
});

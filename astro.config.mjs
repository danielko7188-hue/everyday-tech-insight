import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

import { siteUrl } from "./site.config.mjs";
import rehypeWrapTables from "./src/utils/rehype-wrap-tables.mjs";

export default defineConfig({
  site: siteUrl,
  output: "static",
  trailingSlash: "always",
  build: {
    inlineStylesheets: "always",
  },
  markdown: {
    processor: unified({ rehypePlugins: [rehypeWrapTables] }),
  },
  integrations: [sitemap()],
});

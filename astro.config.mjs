import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

import { siteUrl } from "./site.config.mjs";

export default defineConfig({
  site: siteUrl,
  output: "static",
  trailingSlash: "always",
  integrations: [sitemap()],
});

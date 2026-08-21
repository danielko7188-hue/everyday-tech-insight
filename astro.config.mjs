import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://everyday-tech-insight.vercel.app/",
  output: "static",
  trailingSlash: "always",
  integrations: [sitemap()],
});

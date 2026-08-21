import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

import { articleFrontmatterSchema } from "./utils/content-contract";

const articles = defineCollection({
  loader: glob({
    base: "./src/content/articles",
    pattern: "**/*.{md,mdx}",
  }),
  schema: articleFrontmatterSchema,
});

export const collections = { articles };

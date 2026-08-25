import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

import { site } from "../data/site";
import { filterPublishedArticles } from "../utils/published-articles";

export async function GET(context: { site?: URL }) {
  const publishedArticles = filterPublishedArticles(
    await getCollection("articles"),
  ).sort((left, right) =>
    right.data.datePublished.localeCompare(left.data.datePublished),
  );

  return rss({
    title: site.name,
    description: site.tagline,
    site: context.site ?? new URL(site.url),
    items: publishedArticles.map((article) => ({
      title: article.data.title,
      description: article.data.summary,
      pubDate: new Date(`${article.data.datePublished}T12:00:00Z`),
      link: `/articles/${article.data.slug}/`,
    })),
    customData: `<language>${site.locale}</language>`,
  });
}

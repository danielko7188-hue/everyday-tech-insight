import { siteUrl } from "../../site.config.mjs";

export const prerender = true;

export function GET() {
  const sitemapUrl = new URL("sitemap-index.xml", siteUrl);
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl.toString()}\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}

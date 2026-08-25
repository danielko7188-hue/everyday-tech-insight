import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import {
  auditManagedArticleImages,
  createManagedArticleImageResponse,
  createPublishedManagedImagePaths,
  inspectManagedArticleImage,
} from "../../../utils/managed-article-images.mjs";

interface ManagedImageProps {
  articleSlug: string;
  publicUrl: string;
}

export async function getStaticPaths() {
  const articles = (await getCollection("articles")).map((article) => ({
    body: article.body ?? "",
    data: article.data,
    fileName: article.id,
  }));
  const audit = await auditManagedArticleImages(articles, {
    repositoryRoot: process.cwd(),
  });
  return createPublishedManagedImagePaths(audit);
}

export const GET: APIRoute<ManagedImageProps> = async ({ props }) => {
  const image = await inspectManagedArticleImage({
    articleSlug: props.articleSlug,
    publicUrl: props.publicUrl,
    repositoryRoot: process.cwd(),
  });
  return createManagedArticleImageResponse(image);
};

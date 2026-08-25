import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createManagedArticleImageResponse,
  createPublishedManagedImagePaths,
} from "../../src/utils/managed-article-images.mjs";

describe("published managed image endpoint helpers", () => {
  const image = {
    articleSlug: "published-guide",
    byteLength: 4,
    bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    extension: "png",
    filename: "published-guide-decision-flow.png",
    format: "png",
    height: 8,
    mimeType: "image/png",
    publicUrl: "/images/articles/published-guide-decision-flow.png",
    sourcePath: "C:\\source\\published-guide-decision-flow.png",
    usages: [
      {
        fileName: "published-guide.md",
        kind: "body",
        status: "published",
      },
    ],
    width: 12,
  };

  it("creates a deduplicated static manifest from published images only", () => {
    expect(
      createPublishedManagedImagePaths({
        findings: [],
        referencedImages: [
          image,
          {
            ...image,
            articleSlug: "draft-guide",
            filename: "draft-guide-decision-flow.png",
            publicUrl: "/images/articles/draft-guide-decision-flow.png",
          },
        ],
        publishedImages: [image, image],
      }),
    ).toEqual([
      {
        params: { filename: "published-guide-decision-flow.png" },
        props: {
          articleSlug: "published-guide",
          publicUrl: "/images/articles/published-guide-decision-flow.png",
        },
      },
    ]);
  });

  it("returns no routes when no published article references media", () => {
    expect(
      createPublishedManagedImagePaths({
        findings: [],
        publishedImages: [],
        referencedImages: [],
      }),
    ).toEqual([]);
  });

  it("refuses to publish any route when the lifecycle-wide audit fails", () => {
    expect(() =>
      createPublishedManagedImagePaths({
        findings: [
          {
            code: "orphan-managed-image",
            location: "orphan.png",
            message: "Source file is unreferenced.",
          },
        ],
        publishedImages: [image],
        referencedImages: [image],
      }),
    ).toThrow(/orphan-managed-image.*orphan\.png/s);
  });

  it("emits the validated bytes with bounded caching and nosniff headers", async () => {
    const response = createManagedArticleImageResponse(image);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("4");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(image.bytes);
  });

  it("keeps the Astro endpoint manifest-driven rather than public-directory-driven", async () => {
    const source = await readFile(
      path.resolve(
        import.meta.dirname,
        "../../src/pages/images/articles/[filename].ts",
      ),
      "utf8",
    );

    expect(source).toMatch(/auditManagedArticleImages/);
    expect(source).toMatch(/createPublishedManagedImagePaths/);
    expect(source).not.toMatch(/public[\\/]images[\\/]articles/);
  });
});

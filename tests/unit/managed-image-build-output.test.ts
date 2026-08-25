import { describe, expect, it } from "vitest";

import { validateManagedArticleImageBuildOutput } from "../../scripts/qa-build.mjs";

function article(
  slug: string,
  status: "draft" | "review" | "published" | "archived",
  extension = "png",
) {
  return {
    fileName: `${slug}.md`,
    data: { slug, status },
    body: `![Decision workflow showing approval and review steps](/images/articles/${slug}-decision-flow.${extension})`,
  };
}

function validFixture() {
  const published = article("published-guide", "published", "webp");
  Object.assign(published.data, {
    heroImage: "/images/articles/published-guide-hero.png",
    heroImageAlt: "Editors reviewing the documented publication workflow",
    heroImageDecorative: false,
  });
  const articles = [
    published,
    article("draft-guide", "draft"),
    article("review-guide", "review"),
    article("archived-guide", "archived"),
  ];
  const files = new Map<string, string>([
    ["images/articles/published-guide-hero.png", "[binary resource]"],
    ["images/articles/published-guide-decision-flow.webp", "[binary resource]"],
    [
      "articles/published-guide/index.html",
      `<article>
        <div data-managed-hero-image>
          <img src="/images/articles/published-guide-hero.png" alt="Editors reviewing the documented publication workflow" width="24" height="16" loading="eager" decoding="async">
        </div>
        <div class="article-body">
          <img src="/images/articles/published-guide-decision-flow.webp" alt="Decision workflow showing approval and review steps" width="20" height="12" loading="lazy" decoding="async">
        </div>
      </article>`,
    ],
  ]);
  const managedImageAudit = {
    findings: [],
    publishedImages: [
      {
        articleSlug: "published-guide",
        filename: "published-guide-hero.png",
        height: 16,
        publicUrl: "/images/articles/published-guide-hero.png",
        width: 24,
      },
      {
        articleSlug: "published-guide",
        filename: "published-guide-decision-flow.webp",
        height: 12,
        publicUrl: "/images/articles/published-guide-decision-flow.webp",
        width: 20,
      },
    ],
    referencedImages: [],
  };
  return { articles, files, managedImageAudit };
}

describe("built managed image output", () => {
  it("accepts exact published routes and intrinsic loading attributes", () => {
    expect(validateManagedArticleImageBuildOutput(validFixture())).toEqual([]);
  });

  it("allows a zero-reference build with no managed output directory", () => {
    expect(
      validateManagedArticleImageBuildOutput({
        articles: [
          {
            fileName: "published-guide.md",
            data: { slug: "published-guide", status: "published" },
            body: "No image.",
          },
        ],
        files: new Map([
          [
            "articles/published-guide/index.html",
            '<article><div class="article-body"><p>No image.</p></div></article>',
          ],
        ]),
      }),
    ).toEqual([]);
  });

  it.each([
    ["draft", "images/articles/draft-guide-decision-flow.png"],
    ["review", "images/articles/review-guide-decision-flow.png"],
    ["archived", "images/articles/archived-guide-decision-flow.png"],
  ])("rejects %s asset leakage", (_status, leakedFile) => {
    const fixture = validFixture();
    fixture.files.set(leakedFile, "[binary resource]");

    expect(
      validateManagedArticleImageBuildOutput(fixture).map(({ code }) => code),
    ).toContain("managed-image-output-set");
  });

  it("rejects a missing published image asset", () => {
    const fixture = validFixture();
    fixture.files.delete("images/articles/published-guide-hero.png");

    expect(
      validateManagedArticleImageBuildOutput(fixture).map(({ code }) => code),
    ).toContain("managed-image-output-set");
  });

  it.each([
    ["missing width", ' width="24"', "", "managed-image-dimensions"],
    ["zero height", 'height="16"', 'height="0"', "managed-image-dimensions"],
    [
      "body eager loading",
      'loading="lazy"',
      'loading="eager"',
      "managed-image-loading",
    ],
    [
      "hero lazy loading",
      'loading="eager"',
      'loading="lazy"',
      "managed-image-loading",
    ],
    [
      "sync decoding",
      'decoding="async"',
      'decoding="sync"',
      "managed-image-decoding",
    ],
    [
      "generic body alt",
      "Decision workflow showing approval and review steps",
      "Image",
      "managed-body-image-alt",
    ],
    [
      "incorrect hero alt",
      "Editors reviewing the documented publication workflow",
      "A different description",
      "managed-hero-image-alt",
    ],
  ])("rejects %s", (_label, before, after, code) => {
    const fixture = validFixture();
    fixture.files.set(
      "articles/published-guide/index.html",
      fixture.files
        .get("articles/published-guide/index.html")!
        .replace(before, after),
    );

    expect(
      validateManagedArticleImageBuildOutput(fixture).map(
        ({ code: issueCode }) => issueCode,
      ),
    ).toContain(code);
  });

  it("rejects a rendered URL that was not referenced by the published article", () => {
    const fixture = validFixture();
    fixture.files.set(
      "articles/published-guide/index.html",
      fixture.files
        .get("articles/published-guide/index.html")!
        .replace(
          "published-guide-decision-flow.webp",
          "published-guide-unreferenced-flow.webp",
        ),
    );

    expect(
      validateManagedArticleImageBuildOutput(fixture).map(({ code }) => code),
    ).toContain("managed-image-markup-set");
  });

  it("rejects positive intrinsic dimensions that differ from the decoded source", () => {
    const fixture = validFixture();
    fixture.files.set(
      "articles/published-guide/index.html",
      fixture.files
        .get("articles/published-guide/index.html")!
        .replace('width="24" height="16"', 'width="23" height="15"'),
    );

    expect(
      validateManagedArticleImageBuildOutput(fixture).map(({ code }) => code),
    ).toContain("managed-image-rendered-tuple");
  });

  it("rejects hero and body URLs swapped between otherwise valid occurrences", () => {
    const fixture = validFixture();
    fixture.files.set(
      "articles/published-guide/index.html",
      fixture.files
        .get("articles/published-guide/index.html")!
        .replace("published-guide-hero.png", "temporary-image-name")
        .replace(
          "published-guide-decision-flow.webp",
          "published-guide-hero.png",
        )
        .replace("temporary-image-name", "published-guide-decision-flow.webp"),
    );

    expect(
      validateManagedArticleImageBuildOutput(fixture).map(({ code }) => code),
    ).toContain("managed-image-rendered-tuple");
  });

  it("rejects a meaningful body alt that differs from the reviewed source alt", () => {
    const fixture = validFixture();
    fixture.files.set(
      "articles/published-guide/index.html",
      fixture.files
        .get("articles/published-guide/index.html")!
        .replace(
          "Decision workflow showing approval and review steps",
          "Different workflow showing escalation and approval decisions",
        ),
    );

    expect(
      validateManagedArticleImageBuildOutput(fixture).map(({ code }) => code),
    ).toContain("managed-image-rendered-tuple");
  });

  it("binds decorative hero alt and aria semantics to the reviewed source tuple", () => {
    const fixture = validFixture();
    const published = fixture.articles[0]!;
    Object.assign(published.data, {
      heroImageAlt: "",
      heroImageDecorative: true,
    });
    const articleFile = "articles/published-guide/index.html";
    fixture.files.set(
      articleFile,
      fixture.files
        .get(articleFile)!
        .replace(
          'alt="Editors reviewing the documented publication workflow"',
          'alt="" aria-hidden="true"',
        ),
    );
    expect(validateManagedArticleImageBuildOutput(fixture)).toEqual([]);

    fixture.files.set(
      articleFile,
      fixture.files.get(articleFile)!.replace(' aria-hidden="true"', ""),
    );
    expect(
      validateManagedArticleImageBuildOutput(fixture).map(({ code }) => code),
    ).toContain("managed-image-rendered-tuple");
  });

  it("rejects dimensions from a manifest owned by a different article", () => {
    const fixture = validFixture();
    fixture.managedImageAudit.publishedImages[0]!.articleSlug =
      "different-published-guide";

    expect(
      validateManagedArticleImageBuildOutput(fixture).map(({ code }) => code),
    ).toContain("managed-image-rendered-tuple");
  });
});

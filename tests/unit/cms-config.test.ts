import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ARTICLE_STATUSES,
  CONTENT_TYPES,
  EDITORIAL_VISUAL_KEYS,
  EDITORIAL_VISUAL_TYPES,
  VERIFICATION_STATUSES,
} from "../../src/utils/content-contract";
import { categorySlugs } from "../../src/data/categories";
import {
  printCmsFindings,
  readPagesCmsConfig,
  validatePagesCmsConfig,
} from "../../scripts/qa-cms.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

const expectedFieldOrder = [
  "title",
  "description",
  "slug",
  "category",
  "author",
  "status",
  "contentType",
  "guidePromise",
  "deliverable",
  "whenToUse",
  "businessProblem",
  "technologyFocus",
  "intendedAudience",
  "readerOutcome",
  "verificationStatus",
  "datePublished",
  "dateModified",
  "lastReviewed",
  "dateArchived",
  "summary",
  "visual",
  "sourceList",
  "relatedArticles",
  "heroImage",
  "heroImageAlt",
  "heroImageDecorative",
  "heroImageCaption",
  "heroImageCredit",
  "heroImageSourceUrl",
  "heroImageLicense",
  "noindex",
  "body",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mutation tests deliberately exercise untyped YAML shapes.
type CmsConfig = Record<string, any>;

function field(config: CmsConfig, name: string): CmsConfig {
  const fields = Array.isArray(config.fields)
    ? config.fields
    : config.content[0].fields;
  const match = fields.find((candidate: CmsConfig) => candidate.name === name);
  if (!match) throw new Error(`Missing field ${name}.`);
  return match;
}

async function validConfig(): Promise<CmsConfig> {
  return (await readPagesCmsConfig(
    path.join(repositoryRoot, ".pages.yml"),
  )) as CmsConfig;
}

describe("Pages CMS configuration", () => {
  it("matches the exact repository, collection, view, media, and settings contract", async () => {
    const config = await validConfig();

    expect(validatePagesCmsConfig(config)).toEqual([]);
    expect(Object.keys(config)).toEqual(["media", "content", "settings"]);
    expect(config.media).toEqual([
      {
        name: "article_images",
        label: "Article images",
        input: "src/content-assets/articles",
        output: "/images/articles",
        extensions: ["webp", "png", "jpg", "jpeg"],
        categories: ["image"],
        rename: "safe",
      },
    ]);

    const collection = config.content[0];
    expect(config.content).toHaveLength(1);
    expect(collection).toMatchObject({
      name: "articles",
      label: "Guides",
      type: "collection",
      path: "src/content/articles",
      format: "yaml-frontmatter",
      subfolders: false,
      filename: { template: "{fields.slug}.md", field: false },
      operations: { create: true, rename: false, delete: false },
      view: {
        primary: "title",
        fields: [
          "title",
          "status",
          "category",
          "contentType",
          "datePublished",
          "lastReviewed",
        ],
        search: [
          "title",
          "slug",
          "summary",
          "category",
          "status",
          "contentType",
        ],
        sort: ["datePublished", "lastReviewed", "title", "category", "status"],
        default: { sort: "datePublished", order: "desc" },
      },
    });
    expect(collection.fields.map(({ name }: CmsConfig) => name)).toEqual(
      expectedFieldOrder,
    );
    expect(config.settings).toEqual({
      content: { merge: true },
      commit: {
        identity: "app",
        templates: {
          create: "content(create): {path}",
          update: "content(update): {path}",
          delete: "content(delete): {path}",
          rename: "content(rename): {oldPath} -> {newPath}",
        },
      },
    });
  });

  it("keeps draft identity strict while leaving review and publication metadata optional", async () => {
    const config = await validConfig();
    const collection = config.content[0];

    for (const name of ["title", "slug", "author", "status"]) {
      expect(field(config, name).required, name).toBe(true);
    }
    expect(field(config, "title").options).toMatchObject({
      minlength: 10,
      maxlength: 100,
    });
    expect(field(config, "slug")).toMatchObject({
      pattern: {
        regex: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        message: expect.stringMatching(/lowercase.*hyphen/i),
      },
      options: { minlength: 1, maxlength: 120 },
    });
    expect(field(config, "author")).toMatchObject({
      default: "Everyday Tech Insight",
      readonly: true,
    });
    expect(field(config, "status")).toMatchObject({
      default: "draft",
      options: { values: [...ARTICLE_STATUSES] },
    });
    expect(field(config, "category").required).not.toBe(true);
    expect(field(config, "category").options.values).toEqual([
      ...categorySlugs,
    ]);
    expect(field(config, "contentType").required).not.toBe(true);
    expect(field(config, "contentType").options.values).toEqual([
      ...CONTENT_TYPES,
    ]);
    expect(field(config, "verificationStatus")).toMatchObject({
      default: "unverified",
      options: { values: [...VERIFICATION_STATUSES] },
    });
    expect(
      collection.fields.some(
        ({ name }: CmsConfig) => name === "canonicalOverride",
      ),
    ).toBe(false);
    expect(
      collection.fields.some(({ name }: CmsConfig) => name === "featured"),
    ).toBe(false);
    expect(collection.view.fields).not.toContain("featured");
    expect(field(config, "relatedArticles").default).toEqual([]);
    expect(field(config, "noindex").default).toBe(true);
  });

  it("encodes current length, date, source, visual, reference, hero, and body safeguards", async () => {
    const config = await validConfig();

    for (const [name, minlength, maxlength] of [
      ["description", 50, 180],
      ["guidePromise", 90, 180],
      ["deliverable", 20, 150],
      ["whenToUse", 40, 180],
      ["businessProblem", 20, 500],
      ["technologyFocus", 20, 500],
      ["intendedAudience", 20, 300],
      ["readerOutcome", 20, 500],
      ["summary", 40, 500],
    ] as const) {
      expect(field(config, name).options, name).toMatchObject({
        minlength,
        maxlength,
      });
      expect(field(config, name).required, name).not.toBe(true);
    }
    for (const name of [
      "datePublished",
      "dateModified",
      "lastReviewed",
      "dateArchived",
    ]) {
      expect(field(config, name), name).toMatchObject({
        type: "date",
        default: "",
        options: { format: "yyyy-MM-dd" },
      });
    }

    const visual = field(config, "visual");
    expect(visual.description).toMatch(/repository.*validates.*pair/i);
    expect(field(visual, "key").description).toMatch(
      /new guide.*registered.*symbol.*before.*published/i,
    );
    expect(field(config, "status").description).toMatch(
      /published.*quality record.*editorial-operations\.yml/i,
    );
    expect(visual.fields.map(({ name }: CmsConfig) => name)).toEqual([
      "type",
      "key",
      "alt",
      "caption",
      "decorative",
    ]);
    expect(visual.fields[0].options.values).toEqual([
      ...EDITORIAL_VISUAL_TYPES,
    ]);
    expect(visual.fields[1].options.values).toEqual([...EDITORIAL_VISUAL_KEYS]);
    expect(visual.fields[4].default).toBe(false);

    const sources = field(config, "sourceList");
    expect(sources).toMatchObject({
      type: "object",
      list: {
        collapsible: { collapsed: true, summary: "{fields.title}" },
      },
    });
    expect(sources.fields.map(({ name }: CmsConfig) => name)).toEqual([
      "title",
      "publisher",
      "url",
      "accessed",
    ]);
    expect(sources.fields[3]).toMatchObject({
      type: "date",
      required: true,
      default: "",
      options: { format: "yyyy-MM-dd" },
    });

    expect(field(config, "relatedArticles")).toMatchObject({
      type: "reference",
      options: {
        collection: "articles",
        multiple: true,
        max: 4,
        search: "title,slug",
        value: "{fields.slug}",
        label: "{fields.title}",
      },
    });
    expect(field(config, "heroImage")).toMatchObject({
      type: "image",
      options: {
        media: "article_images",
        extensions: ["webp", "png", "jpg", "jpeg"],
        categories: ["image"],
        rename: "safe",
      },
    });
    expect(field(config, "body")).toMatchObject({
      type: "rich-text",
      required: true,
      description: expect.stringMatching(/Markdown.*evidence.*review/i),
      options: {
        format: "markdown",
        switcher: true,
        media: "article_images",
        extensions: ["webp", "png", "jpg", "jpeg"],
        categories: ["image"],
        rename: "safe",
      },
    });
  });

  it.each([
    "Hosted CMS auth is tested",
    "Hosted CMS authentication is tested",
    "Hosted CMS authorization is tested",
    "Hosted CMS sign-in is tested",
    "Hosted CMS sign in is tested",
    "Hosted CMS save is tested",
    "Hosted CMS saves are tested",
    "Hosted CMS saved content is tested",
    "Hosted CMS saving is tested",
    "Hosted CMS round-trip is tested",
    "Hosted CMS round trip is tested",
    "Hosted CMS roundtrip is tested",
    "CMS authentication is pending",
    "Pages CMS save is pending",
    "Hosted Pages CMS authentication is unverified and not tested by this local check",
    "Hosted CMS sign-in must be tested before use",
    "Hosted CMS saving remains to be tested before use",
    "Hosted CMS authentication is unverified, while GitHub saving is tested in its own unit suite",
    "Hosted CMS authentication is unverified after browser saving is tested",
    "Browser saving is tested and the hosted CMS authentication is unverified",
    "GitHub's hosted CMS saving is tested",
    "Hosted CMS authentication remains unverified until saving has been tested",
    "Hosted authentication is pending external review",
  ])("rejects hosted outcome language fail closed: %s", async (statement) => {
    const config = structuredClone(await validConfig());
    field(config, "title").label = statement;

    expect(validatePagesCmsConfig(config), statement).toContainEqual(
      expect.objectContaining({
        code: "hosted-outcome-language",
        location: "content[0].fields[0].label",
        message:
          "Hosted CMS outcome language is not allowed in configuration; document external validation state separately.",
      }),
    );
  });

  it("rejects hosted outcome language in recursively nested strings", async () => {
    const config = structuredClone(await validConfig());
    field(field(config, "sourceList"), "publisher").description =
      "This CMS guarantees secure hosted authentication";

    expect(validatePagesCmsConfig(config)).toContainEqual(
      expect.objectContaining({
        code: "hosted-outcome-language",
        location: "content[0].fields[21].fields[1].description",
      }),
    );
  });

  it.each([
    "Browser saving is tested in its own unit suite",
    "GitHub authentication is verified in a local test",
    "Local round-trip tests are complete",
    "tested",
    "unverified",
    "Editorial status",
    "Hosted editor status",
    "CMS configuration status",
    "Pages CMS editorial status",
  ])("allows unrelated or standalone wording: %s", async (statement) => {
    const config = structuredClone(await validConfig());
    field(config, "title").label = statement;

    expect(
      validatePagesCmsConfig(config).filter(
        ({ code }) => code === "hosted-outcome-language",
      ),
    ).toEqual([]);
  });

  it.each([
    [
      "source child hidden",
      (config: CmsConfig) =>
        (field(field(config, "sourceList"), "title").hidden = true),
      "source-child-contract",
      "fields.sourceList.title",
    ],
    [
      "source child list",
      (config: CmsConfig) =>
        (field(field(config, "sourceList"), "publisher").list = true),
      "source-child-contract",
      "fields.sourceList.publisher",
    ],
    [
      "source child component",
      (config: CmsConfig) =>
        (field(field(config, "sourceList"), "url").component = "textarea"),
      "source-child-contract",
      "fields.sourceList.url",
    ],
    [
      "visual child readonly",
      (config: CmsConfig) =>
        (field(field(config, "visual"), "alt").readonly = true),
      "visual-child-contract",
      "fields.visual.alt",
    ],
    [
      "visual object component",
      (config: CmsConfig) => (field(config, "visual").component = "custom"),
      "visual-object-contract",
      "fields.visual",
    ],
    [
      "visual child unknown key",
      (config: CmsConfig) =>
        (field(field(config, "visual"), "caption").inventedConstraint = true),
      "visual-child-contract",
      "fields.visual.caption",
    ],
    [
      "hero component",
      (config: CmsConfig) => (field(config, "heroImage").component = "file"),
      "hero-media",
      "fields.heroImage",
    ],
    [
      "noindex hidden",
      (config: CmsConfig) => (field(config, "noindex").hidden = true),
      "hero-seo-contract",
      "fields.noindex",
    ],
  ])(
    "rejects semantic or unknown nested field drift for %s",
    async (_label, mutate, expectedCode, expectedLocation) => {
      const config = structuredClone(await validConfig());
      mutate(config);

      expect(validatePagesCmsConfig(config)).toContainEqual(
        expect.objectContaining({
          code: expectedCode,
          location: expectedLocation,
        }),
      );
    },
  );

  it.each([
    [
      "source title minimum",
      (config: CmsConfig) =>
        (field(field(config, "sourceList"), "title").options.minlength = 0),
      "source-child-options",
      "fields.sourceList.title.options",
    ],
    [
      "source publisher maximum",
      (config: CmsConfig) =>
        (field(field(config, "sourceList"), "publisher").options.maxlength =
          999),
      "source-child-options",
      "fields.sourceList.publisher.options",
    ],
    [
      "source URL pattern message",
      (config: CmsConfig) =>
        (field(field(config, "sourceList"), "url").pattern.message =
          "Any URL is accepted."),
      "source-url-pattern",
      "fields.sourceList.url.pattern",
    ],
    [
      "source accessed date default",
      (config: CmsConfig) =>
        (field(field(config, "sourceList"), "accessed").default = "2026-08-25"),
      "source-date",
      "fields.sourceList.accessed",
    ],
    [
      "source title unexpected default",
      (config: CmsConfig) =>
        (field(field(config, "sourceList"), "title").default =
          "Invented source"),
      "source-child-contract",
      "fields.sourceList.title",
    ],
    [
      "source list unexpected default",
      (config: CmsConfig) => (field(config, "sourceList").default = []),
      "source-list",
      "fields.sourceList",
    ],
    [
      "visual alt minimum",
      (config: CmsConfig) =>
        (field(field(config, "visual"), "alt").options.minlength = 0),
      "visual-child-options",
      "fields.visual.alt.options",
    ],
    [
      "visual caption maximum",
      (config: CmsConfig) =>
        (field(field(config, "visual"), "caption").options.maxlength = 999),
      "visual-child-options",
      "fields.visual.caption.options",
    ],
    [
      "visual alt unexpected default",
      (config: CmsConfig) =>
        (field(field(config, "visual"), "alt").default = "Decorative"),
      "visual-child-contract",
      "fields.visual.alt",
    ],
    [
      "visual object unexpected options",
      (config: CmsConfig) => (field(config, "visual").options = {}),
      "visual-object-contract",
      "fields.visual",
    ],
    [
      "hero image unexpected default",
      (config: CmsConfig) =>
        (field(config, "heroImage").default = "/images/articles/hero.png"),
      "hero-media",
      "fields.heroImage",
    ],
    [
      "hero alt maximum",
      (config: CmsConfig) =>
        (field(config, "heroImageAlt").options.maxlength = 999),
      "hero-seo-contract",
      "fields.heroImageAlt",
    ],
    [
      "hero decorative default",
      (config: CmsConfig) =>
        (field(config, "heroImageDecorative").default = true),
      "hero-seo-contract",
      "fields.heroImageDecorative",
    ],
    [
      "hero caption minimum",
      (config: CmsConfig) =>
        (field(config, "heroImageCaption").options.minlength = 0),
      "hero-seo-contract",
      "fields.heroImageCaption",
    ],
    [
      "hero credit maximum",
      (config: CmsConfig) =>
        (field(config, "heroImageCredit").options.maxlength = 999),
      "hero-seo-contract",
      "fields.heroImageCredit",
    ],
    [
      "hero source URL pattern",
      (config: CmsConfig) =>
        (field(config, "heroImageSourceUrl").pattern.regex = "^http://"),
      "hero-seo-contract",
      "fields.heroImageSourceUrl",
    ],
    [
      "hero license minimum",
      (config: CmsConfig) =>
        (field(config, "heroImageLicense").options.minlength = 0),
      "hero-seo-contract",
      "fields.heroImageLicense",
    ],
    [
      "noindex options",
      (config: CmsConfig) => (field(config, "noindex").options = {}),
      "hero-seo-contract",
      "fields.noindex",
    ],
  ])(
    "rejects exact nested constraint drift for %s",
    async (_label, mutate, expectedCode, expectedLocation) => {
      const config = structuredClone(await validConfig());
      mutate(config);

      expect(validatePagesCmsConfig(config)).toContainEqual(
        expect.objectContaining({
          code: expectedCode,
          location: expectedLocation,
        }),
      );
    },
  );

  it.each([
    [
      "operations.create",
      (config: CmsConfig) => (config.content[0].operations.create = false),
      "collection-identity",
      "content[0]",
    ],
    [
      "media name",
      (config: CmsConfig) => (config.media[0].name = "uploads"),
      "media-contract",
      "media",
    ],
    [
      "media input",
      (config: CmsConfig) => (config.media[0].input = "public/images/articles"),
      "media-contract",
      "media",
    ],
    [
      "media label",
      (config: CmsConfig) => (config.media[0].label = "Uploads"),
      "media-contract",
      "media",
    ],
    [
      "media extensions",
      (config: CmsConfig) => config.media[0].extensions.pop(),
      "media-contract",
      "media",
    ],
    [
      "media categories",
      (config: CmsConfig) => (config.media[0].categories = ["document"]),
      "media-contract",
      "media",
    ],
    [
      "collection name",
      (config: CmsConfig) => (config.content[0].name = "posts"),
      "collection-identity",
      "content[0]",
    ],
    [
      "collection label",
      (config: CmsConfig) => (config.content[0].label = "Articles"),
      "collection-identity",
      "content[0]",
    ],
    [
      "collection type",
      (config: CmsConfig) => (config.content[0].type = "file"),
      "collection-identity",
      "content[0]",
    ],
    [
      "verificationStatus default",
      (config: CmsConfig) =>
        (field(config, "verificationStatus").default = "tested"),
      "verification-default",
      "fields.verificationStatus.default",
    ],
    [
      "relatedArticles default",
      (config: CmsConfig) =>
        (field(config, "relatedArticles").default = ["some-guide"]),
      "related-default",
      "fields.relatedArticles.default",
    ],
    [
      "noindex default",
      (config: CmsConfig) => (field(config, "noindex").default = false),
      "noindex-default",
      "fields.noindex.default",
    ],
    [
      "category enum",
      (config: CmsConfig) => field(config, "category").options.values.pop(),
      "enum-options",
      "fields.category.options.values",
    ],
    [
      "contentType enum",
      (config: CmsConfig) => field(config, "contentType").options.values.pop(),
      "enum-options",
      "fields.contentType.options.values",
    ],
    [
      "verificationStatus enum",
      (config: CmsConfig) =>
        field(config, "verificationStatus").options.values.pop(),
      "enum-options",
      "fields.verificationStatus.options.values",
    ],
    [
      "visual type enum",
      (config: CmsConfig) =>
        field(field(config, "visual"), "type").options.values.pop(),
      "visual-type-options",
      "fields.visual.type.options.values",
    ],
    [
      "visual key enum",
      (config: CmsConfig) =>
        field(field(config, "visual"), "key").options.values.pop(),
      "visual-key-options",
      "fields.visual.key.options.values",
    ],
  ])(
    "reports the relevant finding for %s drift",
    async (_label, mutate, expectedCode, expectedLocation) => {
      const config = structuredClone(await validConfig());
      mutate(config);

      expect(validatePagesCmsConfig(config)).toContainEqual(
        expect.objectContaining({
          code: expectedCode,
          location: expectedLocation,
        }),
      );
    },
  );

  it.each([
    [
      "wrong media output",
      (config: CmsConfig) => (config.media[0].output = "/admin"),
    ],
    [
      "wrong media input",
      (config: CmsConfig) => (config.media[0].input = "images"),
    ],
    [
      "unsafe media rename",
      (config: CmsConfig) => (config.media[0].rename = false),
    ],
    ["media action", (config: CmsConfig) => (config.media[0].actions = [])],
    [
      "wrong collection path",
      (config: CmsConfig) => (config.content[0].path = "public/admin"),
    ],
    ["wrong format", (config: CmsConfig) => (config.content[0].format = "md")],
    [
      "subfolders",
      (config: CmsConfig) => (config.content[0].subfolders = true),
    ],
    [
      "filename template",
      (config: CmsConfig) =>
        (config.content[0].filename.template = "{primary}.md"),
    ],
    [
      "editable filename",
      (config: CmsConfig) => (config.content[0].filename.field = true),
    ],
    [
      "rename operation",
      (config: CmsConfig) => (config.content[0].operations.rename = true),
    ],
    [
      "delete operation",
      (config: CmsConfig) => (config.content[0].operations.delete = true),
    ],
    [
      "collection action",
      (config: CmsConfig) => (config.content[0].actions = []),
    ],
    [
      "workflow",
      (config: CmsConfig) => (config.content[0].workflow = "deploy.yml"),
    ],
    ["view fields", (config: CmsConfig) => config.content[0].view.fields.pop()],
    [
      "view search",
      (config: CmsConfig) => config.content[0].view.search.reverse(),
    ],
    ["view sort", (config: CmsConfig) => config.content[0].view.sort.shift()],
    [
      "view default",
      (config: CmsConfig) => (config.content[0].view.default.order = "asc"),
    ],
    ["field removed", (config: CmsConfig) => config.content[0].fields.pop()],
    [
      "field added",
      (config: CmsConfig) =>
        config.content[0].fields.push({ name: "publisherId", type: "string" }),
    ],
    [
      "unknown collection key",
      (config: CmsConfig) =>
        (config.content[0].previewUrl = "/articles/{fields.slug}/"),
    ],
    ["field order", (config: CmsConfig) => config.content[0].fields.reverse()],
    [
      "author writable",
      (config: CmsConfig) => (field(config, "author").readonly = false),
    ],
    [
      "draft field made required",
      (config: CmsConfig) => (field(config, "category").required = true),
    ],
    [
      "field type drift",
      (config: CmsConfig) => (field(config, "summary").type = "string"),
    ],
    [
      "helper drift",
      (config: CmsConfig) =>
        (field(config, "guidePromise").description = "General helper text."),
    ],
    [
      "date default",
      (config: CmsConfig) =>
        (field(config, "datePublished").default = "2026-08-25"),
    ],
    [
      "enum drift",
      (config: CmsConfig) => field(config, "status").options.values.pop(),
    ],
    [
      "unsafe status default",
      (config: CmsConfig) => (field(config, "status").default = "published"),
    ],
    [
      "source list contract",
      (config: CmsConfig) =>
        (field(config, "sourceList").list.collapsible.collapsed = false),
    ],
    [
      "source URL pattern",
      (config: CmsConfig) =>
        (field(field(config, "sourceList"), "url").pattern.regex = ".*"),
    ],
    [
      "visual child optional",
      (config: CmsConfig) =>
        (field(field(config, "visual"), "type").required = false),
    ],
    [
      "reference value",
      (config: CmsConfig) =>
        (field(config, "relatedArticles").options.value = "{path}"),
    ],
    [
      "hero media",
      (config: CmsConfig) => (field(config, "heroImage").options.media = false),
    ],
    [
      "body extension",
      (config: CmsConfig) =>
        field(config, "body").options.extensions.push("svg"),
    ],
    [
      "merge disabled",
      (config: CmsConfig) => (config.settings.content.merge = false),
    ],
    [
      "personal commit identity",
      (config: CmsConfig) => (config.settings.commit.identity = "user"),
    ],
    [
      "personal metadata template",
      (config: CmsConfig) =>
        (config.settings.commit.templates.update =
          "Update {path} by {userEmail}"),
    ],
    [
      "root action",
      (config: CmsConfig) =>
        (config.actions = [{ name: "deploy", workflow: "deploy.yml" }]),
    ],
    [
      "credential-like key",
      (config: CmsConfig) =>
        (config.settings.publisherId = `pub-${"1".repeat(16)}`),
    ],
    [
      "API credential key",
      (config: CmsConfig) => (config.settings.apiKey = "not-a-real-key"),
    ],
    [
      "hosted outcome language",
      (config: CmsConfig) =>
        (field(config, "body").description =
          "This editor guarantees private hosted authentication and safe deployment."),
    ],
  ])("rejects the %s mutation", async (_label, mutate) => {
    const config = structuredClone(await validConfig());
    mutate(config);

    expect(validatePagesCmsConfig(config)).not.toEqual([]);
  });

  it("prints the exact local PASS label only for a clean configuration", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    printCmsFindings([]);
    expect(log).toHaveBeenCalledWith("CMS QA: PASS");
    expect(error).not.toHaveBeenCalled();

    log.mockRestore();
    error.mockRestore();
  });
});

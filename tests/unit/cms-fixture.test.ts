import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createCmsLifecycleFixtures,
  resolveNpmBuildInvocation,
  validateCmsBuildOutput,
  withTemporaryArticleFixtures,
} from "../../scripts/check-cms-fixture.mjs";
import {
  parseArticleMarkdown,
  validateContentPortfolio,
} from "../../scripts/qa-content.mjs";
import { articleFrontmatterSchema } from "../../src/utils/content-contract";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

describe("CMS lifecycle build fixture", () => {
  it("launches npm through Node on Windows instead of spawning a .cmd shim", () => {
    expect(
      resolveNpmBuildInvocation({
        platform: "win32",
        nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
        npmExecutable:
          "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
      }),
    ).toEqual({
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: [
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "build",
      ],
    });
    expect(
      resolveNpmBuildInvocation({
        platform: "linux",
        nodeExecutable: "/usr/bin/node",
      }),
    ).toEqual({ command: "npm", args: ["run", "build"] });
  });

  it("creates exactly one minimum draft, structurally valid review, and complete archived fixture", async () => {
    const articlesDirectory = path.join(
      repositoryRoot,
      "src",
      "content",
      "articles",
    );
    const fixtures = await createCmsLifecycleFixtures({ articlesDirectory });

    expect(fixtures.map(({ status }) => status)).toEqual([
      "draft",
      "review",
      "archived",
    ]);
    expect(new Set(fixtures.map(({ slug }) => slug)).size).toBe(3);
    for (const fixture of fixtures) {
      expect(path.dirname(fixture.fileName)).toBe(".");
      expect(fixture.fileName).toBe(`${fixture.slug}.md`);
      const record = parseArticleMarkdown(fixture.source, fixture.fileName);
      expect((record.data as Record<string, unknown>).status).toBe(
        fixture.status,
      );
      expect(articleFrontmatterSchema.safeParse(record.data).success).toBe(
        true,
      );
    }

    const records = fixtures.map((fixture) =>
      parseArticleMarkdown(fixture.source, fixture.fileName),
    );
    const existing = await Promise.all(
      (await readdir(articlesDirectory))
        .filter((name) => name.endsWith(".md"))
        .map(async (fileName) =>
          parseArticleMarkdown(
            await readFile(path.join(articlesDirectory, fileName), "utf8"),
            fileName,
          ),
        ),
    );
    expect(validateContentPortfolio([...existing, ...records])).toEqual([]);
  });

  it("writes all fixtures for the operation and cleans them after an injected failure", async () => {
    const articlesDirectory = temporaryRoot("eti-cms-fixture-failure-");
    const fixtures = ["draft", "review", "archived"].map((status) => ({
      fileName: `cms-${status}.md`,
      slug: `cms-${status}`,
      status,
      source: `fixture ${status}`,
    }));

    await expect(
      withTemporaryArticleFixtures(
        { articlesDirectory, fixtures },
        async (paths: string[]) => {
          expect(paths).toHaveLength(3);
          expect(paths.every((candidate) => existsSync(candidate))).toBe(true);
          throw new Error("injected build failure");
        },
      ),
    ).rejects.toThrow("injected build failure");

    expect(await readdir(articlesDirectory)).toEqual([]);
  });

  it("rejects a pre-existing collision, preserves its bytes, and removes any newly-created peers", async () => {
    const articlesDirectory = temporaryRoot("eti-cms-fixture-collision-");
    const sentinelPath = path.join(articlesDirectory, "cms-review.md");
    const sentinel = Buffer.from([0, 1, 2, 255, 13, 10]);
    await writeFile(sentinelPath, sentinel);
    const fixtures = ["draft", "review", "archived"].map((status) => ({
      fileName: `cms-${status}.md`,
      slug: `cms-${status}`,
      status,
      source: `fixture ${status}`,
    }));

    await expect(
      withTemporaryArticleFixtures(
        { articlesDirectory, fixtures },
        async () => undefined,
      ),
    ).rejects.toThrow(/exists|collision|refusing/i);

    expect(await readFile(sentinelPath)).toEqual(sentinel);
    expect(await readdir(articlesDirectory)).toEqual(["cms-review.md"]);
  });

  it("accepts a clean 15-route build inventory and detects leaks into public surfaces or social inventory", async () => {
    const projectRoot = temporaryRoot("eti-cms-build-output-");
    const distDirectory = path.join(projectRoot, "dist");
    const socialDirectory = path.join(projectRoot, "public", "social");
    const fixtureSlugs = [
      "cms-fixture-minimum-draft",
      "cms-fixture-structural-review",
      "cms-fixture-complete-archived",
    ];
    await mkdir(path.join(distDirectory, "articles"), { recursive: true });
    const categorySlugs = [
      "ai-automation",
      "business-software",
      "cybersecurity-data-protection",
      "digital-operations",
      "technology-strategy",
    ];
    for (const categorySlug of categorySlugs) {
      await mkdir(path.join(distDirectory, "categories", categorySlug), {
        recursive: true,
      });
    }
    await mkdir(path.join(distDirectory, "publisher"), { recursive: true });
    await mkdir(path.join(distDirectory, "sitemap"), { recursive: true });
    await mkdir(socialDirectory, { recursive: true });

    for (let index = 1; index <= 15; index += 1) {
      const slug = `published-article-${index}`;
      await mkdir(path.join(distDirectory, "articles", slug), {
        recursive: true,
      });
      await writeFile(
        path.join(distDirectory, "articles", slug, "index.html"),
        `<a href="/articles/published-article-${(index % 15) + 1}/">Related</a>`,
      );
      await writeFile(
        path.join(socialDirectory, `article-${slug}.png`),
        Buffer.from([137, 80, 78, 71]),
      );
    }
    for (const [relativePath, contents] of [
      ["index.html", "Published guides"],
      ["articles/index.html", "Published guide archive"],
      ...categorySlugs.map(
        (categorySlug) =>
          [
            `categories/${categorySlug}/index.html`,
            "Published category",
          ] as const,
      ),
      ["publisher/index.html", "Published publisher record"],
      ["sitemap/index.html", "Published HTML sitemap"],
      ["sitemap-0.xml", "<urlset></urlset>"],
      ["sitemap-index.xml", "<sitemapindex></sitemapindex>"],
      ["rss.xml", "<rss></rss>"],
    ] as const) {
      const target = path.join(distDirectory, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents, "utf8");
    }

    await expect(
      validateCmsBuildOutput({ projectRoot, fixtureSlugs }),
    ).resolves.toMatchObject({ publicArticleRoutes: 15 });

    await writeFile(
      path.join(distDirectory, "rss.xml"),
      `<rss>${fixtureSlugs[0]}</rss>`,
      "utf8",
    );
    await expect(
      validateCmsBuildOutput({ projectRoot, fixtureSlugs }),
    ).rejects.toThrow(/fixture.*rss|rss.*fixture/i);
  });
});

import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCmsLifecycleFixtures,
  reemitCmsFixtureSignal,
  resolveNpmBuildInvocation,
  runCmsLifecycleFixture,
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
type SignalControl = {
  trackChild: (child: {
    kill: (signal: NodeJS.Signals) => boolean;
  }) => () => void;
};

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

function tryCreateDirectoryLink(target: string, linkPath: string): boolean {
  try {
    symlinkSync(
      target,
      linkPath,
      process.platform === "win32" ? "junction" : "dir",
    );
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["EACCES", "EPERM", "ENOSYS", "ENOTSUP"].includes(String(error.code))
    ) {
      return false;
    }
    throw error;
  }
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

  it.each([
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const)(
    "uses the conventional %s exit code when signal re-emission is unavailable",
    (signal, exitCode) => {
      const processTarget = {
        pid: 42,
        exitCode: undefined as number | undefined,
      };
      expect(() =>
        reemitCmsFixtureSignal(signal, {
          processTarget,
          killProcess: () => {
            throw Object.assign(new Error("signal unavailable"), {
              code: "ENOSYS",
            });
          },
        }),
      ).not.toThrow();
      expect(processTarget.exitCode).toBe(exitCode);
    },
  );

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
      const data = record.data as Record<string, unknown>;
      expect(data.status).toBe(fixture.status);
      expect(fixture.title).toBe(data.title);
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

  it("passes an all-archived lifecycle build with zero public article routes", async () => {
    const projectRoot = temporaryRoot("eti-cms-zero-published-");
    const articlesDirectory = path.join(
      projectRoot,
      "src",
      "content",
      "articles",
    );
    await mkdir(articlesDirectory, { recursive: true });

    const seedFixtures = await createCmsLifecycleFixtures({
      articlesDirectory: path.join(
        repositoryRoot,
        "src",
        "content",
        "articles",
      ),
    });
    const seedArchived = seedFixtures.find(
      ({ status }) => status === "archived",
    );
    if (!seedArchived?.slug || !seedArchived.title) {
      throw new Error("Expected a complete archived seed fixture.");
    }
    const withdrawnSlug = "withdrawn-guide";
    const withdrawnTitle = "Withdrawn guide";
    await writeFile(
      path.join(articlesDirectory, `${withdrawnSlug}.md`),
      seedArchived.source
        .replaceAll(seedArchived.slug, withdrawnSlug)
        .replace(seedArchived.title, withdrawnTitle),
      "utf8",
    );

    const result = await runCmsLifecycleFixture({
      projectRoot,
      runBuild: async () => {
        const fixtureFiles = (await readdir(articlesDirectory)).filter((name) =>
          name.startsWith("cms-fixture-"),
        );
        expect(fixtureFiles).toHaveLength(3);
        for (const fileName of fixtureFiles) {
          const record = parseArticleMarkdown(
            await readFile(path.join(articlesDirectory, fileName), "utf8"),
            fileName,
          );
          expect(articleFrontmatterSchema.safeParse(record.data).success).toBe(
            true,
          );
        }

        const distDirectory = path.join(projectRoot, "dist");
        await mkdir(path.join(distDirectory, "articles"), { recursive: true });
        await mkdir(path.join(projectRoot, "public", "social"), {
          recursive: true,
        });
        for (const categorySlug of [
          "ai-automation",
          "business-software",
          "cybersecurity-data-protection",
          "digital-operations",
          "technology-strategy",
        ]) {
          await mkdir(path.join(distDirectory, "categories", categorySlug), {
            recursive: true,
          });
          await writeFile(
            path.join(distDirectory, "categories", categorySlug, "index.html"),
            "Empty category",
            "utf8",
          );
        }
        for (const [relativePath, contents] of [
          ["index.html", "No current guides"],
          ["articles/index.html", "No current guides"],
          ["publisher/index.html", "No published work"],
          ["sitemap/index.html", "No article routes"],
          ["sitemap-0.xml", "<urlset></urlset>"],
          ["rss.xml", "<rss></rss>"],
        ] as const) {
          const target = path.join(distDirectory, relativePath);
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, contents, "utf8");
        }
      },
    });

    expect(result).toEqual({
      checkedFixtures: 3,
      publicArticleRoutes: 0,
      publicArticleSocialImages: 0,
    });
    expect(await readdir(path.join(projectRoot, "dist", "articles"))).toEqual([
      "index.html",
    ]);
    expect(await readdir(articlesDirectory)).toEqual([`${withdrawnSlug}.md`]);
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

  it("terminates and awaits an active child, cleans owned fixtures, then re-emits the original signal", async () => {
    const articlesDirectory = temporaryRoot("eti-cms-fixture-signal-");
    const fixtures = ["draft", "review", "archived"].map((status) => ({
      fileName: `cms-${status}.md`,
      slug: `cms-${status}`,
      status,
      source: `fixture ${status}`,
    }));
    const processTarget = new EventEmitter();
    const child = new EventEmitter() as EventEmitter & {
      killed: boolean;
      kill: (signal: NodeJS.Signals) => boolean;
    };
    let childSettled = false;
    child.killed = false;
    child.kill = vi.fn((signal: NodeJS.Signals) => {
      child.killed = true;
      queueMicrotask(() => {
        childSettled = true;
        child.emit("exit", null, signal);
      });
      return true;
    });
    const reemitSignal = vi.fn((signal: NodeJS.Signals) => {
      expect(signal).toBe("SIGTERM");
      expect(childSettled).toBe(true);
      expect(
        fixtures.every((fixture) =>
          existsSync(path.join(articlesDirectory, fixture.fileName)),
        ),
      ).toBe(false);
    });

    await expect(
      withTemporaryArticleFixtures(
        { articlesDirectory, fixtures },
        async (_paths: string[], signalControl: SignalControl) => {
          signalControl.trackChild(child);
          await new Promise<never>((_resolve, reject) => {
            child.once("exit", (_code, signal) => {
              reject(new Error(`child exited via ${String(signal)}`));
            });
            processTarget.emit("SIGTERM");
          });
        },
        { processTarget, reemitSignal },
      ),
    ).rejects.toMatchObject({
      code: "CMS_FIXTURE_SIGNAL",
      signal: "SIGTERM",
    });

    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(reemitSignal).toHaveBeenCalledOnce();
    expect(await readdir(articlesDirectory)).toEqual([]);
    expect(processTarget.listenerCount("SIGINT")).toBe(0);
    expect(processTarget.listenerCount("SIGTERM")).toBe(0);
  });

  it("awaits every cleanup attempt and preserves signal re-emission when one removal fails", async () => {
    const articlesDirectory = temporaryRoot("eti-cms-fixture-cleanup-signal-");
    const fixtures = ["draft", "review", "archived"].map((status) => ({
      fileName: `cms-${status}.md`,
      slug: `cms-${status}`,
      status,
      source: `fixture ${status}`,
    }));
    const processTarget = new EventEmitter();
    const removalAttempts: string[] = [];
    const reemitSignal = vi.fn();

    await expect(
      withTemporaryArticleFixtures(
        { articlesDirectory, fixtures },
        async () => {
          processTarget.emit("SIGINT");
          throw new Error("operation interrupted");
        },
        {
          processTarget,
          reemitSignal,
          removeFixture: async (target: string) => {
            removalAttempts.push(path.basename(target));
            if (removalAttempts.length === 1) {
              throw new Error("injected cleanup failure");
            }
            rmSync(target);
          },
        },
      ),
    ).rejects.toMatchObject({
      code: "CMS_FIXTURE_SIGNAL",
      signal: "SIGINT",
    });

    expect(removalAttempts.sort()).toEqual(
      fixtures.map(({ fileName }) => fileName).sort(),
    );
    expect(reemitSignal).toHaveBeenCalledWith("SIGINT");
  });

  it("accepts exact dynamic route and social parity and detects nonpublished leaks", async () => {
    const projectRoot = temporaryRoot("eti-cms-build-output-");
    const distDirectory = path.join(projectRoot, "dist");
    const socialDirectory = path.join(projectRoot, "public", "social");
    const fixtureSlugs = [
      "cms-fixture-minimum-draft",
      "cms-fixture-structural-review",
      "cms-fixture-complete-archived",
    ];
    const fixtureTitles = [
      "CMS fixture minimum editorial draft",
      "CMS fixture structurally valid review guide",
      "CMS fixture complete archived guide",
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

    const expectedPublishedSlugs = Array.from(
      { length: 16 },
      (_, index) => `published-article-${index + 1}`,
    );
    for (let index = 1; index <= expectedPublishedSlugs.length; index += 1) {
      const slug = `published-article-${index}`;
      await mkdir(path.join(distDirectory, "articles", slug), {
        recursive: true,
      });
      await writeFile(
        path.join(distDirectory, "articles", slug, "index.html"),
        `<a href="/articles/published-article-${(index % expectedPublishedSlugs.length) + 1}/">Related</a>`,
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
      validateCmsBuildOutput({
        projectRoot,
        expectedPublishedSlugs,
        fixtureSlugs,
        fixtureTitles,
      }),
    ).resolves.toMatchObject({ publicArticleRoutes: 16 });

    await writeFile(
      path.join(distDirectory, "rss.xml"),
      `<rss>${fixtureSlugs[0]}</rss>`,
      "utf8",
    );
    await expect(
      validateCmsBuildOutput({
        projectRoot,
        expectedPublishedSlugs,
        fixtureSlugs,
        fixtureTitles,
      }),
    ).rejects.toThrow(/fixture.*rss|rss.*fixture/i);

    await writeFile(path.join(distDirectory, "rss.xml"), "<rss></rss>", "utf8");
    await writeFile(
      path.join(distDirectory, "publisher", "index.html"),
      `<main>${fixtureTitles[1]}</main>`,
      "utf8",
    );
    await expect(
      validateCmsBuildOutput({
        projectRoot,
        expectedPublishedSlugs,
        fixtureSlugs,
        fixtureTitles,
      }),
    ).rejects.toThrow(/fixture.*title.*publisher|publisher.*fixture.*title/i);

    await writeFile(
      path.join(distDirectory, "publisher", "index.html"),
      "Published publisher record",
      "utf8",
    );
    const leakedRoute = path.join(
      distDirectory,
      "articles",
      "unpublished-review-guide",
    );
    await mkdir(leakedRoute);
    await writeFile(path.join(leakedRoute, "index.html"), "Not public", "utf8");
    await expect(
      validateCmsBuildOutput({
        projectRoot,
        expectedPublishedSlugs,
        fixtureSlugs,
        fixtureTitles,
      }),
    ).rejects.toThrow(/article route.*unexpected|route set.*unpublished/i);

    rmSync(leakedRoute, { recursive: true });
    await writeFile(
      path.join(socialDirectory, "article-unpublished-review-guide.png"),
      Buffer.from([137, 80, 78, 71]),
    );
    await expect(
      validateCmsBuildOutput({
        projectRoot,
        expectedPublishedSlugs,
        fixtureSlugs,
        fixtureTitles,
      }),
    ).rejects.toThrow(/social.*unexpected|social.*set.*unpublished/i);

    rmSync(path.join(socialDirectory, "article-unpublished-review-guide.png"));
    const rssPath = path.join(distDirectory, "rss.xml");
    rmSync(rssPath);
    await mkdir(rssPath);
    await expect(
      validateCmsBuildOutput({
        projectRoot,
        expectedPublishedSlugs,
        fixtureSlugs,
        fixtureTitles,
      }),
    ).rejects.toThrow(/regular file/i);

    rmSync(rssPath, { recursive: true });
    await writeFile(rssPath, "<rss></rss>", "utf8");
    const socialFilePath = path.join(
      socialDirectory,
      `article-${expectedPublishedSlugs[0]}.png`,
    );
    rmSync(socialFilePath);
    await mkdir(socialFilePath);
    await expect(
      validateCmsBuildOutput({
        projectRoot,
        expectedPublishedSlugs,
        fixtureSlugs,
        fixtureTitles,
      }),
    ).rejects.toThrow(/social.*regular file/i);
  }, 15_000);

  it("rejects a non-regular Markdown source before fixture derivation", async () => {
    const articlesDirectory = temporaryRoot("eti-cms-nonregular-source-");
    await mkdir(path.join(articlesDirectory, "not-a-file.md"));

    await expect(
      createCmsLifecycleFixtures({ articlesDirectory }),
    ).rejects.toThrow(/source.*regular file/i);
  });

  it("rejects linked fixture source and built-output directories", async (context) => {
    const parent = temporaryRoot("eti-cms-linked-path-");
    const realArticles = path.join(parent, "real-articles");
    const linkedArticles = path.join(parent, "linked-articles");
    await mkdir(realArticles);
    if (!tryCreateDirectoryLink(realArticles, linkedArticles)) {
      context.skip("Creating a directory link is unavailable on this host.");
      return;
    }

    await expect(
      withTemporaryArticleFixtures(
        {
          articlesDirectory: linkedArticles,
          fixtures: [
            {
              fileName: "cms-draft.md",
              slug: "cms-draft",
              status: "draft",
              source: "fixture",
            },
          ],
        },
        async () => undefined,
      ),
    ).rejects.toThrow(/symbolic link|junction|canonical/i);

    const projectRoot = path.join(parent, "project");
    const outsideDist = path.join(parent, "outside-dist");
    await mkdir(projectRoot);
    await mkdir(outsideDist);
    const linkedDist = path.join(projectRoot, "dist");
    if (!tryCreateDirectoryLink(outsideDist, linkedDist)) {
      context.skip(
        "Creating a second directory link is unavailable on this host.",
      );
      return;
    }
    await expect(
      validateCmsBuildOutput({
        projectRoot,
        expectedPublishedSlugs: [],
        fixtureSlugs: [],
        fixtureTitles: [],
      }),
    ).rejects.toThrow(/symbolic link|junction|canonical/i);
  });
});

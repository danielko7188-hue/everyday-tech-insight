import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { dump as dumpYaml } from "js-yaml";

import { renderArticleDraft, validateArticleSlug } from "./new-article.mjs";
import { readArticleRecords } from "./qa-content.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const CATEGORY_SLUGS = [
  "ai-automation",
  "business-software",
  "cybersecurity-data-protection",
  "digital-operations",
  "technology-strategy",
];
export const CMS_FIXTURE_SLUGS = [
  "cms-fixture-minimum-draft",
  "cms-fixture-structural-review",
  "cms-fixture-complete-archived",
];

function serializeArticle(data, body) {
  const frontmatter = dumpYaml(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    sortKeys: false,
  }).trimEnd();
  return `---\n${frontmatter}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}

export async function createCmsLifecycleFixtures({ articlesDirectory }) {
  const records = await readArticleRecords(articlesDirectory);
  const published = records.find(
    (record) => record.data.status === "published",
  );
  if (!published) {
    throw new Error("A published article is required to derive CMS fixtures.");
  }

  const [draftSlug, reviewSlug, archivedSlug] = CMS_FIXTURE_SLUGS;
  const draftSource = renderArticleDraft({
    title: "CMS fixture minimum editorial draft",
    slug: draftSlug,
  });
  const reviewData = {
    ...published.data,
    title: "CMS fixture structurally valid review guide",
    slug: reviewSlug,
    status: "review",
    verificationStatus: "unverified",
    relatedArticles: [],
    noindex: true,
  };
  const precedingDates = [
    published.data.datePublished,
    published.data.dateModified,
    published.data.lastReviewed,
  ].filter((value) => typeof value === "string");
  const archivedData = {
    ...published.data,
    title: "CMS fixture complete archived guide",
    slug: archivedSlug,
    status: "archived",
    dateArchived: precedingDates.sort().at(-1),
    relatedArticles: [],
    noindex: true,
  };

  return [
    {
      fileName: `${draftSlug}.md`,
      slug: draftSlug,
      status: "draft",
      source: draftSource,
    },
    {
      fileName: `${reviewSlug}.md`,
      slug: reviewSlug,
      status: "review",
      source: serializeArticle(reviewData, published.body),
    },
    {
      fileName: `${archivedSlug}.md`,
      slug: archivedSlug,
      status: "archived",
      source: serializeArticle(archivedData, published.body),
    },
  ];
}

function fixtureTarget(articlesDirectory, fixture) {
  validateArticleSlug(fixture.slug);
  if (fixture.fileName !== `${fixture.slug}.md`) {
    throw new Error(
      `CMS fixture ${fixture.fileName} must match its canonical slug.`,
    );
  }
  const resolvedDirectory = path.resolve(articlesDirectory);
  const target = path.resolve(resolvedDirectory, fixture.fileName);
  if (
    path.dirname(target) !== resolvedDirectory ||
    path.basename(target) !== fixture.fileName
  ) {
    throw new Error(
      "CMS fixtures must be direct children of the article directory.",
    );
  }
  return target;
}

export async function withTemporaryArticleFixtures(
  { articlesDirectory, fixtures },
  operation,
) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error("At least one CMS fixture is required.");
  }
  if (typeof operation !== "function") {
    throw new TypeError("CMS fixture operation must be a function.");
  }
  const targets = fixtures.map((fixture) =>
    fixtureTarget(articlesDirectory, fixture),
  );
  if (new Set(targets).size !== targets.length) {
    throw new Error("CMS fixture targets must be unique.");
  }

  const createdTargets = [];
  try {
    const writes = await Promise.allSettled(
      fixtures.map(async (fixture, index) => {
        await writeFile(targets[index], fixture.source, {
          encoding: "utf8",
          flag: "wx",
        });
        createdTargets.push(targets[index]);
      }),
    );
    const rejected = writes.find((result) => result.status === "rejected");
    if (rejected) {
      const collision =
        rejected.reason &&
        typeof rejected.reason === "object" &&
        rejected.reason.code === "EEXIST";
      throw new Error(
        collision
          ? "Refusing to replace a pre-existing CMS fixture collision."
          : `Unable to create CMS fixtures: ${String(rejected.reason)}`,
        { cause: rejected.reason },
      );
    }
    return await operation(targets);
  } finally {
    await Promise.all(
      createdTargets.map((target) => rm(target, { force: false })),
    );
  }
}

async function listFilesRecursively(directory, relativeDirectory = "") {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const relativePath = relativeDirectory
      ? path.join(relativeDirectory, entry.name)
      : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

async function requireFile(filePath, label) {
  try {
    if (!(await stat(filePath)).isFile()) throw new Error();
  } catch {
    throw new Error(
      `CMS fixture check requires the built ${label}: ${filePath}`,
    );
  }
}

export async function validateCmsBuildOutput({
  projectRoot,
  fixtureSlugs = CMS_FIXTURE_SLUGS,
}) {
  const resolvedRoot = path.resolve(projectRoot);
  const distDirectory = path.join(resolvedRoot, "dist");
  const articleDirectory = path.join(distDirectory, "articles");
  const requiredSurfaces = [
    [path.join(distDirectory, "index.html"), "homepage"],
    [path.join(articleDirectory, "index.html"), "article archive"],
    [path.join(distDirectory, "publisher", "index.html"), "publisher page"],
    [path.join(distDirectory, "sitemap", "index.html"), "HTML sitemap"],
    [path.join(distDirectory, "rss.xml"), "RSS feed"],
    ...CATEGORY_SLUGS.map((slug) => [
      path.join(distDirectory, "categories", slug, "index.html"),
      `category ${slug}`,
    ]),
  ];
  await Promise.all(
    requiredSurfaces.map(([filePath, label]) => requireFile(filePath, label)),
  );

  const distFiles = await listFilesRecursively(distDirectory);
  const sitemapXml = distFiles.filter(({ relativePath }) =>
    /(?:^|[\\/])sitemap[^\\/]*\.xml$/i.test(relativePath),
  );
  if (sitemapXml.length === 0) {
    throw new Error("CMS fixture check requires the generated XML sitemap.");
  }

  const articleEntries = await readdir(articleDirectory, {
    withFileTypes: true,
  });
  const publicArticleRoutes = articleEntries.filter((entry) =>
    entry.isDirectory(),
  );
  if (publicArticleRoutes.length !== 15) {
    throw new Error(
      `CMS fixture build must keep exactly 15 public article routes; found ${publicArticleRoutes.length}.`,
    );
  }
  await Promise.all(
    publicArticleRoutes.map((entry) =>
      requireFile(
        path.join(articleDirectory, entry.name, "index.html"),
        `article route ${entry.name}`,
      ),
    ),
  );

  for (const { absolutePath, relativePath } of distFiles) {
    for (const slug of fixtureSlugs) {
      if (relativePath.includes(slug)) {
        throw new Error(
          `CMS fixture ${slug} leaked into built path ${relativePath}.`,
        );
      }
    }
    if (!/\.(?:html|xml)$/i.test(relativePath)) continue;
    const contents = await readFile(absolutePath, "utf8");
    for (const slug of fixtureSlugs) {
      if (contents.includes(slug)) {
        throw new Error(`CMS fixture ${slug} leaked into ${relativePath}.`);
      }
    }
  }

  const socialDirectory = path.join(resolvedRoot, "public", "social");
  const socialEntries = await readdir(socialDirectory, { withFileTypes: true });
  const articleSocialImages = socialEntries.filter(
    (entry) => entry.isFile() && /^article-.+\.png$/.test(entry.name),
  );
  if (articleSocialImages.length !== 15) {
    throw new Error(
      `CMS fixture build must keep exactly 15 public article social images; found ${articleSocialImages.length}.`,
    );
  }
  for (const entry of socialEntries) {
    for (const slug of fixtureSlugs) {
      if (entry.name.includes(slug)) {
        throw new Error(
          `CMS fixture ${slug} leaked into social inventory ${entry.name}.`,
        );
      }
    }
  }

  return {
    publicArticleRoutes: publicArticleRoutes.length,
    publicArticleSocialImages: articleSocialImages.length,
    checkedFixtures: fixtureSlugs.length,
  };
}

export function resolveNpmBuildInvocation({
  platform = process.platform,
  nodeExecutable = process.execPath,
  npmExecutable = process.env.npm_execpath,
} = {}) {
  if (platform !== "win32") {
    return { command: "npm", args: ["run", "build"] };
  }
  if (typeof npmExecutable !== "string" || npmExecutable.trim() === "") {
    throw new Error(
      "Windows CMS fixture builds must run through npm so npm_execpath is available.",
    );
  }
  return {
    command: nodeExecutable,
    args: [npmExecutable, "run", "build"],
  };
}

export async function runProductionBuild({ projectRoot }) {
  await new Promise((resolve, reject) => {
    const { command, args } = resolveNpmBuildInvocation();
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `Production build failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`,
          ),
        );
      }
    });
  });
}

export async function runCmsLifecycleFixture({
  projectRoot = repositoryRoot,
  runBuild = runProductionBuild,
} = {}) {
  const articlesDirectory = path.join(
    projectRoot,
    "src",
    "content",
    "articles",
  );
  const fixtures = await createCmsLifecycleFixtures({ articlesDirectory });
  return withTemporaryArticleFixtures(
    { articlesDirectory, fixtures },
    async () => {
      await runBuild({ projectRoot });
      return validateCmsBuildOutput({
        projectRoot,
        fixtureSlugs: fixtures.map(({ slug }) => slug),
      });
    },
  );
}

async function main() {
  const result = await runCmsLifecycleFixture();
  console.log(
    `CMS fixture: PASS (${result.publicArticleRoutes} public article routes; ${result.checkedFixtures} nonpublic lifecycle fixtures excluded).`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `CMS fixture: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

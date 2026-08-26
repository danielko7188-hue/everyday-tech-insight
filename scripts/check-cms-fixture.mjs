import { execFile, spawn } from "node:child_process";
import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { dump as dumpYaml } from "js-yaml";

import {
  renderArticleDraft,
  resolveSafeArticleTarget,
  validateArticleSlug,
} from "./new-article.mjs";
import { readArticleRecords } from "./qa-content.mjs";
import { resolveBuildGitSha } from "../src/utils/build-provenance.mjs";

const execFileAsync = promisify(execFile);

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
const TEXT_PUBLIC_EXTENSIONS = new Set([
  ".atom",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".rss",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);
export const CMS_FIXTURE_SLUGS = [
  "cms-fixture-minimum-draft",
  "cms-fixture-structural-review",
  "cms-fixture-complete-archived",
];
const FULL_GIT_SHA_PATTERN = /^[a-f\d]{40}$/;
const BUILD_PROVENANCE_ENVIRONMENT_NAMES = [
  "VERCEL_GIT_COMMIT_SHA",
  "PUBLIC_VERCEL_GIT_COMMIT_SHA",
  "GITHUB_SHA",
];

function validateFullGitSha(candidate, label) {
  if (typeof candidate !== "string" || !FULL_GIT_SHA_PATTERN.test(candidate)) {
    throw new Error(`${label} must be a full lowercase 40-character SHA.`);
  }
  return candidate;
}

export function resolveCmsFixtureBuildEnvironment({
  baseEnvironment = process.env,
  fixtureGitSha,
}) {
  if (!baseEnvironment || typeof baseEnvironment !== "object") {
    throw new TypeError("CMS fixture base environment must be an object.");
  }
  const environment = { ...baseEnvironment };
  for (const variableName of BUILD_PROVENANCE_ENVIRONMENT_NAMES) {
    delete environment[variableName];
  }
  environment.GITHUB_SHA = validateFullGitSha(
    fixtureGitSha,
    "CMS fixture Git SHA",
  );
  return environment;
}

async function runGitCommand(projectRoot, args, failureMessage) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return result.stdout;
  } catch (cause) {
    throw new Error(failureMessage, { cause });
  }
}

function relativeGitTargets(projectRoot, targets) {
  const resolvedRoot = path.resolve(projectRoot);
  return targets.map((target) => {
    const relative = path.relative(resolvedRoot, path.resolve(target));
    if (
      relative === "" ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error("CMS fixture commit target escapes its worktree.");
    }
    return relative.split(path.sep).join("/");
  });
}

async function commitCmsFixtureInputs(projectRoot, targets) {
  const relativeTargets = relativeGitTargets(projectRoot, targets);
  await runGitCommand(
    projectRoot,
    ["add", "--", ...relativeTargets],
    "Unable to stage isolated CMS fixture inputs.",
  );
  await runGitCommand(
    projectRoot,
    [
      "-c",
      "user.name=Everyday Tech Insight QA",
      "-c",
      "user.email=qa@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "--no-verify",
      "--no-gpg-sign",
      "-m",
      "test: isolated CMS lifecycle fixtures",
      "--",
      ...relativeTargets,
    ],
    "Unable to commit isolated CMS fixture inputs.",
  );
  const fixtureGitSha = (
    await runGitCommand(
      projectRoot,
      ["rev-parse", "--verify", "HEAD"],
      "Unable to resolve the isolated CMS fixture commit.",
    )
  ).trim();
  return validateFullGitSha(fixtureGitSha, "CMS fixture Git SHA");
}

function serializeArticle(data, body) {
  const frontmatter = dumpYaml(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    sortKeys: false,
  }).trimEnd();
  return `---\n${frontmatter}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}

function assertCanonicalContainment(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} escapes its canonical containment root.`);
  }
}

async function readVerifiedArticleRecords(articlesDirectory) {
  await resolveSafeArticleTarget(articlesDirectory, "cms-path-safety-probe");
  const canonicalDirectory = await realpath(articlesDirectory);
  const entries = await readdir(articlesDirectory);
  for (const name of entries) {
    const candidate = path.join(articlesDirectory, name);
    const stats = await lstat(candidate);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Article source contains a symbolic link or junction: ${candidate}`,
      );
    }
    if (!name.endsWith(".md")) continue;
    if (!stats.isFile()) {
      throw new Error(`Article source must be a regular file: ${candidate}`);
    }
    assertCanonicalContainment(
      canonicalDirectory,
      await realpath(candidate),
      "Article source",
    );
  }
  return readArticleRecords(articlesDirectory);
}

function publishedSlugsFromRecords(records) {
  const slugs = records
    .filter((record) => record.data.status === "published")
    .map((record) => validateArticleSlug(record.data.slug));
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("Published article slugs must be unique.");
  }
  return slugs.sort();
}

function createCmsLifecycleFixturesFromRecords(records) {
  const template =
    records.find((record) => record.data.status === "published") ??
    records.find((record) => record.data.status === "archived");
  if (!template) {
    throw new Error(
      "A published or archived article is required to derive CMS fixtures.",
    );
  }

  const [draftSlug, reviewSlug, archivedSlug] = CMS_FIXTURE_SLUGS;
  const draftTitle = "CMS fixture minimum editorial draft";
  const reviewTitle = "CMS fixture structurally valid review guide";
  const archivedTitle = "CMS fixture complete archived guide";
  const draftSource = renderArticleDraft({
    title: draftTitle,
    slug: draftSlug,
  });
  const reviewTemplateData = { ...template.data };
  delete reviewTemplateData.dateArchived;
  const reviewData = {
    ...reviewTemplateData,
    title: reviewTitle,
    slug: reviewSlug,
    status: "review",
    verificationStatus: "unverified",
    relatedArticles: [],
    noindex: true,
  };
  const precedingDates = [
    template.data.datePublished,
    template.data.dateModified,
    template.data.lastReviewed,
    template.data.dateArchived,
  ].filter((value) => typeof value === "string");
  const archivedData = {
    ...template.data,
    title: archivedTitle,
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
      title: draftTitle,
      status: "draft",
      source: draftSource,
    },
    {
      fileName: `${reviewSlug}.md`,
      slug: reviewSlug,
      title: reviewTitle,
      status: "review",
      source: serializeArticle(reviewData, template.body),
    },
    {
      fileName: `${archivedSlug}.md`,
      slug: archivedSlug,
      title: archivedTitle,
      status: "archived",
      source: serializeArticle(archivedData, template.body),
    },
  ];
}

export async function createCmsLifecycleFixtures({ articlesDirectory }) {
  return createCmsLifecycleFixturesFromRecords(
    await readVerifiedArticleRecords(articlesDirectory),
  );
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

/**
 * @param {{ articlesDirectory: string, fixtures: Array<{ fileName: string, slug: string, source: string, status?: string, title?: string }> }} fixtureOptions
 * @param {(targets: string[], signalControl: { trackChild: (child: { kill: (signal: NodeJS.Signals) => boolean }) => () => void, throwIfSignaled: () => void }) => unknown | Promise<unknown>} operation
 * @param {{ processTarget?: import("node:events").EventEmitter & { pid?: number, exitCode?: number }, reemitSignal?: (signal: NodeJS.Signals) => void, removeFixture?: (target: string) => Promise<void> }} signalOptions
 */
export async function withTemporaryArticleFixtures(
  { articlesDirectory, fixtures },
  operation,
  {
    processTarget = process,
    reemitSignal = (signal) =>
      reemitCmsFixtureSignal(signal, { processTarget }),
    removeFixture = (target) => rm(target, { force: false }),
  } = {},
) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error("At least one CMS fixture is required.");
  }
  if (typeof operation !== "function") {
    throw new TypeError("CMS fixture operation must be a function.");
  }
  const targets = await Promise.all(
    fixtures.map(async (fixture) => {
      const lexicalTarget = fixtureTarget(articlesDirectory, fixture);
      const safeTarget = await resolveSafeArticleTarget(
        articlesDirectory,
        fixture.slug,
      );
      if (safeTarget !== lexicalTarget) {
        throw new Error("CMS fixture target changed during path verification.");
      }
      return safeTarget;
    }),
  );
  if (new Set(targets).size !== targets.length) {
    throw new Error("CMS fixture targets must be unique.");
  }

  if (
    !processTarget ||
    typeof processTarget.on !== "function" ||
    typeof processTarget.off !== "function"
  ) {
    throw new TypeError("Signal process target must support on() and off().");
  }
  if (typeof reemitSignal !== "function") {
    throw new TypeError("Signal re-emitter must be a function.");
  }
  if (typeof removeFixture !== "function") {
    throw new TypeError("Fixture remover must be a function.");
  }

  const createdTargets = [];
  let activeChild;
  let receivedSignal;
  const signalHandlers = new Map(
    ["SIGINT", "SIGTERM"].map((signal) => [
      signal,
      () => {
        if (receivedSignal) return;
        receivedSignal = signal;
        if (activeChild && typeof activeChild.kill === "function") {
          activeChild.kill(signal);
        }
      },
    ]),
  );
  const signalControl = {
    trackChild(child) {
      if (!child || typeof child.kill !== "function") {
        throw new TypeError("Tracked build child must support kill().");
      }
      activeChild = child;
      if (receivedSignal) child.kill(receivedSignal);
      return () => {
        if (activeChild === child) activeChild = undefined;
      };
    },
    throwIfSignaled() {
      if (receivedSignal) {
        throw new CmsFixtureSignalError(receivedSignal);
      }
    },
  };
  for (const [signal, handler] of signalHandlers) {
    processTarget.on(signal, handler);
  }

  let result;
  let operationError;
  let cleanupError;
  try {
    try {
      signalControl.throwIfSignaled();
      const writes = await Promise.allSettled(
        fixtures.map(async (fixture, index) => {
          await writeFile(targets[index], fixture.source, {
            encoding: "utf8",
            flag: "wx",
          });
          createdTargets.push(targets[index]);
        }),
      );
      const rejected = writes.find((entry) => entry.status === "rejected");
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
      signalControl.throwIfSignaled();
      result = await operation(targets, signalControl);
    } catch (error) {
      operationError = error;
    }
  } finally {
    try {
      const cleanupResults = await Promise.allSettled(
        createdTargets.map((target) =>
          Promise.resolve().then(() => removeFixture(target)),
        ),
      );
      const cleanupFailures = cleanupResults
        .filter((entry) => entry.status === "rejected")
        .map((entry) => entry.reason);
      if (cleanupFailures.length > 0) {
        cleanupError = new AggregateError(
          cleanupFailures,
          "Unable to remove every owned CMS fixture.",
        );
      }
    } finally {
      for (const [signal, handler] of signalHandlers) {
        processTarget.off(signal, handler);
      }
    }
  }

  if (receivedSignal) {
    reemitSignal(receivedSignal);
    const cause =
      operationError && cleanupError
        ? new AggregateError(
            [operationError, cleanupError],
            "CMS fixture operation and cleanup both failed.",
          )
        : (operationError ?? cleanupError);
    throw new CmsFixtureSignalError(receivedSignal, { cause });
  }
  if (cleanupError) throw cleanupError;
  if (operationError) throw operationError;
  return result;
}

export class CmsFixtureSignalError extends Error {
  constructor(signal, options = {}) {
    super(`CMS fixture interrupted by ${signal}.`, options);
    this.name = "CmsFixtureSignalError";
    this.code = "CMS_FIXTURE_SIGNAL";
    this.signal = signal;
  }
}

/**
 * @param {NodeJS.Signals} signal
 * @param {{ processTarget?: { pid: number, exitCode?: number }, killProcess?: (pid: number, signal: NodeJS.Signals) => boolean }} options
 */
export function reemitCmsFixtureSignal(
  signal,
  { processTarget = process, killProcess = process.kill.bind(process) } = {},
) {
  let delivered;
  try {
    delivered = killProcess(processTarget.pid, signal);
  } catch {
    delivered = false;
  }
  if (delivered === false) {
    processTarget.exitCode = signal === "SIGINT" ? 130 : 143;
  }
}

async function assertNoLinkedPathComponents(candidate, label) {
  const resolved = path.resolve(candidate);
  const { root } = path.parse(resolved);
  const parts = path.relative(root, resolved).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    const stats = await lstat(current);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `${label} contains a symbolic link or junction: ${current}`,
      );
    }
  }
}

async function requireDirectory(directory, label, canonicalRoot) {
  await assertNoLinkedPathComponents(directory, label);
  const stats = await lstat(directory);
  if (!stats.isDirectory()) {
    throw new Error(
      `CMS fixture check requires the ${label} directory: ${directory}`,
    );
  }
  const canonicalDirectory = await realpath(directory);
  if (canonicalRoot) {
    assertCanonicalContainment(canonicalRoot, canonicalDirectory, label);
  }
  return canonicalDirectory;
}

async function listFilesRecursively(
  directory,
  canonicalRoot,
  relativeDirectory = "",
) {
  const files = [];
  const entries = (await readdir(directory)).sort((left, right) =>
    left.localeCompare(right),
  );
  for (const name of entries) {
    const relativePath = relativeDirectory
      ? path.join(relativeDirectory, name)
      : name;
    const absolutePath = path.join(directory, name);
    const stats = await lstat(absolutePath);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Built output contains a symbolic link or junction: ${absolutePath}`,
      );
    }
    assertCanonicalContainment(
      canonicalRoot,
      await realpath(absolutePath),
      "Built output",
    );
    if (stats.isDirectory()) {
      files.push(
        ...(await listFilesRecursively(
          absolutePath,
          canonicalRoot,
          relativePath,
        )),
      );
    } else if (stats.isFile()) {
      files.push({ absolutePath, relativePath });
    } else {
      throw new Error(`Built output must be a regular file: ${absolutePath}`);
    }
  }
  return files;
}

async function requireFile(filePath, label, canonicalRoot) {
  try {
    await assertNoLinkedPathComponents(filePath, `Built ${label}`);
    if (!(await lstat(filePath)).isFile()) {
      throw new Error(`Built ${label} is not a regular file.`);
    }
    assertCanonicalContainment(
      canonicalRoot,
      await realpath(filePath),
      `Built ${label}`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /symbolic link|junction|canonical|regular file/i.test(error.message)
    ) {
      throw error;
    }
    throw new Error(
      `CMS fixture check requires the built ${label}: ${filePath}`,
      { cause: error },
    );
  }
}

function assertExactInventory(actualValues, expectedValues, label) {
  const actual = [...new Set(actualValues)].sort();
  const expected = [...new Set(expectedValues)].sort();
  const missing = expected.filter((value) => !actual.includes(value));
  const unexpected = actual.filter((value) => !expected.includes(value));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `CMS fixture ${label} set differs from published sources; missing ${JSON.stringify(missing)}, unexpected ${JSON.stringify(unexpected)}.`,
    );
  }
}

/**
 * @param {{ projectRoot: string, expectedPublishedSlugs: string[], fixtureSlugs?: string[], fixtureTitles?: string[] }} options
 */
export async function validateCmsBuildOutput({
  projectRoot,
  expectedPublishedSlugs,
  fixtureSlugs = CMS_FIXTURE_SLUGS,
  fixtureTitles = [],
}) {
  if (!Array.isArray(expectedPublishedSlugs)) {
    throw new TypeError(
      "Expected published slugs must be supplied as an array.",
    );
  }
  for (const slug of expectedPublishedSlugs) validateArticleSlug(slug);
  if (new Set(expectedPublishedSlugs).size !== expectedPublishedSlugs.length) {
    throw new Error("Expected published slugs must be unique.");
  }
  const resolvedRoot = path.resolve(projectRoot);
  const canonicalRoot = await requireDirectory(resolvedRoot, "project root");
  const distDirectory = path.join(resolvedRoot, "dist");
  const canonicalDist = await requireDirectory(
    distDirectory,
    "built output",
    canonicalRoot,
  );
  const articleDirectory = path.join(distDirectory, "articles");
  await requireDirectory(articleDirectory, "article output", canonicalDist);
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
    requiredSurfaces.map(([filePath, label]) =>
      requireFile(filePath, label, canonicalDist),
    ),
  );

  const distFiles = await listFilesRecursively(distDirectory, canonicalDist);
  const sitemapXml = distFiles.filter(({ relativePath }) =>
    /(?:^|[\\/])sitemap[^\\/]*\.xml$/i.test(relativePath),
  );
  if (sitemapXml.length === 0) {
    throw new Error("CMS fixture check requires the generated XML sitemap.");
  }

  const publicArticleRoutes = [];
  for (const name of await readdir(articleDirectory)) {
    const candidate = path.join(articleDirectory, name);
    const stats = await lstat(candidate);
    if (stats.isDirectory()) publicArticleRoutes.push(name);
  }
  assertExactInventory(
    publicArticleRoutes,
    expectedPublishedSlugs,
    "article route",
  );
  await Promise.all(
    publicArticleRoutes.map((slug) =>
      requireFile(
        path.join(articleDirectory, slug, "index.html"),
        `article route ${slug}`,
        canonicalDist,
      ),
    ),
  );

  const forbiddenFixtureValues = [
    ...fixtureSlugs.map((value) => ({ kind: "slug", value })),
    ...fixtureTitles.map((value) => ({ kind: "title", value })),
  ];
  for (const { absolutePath, relativePath } of distFiles) {
    for (const { kind, value } of forbiddenFixtureValues) {
      if (relativePath.includes(value)) {
        throw new Error(
          `CMS fixture ${kind} ${value} leaked into built path ${relativePath}.`,
        );
      }
    }
    if (!TEXT_PUBLIC_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
      continue;
    }
    const contents = await readFile(absolutePath, "utf8");
    for (const { kind, value } of forbiddenFixtureValues) {
      if (contents.includes(value)) {
        throw new Error(
          `CMS fixture ${kind} ${value} leaked into ${relativePath}.`,
        );
      }
    }
  }

  const socialDirectory = path.join(resolvedRoot, "public", "social");
  const canonicalSocial = await requireDirectory(
    socialDirectory,
    "social output",
    canonicalRoot,
  );
  const socialEntries = [];
  for (const name of await readdir(socialDirectory)) {
    const candidate = path.join(socialDirectory, name);
    const stats = await lstat(candidate);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Social output contains a symbolic link or junction: ${candidate}`,
      );
    }
    if (!stats.isFile()) {
      throw new Error(`Social output must be a regular file: ${candidate}`);
    }
    assertCanonicalContainment(
      canonicalSocial,
      await realpath(candidate),
      "Social output",
    );
    socialEntries.push(name);
  }
  const articleSocialImages = socialEntries.filter((name) =>
    /^article-.+\.png$/.test(name),
  );
  assertExactInventory(
    articleSocialImages,
    expectedPublishedSlugs.map((slug) => `article-${slug}.png`),
    "article social image",
  );
  for (const name of socialEntries) {
    for (const { kind, value } of forbiddenFixtureValues) {
      if (name.includes(value)) {
        throw new Error(
          `CMS fixture ${kind} ${value} leaked into social inventory ${name}.`,
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

export async function runProductionBuild({
  projectRoot,
  signalControl,
  environment = process.env,
}) {
  if (!environment || typeof environment !== "object") {
    throw new TypeError("CMS fixture build environment must be an object.");
  }
  signalControl?.throwIfSignaled();
  await new Promise((resolve, reject) => {
    const { command, args } = resolveNpmBuildInvocation();
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    const releaseChild = signalControl?.trackChild(child) ?? (() => undefined);
    child.once("error", (error) => {
      releaseChild();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      releaseChild();
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
  signalOptions,
} = {}) {
  const articlesDirectory = path.join(
    projectRoot,
    "src",
    "content",
    "articles",
  );
  const verifiedRecords = await readVerifiedArticleRecords(articlesDirectory);
  const expectedPublishedSlugs = publishedSlugsFromRecords(verifiedRecords);
  const fixtures = createCmsLifecycleFixturesFromRecords(verifiedRecords);
  return withTemporaryArticleFixtures(
    { articlesDirectory, fixtures },
    async (targets, signalControl) => {
      await runBuild({
        fixtureTargets: targets,
        projectRoot,
        signalControl,
      });
      return validateCmsBuildOutput({
        projectRoot,
        expectedPublishedSlugs,
        fixtureSlugs: fixtures.map(({ slug }) => slug),
        fixtureTitles: fixtures.map(({ title }) => title),
      });
    },
    signalOptions,
  );
}

export async function withIsolatedCmsWorktree(
  { projectRoot, signalControl },
  operation,
) {
  if (typeof operation !== "function") {
    throw new TypeError("Isolated CMS worktree operation must be callable.");
  }
  const resolvedProjectRoot = path.resolve(projectRoot);
  signalControl?.throwIfSignaled();
  resolveBuildGitSha({ repositoryRoot: resolvedProjectRoot });
  signalControl?.throwIfSignaled();

  let temporaryRoot;
  let worktreeRoot;
  let linkedNodeModules;
  let worktreeCreated = false;
  let nodeModulesLinked = false;
  let result;
  let operationError;
  const cleanupErrors = [];

  try {
    temporaryRoot = await mkdtemp(
      path.join(tmpdir(), "eti-cms-fixture-worktree-"),
    );
    worktreeRoot = path.join(temporaryRoot, "checkout");
    linkedNodeModules = path.join(worktreeRoot, "node_modules");
    signalControl?.throwIfSignaled();
    await runGitCommand(
      resolvedProjectRoot,
      ["worktree", "add", "--detach", "--quiet", worktreeRoot, "HEAD"],
      "Unable to create an isolated CMS fixture worktree.",
    );
    worktreeCreated = true;
    signalControl?.throwIfSignaled();

    const sourceNodeModules = path.join(resolvedProjectRoot, "node_modules");
    const nodeModulesStats = await lstat(sourceNodeModules);
    if (!nodeModulesStats.isDirectory()) {
      throw new Error(
        `CMS fixture check requires installed dependencies: ${sourceNodeModules}`,
      );
    }
    signalControl?.throwIfSignaled();
    await symlink(
      sourceNodeModules,
      linkedNodeModules,
      process.platform === "win32" ? "junction" : "dir",
    );
    nodeModulesLinked = true;
    signalControl?.throwIfSignaled();
    result = await operation(worktreeRoot);
  } catch (error) {
    operationError = error;
  } finally {
    if (nodeModulesLinked) {
      try {
        const linkedStats = await lstat(linkedNodeModules);
        if (!linkedStats.isSymbolicLink()) {
          cleanupErrors.push(
            new Error(
              "Refusing to remove a node_modules path that is not the owned worktree link.",
            ),
          );
        } else {
          await unlink(linkedNodeModules);
        }
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (worktreeCreated) {
      try {
        await runGitCommand(
          resolvedProjectRoot,
          ["worktree", "remove", "--force", worktreeRoot],
          "Unable to remove the isolated CMS fixture worktree.",
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (temporaryRoot) {
      try {
        await rm(temporaryRoot, { force: true, recursive: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }

  if (cleanupErrors.length > 0) {
    const cleanupError = new AggregateError(
      cleanupErrors,
      "Unable to fully clean the isolated CMS fixture worktree.",
    );
    if (operationError) {
      throw new AggregateError(
        [operationError, cleanupError],
        "CMS fixture operation and worktree cleanup both failed.",
      );
    }
    throw cleanupError;
  }
  if (operationError) throw operationError;
  return result;
}

export async function runIsolatedCmsLifecycleFixture({
  projectRoot = repositoryRoot,
  baseEnvironment = process.env,
  processTarget = process,
  reemitSignal = (signal) => reemitCmsFixtureSignal(signal, { processTarget }),
} = {}) {
  if (
    !processTarget ||
    typeof processTarget.on !== "function" ||
    typeof processTarget.off !== "function"
  ) {
    throw new TypeError("Signal process target must support on() and off().");
  }
  if (typeof reemitSignal !== "function") {
    throw new TypeError("Signal re-emitter must be a function.");
  }

  let receivedSignal;
  let result;
  let operationError;
  const signalHandlers = new Map(
    ["SIGINT", "SIGTERM"].map((signal) => [
      signal,
      () => {
        receivedSignal ??= signal;
      },
    ]),
  );
  const signalControl = {
    throwIfSignaled() {
      if (receivedSignal) {
        throw new CmsFixtureSignalError(receivedSignal);
      }
    },
  };
  for (const [signal, handler] of signalHandlers) {
    processTarget.on(signal, handler);
  }

  try {
    result = await withIsolatedCmsWorktree(
      { projectRoot, signalControl },
      async (isolatedProjectRoot) =>
        runCmsLifecycleFixture({
          projectRoot: isolatedProjectRoot,
          runBuild: async ({ fixtureTargets, signalControl }) => {
            const fixtureGitSha = await commitCmsFixtureInputs(
              isolatedProjectRoot,
              fixtureTargets,
            );
            await runProductionBuild({
              environment: resolveCmsFixtureBuildEnvironment({
                baseEnvironment,
                fixtureGitSha,
              }),
              projectRoot: isolatedProjectRoot,
              signalControl,
            });
          },
          signalOptions: {
            processTarget,
            reemitSignal: (signal) => {
              receivedSignal ??= signal;
            },
          },
        }),
    );
  } catch (error) {
    operationError = error;
  } finally {
    for (const [signal, handler] of signalHandlers) {
      processTarget.off(signal, handler);
    }
  }

  if (receivedSignal) reemitSignal(receivedSignal);
  if (operationError) throw operationError;
  return result;
}

async function main() {
  const result = await runIsolatedCmsLifecycleFixture();
  console.log(
    `CMS fixture: PASS (${result.publicArticleRoutes} public article routes; ${result.checkedFixtures} nonpublic lifecycle fixtures excluded).`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    if (error?.code === "CMS_FIXTURE_SIGNAL") return;
    console.error(
      `CMS fixture: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

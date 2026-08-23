import { lstat, mkdir, readdir, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

export const CAPTURE_WIDTHS = Object.freeze([390, 768, 1440]);
export const CAPTURE_HEIGHT = 900;
export const CAPTURE_ROUTES = Object.freeze([
  Object.freeze({ alias: "home", path: "/", status: 200 }),
  Object.freeze({
    alias: "category",
    path: "/categories/cybersecurity-data-protection/",
    status: 200,
  }),
  Object.freeze({
    alias: "article",
    path: "/articles/back-up-business-files-with-the-3-2-1-method/",
    status: 200,
  }),
  Object.freeze({ alias: "toolkit", path: "/toolkit/", status: 200 }),
  Object.freeze({ alias: "about", path: "/about/", status: 200 }),
  Object.freeze({
    alias: "editorial-standards",
    path: "/editorial-standards/",
    status: 200,
  }),
  Object.freeze({ alias: "contact", path: "/contact/", status: 200 }),
  Object.freeze({
    alias: "404",
    path: "/publication-after-capture-route-that-does-not-exist/",
    status: 404,
  }),
]);

const CAPTURE_FILE_NAMES = Object.freeze(
  CAPTURE_WIDTHS.flatMap((width) =>
    CAPTURE_ROUTES.flatMap(({ alias }) => [
      `${width}-${alias}-above-fold.png`,
      `${width}-${alias}-full.png`,
    ]),
  ),
);
const captureFileNameSet = new Set(CAPTURE_FILE_NAMES);

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixedAuditSegments = ["artifacts", "site-audit", "after"];

export function createCapturePaths(repositoryRootCandidate = repositoryRoot) {
  const resolvedRepositoryRoot = path.resolve(repositoryRootCandidate);
  const auditRoot = path.join(resolvedRepositoryRoot, ...fixedAuditSegments);
  return Object.freeze({
    auditRoot,
    backupDirectory: path.join(auditRoot, ".production-capture.backup"),
    outputDirectory: path.join(auditRoot, "production"),
    pendingDirectory: path.join(auditRoot, ".production-capture.pending"),
    repositoryRoot: resolvedRepositoryRoot,
  });
}

const defaultCapturePaths = createCapturePaths();

function normalizedPathKey(candidate) {
  const resolved = path.resolve(candidate);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function pathsAreEqual(left, right) {
  return normalizedPathKey(left) === normalizedPathKey(right);
}

function pathIsWithin(root, candidate) {
  const relativePath = path.relative(
    path.resolve(root),
    path.resolve(candidate),
  );
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function isMissingPathError(error) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function captureFileSystem(overrides = {}) {
  return {
    lstatImpl: lstat,
    mkdirImpl: mkdir,
    readdirImpl: readdir,
    realpathImpl: realpath,
    renameImpl: rename,
    rmImpl: rm,
    ...overrides,
  };
}

function assertFixedCaptureLayout(paths) {
  const expected = createCapturePaths(paths.repositoryRoot);
  for (const key of [
    "repositoryRoot",
    "auditRoot",
    "pendingDirectory",
    "outputDirectory",
    "backupDirectory",
  ]) {
    if (!pathsAreEqual(paths[key], expected[key])) {
      throw new Error(`Capture ${key} is outside the fixed audit layout.`);
    }
  }
  if (!pathIsWithin(paths.repositoryRoot, paths.auditRoot)) {
    throw new Error("Capture audit root is outside the repository root.");
  }
}

async function pathExists(candidate, { lstatImpl }) {
  try {
    await lstatImpl(candidate);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
  }
}

async function assertNoLinkedPathComponents(candidate, { lstatImpl }) {
  const resolvedCandidate = path.resolve(candidate);
  const parsed = path.parse(resolvedCandidate);
  const components = path
    .relative(parsed.root, resolvedCandidate)
    .split(path.sep)
    .filter(Boolean);
  let current = parsed.root;

  for (const component of components) {
    current = path.join(current, component);
    try {
      const stats = await lstatImpl(current);
      if (stats.isSymbolicLink()) {
        throw new Error(
          `Capture path contains a symbolic link or junction: ${current}`,
        );
      }
    } catch (error) {
      if (isMissingPathError(error)) return;
      throw error;
    }
  }
}

async function nearestExistingAncestor(candidate, fileSystem) {
  let current = path.resolve(candidate);
  while (!(await pathExists(current, fileSystem))) {
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        `Could not resolve an existing ancestor for ${candidate}.`,
      );
    }
    current = parent;
  }
  return current;
}

function isExpectedOutputPath(paths, candidate) {
  return (
    pathsAreEqual(path.dirname(candidate), paths.pendingDirectory) &&
    captureFileNameSet.has(path.basename(candidate))
  );
}

async function assertSafeOwnedCapturePath(paths, candidate, overrides = {}) {
  assertFixedCaptureLayout(paths);
  const fileSystem = captureFileSystem(overrides);
  const resolvedCandidate = path.resolve(candidate);
  const isOwnedDirectory = [
    paths.auditRoot,
    paths.pendingDirectory,
    paths.outputDirectory,
    paths.backupDirectory,
  ].some((ownedPath) => pathsAreEqual(ownedPath, resolvedCandidate));
  if (!isOwnedDirectory && !isExpectedOutputPath(paths, resolvedCandidate)) {
    throw new Error(
      `Capture path is outside the owned audit outputs: ${candidate}`,
    );
  }

  await assertNoLinkedPathComponents(resolvedCandidate, fileSystem);
  if (!(await pathExists(paths.auditRoot, fileSystem))) {
    if (pathsAreEqual(resolvedCandidate, paths.auditRoot)) return;
    throw new Error("Capture audit root does not exist.");
  }

  const [resolvedRepositoryRoot, resolvedAuditRoot] = await Promise.all([
    fileSystem.realpathImpl(paths.repositoryRoot),
    fileSystem.realpathImpl(paths.auditRoot),
  ]);
  const expectedResolvedAuditRoot = path.join(
    resolvedRepositoryRoot,
    ...fixedAuditSegments,
  );
  if (!pathsAreEqual(resolvedAuditRoot, expectedResolvedAuditRoot)) {
    throw new Error(
      "Resolved capture audit root escaped the repository layout.",
    );
  }

  const existingAncestor = await nearestExistingAncestor(
    resolvedCandidate,
    fileSystem,
  );
  const resolvedAncestor = await fileSystem.realpathImpl(existingAncestor);
  if (!pathIsWithin(resolvedAuditRoot, resolvedAncestor)) {
    throw new Error(
      `Resolved capture path escaped the repository audit root: ${candidate}`,
    );
  }
}

async function assertNoLinkedDescendants(candidate, overrides = {}) {
  const fileSystem = captureFileSystem(overrides);
  let stats;
  try {
    stats = await fileSystem.lstatImpl(candidate);
  } catch (error) {
    if (isMissingPathError(error)) return;
    throw error;
  }
  if (stats.isSymbolicLink()) {
    throw new Error(
      `Capture path contains a symbolic link or junction: ${candidate}`,
    );
  }
  if (!stats.isDirectory()) return;

  const entries = await fileSystem.readdirImpl(candidate, {
    withFileTypes: true,
  });
  for (const entry of entries) {
    const child = path.join(candidate, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Capture path contains a symbolic link or junction: ${child}`,
      );
    }
    if (entry.isDirectory()) {
      await assertNoLinkedDescendants(child, fileSystem);
    }
  }
}

async function safeRemoveCaptureDirectory(paths, candidate, overrides = {}) {
  if (pathsAreEqual(candidate, paths.auditRoot)) {
    throw new Error("Refusing to recursively remove the capture audit root.");
  }
  const fileSystem = captureFileSystem(overrides);
  await assertSafeOwnedCapturePath(paths, candidate, fileSystem);
  await assertNoLinkedDescendants(candidate, fileSystem);
  await fileSystem.rmImpl(candidate, { force: true, recursive: true });
}

export async function assertSafeCaptureOutputPath(
  paths,
  outputPath,
  overrides = {},
) {
  if (!isExpectedOutputPath(paths, outputPath)) {
    throw new Error(`Unexpected production capture filename: ${outputPath}`);
  }
  await assertSafeOwnedCapturePath(paths, outputPath, overrides);
}

export async function prepareCaptureWorkspace(paths, overrides = {}) {
  assertFixedCaptureLayout(paths);
  const fileSystem = captureFileSystem(overrides);
  await assertNoLinkedPathComponents(paths.auditRoot, fileSystem);
  await fileSystem.mkdirImpl(paths.auditRoot, { recursive: true });
  await assertSafeOwnedCapturePath(paths, paths.auditRoot, fileSystem);
  for (const candidate of [
    paths.pendingDirectory,
    paths.outputDirectory,
    paths.backupDirectory,
  ]) {
    await assertSafeOwnedCapturePath(paths, candidate, fileSystem);
  }

  const backupExists = await pathExists(paths.backupDirectory, fileSystem);
  const outputExists = await pathExists(paths.outputDirectory, fileSystem);
  if (backupExists && outputExists) {
    await safeRemoveCaptureDirectory(paths, paths.backupDirectory, fileSystem);
  } else if (backupExists) {
    await fileSystem.renameImpl(paths.backupDirectory, paths.outputDirectory);
  }

  await safeRemoveCaptureDirectory(paths, paths.pendingDirectory, fileSystem);
  await fileSystem.mkdirImpl(paths.pendingDirectory);
  await assertSafeOwnedCapturePath(paths, paths.pendingDirectory, fileSystem);
}

export function normalizeCaptureOrigin(candidate) {
  if (typeof candidate !== "string" || candidate.trim() !== candidate) {
    throw new TypeError(
      "Capture origin must be an explicit HTTPS origin without credentials, path, query, or hash.",
    );
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new TypeError(
      "Capture origin must be an explicit HTTPS origin without credentials, path, query, or hash.",
    );
  }

  const lexicalOrigin =
    candidate === parsed.origin || candidate === `${parsed.origin}/`;
  if (
    !lexicalOrigin ||
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new TypeError(
      "Capture origin must be an explicit HTTPS origin without credentials, path, query, or hash.",
    );
  }

  return parsed.origin;
}

export function parseCaptureOrigin(arguments_) {
  const originIndexes = arguments_.flatMap((argument, index) =>
    argument === "--origin" ? [index] : [],
  );
  if (originIndexes.length !== 1) {
    throw new TypeError("Provide exactly one --origin HTTPS origin.");
  }
  const originIndex = originIndexes[0];
  const candidate = arguments_[originIndex + 1];
  if (!candidate || candidate.startsWith("--")) {
    throw new TypeError("The --origin option requires an HTTPS origin.");
  }
  if (arguments_.length !== 2 || originIndex !== 0) {
    throw new TypeError("Unexpected option; only --origin is supported.");
  }
  return normalizeCaptureOrigin(candidate);
}

export function buildCapturePlan(candidate) {
  const origin = normalizeCaptureOrigin(candidate);
  return CAPTURE_WIDTHS.flatMap((width) =>
    CAPTURE_ROUTES.flatMap((route) =>
      ["above-fold", "full"].map((variant) => ({
        ...route,
        deviceScaleFactor: 1,
        fileName: `${width}-${route.alias}-${variant}.png`,
        fullPage: variant === "full",
        height: CAPTURE_HEIGHT,
        url: new URL(route.path, `${origin}/`).href,
        variant,
        width,
      })),
    ),
  );
}

export function assertExpectedNavigation(response, { route, url }) {
  if (!response) {
    throw new Error(
      `${route.path} returned no response; expected ${route.status}.`,
    );
  }
  const redirectedFrom = response.request().redirectedFrom();
  if (redirectedFrom) {
    throw new Error(
      `${route.path} followed an unexpected redirect chain before returning ${response.url()}.`,
    );
  }
  if (response.status() !== route.status) {
    throw new Error(
      `${route.path} returned ${response.status()}; expected ${route.status}.`,
    );
  }
  if (response.url() !== url) {
    throw new Error(
      `${route.path} unexpectedly redirected to ${response.url()}.`,
    );
  }
}

export async function publishCaptureRun(paths, overrides = {}) {
  assertFixedCaptureLayout(paths);
  const fileSystem = captureFileSystem(overrides);
  for (const candidate of [
    paths.pendingDirectory,
    paths.outputDirectory,
    paths.backupDirectory,
  ]) {
    await assertSafeOwnedCapturePath(paths, candidate, fileSystem);
  }

  let outputExists = await pathExists(paths.outputDirectory, fileSystem);
  const staleBackupExists = await pathExists(paths.backupDirectory, fileSystem);
  if (staleBackupExists && outputExists) {
    await safeRemoveCaptureDirectory(paths, paths.backupDirectory, fileSystem);
  } else if (staleBackupExists) {
    await fileSystem.renameImpl(paths.backupDirectory, paths.outputDirectory);
    outputExists = true;
  }

  let priorEvidenceStaged = false;
  if (outputExists) {
    await fileSystem.renameImpl(paths.outputDirectory, paths.backupDirectory);
    priorEvidenceStaged = true;
  }

  try {
    await fileSystem.renameImpl(paths.pendingDirectory, paths.outputDirectory);
  } catch (publishError) {
    try {
      const pendingExists = await pathExists(
        paths.pendingDirectory,
        fileSystem,
      );
      const newOutputExists = await pathExists(
        paths.outputDirectory,
        fileSystem,
      );
      if (newOutputExists && !pendingExists) {
        await assertSafeOwnedCapturePath(
          paths,
          paths.outputDirectory,
          fileSystem,
        );
        await fileSystem.renameImpl(
          paths.outputDirectory,
          paths.pendingDirectory,
        );
      } else if (newOutputExists) {
        await safeRemoveCaptureDirectory(
          paths,
          paths.outputDirectory,
          fileSystem,
        );
      }

      if (priorEvidenceStaged) {
        await assertSafeOwnedCapturePath(
          paths,
          paths.backupDirectory,
          fileSystem,
        );
        await fileSystem.renameImpl(
          paths.backupDirectory,
          paths.outputDirectory,
        );
      }
    } catch (rollbackError) {
      throw new AggregateError(
        [publishError, rollbackError],
        "Production evidence publication failed and prior evidence could not be restored.",
        { cause: rollbackError },
      );
    }
    throw publishError;
  }

  if (priorEvidenceStaged) {
    await safeRemoveCaptureDirectory(paths, paths.backupDirectory, fileSystem);
  }
}

function createRuntimeMonitor(page, origin, route) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const locationUrl = message.location().url;
    const expectedMissingRouteNoise =
      route.status === 404 &&
      locationUrl === new URL(route.path, `${origin}/`).href &&
      /Failed to load resource.*404/i.test(message.text());
    if (!expectedMissingRouteNoise) {
      errors.push(`console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`page error: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    errors.push(
      `request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown error"})`,
    );
  });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (["http:", "https:"].includes(requestUrl.protocol)) {
      if (requestUrl.origin !== origin) {
        errors.push(`cross-origin request: ${request.url()}`);
      }
    }
  });
  return errors;
}

async function stabilizePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await Promise.all([
      globalThis.document.fonts.load('1rem "Newsreader Variable"'),
      globalThis.document.fonts.load('1rem "Source Sans 3 Variable"'),
      globalThis.document.fonts.ready,
    ]);
    await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
  });
}

export async function captureProductionScreenshots(candidate) {
  const origin = normalizeCaptureOrigin(candidate);
  const expectedNames = buildCapturePlan(origin).map(
    ({ fileName }) => fileName,
  );
  const paths = defaultCapturePaths;
  await prepareCaptureWorkspace(paths);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of CAPTURE_WIDTHS) {
      const context = await browser.newContext({
        colorScheme: "light",
        deviceScaleFactor: 1,
        locale: "en-US",
        reducedMotion: "reduce",
        timezoneId: "America/Los_Angeles",
        viewport: { height: CAPTURE_HEIGHT, width },
      });
      try {
        for (const route of CAPTURE_ROUTES) {
          const page = await context.newPage();
          const runtimeErrors = createRuntimeMonitor(page, origin, route);
          const url = new URL(route.path, `${origin}/`).href;
          const response = await page.goto(url, { waitUntil: "networkidle" });
          assertExpectedNavigation(response, { route, url });
          await stabilizePage(page);
          const aboveFoldPath = path.join(
            paths.pendingDirectory,
            `${width}-${route.alias}-above-fold.png`,
          );
          await assertSafeCaptureOutputPath(paths, aboveFoldPath);
          await page.screenshot({
            animations: "disabled",
            caret: "hide",
            path: aboveFoldPath,
            scale: "css",
          });
          const fullPagePath = path.join(
            paths.pendingDirectory,
            `${width}-${route.alias}-full.png`,
          );
          await assertSafeCaptureOutputPath(paths, fullPagePath);
          await page.screenshot({
            animations: "disabled",
            caret: "hide",
            fullPage: true,
            path: fullPagePath,
            scale: "css",
          });
          await page.close();
          if (runtimeErrors.length > 0) {
            throw new Error(`${route.path}: ${runtimeErrors.join("; ")}`);
          }
        }
      } finally {
        await context.close();
      }
    }

    const actualNames = (await readdir(paths.pendingDirectory)).sort();
    const sortedExpectedNames = [...expectedNames].sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(sortedExpectedNames)) {
      throw new Error(
        `Capture inventory mismatch: expected ${sortedExpectedNames.length}, found ${actualNames.length}.`,
      );
    }
    for (const name of sortedExpectedNames) {
      await assertSafeCaptureOutputPath(
        paths,
        path.join(paths.pendingDirectory, name),
      );
    }
  } catch (error) {
    try {
      await safeRemoveCaptureDirectory(paths, paths.pendingDirectory);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Production capture failed and its pending output could not be removed safely.",
        { cause: cleanupError },
      );
    }
    throw error;
  } finally {
    await browser.close();
  }

  await publishCaptureRun(paths);
  return {
    count: expectedNames.length,
    origin,
    outputDirectory: paths.outputDirectory,
  };
}

async function main() {
  const origin = parseCaptureOrigin(process.argv.slice(2));
  const result = await captureProductionScreenshots(origin);
  console.log(
    `Production capture: PASS (${result.count} PNGs from ${result.origin} written to ${result.outputDirectory}).`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `Production capture: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

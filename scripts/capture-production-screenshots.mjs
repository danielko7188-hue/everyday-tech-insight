import { execFile } from "node:child_process";
import { lstat, mkdir, readdir, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { chromium } from "@playwright/test";

import { REPRESENTATIVE_ARTICLE_PATHS } from "./publication-route-inventory.mjs";
import {
  normalizeAuditOrigin,
  writeAuditManifest,
} from "./write-audit-manifest.mjs";
import { BUILD_GIT_SHA_META_NAME } from "../src/utils/build-provenance.mjs";

const execFileAsync = promisify(execFile);

export const CAPTURE_PHASES = Object.freeze([
  "before",
  "after-local",
  "after-production",
  "runtime-verification",
]);
export const CAPTURE_WIDTHS = Object.freeze([
  320, 390, 600, 768, 1024, 1280, 1440, 1920,
]);
export const CAPTURE_HEIGHT = 900;
export const RELEASE_EVIDENCE_ID = "premium-spatial-2026-08-26";
export const BEFORE_CAPTURE_ROUTES = Object.freeze([
  Object.freeze({ alias: "home", path: "/", status: 200 }),
  Object.freeze({ alias: "articles", path: "/articles/", status: 200 }),
  Object.freeze({
    alias: "category-cybersecurity",
    path: "/categories/cybersecurity-data-protection/",
    status: 200,
  }),
  ...(REPRESENTATIVE_ARTICLE_PATHS.primary
    ? [
        Object.freeze({
          alias: "article-ai-automation",
          path: REPRESENTATIVE_ARTICLE_PATHS.primary,
          status: 200,
        }),
      ]
    : []),
  Object.freeze({ alias: "toolkit", path: "/toolkit/", status: 200 }),
  Object.freeze({ alias: "about", path: "/about/", status: 200 }),
  Object.freeze({
    alias: "editorial-standards",
    path: "/editorial-standards/",
    status: 200,
  }),
  Object.freeze({
    alias: "404",
    path: "/publication-audit-route-that-does-not-exist/",
    status: 404,
  }),
]);
export const AFTER_CAPTURE_ROUTES = Object.freeze([
  Object.freeze({ alias: "home", path: "/", status: 200 }),
  Object.freeze({ alias: "articles", path: "/articles/", status: 200 }),
  Object.freeze({ alias: "categories", path: "/categories/", status: 200 }),
  Object.freeze({
    alias: "category-cybersecurity",
    path: "/categories/cybersecurity-data-protection/",
    status: 200,
  }),
  ...(REPRESENTATIVE_ARTICLE_PATHS.primary
    ? [
        Object.freeze({
          alias: "article-ai-automation",
          path: REPRESENTATIVE_ARTICLE_PATHS.primary,
          status: 200,
        }),
      ]
    : []),
  ...(REPRESENTATIVE_ARTICLE_PATHS.saasEvaluation
    ? [
        Object.freeze({
          alias: "article-saas-evaluation",
          path: REPRESENTATIVE_ARTICLE_PATHS.saasEvaluation,
          status: 200,
        }),
      ]
    : []),
  ...(REPRESENTATIVE_ARTICLE_PATHS.securityWorkflow
    ? [
        Object.freeze({
          alias: "article-phishing-response",
          path: REPRESENTATIVE_ARTICLE_PATHS.securityWorkflow,
          status: 200,
        }),
      ]
    : []),
  ...(REPRESENTATIVE_ARTICLE_PATHS.operationsArchitecture
    ? [
        Object.freeze({
          alias: "article-shared-files",
          path: REPRESENTATIVE_ARTICLE_PATHS.operationsArchitecture,
          status: 200,
        }),
      ]
    : []),
  ...(REPRESENTATIVE_ARTICLE_PATHS.strategyCost
    ? [
        Object.freeze({
          alias: "article-software-tco",
          path: REPRESENTATIVE_ARTICLE_PATHS.strategyCost,
          status: 200,
        }),
      ]
    : []),
  Object.freeze({ alias: "toolkit", path: "/toolkit/", status: 200 }),
  Object.freeze({
    alias: "toolkit-risk-register",
    path: "/toolkit/technology-risk-register/",
    status: 200,
  }),
  Object.freeze({ alias: "about", path: "/about/", status: 200 }),
  Object.freeze({ alias: "publisher", path: "/publisher/", status: 200 }),
  Object.freeze({
    alias: "editorial-standards",
    path: "/editorial-standards/",
    status: 200,
  }),
  Object.freeze({ alias: "privacy", path: "/privacy/", status: 200 }),
  Object.freeze({
    alias: "advertising-disclosure",
    path: "/advertising-disclosure/",
    status: 200,
  }),
  Object.freeze({ alias: "contact", path: "/contact/", status: 200 }),
  Object.freeze({
    alias: "404",
    path: "/publication-audit-route-that-does-not-exist/",
    status: 404,
  }),
]);
// Backwards-compatible name for consumers that need the complete release set.
export const CAPTURE_ROUTES = AFTER_CAPTURE_ROUTES;

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixedAuditSegments = ["artifacts", "site-audit"];
const phaseOutputSegments = Object.freeze({
  before: ["before", RELEASE_EVIDENCE_ID],
  "after-local": ["after", RELEASE_EVIDENCE_ID, "local"],
  "after-production": ["after", RELEASE_EVIDENCE_ID, "production"],
  "runtime-verification": [
    "runtime-verification",
    `${RELEASE_EVIDENCE_ID}-final`,
  ],
});

function assertCapturePhase(phase) {
  if (!CAPTURE_PHASES.includes(phase)) {
    throw new TypeError(
      `Capture phase must be one of: ${CAPTURE_PHASES.join(", ")}.`,
    );
  }
  return phase;
}

function captureFileNamesForPhase(phase) {
  const routes =
    phase === "before" ? BEFORE_CAPTURE_ROUTES : AFTER_CAPTURE_ROUTES;
  const names = CAPTURE_WIDTHS.flatMap((width) =>
    routes.map(({ alias }) => `${width}-${alias}-full-page.png`),
  );
  if (phase !== "before") {
    names.push(
      ...[320, 390, 600, 768].map((width) => `${width}-home-menu-open.png`),
      ...CAPTURE_WIDTHS.map((width) => `${width}-home-skip-link-focus.png`),
    );
  }
  return Object.freeze(names);
}

export function createCapturePaths(repositoryRootCandidate, phaseCandidate) {
  if (
    typeof repositoryRootCandidate !== "string" ||
    repositoryRootCandidate.length === 0
  ) {
    throw new TypeError("Capture repository root must be explicit.");
  }
  const phase = assertCapturePhase(phaseCandidate);
  const resolvedRepositoryRoot = path.resolve(repositoryRootCandidate);
  const auditRoot = path.join(resolvedRepositoryRoot, ...fixedAuditSegments);
  const outputDirectory = path.join(auditRoot, ...phaseOutputSegments[phase]);
  return Object.freeze({
    auditRoot,
    backupDirectory: `${outputDirectory}.backup`,
    expectedFileNames: captureFileNamesForPhase(phase),
    outputDirectory,
    pendingDirectory: `${outputDirectory}.pending`,
    phase,
    repositoryRoot: resolvedRepositoryRoot,
  });
}

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
  const expected = createCapturePaths(paths.repositoryRoot, paths.phase);
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
  if (
    JSON.stringify(paths.expectedFileNames) !==
    JSON.stringify(expected.expectedFileNames)
  ) {
    throw new Error("Capture expected filenames differ from the fixed plan.");
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
    paths.expectedFileNames.includes(path.basename(candidate))
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
  await fileSystem.mkdirImpl(paths.pendingDirectory, { recursive: true });
  await assertSafeOwnedCapturePath(paths, paths.pendingDirectory, fileSystem);
}

function captureOriginError(phase) {
  return phase === "after-local"
    ? "Capture origin must be the canonical loopback HTTP origin http://127.0.0.1 with an optional safe port and without credentials, path, query, or hash."
    : "Capture origin must be an explicit HTTPS origin without credentials, path, query, or hash.";
}

export function normalizeCaptureOrigin(candidate, phaseCandidate) {
  const phase = assertCapturePhase(phaseCandidate);
  if (typeof candidate !== "string" || candidate.trim() !== candidate) {
    throw new TypeError(captureOriginError(phase));
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new TypeError(captureOriginError(phase));
  }

  const lexicalOrigin =
    candidate === parsed.origin || candidate === `${parsed.origin}/`;
  if (
    !lexicalOrigin ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new TypeError(captureOriginError(phase));
  }

  try {
    return normalizeAuditOrigin(parsed.origin, phase);
  } catch {
    throw new TypeError(captureOriginError(phase));
  }
}

export function normalizeExpectedGitSha(candidate) {
  if (typeof candidate !== "string" || !/^[a-f\d]{40}$/.test(candidate)) {
    throw new TypeError(
      "Expected Git SHA must be a full lowercase 40-character SHA.",
    );
  }
  return candidate;
}

export function normalizeDeploymentId(candidate) {
  if (
    typeof candidate !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/.test(candidate)
  ) {
    throw new TypeError("Deployment ID contains unsupported characters.");
  }
  return candidate;
}

function assertCaptureProvenance(phase, expectedGitSha, deploymentId) {
  if (expectedGitSha === null) {
    throw new TypeError(`Capture phase ${phase} requires an expected SHA.`);
  }
  if (phase === "after-local") {
    if (deploymentId !== null) {
      throw new TypeError(
        "Capture phase after-local must not include a deployment ID.",
      );
    }
    return;
  }
  if (deploymentId === null) {
    throw new TypeError(`Capture phase ${phase} requires a deployment ID.`);
  }
}

async function runGitCaptureCommand(
  repositoryRootCandidate,
  args,
  execFileImpl,
) {
  const resolvedRepositoryRoot = path.resolve(repositoryRootCandidate);
  try {
    const result = await execFileImpl("git", args, {
      cwd: resolvedRepositoryRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    if (!result || typeof result.stdout !== "string") {
      throw new TypeError("Git command returned no text output contract.");
    }
    return result.stdout;
  } catch (cause) {
    throw new Error(
      `Could not verify capture Git source with git ${args[0]}.`,
      { cause },
    );
  }
}

export async function assertCaptureSourceProvenance(
  {
    expectedGitSha: expectedGitShaCandidate,
    phase: phaseCandidate,
    repositoryRoot: repositoryRootCandidate,
  },
  overrides = {},
) {
  const phase = assertCapturePhase(phaseCandidate);
  if (phase === "before") {
    return Object.freeze({ exempt: true });
  }
  if (
    typeof repositoryRootCandidate !== "string" ||
    repositoryRootCandidate.length === 0
  ) {
    throw new TypeError("Capture repository root must be explicit.");
  }
  const expectedGitSha = normalizeExpectedGitSha(expectedGitShaCandidate);
  const execFileImpl = overrides.execFileImpl ?? execFileAsync;
  if (typeof execFileImpl !== "function") {
    throw new TypeError("Capture Git command implementation must be callable.");
  }

  const headOutput = await runGitCaptureCommand(
    repositoryRootCandidate,
    ["rev-parse", "--verify", "HEAD"],
    execFileImpl,
  );
  let gitHead;
  try {
    gitHead = normalizeExpectedGitSha(headOutput.trim());
  } catch (cause) {
    throw new Error(
      "Could not verify capture Git source because Git HEAD was not a full lowercase SHA.",
      { cause },
    );
  }
  if (gitHead !== expectedGitSha) {
    throw new Error(
      `Capture expected SHA ${expectedGitSha} does not match current Git HEAD ${gitHead}.`,
    );
  }

  const statusOutput = await runGitCaptureCommand(
    repositoryRootCandidate,
    ["status", "--porcelain=v1", "--untracked-files=all", "--ignored=no"],
    execFileImpl,
  );
  if (statusOutput.trim().length > 0) {
    throw new Error(
      "Capture source tree is not clean; commit or remove tracked and untracked non-ignored changes before capturing.",
    );
  }

  const indexFlagsOutput = await runGitCaptureCommand(
    repositoryRootCandidate,
    ["ls-files", "-v", "-z", "--cached"],
    execFileImpl,
  );
  const flaggedIndexEntries = indexFlagsOutput
    .split("\0")
    .filter((entry) => /^(?:[a-z]|S) /.test(entry));
  if (flaggedIndexEntries.length > 0) {
    throw new Error(
      "Tracked files carry assume-unchanged or skip-worktree index flags; clear those index flags before capturing.",
    );
  }

  const ignoredEnvironmentOutput = await runGitCaptureCommand(
    repositoryRootCandidate,
    [
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "-z",
      "--",
      ":(top).env",
      ":(top).env.*",
    ],
    execFileImpl,
  );
  const ignoredEnvironmentFiles = ignoredEnvironmentOutput
    .split("\0")
    .filter(Boolean)
    .filter((fileName) => fileName !== ".env.example");
  if (ignoredEnvironmentFiles.length > 0) {
    throw new Error(
      "Ignored local .env environment files can change build output; remove them before capturing.",
    );
  }
  return Object.freeze({ gitHead, sourceTreeClean: true });
}

export function parseCaptureArguments(arguments_) {
  if (!Array.isArray(arguments_)) {
    throw new TypeError("Capture command arguments must be an array.");
  }
  const supportedOptions = new Set([
    "--origin",
    "--phase",
    "--expected-sha",
    "--deployment-id",
  ]);
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const option = arguments_[index];
    const value = arguments_[index + 1];
    if (!supportedOptions.has(option)) {
      throw new TypeError(`Unexpected capture option: ${String(option)}`);
    }
    if (values.has(option)) {
      throw new TypeError(`Provide exactly one ${option} value.`);
    }
    if (!value || value.startsWith("--")) {
      throw new TypeError(`${option} requires a value.`);
    }
    values.set(option, value);
  }
  if (!values.has("--origin")) {
    throw new TypeError("Provide exactly one --origin HTTPS origin.");
  }
  if (!values.has("--phase")) {
    throw new TypeError("Provide exactly one --phase value.");
  }

  const phase = assertCapturePhase(values.get("--phase"));
  const deploymentId = values.has("--deployment-id")
    ? normalizeDeploymentId(values.get("--deployment-id"))
    : null;
  const expectedGitSha = values.has("--expected-sha")
    ? normalizeExpectedGitSha(values.get("--expected-sha"))
    : null;
  assertCaptureProvenance(phase, expectedGitSha, deploymentId);
  return {
    deploymentId,
    expectedGitSha,
    origin: normalizeCaptureOrigin(values.get("--origin"), phase),
    phase,
  };
}

function plannedCapture(route, width, state, origin) {
  return Object.freeze({
    ...route,
    deviceScaleFactor: 1,
    fileName: `${width}-${route.alias}-${state}.png`,
    fullPage: state === "full-page",
    height: CAPTURE_HEIGHT,
    state,
    url: new URL(route.path, `${origin}/`).href,
    width,
  });
}

const representativeCaptureRouteSlots = Object.freeze({
  "article-ai-automation": "primary",
  "article-phishing-response": "securityWorkflow",
  "article-saas-evaluation": "saasEvaluation",
  "article-shared-files": "operationsArchitecture",
  "article-software-tco": "strategyCost",
});

function captureRoutesForRepresentativePaths(routes, representativePaths) {
  return routes.flatMap((route) => {
    const slot = representativeCaptureRouteSlots[route.alias];
    if (!slot) return [route];
    const representativePath = representativePaths[slot];
    return representativePath
      ? [Object.freeze({ ...route, path: representativePath })]
      : [];
  });
}

export function buildCapturePlan({
  origin: originCandidate,
  phase: phaseCandidate,
  representativeArticlePaths = REPRESENTATIVE_ARTICLE_PATHS,
}) {
  const phase = assertCapturePhase(phaseCandidate);
  const origin = normalizeCaptureOrigin(originCandidate, phase);
  const routes = captureRoutesForRepresentativePaths(
    phase === "before" ? BEFORE_CAPTURE_ROUTES : AFTER_CAPTURE_ROUTES,
    representativeArticlePaths,
  );
  const plan = CAPTURE_WIDTHS.flatMap((width) =>
    routes.map((route) => plannedCapture(route, width, "full-page", origin)),
  );
  if (phase !== "before") {
    const home = routes.find(({ alias }) => alias === "home");
    plan.push(
      ...[320, 390, 600, 768].map((width) =>
        plannedCapture(home, width, "menu-open", origin),
      ),
      ...CAPTURE_WIDTHS.map((width) =>
        plannedCapture(home, width, "skip-link-focus", origin),
      ),
    );
  }
  const fileNames = plan.map(({ fileName }) => fileName);
  if (new Set(fileNames).size !== fileNames.length) {
    throw new Error("Capture plan contains duplicate filenames.");
  }
  return Object.freeze(plan);
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

export function validateServedBuildGitSha(
  markerValues,
  expectedGitShaCandidate,
) {
  const expectedGitSha = normalizeExpectedGitSha(expectedGitShaCandidate);
  if (!Array.isArray(markerValues) || markerValues.length !== 1) {
    throw new Error(
      "Served root build SHA marker must appear exactly once in the document head.",
    );
  }
  let servedGitSha;
  try {
    servedGitSha = normalizeExpectedGitSha(markerValues[0]);
  } catch (cause) {
    throw new Error(
      "Served root build SHA marker must contain a full lowercase 40-character SHA.",
      { cause },
    );
  }
  if (servedGitSha !== expectedGitSha) {
    throw new Error(
      `Served root build SHA ${servedGitSha} does not match expected SHA ${expectedGitSha}.`,
    );
  }
  return servedGitSha;
}

export async function assertServedBuildGitSha(
  browser,
  { expectedGitSha, origin, phase: phaseCandidate },
) {
  const phase = assertCapturePhase(phaseCandidate);
  if (phase === "before") {
    return Object.freeze({ exempt: true });
  }
  const normalizedOrigin = normalizeCaptureOrigin(origin, phase);
  const context = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "America/Los_Angeles",
    viewport: { height: CAPTURE_HEIGHT, width: 390 },
  });
  const page = await context.newPage();
  const route = { path: "/", status: 200 };
  const runtimeErrors = createRuntimeMonitor(page, normalizedOrigin, route);
  try {
    const url = new URL(route.path, `${normalizedOrigin}/`).href;
    const response = await page.goto(url, { waitUntil: "networkidle" });
    assertExpectedNavigation(response, { route, url });
    if (runtimeErrors.length > 0) {
      throw new Error(`/: ${runtimeErrors.join("; ")}`);
    }

    const locator = page.locator(
      `head > meta[name="${BUILD_GIT_SHA_META_NAME}"]`,
    );
    const markerCount = await locator.count();
    const markerValues = [];
    for (let index = 0; index < markerCount; index += 1) {
      markerValues.push(await locator.nth(index).getAttribute("content"));
    }
    const servedGitSha = validateServedBuildGitSha(
      markerValues,
      expectedGitSha,
    );
    return Object.freeze({ servedGitSha });
  } finally {
    await page.close();
    await context.close();
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

export function createRuntimeMonitor(page, origin, route) {
  const errors = [];
  const recordedErrors = new Set();
  const recordError = (message) => {
    if (recordedErrors.has(message)) return;
    recordedErrors.add(message);
    errors.push(message);
  };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const locationUrl = message.location().url;
    const expectedMissingRouteNoise =
      route.status === 404 &&
      locationUrl === new URL(route.path, `${origin}/`).href &&
      /Failed to load resource.*404/i.test(message.text());
    if (!expectedMissingRouteNoise) {
      recordError(`console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    recordError(`page error: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    recordError(
      `request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown error"})`,
    );
  });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (["http:", "https:"].includes(requestUrl.protocol)) {
      if (requestUrl.origin !== origin) {
        recordError(`cross-origin request: ${request.url()}`);
      }
    }
  });
  page.on("response", (response) => {
    const responseUrl = new URL(response.url());
    const request = response.request();
    const redirectedFrom = request.redirectedFrom();
    const redirectedTo = request.redirectedTo?.();
    const status = response.status();
    if (redirectedFrom) {
      recordError(
        `unexpected redirect chain: ${redirectedFrom.url()} -> ${response.url()}`,
      );
    } else if ([301, 302, 303, 307, 308].includes(status)) {
      recordError(
        `unexpected redirect response ${status}: ${response.url()} -> ${redirectedTo?.url() ?? "[unknown target]"}`,
      );
    }

    if (responseUrl.origin !== origin || status < 400) return;
    const expectedUrl = new URL(route.path, `${origin}/`).href;
    const expectedPrimary404 =
      route.status === 404 &&
      status === 404 &&
      response.url() === expectedUrl &&
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame();
    if (!expectedPrimary404) {
      recordError(`HTTP ${status} response: ${response.url()}`);
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

async function materializeDeferredContent(page) {
  await page.evaluate(async () => {
    const deferred = Array.from(
      globalThis.document.querySelectorAll("*"),
    ).filter(
      (element) =>
        globalThis.getComputedStyle(element).contentVisibility === "auto",
    );
    const nextFrame = () =>
      new Promise((resolve) => globalThis.requestAnimationFrame(resolve));

    for (const element of deferred) {
      element.scrollIntoView({ block: "center" });
      await nextFrame();
    }
    globalThis.scrollTo({ left: 0, top: 0 });
    for (const element of deferred) {
      element.style.contentVisibility = "visible";
    }
    await nextFrame();
    await nextFrame();
  });
}

async function focusWithKeyboard(page, locator) {
  for (let index = 0; index < 30; index += 1) {
    await page.keyboard.press("Tab");
    if (
      await locator.evaluate(
        (element) => element === globalThis.document.activeElement,
      )
    ) {
      return;
    }
  }
  throw new Error("Keyboard focus did not reach the requested capture state.");
}

async function prepareCaptureState(page, item) {
  if (item.state === "full-page") {
    await materializeDeferredContent(page);
    return;
  }
  if (item.state === "menu-open") {
    const menu = page.locator(".site-header__mobile-menu").first();
    const summary = menu.locator("summary");
    if (!(await menu.isVisible())) {
      throw new Error(`Mobile menu is not visible at ${item.width}px.`);
    }
    await focusWithKeyboard(page, summary);
    await page.keyboard.press("Enter");
    if ((await menu.getAttribute("open")) === null) {
      throw new Error(`Mobile menu did not open at ${item.width}px.`);
    }
    return;
  }
  if (item.state === "skip-link-focus") {
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await page.keyboard.press("Tab");
    const state = await skipLink.evaluate((element) => ({
      focused: element === globalThis.document.activeElement,
      visible: Boolean(
        element.getClientRects().length &&
        globalThis.getComputedStyle(element).visibility !== "hidden",
      ),
    }));
    if (!state.focused || !state.visible) {
      throw new Error(`Skip link is not visibly focused at ${item.width}px.`);
    }
    return;
  }
  throw new Error(`Unsupported capture state: ${item.state}`);
}

async function collectAuditAssertions(browser, origin) {
  const context = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "America/Los_Angeles",
    viewport: { height: CAPTURE_HEIGHT, width: 390 },
  });
  try {
    const assertions = [];
    for (const check of [
      {
        id: "ads-txt-absent",
        path: "/ads.txt",
      },
      {
        id: "cms-admin-absent",
        path: "/admin/",
      },
      {
        id: "cms-config-absent",
        path: "/.pages.yml",
      },
      {
        id: "cms-draft-absent",
        path: "/articles/cms-fixture-minimum-draft/",
      },
      {
        id: "cms-keystatic-absent",
        path: "/keystatic/",
      },
    ]) {
      const expectedUrl = new URL(check.path, `${origin}/`).href;
      const response = await context.request.get(expectedUrl, {
        failOnStatusCode: false,
        maxRedirects: 0,
      });
      const actualStatus = response.status();
      if (response.url() !== expectedUrl || actualStatus !== 404) {
        throw new Error(
          `${check.path} returned ${actualStatus} at ${response.url()}; expected an exact 404 without redirects.`,
        );
      }
      assertions.push({
        actual: actualStatus,
        evidence: "http",
        expected: 404,
        id: check.id,
        passed: true,
        route: check.path,
      });
    }

    const page = await context.newPage();
    const route = { path: "/", status: 200 };
    const runtimeErrors = createRuntimeMonitor(page, origin, route);
    const url = new URL(route.path, `${origin}/`).href;
    const response = await page.goto(url, { waitUntil: "networkidle" });
    assertExpectedNavigation(response, { route, url });
    const integrationMarkers = await page.evaluate(() => {
      const selectors = [
        'meta[name="google-adsense-account"]',
        "ins.adsbygoogle",
        "[data-ad-client]",
        "[data-ad-slot]",
        "[data-analytics-id]",
      ];
      const selectorMatches = selectors.flatMap((selector) =>
        Array.from(
          globalThis.document.querySelectorAll(selector),
          () => selector,
        ),
      );
      const html = globalThis.document.documentElement.outerHTML;
      const textMatches = html.match(
        /googlesyndication|doubleclick|google-analytics|googletagmanager|adsbygoogle|(?:ca-)?pub-\d{6,}/gi,
      );
      return [...selectorMatches, ...(textMatches ?? [])];
    });
    await page.close();
    if (runtimeErrors.length > 0) {
      throw new Error(`/: ${runtimeErrors.join("; ")}`);
    }
    if (integrationMarkers.length > 0) {
      throw new Error(
        `Monetization-off DOM assertion found forbidden integration markers: ${integrationMarkers.join(", ")}`,
      );
    }
    assertions.push({
      actual: "absent",
      evidence: "dom",
      expected: "absent",
      id: "monetization-off",
      passed: true,
      route: "/",
    });
    return assertions;
  } finally {
    await context.close();
  }
}

async function capturePlanItem(context, item, origin, paths) {
  const page = await context.newPage();
  const runtimeErrors = createRuntimeMonitor(page, origin, item);
  try {
    const response = await page.goto(item.url, { waitUntil: "networkidle" });
    assertExpectedNavigation(response, { route: item, url: item.url });
    await stabilizePage(page);
    await prepareCaptureState(page, item);
    const outputPath = path.join(paths.pendingDirectory, item.fileName);
    await assertSafeCaptureOutputPath(paths, outputPath);
    await page.screenshot({
      animations: "disabled",
      caret: "hide",
      fullPage: item.fullPage,
      path: outputPath,
      scale: "css",
    });
    if (runtimeErrors.length > 0) {
      throw new Error(`${item.path}: ${runtimeErrors.join("; ")}`);
    }
    return response.status();
  } finally {
    await page.close();
  }
}

export async function captureProductionScreenshots(options, overrides = {}) {
  if (!options || typeof options !== "object") {
    throw new TypeError("Production capture options must be explicit.");
  }
  const phase = assertCapturePhase(options.phase);
  const origin = normalizeCaptureOrigin(options.origin, phase);
  const expectedGitSha = options.expectedGitSha
    ? normalizeExpectedGitSha(options.expectedGitSha)
    : null;
  const deploymentId = options.deploymentId
    ? normalizeDeploymentId(options.deploymentId)
    : null;
  assertCaptureProvenance(phase, expectedGitSha, deploymentId);
  const capturedAt = (overrides.nowImpl ?? (() => new Date()))().toISOString();
  const plan = buildCapturePlan({ origin, phase });
  const expectedNames = plan.map(({ fileName }) => fileName);
  const paths = overrides.paths ?? createCapturePaths(repositoryRoot, phase);
  assertFixedCaptureLayout(paths);
  if (paths.phase !== phase) {
    throw new Error("Capture paths do not match the requested phase.");
  }
  await assertCaptureSourceProvenance(
    {
      expectedGitSha,
      phase,
      repositoryRoot: paths.repositoryRoot,
    },
    { execFileImpl: overrides.execFileImpl },
  );
  await prepareCaptureWorkspace(paths, overrides.fileSystem);

  let browser;
  let manifest;
  let operationError;
  try {
    browser = await (overrides.chromiumImpl ?? chromium).launch({
      headless: true,
    });
    await assertServedBuildGitSha(browser, {
      expectedGitSha,
      origin,
      phase,
    });
    const statusByFileName = new Map();
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
        for (const item of plan.filter((capture) => capture.width === width)) {
          const actualStatus = await capturePlanItem(
            context,
            item,
            origin,
            paths,
          );
          statusByFileName.set(item.fileName, actualStatus);
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
    const assertions = await collectAuditAssertions(browser, origin);
    manifest = await writeAuditManifest({
      assertions,
      capturedAt,
      deploymentId,
      expectedGitSha,
      origin,
      outputDirectory: paths.pendingDirectory,
      phase,
      plan,
      statusByFileName,
    });
  } catch (error) {
    operationError = error;
  }

  let browserCloseError;
  try {
    await browser?.close();
  } catch (error) {
    browserCloseError = error;
  }
  const errors = [operationError, browserCloseError].filter(Boolean);
  if (errors.length > 0) {
    try {
      await safeRemoveCaptureDirectory(
        paths,
        paths.pendingDirectory,
        overrides.fileSystem,
      );
    } catch (cleanupError) {
      errors.push(cleanupError);
    }
    if (errors.length === 1) throw errors[0];
    throw new AggregateError(
      errors,
      "Production capture failed and its owned resources did not clean up safely.",
      { cause: errors[0] },
    );
  }

  await publishCaptureRun(paths, overrides.fileSystem);
  return {
    count: expectedNames.length,
    manifest,
    origin,
    outputDirectory: paths.outputDirectory,
    phase,
  };
}

async function main() {
  const options = parseCaptureArguments(process.argv.slice(2));
  const result = await captureProductionScreenshots(options);
  console.log(
    `Production capture: PASS (${result.count} PNGs for ${result.phase} from ${result.origin} written to ${result.outputDirectory}).`,
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

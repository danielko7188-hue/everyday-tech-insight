import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const BUILD_GIT_SHA_META_NAME = "eti-build-git-sha";

const FULL_GIT_SHA_PATTERN = /^[a-f\d]{40}$/;
const MAX_VERCEL_CONFIG_DIFF_LENGTH = 2_000;
// Exact tracked repository-only paths removed by the committed .vercelignore.
// New deployment exclusions must be reviewed here instead of becoming a broad
// provider-context dirty-tree bypass.
const VERCEL_PRUNED_REPOSITORY_PREFIXES = [
  ".planning/",
  "artifacts/",
  "tests/",
];
const VERCEL_PRUNED_REPOSITORY_FILES = new Set([
  "AGENTS.md",
  "DESIGN.md",
  "playwright.config.ts",
  "vitest.config.ts",
]);
const defaultRepositoryRoot = process.cwd();
let cachedDefaultBuildGitSha;

function validatedFullGitSha(candidate, sourceName) {
  if (typeof candidate !== "string" || !FULL_GIT_SHA_PATTERN.test(candidate)) {
    throw new Error(`${sourceName} must be a full lowercase 40-character SHA.`);
  }
  return candidate;
}

function selectedEnvironmentGitSha(env) {
  for (const variableName of [
    "VERCEL_GIT_COMMIT_SHA",
    "PUBLIC_VERCEL_GIT_COMMIT_SHA",
    "GITHUB_SHA",
  ]) {
    const candidate = env?.[variableName];
    if (candidate !== undefined && candidate !== "") {
      return {
        sha: validatedFullGitSha(candidate, variableName),
        variableName,
      };
    }
  }
  return null;
}

function isVerifiedVercelGitBuild(env, environmentGitSha) {
  return (
    environmentGitSha?.variableName === "VERCEL_GIT_COMMIT_SHA" &&
    env?.CI === "1" &&
    env?.VERCEL === "1" &&
    ["preview", "production"].includes(env?.VERCEL_ENV) &&
    env?.VERCEL_GIT_PROVIDER === "github"
  );
}

function isVercelPrunedRepositoryStatusLine(line) {
  if (!line.startsWith(" D ")) return false;
  const fileName = line.slice(3);
  return (
    VERCEL_PRUNED_REPOSITORY_FILES.has(fileName) ||
    VERCEL_PRUNED_REPOSITORY_PREFIXES.some((prefix) =>
      fileName.startsWith(prefix),
    )
  );
}

function unexpectedSourceStatusLines(statusOutput, verifiedVercelGitBuild) {
  const lines = statusOutput.split(/\r?\n/).filter(Boolean);
  return verifiedVercelGitBuild
    ? lines.filter((line) => !isVercelPrunedRepositoryStatusLine(line))
    : lines;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function runBuildGitCommand(
  repositoryRoot,
  args,
  execFileSyncImpl,
  failureMessage,
) {
  let output;
  try {
    output = execFileSyncImpl("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
    });
  } catch (cause) {
    throw new Error(failureMessage, { cause });
  }
  if (typeof output !== "string") {
    throw new Error(failureMessage);
  }
  return output;
}

function boundedVercelConfigDiff(
  repositoryRoot,
  unexpectedStatusLines,
  verifiedVercelGitBuild,
  execFileSyncImpl,
) {
  const hasModifiedVercelConfig = unexpectedStatusLines.some(
    (line) => line.slice(3) === "vercel.json" && line.slice(0, 2).includes("M"),
  );
  if (!verifiedVercelGitBuild || !hasModifiedVercelConfig) return "";

  let diff;
  try {
    diff = runBuildGitCommand(
      repositoryRoot,
      ["diff", "--no-ext-diff", "--unified=3", "--", "vercel.json"],
      execFileSyncImpl,
      "Could not inspect the modified Vercel config.",
    ).trim();
  } catch {
    return "\nVercel config diff: [unavailable]";
  }
  if (diff.length === 0) return "\nVercel config diff: [no textual diff]";

  const boundedDiff = diff.slice(0, MAX_VERCEL_CONFIG_DIFF_LENGTH);
  const suffix =
    diff.length > MAX_VERCEL_CONFIG_DIFF_LENGTH ? "\n[truncated]" : "";
  return `\nVercel config diff:\n${boundedDiff}${suffix}`;
}

function hasSemanticallyIdenticalVercelConfigRewrite(
  repositoryRoot,
  unexpectedStatusLines,
  verifiedVercelGitBuild,
  execFileSyncImpl,
  readFileSyncImpl,
) {
  if (
    !verifiedVercelGitBuild ||
    !unexpectedStatusLines.includes(" M vercel.json")
  ) {
    return false;
  }

  try {
    const committedConfig = runBuildGitCommand(
      repositoryRoot,
      ["show", "HEAD:vercel.json"],
      execFileSyncImpl,
      "Could not read the committed Vercel config.",
    );
    const rewrittenConfig = readFileSyncImpl(
      path.join(repositoryRoot, "vercel.json"),
      "utf8",
    );
    if (typeof rewrittenConfig !== "string") return false;
    return (
      canonicalJson(JSON.parse(committedConfig)) ===
      canonicalJson(JSON.parse(rewrittenConfig))
    );
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   execFileSyncImpl?: (command: string, args: string[], options: { cwd: string, encoding: "utf8", windowsHide: boolean }) => string,
 *   pathExistsImpl?: (candidate: string) => boolean,
 *   readFileSyncImpl?: (candidate: string, encoding: "utf8") => string,
 *   repositoryRoot?: string,
 * }} [options]
 */
export function resolveBuildGitSha(options) {
  const useDefaultCache = options === undefined;
  if (useDefaultCache && cachedDefaultBuildGitSha) {
    return cachedDefaultBuildGitSha;
  }
  const {
    env = process.env,
    execFileSyncImpl = execFileSync,
    pathExistsImpl = existsSync,
    readFileSyncImpl = readFileSync,
    repositoryRoot = defaultRepositoryRoot,
  } = options ?? {};

  if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0) {
    throw new TypeError("Build repository root must be explicit.");
  }
  if (typeof execFileSyncImpl !== "function") {
    throw new TypeError("Build Git command implementation must be callable.");
  }
  if (typeof pathExistsImpl !== "function") {
    throw new TypeError(
      "Build path existence implementation must be callable.",
    );
  }
  if (typeof readFileSyncImpl !== "function") {
    throw new TypeError("Build file reader implementation must be callable.");
  }

  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const environmentGitSha = selectedEnvironmentGitSha(env);
  let gitMetadataExists;
  try {
    gitMetadataExists = pathExistsImpl(
      path.join(resolvedRepositoryRoot, ".git"),
    );
  } catch (cause) {
    throw new Error("Could not verify whether build Git metadata exists.", {
      cause,
    });
  }
  if (!gitMetadataExists) {
    if (!environmentGitSha) {
      throw new Error(
        "Build source has no .git metadata and no validated environment SHA.",
      );
    }
    if (useDefaultCache) cachedDefaultBuildGitSha = environmentGitSha.sha;
    return environmentGitSha.sha;
  }

  const gitHeadOutput = runBuildGitCommand(
    resolvedRepositoryRoot,
    ["rev-parse", "--verify", "HEAD"],
    execFileSyncImpl,
    "Could not resolve the build Git HEAD.",
  );
  const gitHead = validatedFullGitSha(gitHeadOutput.trim(), "Git HEAD");
  if (environmentGitSha && environmentGitSha.sha !== gitHead) {
    throw new Error(
      `${environmentGitSha.variableName} environment SHA does not match local Git HEAD.`,
    );
  }

  const statusOutput = runBuildGitCommand(
    resolvedRepositoryRoot,
    ["status", "--porcelain=v1", "--untracked-files=all", "--ignored=no"],
    execFileSyncImpl,
    "Could not verify build source tree status.",
  );
  const verifiedVercelGitBuild = isVerifiedVercelGitBuild(
    env,
    environmentGitSha,
  );
  let unexpectedStatusLines = unexpectedSourceStatusLines(
    statusOutput,
    verifiedVercelGitBuild,
  );
  if (
    hasSemanticallyIdenticalVercelConfigRewrite(
      resolvedRepositoryRoot,
      unexpectedStatusLines,
      verifiedVercelGitBuild,
      execFileSyncImpl,
      readFileSyncImpl,
    )
  ) {
    unexpectedStatusLines = unexpectedStatusLines.filter(
      (line) => line !== " M vercel.json",
    );
  }
  if (unexpectedStatusLines.length > 0) {
    const diagnosticEntries = unexpectedStatusLines
      .slice(0, 10)
      .map((line) => line.trimStart())
      .join(", ");
    const remainingCount = unexpectedStatusLines.length - 10;
    const diagnosticSuffix =
      remainingCount > 0 ? `, plus ${remainingCount} more` : "";
    const vercelConfigDiff = boundedVercelConfigDiff(
      resolvedRepositoryRoot,
      unexpectedStatusLines,
      verifiedVercelGitBuild,
      execFileSyncImpl,
    );
    throw new Error(
      `Build source tree is not clean; commit or remove tracked and untracked non-ignored changes before building. Unexpected entries: ${diagnosticEntries}${diagnosticSuffix}.${vercelConfigDiff}`,
    );
  }

  const indexFlagsOutput = runBuildGitCommand(
    resolvedRepositoryRoot,
    ["ls-files", "-v", "-z", "--cached"],
    execFileSyncImpl,
    "Could not verify build source index flags.",
  );
  if (
    indexFlagsOutput.split("\0").some((entry) => /^(?:[a-z]|S) /.test(entry))
  ) {
    throw new Error(
      "Build source contains assume-unchanged or skip-worktree index flags; clear those index flags before building.",
    );
  }

  const ignoredEnvironmentOutput = runBuildGitCommand(
    resolvedRepositoryRoot,
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
    execFileSyncImpl,
    "Could not verify ignored build environment files.",
  );
  const ignoredEnvironmentFiles = ignoredEnvironmentOutput
    .split("\0")
    .filter(Boolean)
    .filter((fileName) => fileName !== ".env.example");
  if (ignoredEnvironmentFiles.length > 0) {
    throw new Error(
      "Ignored local .env environment files can change build output; remove them before building.",
    );
  }

  if (useDefaultCache) cachedDefaultBuildGitSha = gitHead;
  return gitHead;
}

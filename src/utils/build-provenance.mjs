import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BUILD_GIT_SHA_META_NAME = "eti-build-git-sha";

const FULL_GIT_SHA_PATTERN = /^[a-f\d]{40}$/;
const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
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

/**
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   execFileSyncImpl?: (command: string, args: string[], options: { cwd: string, encoding: "utf8", windowsHide: boolean }) => string,
 *   pathExistsImpl?: (candidate: string) => boolean,
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
  if (statusOutput.trim().length > 0) {
    throw new Error(
      "Build source tree is not clean; commit or remove tracked and untracked non-ignored changes before building.",
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

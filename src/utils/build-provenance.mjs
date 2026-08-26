import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BUILD_GIT_SHA_META_NAME = "eti-build-git-sha";

const FULL_GIT_SHA_PATTERN = /^[a-f\d]{40}$/;
const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function validatedFullGitSha(candidate, sourceName) {
  if (typeof candidate !== "string" || !FULL_GIT_SHA_PATTERN.test(candidate)) {
    throw new Error(`${sourceName} must be a full lowercase 40-character SHA.`);
  }
  return candidate;
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   execFileSyncImpl?: (command: string, args: string[], options: { cwd: string, encoding: "utf8", windowsHide: boolean }) => string,
 *   repositoryRoot?: string,
 * }} [options]
 */
export function resolveBuildGitSha({
  env = process.env,
  execFileSyncImpl = execFileSync,
  repositoryRoot = defaultRepositoryRoot,
} = {}) {
  for (const variableName of [
    "VERCEL_GIT_COMMIT_SHA",
    "PUBLIC_VERCEL_GIT_COMMIT_SHA",
    "GITHUB_SHA",
  ]) {
    const candidate = env?.[variableName];
    if (candidate !== undefined && candidate !== "") {
      return validatedFullGitSha(candidate, variableName);
    }
  }

  if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0) {
    throw new TypeError("Build repository root must be explicit.");
  }
  if (typeof execFileSyncImpl !== "function") {
    throw new TypeError("Build Git command implementation must be callable.");
  }

  let gitHeadOutput;
  try {
    gitHeadOutput = execFileSyncImpl("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: path.resolve(repositoryRoot),
      encoding: "utf8",
      windowsHide: true,
    });
  } catch (cause) {
    throw new Error("Could not resolve the build Git HEAD.", { cause });
  }
  if (typeof gitHeadOutput !== "string") {
    throw new Error("Git HEAD must be a full lowercase 40-character SHA.");
  }
  return validatedFullGitSha(gitHeadOutput.trim(), "Git HEAD");
}

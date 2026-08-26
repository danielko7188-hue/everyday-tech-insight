import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  BUILD_GIT_SHA_META_NAME,
  resolveBuildGitSha,
} from "../../src/utils/build-provenance.mjs";

const VERCEL_SHA = "0123456789abcdef0123456789abcdef01234567";
const GITHUB_SHA = "89abcdef0123456789abcdef0123456789abcdef";
const temporaryRoots: string[] = [];

function runGit(repositoryRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

function createCleanGitFixture(): { gitHead: string; repositoryRoot: string } {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "eti-build-source-"));
  temporaryRoots.push(repositoryRoot);
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "user.email", "build@example.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Build Test"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  writeFileSync(
    join(repositoryRoot, ".gitignore"),
    ".env\n.env.*\n!.env.example\n",
    "utf8",
  );
  writeFileSync(
    join(repositoryRoot, ".env.example"),
    "PUBLIC_VALUE=\n",
    "utf8",
  );
  writeFileSync(join(repositoryRoot, "tracked.txt"), "clean\n", "utf8");
  runGit(repositoryRoot, [
    "add",
    "--",
    ".gitignore",
    ".env.example",
    "tracked.txt",
  ]);
  runGit(repositoryRoot, ["commit", "--quiet", "-m", "fixture"]);
  return {
    gitHead: runGit(repositoryRoot, ["rev-parse", "--verify", "HEAD"]).trim(),
    repositoryRoot,
  };
}

afterEach(() => {
  for (const repositoryRoot of temporaryRoots.splice(0).reverse()) {
    rmSync(repositoryRoot, { force: true, recursive: true });
  }
});

describe("public build provenance", () => {
  it("uses a validated Vercel Git SHA without invoking local Git", () => {
    let gitInvoked = false;
    const execFileSyncImpl = () => {
      gitInvoked = true;
      throw new Error("Git fallback must not run");
    };

    expect(
      resolveBuildGitSha({
        env: { VERCEL_GIT_COMMIT_SHA: VERCEL_SHA },
        execFileSyncImpl,
        pathExistsImpl: () => false,
        repositoryRoot: "C:/unused",
      }),
    ).toBe(VERCEL_SHA);
    expect(gitInvoked).toBe(false);
  });

  it("uses a validated GitHub SHA when the Vercel SHA is absent", () => {
    expect(
      resolveBuildGitSha({
        env: { GITHUB_SHA },
        execFileSyncImpl: () => {
          throw new Error("Git fallback must not run");
        },
        pathExistsImpl: () => false,
        repositoryRoot: "C:/unused",
      }),
    ).toBe(GITHUB_SHA);
  });

  it("uses Astro-compatible public Vercel SHA before GitHub when private Vercel SHA is absent", () => {
    expect(
      resolveBuildGitSha({
        env: {
          GITHUB_SHA,
          PUBLIC_VERCEL_GIT_COMMIT_SHA: VERCEL_SHA,
        },
        execFileSyncImpl: () => {
          throw new Error("Git fallback must not run");
        },
        pathExistsImpl: () => false,
        repositoryRoot: "C:/unused",
      }),
    ).toBe(VERCEL_SHA);
  });

  it("falls back to the repository full Git HEAD with an argument-array command", () => {
    const calls: Array<{
      args: string[];
      command: string;
      options: { cwd?: string; encoding?: string; windowsHide?: boolean };
    }> = [];
    const repositoryRoot = resolve("publication-fixture");
    const execFileSyncImpl = (
      command: string,
      args: string[],
      options: { cwd?: string; encoding?: string; windowsHide?: boolean },
    ) => {
      calls.push({ args, command, options });
      return args[0] === "rev-parse" ? `${VERCEL_SHA}\n` : "";
    };

    expect(
      resolveBuildGitSha({
        env: {},
        execFileSyncImpl,
        pathExistsImpl: () => true,
        repositoryRoot,
      }),
    ).toBe(VERCEL_SHA);
    expect(calls).toEqual([
      {
        args: ["rev-parse", "--verify", "HEAD"],
        command: "git",
        options: {
          cwd: repositoryRoot,
          encoding: "utf8",
          windowsHide: true,
        },
      },
      {
        args: [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
          "--ignored=no",
        ],
        command: "git",
        options: {
          cwd: repositoryRoot,
          encoding: "utf8",
          windowsHide: true,
        },
      },
      {
        args: ["ls-files", "-v", "-z", "--cached"],
        command: "git",
        options: {
          cwd: repositoryRoot,
          encoding: "utf8",
          windowsHide: true,
        },
      },
      {
        args: [
          "ls-files",
          "--others",
          "--ignored",
          "--exclude-standard",
          "-z",
          "--",
          ":(top).env",
          ":(top).env.*",
        ],
        command: "git",
        options: {
          cwd: repositoryRoot,
          encoding: "utf8",
          windowsHide: true,
        },
      },
    ]);
  });

  it.each([
    ["VERCEL_GIT_COMMIT_SHA", "main"],
    ["PUBLIC_VERCEL_GIT_COMMIT_SHA", "main"],
    ["GITHUB_SHA", "ABCDEF0123456789ABCDEF0123456789ABCDEF01"],
    ["VERCEL_GIT_COMMIT_SHA", ` ${VERCEL_SHA}`],
  ])("fails closed for an invalid explicit %s value", (name, value) => {
    expect(() =>
      resolveBuildGitSha({
        env: { [name]: value },
        execFileSyncImpl: () => VERCEL_SHA,
        pathExistsImpl: () => false,
        repositoryRoot: "C:/unused",
      }),
    ).toThrow(new RegExp(`${name}.*full lowercase`, "i"));
  });

  it("fails closed when the local Git fallback fails or is not a full SHA", () => {
    expect(() =>
      resolveBuildGitSha({
        env: {},
        execFileSyncImpl: () => {
          throw new Error("injected Git failure");
        },
        pathExistsImpl: () => true,
        repositoryRoot: "C:/publication",
      }),
    ).toThrow(/could not resolve.*Git HEAD/i);
    expect(() =>
      resolveBuildGitSha({
        env: {},
        execFileSyncImpl: () => "main\n",
        pathExistsImpl: () => true,
        repositoryRoot: "C:/publication",
      }),
    ).toThrow(/Git HEAD.*full lowercase/i);
  });

  it("fails closed without either repository metadata or a deployment SHA", () => {
    expect(() =>
      resolveBuildGitSha({
        env: {},
        execFileSyncImpl: () => {
          throw new Error("Git must not run without .git metadata");
        },
        pathExistsImpl: () => false,
        repositoryRoot: "C:/gitless-build",
      }),
    ).toThrow(/no \.git.*environment SHA/i);
  });

  it("requires a selected environment SHA to match local Git HEAD", () => {
    expect(() =>
      resolveBuildGitSha({
        env: { VERCEL_GIT_COMMIT_SHA: VERCEL_SHA },
        execFileSyncImpl: (_command, args) =>
          args[0] === "rev-parse" ? `${GITHUB_SHA}\n` : "",
        pathExistsImpl: () => true,
        repositoryRoot: "C:/publication",
      }),
    ).toThrow(/environment SHA.*does not match.*Git HEAD/i);
  });

  it("rejects a dirty same-HEAD build from a real local Git repository", () => {
    const { gitHead, repositoryRoot } = createCleanGitFixture();
    writeFileSync(join(repositoryRoot, "tracked.txt"), "dirty\n", "utf8");

    expect(() =>
      resolveBuildGitSha({
        env: { VERCEL_GIT_COMMIT_SHA: gitHead },
        repositoryRoot,
      }),
    ).toThrow(/source tree.*not clean/i);
  });

  it.each([
    ["assume-unchanged", "h tracked.txt\0"],
    ["skip-worktree", "S tracked.txt\0"],
  ])("rejects %s index flags during build", (_label, indexOutput) => {
    expect(() =>
      resolveBuildGitSha({
        env: {},
        execFileSyncImpl: (_command, args) => {
          if (args[0] === "rev-parse") return `${VERCEL_SHA}\n`;
          if (args[0] === "status") return "";
          if (args.includes("-v")) return indexOutput;
          return "";
        },
        pathExistsImpl: () => true,
        repositoryRoot: "C:/publication",
      }),
    ).toThrow(/assume-unchanged|skip-worktree|index flags/i);
  });

  it("rejects ignored root .env variants during build", () => {
    expect(() =>
      resolveBuildGitSha({
        env: {},
        execFileSyncImpl: (_command, args) => {
          if (args[0] === "rev-parse") return `${VERCEL_SHA}\n`;
          if (args[0] === "status" || args.includes("-v")) return "";
          return ".env.production.local\0";
        },
        pathExistsImpl: () => true,
        repositoryRoot: "C:/publication",
      }),
    ).toThrow(/ignored.*\.env|environment.*files/i);
  });

  it("embeds the resolved SHA through one clearly named public meta marker", () => {
    const layout = readFileSync(
      new URL("../../src/layouts/BaseLayout.astro", import.meta.url),
      "utf8",
    );

    expect(BUILD_GIT_SHA_META_NAME).toBe("eti-build-git-sha");
    expect(layout).toContain("resolveBuildGitSha");
    expect(layout).toContain("const buildGitSha = resolveBuildGitSha();");
    expect(layout).toContain(
      "<meta name={BUILD_GIT_SHA_META_NAME} content={buildGitSha} />",
    );
  });
});

import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  BUILD_GIT_SHA_META_NAME,
  resolveBuildGitSha,
} from "../../src/utils/build-provenance.mjs";

const VERCEL_SHA = "0123456789abcdef0123456789abcdef01234567";
const GITHUB_SHA = "89abcdef0123456789abcdef0123456789abcdef";
const VERCEL_GIT_BUILD_ENVIRONMENT = {
  CI: "1",
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: VERCEL_SHA,
  VERCEL_GIT_PROVIDER: "github",
};
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
    readFileSync(new URL("../../.gitignore", import.meta.url), "utf8"),
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

  it("accepts Vercel-managed Git pruning only in a complete exact-SHA platform context", () => {
    const calls: string[][] = [];
    const execFileSyncImpl = (_command: string, args: string[]) => {
      calls.push(args);
      if (args[0] === "rev-parse") return `${VERCEL_SHA}\n`;
      if (args[0] === "status") {
        return [
          " D .planning/sketches/review.png",
          " D AGENTS.md",
          " D artifacts/site-audit/evidence.png",
          " D playwright.config.ts",
          " D tests/release-only.test.ts",
        ].join("\n");
      }
      return "";
    };

    expect(
      resolveBuildGitSha({
        env: VERCEL_GIT_BUILD_ENVIRONMENT,
        execFileSyncImpl,
        pathExistsImpl: () => true,
        repositoryRoot: "C:/vercel/path0",
      }),
    ).toBe(VERCEL_SHA);
    expect(calls.map((args) => args[0])).toEqual([
      "rev-parse",
      "status",
      "ls-files",
      "ls-files",
    ]);
  });

  it.each([
    ["modified source", " M src/pages/index.astro\n"],
    ["staged deletion", "D  tests/release-only.test.ts\n"],
    ["untracked input", "?? tests/release-only.test.ts\n"],
    ["unexpected deletion", " D src/pages/index.astro\n"],
  ])("rejects %s in a complete Vercel Git context", (_label, statusOutput) => {
    expect(() =>
      resolveBuildGitSha({
        env: VERCEL_GIT_BUILD_ENVIRONMENT,
        execFileSyncImpl: (_command, args) =>
          args[0] === "rev-parse" ? `${VERCEL_SHA}\n` : statusOutput,
        pathExistsImpl: () => true,
        repositoryRoot: "C:/vercel/path0",
      }),
    ).toThrow(/source tree.*not clean/i);
  });

  it("names the unexpected source entry in a dirty-tree diagnostic", () => {
    expect(() =>
      resolveBuildGitSha({
        env: VERCEL_GIT_BUILD_ENVIRONMENT,
        execFileSyncImpl: (_command, args) =>
          args[0] === "rev-parse"
            ? `${VERCEL_SHA}\n`
            : " M package-lock.json\n",
        pathExistsImpl: () => true,
        repositoryRoot: "C:/vercel/path0",
      }),
    ).toThrow(/unexpected entries: M package-lock\.json/i);
  });

  it("includes a bounded tracked diff only for the public Vercel config", () => {
    const diff = [
      "diff --git a/vercel.json b/vercel.json",
      "--- a/vercel.json",
      "+++ b/vercel.json",
      "@@ -1,3 +1,4 @@",
      " {",
      `+  "installCommand": "npm ci",`,
      `   "framework": "astro"`,
      " }",
      "x".repeat(4_000),
    ].join("\n");
    const calls: string[][] = [];

    expect(() =>
      resolveBuildGitSha({
        env: VERCEL_GIT_BUILD_ENVIRONMENT,
        execFileSyncImpl: (_command, args) => {
          calls.push(args);
          if (args[0] === "rev-parse") return `${VERCEL_SHA}\n`;
          if (args[0] === "status") return " M vercel.json\n";
          if (args[0] === "diff") return diff;
          return "";
        },
        pathExistsImpl: () => true,
        repositoryRoot: "C:/vercel/path0",
      }),
    ).toThrow(/Vercel config diff:[\s\S]*installCommand[\s\S]*truncated/i);

    expect(calls).toContainEqual([
      "diff",
      "--no-ext-diff",
      "--unified=3",
      "--",
      "vercel.json",
    ]);
  });

  it.each([
    ["missing CI", { VERCEL: "1", VERCEL_ENV: "production" }],
    ["missing Vercel indicator", { CI: "1", VERCEL_ENV: "production" }],
    ["missing environment", { CI: "1", VERCEL: "1" }],
    [
      "missing Git provider",
      { CI: "1", VERCEL: "1", VERCEL_ENV: "production" },
    ],
  ])(
    "does not allow provider pruning for an incomplete context: %s",
    (_label, context) => {
      expect(() =>
        resolveBuildGitSha({
          env: {
            ...context,
            VERCEL_GIT_COMMIT_SHA: VERCEL_SHA,
          },
          execFileSyncImpl: (_command, args) =>
            args[0] === "rev-parse"
              ? `${VERCEL_SHA}\n`
              : " D tests/release-only.test.ts\n",
          pathExistsImpl: () => true,
          repositoryRoot: "C:/vercel/path0",
        }),
      ).toThrow(/source tree.*not clean/i);
    },
  );

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

  it.skipIf(process.platform === "win32")(
    "keeps a Linux node_modules symlink out of the source-integrity status",
    () => {
      const { gitHead, repositoryRoot } = createCleanGitFixture();
      const dependencyStore = mkdtempSync(
        join(tmpdir(), "eti-build-dependencies-"),
      );
      temporaryRoots.push(dependencyStore);
      symlinkSync(dependencyStore, join(repositoryRoot, "node_modules"), "dir");

      expect(
        runGit(repositoryRoot, [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
          "--ignored=no",
        ]),
      ).toBe("");
      expect(resolveBuildGitSha({ env: {}, repositoryRoot })).toBe(gitHead);
    },
  );

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
    const provenanceSource = readFileSync(
      new URL("../../src/utils/build-provenance.mjs", import.meta.url),
      "utf8",
    );

    expect(BUILD_GIT_SHA_META_NAME).toBe("eti-build-git-sha");
    expect(provenanceSource).toContain(
      "const defaultRepositoryRoot = process.cwd();",
    );
    expect(layout).toContain("resolveBuildGitSha");
    expect(layout).toContain("const buildGitSha = resolveBuildGitSha();");
    expect(layout).toContain(
      "<meta name={BUILD_GIT_SHA_META_NAME} content={buildGitSha} />",
    );
  });
});

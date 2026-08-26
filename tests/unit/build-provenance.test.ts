import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BUILD_GIT_SHA_META_NAME,
  resolveBuildGitSha,
} from "../../src/utils/build-provenance.mjs";

const VERCEL_SHA = "0123456789abcdef0123456789abcdef01234567";
const GITHUB_SHA = "89abcdef0123456789abcdef0123456789abcdef";

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
      return `${VERCEL_SHA}\n`;
    };

    expect(
      resolveBuildGitSha({ env: {}, execFileSyncImpl, repositoryRoot }),
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
        repositoryRoot: "C:/publication",
      }),
    ).toThrow(/could not resolve.*Git HEAD/i);
    expect(() =>
      resolveBuildGitSha({
        env: {},
        execFileSyncImpl: () => "main\n",
        repositoryRoot: "C:/publication",
      }),
    ).toThrow(/Git HEAD.*full lowercase/i);
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

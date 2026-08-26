import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildAuditManifest } from "../../scripts/write-audit-manifest.mjs";
import {
  AFTER_CAPTURE_ROUTES,
  BEFORE_CAPTURE_ROUTES,
  CAPTURE_PHASES,
  CAPTURE_ROUTES,
  CAPTURE_WIDTHS,
  RELEASE_EVIDENCE_ID,
  assertExpectedNavigation,
  assertCaptureSourceProvenance,
  assertSafeCaptureOutputPath,
  assertServedBuildGitSha,
  buildCapturePlan,
  captureProductionScreenshots,
  createCapturePaths,
  normalizeCaptureOrigin,
  parseCaptureArguments,
  prepareCaptureWorkspace,
  publishCaptureRun,
  validateServedBuildGitSha,
} from "../../scripts/capture-production-screenshots.mjs";

const temporaryRoots: string[] = [];
const temporaryLinks: string[] = [];

function createTemporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function runGit(repositoryRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

function createCleanGitFixture(prefix: string): {
  gitHead: string;
  repositoryRoot: string;
} {
  const repositoryRoot = createTemporaryRoot(prefix);
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "user.email", "capture@example.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Capture Test"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  writeFileSync(
    join(repositoryRoot, ".gitignore"),
    ".env\n.env.*\n!.env.example\n",
    "utf8",
  );
  writeFileSync(
    join(repositoryRoot, ".env.example"),
    "PUBLIC_EXAMPLE=\n",
    "utf8",
  );
  writeFileSync(join(repositoryRoot, "tracked.txt"), "tracked\n", "utf8");
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
  for (const link of temporaryLinks.splice(0).reverse()) {
    try {
      unlinkSync(link);
    } catch {
      // A successful workspace operation may already have removed the link.
    }
  }

  const temporaryDirectory = resolve(tmpdir());
  for (const root of temporaryRoots.splice(0).reverse()) {
    const resolvedRoot = resolve(root);
    const relativeRoot = relative(temporaryDirectory, resolvedRoot);
    if (
      !relativeRoot ||
      relativeRoot.startsWith("..") ||
      isAbsolute(relativeRoot)
    ) {
      throw new Error(
        `Refusing to clean unexpected test path: ${resolvedRoot}`,
      );
    }
    rmSync(resolvedRoot, { force: true, recursive: true });
  }
});

describe("production screenshot capture contract", () => {
  it("accepts an after capture only when the expected SHA matches a clean full Git HEAD", async () => {
    const head = "0123456789abcdef0123456789abcdef01234567";
    const calls: Array<{ args: string[]; command: string; cwd?: string }> = [];
    const repositoryRoot = createTemporaryRoot("eti-capture-git-clean-");
    const execFileImpl = async (
      command: string,
      args: string[],
      options: { cwd?: string },
    ) => {
      calls.push({ args, command, cwd: options.cwd });
      return args[0] === "rev-parse"
        ? { stderr: "", stdout: `${head}\n` }
        : { stderr: "", stdout: "" };
    };

    await expect(
      assertCaptureSourceProvenance(
        {
          expectedGitSha: head,
          phase: "after-local",
          repositoryRoot,
        },
        { execFileImpl },
      ),
    ).resolves.toEqual({ gitHead: head, sourceTreeClean: true });
    expect(calls).toEqual([
      {
        args: ["rev-parse", "--verify", "HEAD"],
        command: "git",
        cwd: repositoryRoot,
      },
      {
        args: [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
          "--ignored=no",
        ],
        command: "git",
        cwd: repositoryRoot,
      },
      {
        args: ["ls-files", "-v", "-z", "--cached"],
        command: "git",
        cwd: repositoryRoot,
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
        cwd: repositoryRoot,
      },
    ]);
  });

  it("rejects an after capture when the expected SHA differs from Git HEAD", async () => {
    const expectedGitSha = "0123456789abcdef0123456789abcdef01234567";
    const gitHead = "89abcdef0123456789abcdef0123456789abcdef";
    const execFileImpl = async () => ({ stderr: "", stdout: `${gitHead}\n` });

    await expect(
      assertCaptureSourceProvenance(
        {
          expectedGitSha,
          phase: "after-production",
          repositoryRoot: createTemporaryRoot("eti-capture-git-mismatch-"),
        },
        { execFileImpl },
      ),
    ).rejects.toThrow(/expected SHA.*does not match.*Git HEAD/i);
  });

  it("rejects a dirty tracked or untracked non-ignored source tree", async () => {
    const head = "0123456789abcdef0123456789abcdef01234567";
    const execFileImpl = async (_command: string, args: string[]) =>
      args[0] === "rev-parse"
        ? { stderr: "", stdout: `${head}\n` }
        : { stderr: "", stdout: " M src/styles/global.css\n?? notes.txt\n" };

    await expect(
      assertCaptureSourceProvenance(
        {
          expectedGitSha: head,
          phase: "runtime-verification",
          repositoryRoot: createTemporaryRoot("eti-capture-git-dirty-"),
        },
        { execFileImpl },
      ),
    ).rejects.toThrow(/source tree.*not clean/i);
  });

  it("fails closed when a Git provenance command fails", async () => {
    const head = "0123456789abcdef0123456789abcdef01234567";
    const execFileImpl = async () => {
      throw new Error("injected Git failure");
    };

    await expect(
      assertCaptureSourceProvenance(
        {
          expectedGitSha: head,
          phase: "after-local",
          repositoryRoot: createTemporaryRoot("eti-capture-git-error-"),
        },
        { execFileImpl },
      ),
    ).rejects.toThrow(/could not verify.*Git source/i);
  });

  it("rejects an assume-unchanged tracked file that porcelain status hides", async () => {
    const { gitHead, repositoryRoot } = createCleanGitFixture(
      "eti-capture-assume-unchanged-",
    );
    runGit(repositoryRoot, [
      "update-index",
      "--assume-unchanged",
      "tracked.txt",
    ]);
    expect(
      runGit(repositoryRoot, [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignored=no",
      ]),
    ).toBe("");

    await expect(
      assertCaptureSourceProvenance({
        expectedGitSha: gitHead,
        phase: "after-local",
        repositoryRoot,
      }),
    ).rejects.toThrow(/assume-unchanged|index flags/i);
  });

  it("rejects a skip-worktree tracked file that porcelain status hides", async () => {
    const { gitHead, repositoryRoot } = createCleanGitFixture(
      "eti-capture-skip-worktree-",
    );
    runGit(repositoryRoot, ["update-index", "--skip-worktree", "tracked.txt"]);
    expect(
      runGit(repositoryRoot, [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignored=no",
      ]),
    ).toBe("");

    await expect(
      assertCaptureSourceProvenance({
        expectedGitSha: gitHead,
        phase: "after-production",
        repositoryRoot,
      }),
    ).rejects.toThrow(/skip-worktree|index flags/i);
  });

  it("allows tracked .env.example but rejects an ignored local .env variant", async () => {
    const { gitHead, repositoryRoot } = createCleanGitFixture(
      "eti-capture-ignored-env-",
    );
    await expect(
      assertCaptureSourceProvenance({
        expectedGitSha: gitHead,
        phase: "runtime-verification",
        repositoryRoot,
      }),
    ).resolves.toEqual({ gitHead, sourceTreeClean: true });

    writeFileSync(
      join(repositoryRoot, ".env.production.local"),
      "PUBLIC_VARIANT=unsafe\n",
      "utf8",
    );
    expect(
      runGit(repositoryRoot, [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignored=no",
      ]),
    ).toBe("");

    await expect(
      assertCaptureSourceProvenance({
        expectedGitSha: gitHead,
        phase: "runtime-verification",
        repositoryRoot,
      }),
    ).rejects.toThrow(/ignored.*\.env|environment.*file/i);
  });

  it("exempts historical before captures from the local Git source gate", async () => {
    const deployedGitSha = "0123456789abcdef0123456789abcdef01234567";
    let gitInvoked = false;
    const execFileImpl = async () => {
      gitInvoked = true;
      throw new Error("before captures must not inspect local Git");
    };

    await expect(
      assertCaptureSourceProvenance(
        {
          expectedGitSha: deployedGitSha,
          phase: "before",
          repositoryRoot: createTemporaryRoot("eti-capture-git-before-"),
        },
        { execFileImpl },
      ),
    ).resolves.toEqual({ exempt: true });
    expect(gitInvoked).toBe(false);
  });

  it("checks source cleanliness before mutating an existing capture output", async () => {
    const head = "0123456789abcdef0123456789abcdef01234567";
    const repositoryRoot = createTemporaryRoot("eti-capture-git-order-");
    const paths = createCapturePaths(repositoryRoot, "after-local");
    const sentinelPath = join(paths.outputDirectory, "prior-evidence.txt");
    mkdirSync(paths.outputDirectory, { recursive: true });
    writeFileSync(sentinelPath, "prior", "utf8");
    const execFileImpl = async (_command: string, args: string[]) =>
      args[0] === "rev-parse"
        ? { stderr: "", stdout: `${head}\n` }
        : { stderr: "", stdout: "?? uncommitted-source.txt\n" };

    await expect(
      captureProductionScreenshots(
        {
          deploymentId: null,
          expectedGitSha: head,
          origin: "http://127.0.0.1:4321",
          phase: "after-local",
        },
        { execFileImpl, paths },
      ),
    ).rejects.toThrow(/source tree.*not clean/i);
    expect(readFileSync(sentinelPath, "utf8")).toBe("prior");
  });

  it("accepts exactly one served root build marker matching the expected SHA", () => {
    const head = "0123456789abcdef0123456789abcdef01234567";

    expect(validateServedBuildGitSha([head], head)).toBe(head);
  });

  it.each([
    ["a missing marker", []],
    [
      "duplicate markers",
      [
        "0123456789abcdef0123456789abcdef01234567",
        "0123456789abcdef0123456789abcdef01234567",
      ],
    ],
    ["a malformed marker", ["main"]],
    ["a mismatched marker", ["89abcdef0123456789abcdef0123456789abcdef"]],
  ])("rejects %s on the served root", (_label, markerValues) => {
    const expectedGitSha = "0123456789abcdef0123456789abcdef01234567";

    expect(() =>
      validateServedBuildGitSha(markerValues, expectedGitSha),
    ).toThrow(/served root.*build.*SHA/i);
  });

  it("rejects a mismatched served root marker before any screenshot", async () => {
    const expectedGitSha = "0123456789abcdef0123456789abcdef01234567";
    const servedGitSha = "89abcdef0123456789abcdef0123456789abcdef";
    const repositoryRoot = createTemporaryRoot("eti-capture-served-sha-");
    const paths = createCapturePaths(repositoryRoot, "after-local");
    let screenshotCalls = 0;
    const mainFrame = {};
    const page = {
      close: async () => undefined,
      goto: async (url: string) => ({
        request: () => ({ redirectedFrom: () => null }),
        status: () => 200,
        url: () => url,
      }),
      locator: () => ({
        count: async () => 1,
        nth: () => ({ getAttribute: async () => servedGitSha }),
      }),
      mainFrame: () => mainFrame,
      on: () => page,
      screenshot: async () => {
        screenshotCalls += 1;
      },
    };
    const context = {
      close: async () => undefined,
      newPage: async () => page,
    };
    const browser = {
      close: async () => undefined,
      newContext: async () => context,
    };
    const chromiumImpl = { launch: async () => browser };
    const execFileImpl = async (_command: string, args: string[]) =>
      args[0] === "rev-parse"
        ? { stderr: "", stdout: `${expectedGitSha}\n` }
        : { stderr: "", stdout: "" };

    await expect(
      captureProductionScreenshots(
        {
          deploymentId: null,
          expectedGitSha,
          origin: "http://127.0.0.1:4321",
          phase: "after-local",
        },
        { chromiumImpl, execFileImpl, paths },
      ),
    ).rejects.toThrow(/served root.*build.*SHA/i);
    expect(screenshotCalls).toBe(0);
  });

  it("keeps historical before captures compatible with sites without a build marker", async () => {
    let browserUsed = false;
    const browser = {
      newContext: async () => {
        browserUsed = true;
        throw new Error("before phase must not inspect a build marker");
      },
    };

    await expect(
      assertServedBuildGitSha(browser, {
        expectedGitSha: "0123456789abcdef0123456789abcdef01234567",
        origin: "https://publication.example",
        phase: "before",
      }),
    ).resolves.toEqual({ exempt: true });
    expect(browserUsed).toBe(false);
  });

  it("defines the exact unique 27-route after inventory", () => {
    expect(RELEASE_EVIDENCE_ID).toBe("premium-spatial-2026-08-26");
    expect(CAPTURE_PHASES).toEqual([
      "before",
      "after-local",
      "after-production",
      "runtime-verification",
    ]);
    expect(CAPTURE_WIDTHS).toEqual([
      320, 390, 600, 768, 1024, 1280, 1440, 1920,
    ]);
    expect(BEFORE_CAPTURE_ROUTES).toEqual([
      { alias: "home", path: "/", status: 200 },
      { alias: "articles", path: "/articles/", status: 200 },
      {
        alias: "category-cybersecurity",
        path: "/categories/cybersecurity-data-protection/",
        status: 200,
      },
      {
        alias: "article-ai-automation",
        path: "/articles/how-to-identify-business-tasks-for-automation/",
        status: 200,
      },
      { alias: "toolkit", path: "/toolkit/", status: 200 },
      { alias: "about", path: "/about/", status: 200 },
      {
        alias: "editorial-standards",
        path: "/editorial-standards/",
        status: 200,
      },
      {
        alias: "404",
        path: "/publication-audit-route-that-does-not-exist/",
        status: 404,
      },
    ]);
    const afterAliases = AFTER_CAPTURE_ROUTES.map(({ alias }) => alias);
    const afterPaths = AFTER_CAPTURE_ROUTES.map(({ path }) => path);
    expect(afterAliases).toEqual([
      "home",
      "articles",
      "categories",
      "category-ai-automation",
      "category-business-software",
      "category-cybersecurity",
      "category-digital-operations",
      "category-technology-strategy",
      "article-ai-automation",
      "article-saas-evaluation",
      "article-phishing-response",
      "article-shared-files",
      "article-software-tco",
      "toolkit",
      "toolkit-automation-candidate-screen",
      "toolkit-saas-evaluation-evidence-sheet",
      "toolkit-risk-register",
      "toolkit-backup-restore-test-log",
      "about",
      "publisher",
      "editorial-standards",
      "corrections",
      "privacy",
      "advertising-disclosure",
      "contact",
      "sitemap",
      "404",
    ]);
    expect(afterPaths).toEqual([
      "/",
      "/articles/",
      "/categories/",
      "/categories/ai-automation/",
      "/categories/business-software/",
      "/categories/cybersecurity-data-protection/",
      "/categories/digital-operations/",
      "/categories/technology-strategy/",
      "/articles/how-to-identify-business-tasks-for-automation/",
      "/articles/evaluate-saas-with-a-practical-checklist/",
      "/articles/respond-to-a-suspected-phishing-message/",
      "/articles/create-a-shared-file-and-folder-system/",
      "/articles/calculate-the-total-cost-of-business-software/",
      "/toolkit/",
      "/toolkit/automation-candidate-screen/",
      "/toolkit/saas-evaluation-evidence-sheet/",
      "/toolkit/technology-risk-register/",
      "/toolkit/backup-restore-test-log/",
      "/about/",
      "/publisher/",
      "/editorial-standards/",
      "/corrections/",
      "/privacy/",
      "/advertising-disclosure/",
      "/contact/",
      "/sitemap/",
      "/publication-audit-route-that-does-not-exist/",
    ]);
    expect(AFTER_CAPTURE_ROUTES).toHaveLength(27);
    expect(new Set(afterAliases).size).toBe(27);
    expect(new Set(afterPaths).size).toBe(27);
    expect(
      AFTER_CAPTURE_ROUTES.filter(({ status }) => status === 200),
    ).toHaveLength(26);
    expect(AFTER_CAPTURE_ROUTES.at(-1)?.status).toBe(404);
    expect(CAPTURE_ROUTES).toBe(AFTER_CAPTURE_ROUTES);
  });

  it("builds a deterministic 64-image representative before inventory", () => {
    const plan = buildCapturePlan({
      origin: "https://publication.example",
      phase: "before",
    });

    expect(plan).toHaveLength(64);
    expect(new Set(plan.map(({ fileName }) => fileName)).size).toBe(64);
    expect(plan.every(({ state }) => state === "full-page")).toBe(true);
    expect(plan[0]?.fileName).toBe("320-home-full-page.png");
    expect(plan.at(-1)?.fileName).toBe("1920-404-full-page.png");
    expect(plan.every(({ height }) => height === 900)).toBe(true);
    expect(plan.every(({ deviceScaleFactor }) => deviceScaleFactor === 1)).toBe(
      true,
    );
    expect(plan[0]?.url).toBe("https://publication.example/");
    expect(plan.at(-1)?.url).toBe(
      "https://publication.example/publication-audit-route-that-does-not-exist/",
    );
  });

  it("builds the exact 228-image after inventory including keyboard states", () => {
    const productionPlan = buildCapturePlan({
      origin: "https://publication.example",
      phase: "after-production",
    });
    const localPlan = buildCapturePlan({
      origin: "http://127.0.0.1:4321",
      phase: "after-local",
    });
    const runtimePlan = buildCapturePlan({
      origin: "https://publication.example",
      phase: "runtime-verification",
    });
    const fileNames = productionPlan.map(({ fileName }) => fileName);

    expect(productionPlan).toHaveLength(228);
    expect(new Set(fileNames).size).toBe(228);
    expect(
      productionPlan
        .filter(({ state }) => state === "menu-open")
        .map(({ width }) => width),
    ).toEqual([320, 390, 600, 768]);
    expect(
      productionPlan
        .filter(({ state }) => state === "skip-link-focus")
        .map(({ width }) => width),
    ).toEqual(CAPTURE_WIDTHS);
    expect(
      productionPlan.filter(({ state }) => state === "full-page"),
    ).toHaveLength(216);
    expect(localPlan.map(({ fileName }) => fileName)).toEqual(fileNames);
    expect(runtimePlan.map(({ fileName }) => fileName)).toEqual(fileNames);
    expect(runtimePlan).toHaveLength(228);
  });

  it("materializes the exact 228-row after capture manifest", () => {
    const plan = buildCapturePlan({
      origin: "https://publication.example",
      phase: "after-production",
    });
    const manifest = buildAuditManifest({
      assertions: [],
      captureRecords: plan.map(({ fileName, status }, index) => ({
        actualStatus: status,
        byteCount: index + 1,
        fileName,
        sha256: index.toString(16).padStart(64, "0"),
      })),
      capturedAt: "2026-08-26T12:00:00.000Z",
      deploymentId: "dpl_capture_manifest_fixture",
      expectedGitSha: "0123456789abcdef0123456789abcdef01234567",
      origin: "https://publication.example",
      phase: "after-production",
      plan,
    });

    expect(manifest.captureCount).toBe(228);
    expect(manifest.captures).toHaveLength(228);
    expect(
      new Set(manifest.captures.map(({ fileName }) => fileName)).size,
    ).toBe(228);
    expect(
      [...new Set(manifest.captures.map(({ route }) => route))].sort(),
    ).toEqual(AFTER_CAPTURE_ROUTES.map(({ path }) => path).sort());
    expect(
      Object.fromEntries(
        ["full-page", "menu-open", "skip-link-focus"].map((state) => [
          state,
          manifest.captures.filter((capture) => capture.state === state).length,
        ]),
      ),
    ).toEqual({
      "full-page": 216,
      "menu-open": 4,
      "skip-link-focus": 8,
    });
  });

  it("omits nullable representative routes instead of generating /null captures", () => {
    const representativeArticlePaths = {
      backup: null,
      operationsArchitecture: null,
      primary: null,
      saasEvaluation: null,
      securityWorkflow: null,
      strategyCost: null,
      table: null,
    };
    const beforePlan = buildCapturePlan({
      origin: "https://publication.example",
      phase: "before",
      representativeArticlePaths,
    });
    const afterPlan = buildCapturePlan({
      origin: "https://publication.example",
      phase: "after-production",
      representativeArticlePaths,
    });

    expect(beforePlan).toHaveLength(56);
    expect(afterPlan).toHaveLength(188);
    expect(
      [...beforePlan, ...afterPlan].filter(({ alias }) =>
        alias.startsWith("article-"),
      ),
    ).toEqual([]);
    expect(
      [...beforePlan, ...afterPlan].some(
        ({ url }) => new URL(url).pathname === "/null",
      ),
    ).toBe(false);
  });

  it.each(["before", "after-production", "runtime-verification"] as const)(
    "accepts only an explicit canonical HTTPS origin for %s",
    (phase) => {
      expect(normalizeCaptureOrigin("https://publication.example", phase)).toBe(
        "https://publication.example",
      );
      expect(
        normalizeCaptureOrigin("https://publication.example/", phase),
      ).toBe("https://publication.example");

      for (const candidate of [
        "",
        " https://publication.example",
        "http://publication.example",
        "http://127.0.0.1:4321",
        "https://user:secret@publication.example",
        "https://publication.example/path",
        "https://publication.example/a/..",
        "https://publication.example/?",
        "https://publication.example/#",
        "publication.example",
      ]) {
        expect(() => normalizeCaptureOrigin(candidate, phase)).toThrow(
          /HTTPS origin/i,
        );
      }
    },
  );

  it("accepts only canonical loopback HTTP origins with safe explicit ports for after-local", () => {
    for (const candidate of [
      "http://127.0.0.1",
      "http://127.0.0.1/",
      "http://127.0.0.1:1024",
      "http://127.0.0.1:4321",
      "http://127.0.0.1:65535",
    ]) {
      expect(normalizeCaptureOrigin(candidate, "after-local")).toBe(
        candidate.endsWith("/") ? candidate.slice(0, -1) : candidate,
      );
    }

    for (const candidate of [
      "http://localhost:4321",
      "http://127.0.0.2:4321",
      "http://[::1]:4321",
      "http://0.0.0.0:4321",
      "https://127.0.0.1:4321",
      "http://user:secret@127.0.0.1:4321",
      "http://127.0.0.1:0",
      "http://127.0.0.1:1023",
      "http://127.0.0.1:04321",
      "http://127.0.0.1:4321/path",
      "http://127.0.0.1:4321/a/..",
      "http://127.0.0.1:4321/?",
      "http://127.0.0.1:4321/#",
    ]) {
      expect(() => normalizeCaptureOrigin(candidate, "after-local")).toThrow(
        /loopback HTTP origin/i,
      );
    }
  });

  it("requires explicit origin and phase and accepts only validated release metadata", () => {
    expect(
      parseCaptureArguments([
        "--origin",
        "https://publication.example/",
        "--phase",
        "after-production",
        "--expected-sha",
        "0123456789abcdef0123456789abcdef01234567",
        "--deployment-id",
        "dpl_AbCdEf1234567890",
      ]),
    ).toEqual({
      deploymentId: "dpl_AbCdEf1234567890",
      expectedGitSha: "0123456789abcdef0123456789abcdef01234567",
      origin: "https://publication.example",
      phase: "after-production",
    });
    expect(
      parseCaptureArguments([
        "--origin",
        "http://127.0.0.1:4321",
        "--phase",
        "after-local",
        "--expected-sha",
        "0123456789abcdef0123456789abcdef01234567",
      ]),
    ).toEqual({
      deploymentId: null,
      expectedGitSha: "0123456789abcdef0123456789abcdef01234567",
      origin: "http://127.0.0.1:4321",
      phase: "after-local",
    });
    expect(() => parseCaptureArguments([])).toThrow(/--origin/i);
    expect(() =>
      parseCaptureArguments([
        "--origin",
        "http://127.0.0.1:4321",
        "--phase",
        "after-local",
        "--expected-sha",
        "main",
      ]),
    ).toThrow(/SHA/i);
    expect(() =>
      parseCaptureArguments([
        "--origin",
        "https://one.example",
        "--origin",
        "https://two.example",
        "--phase",
        "before",
      ]),
    ).toThrow(/exactly one/i);
    expect(() =>
      parseCaptureArguments([
        "--origin",
        "https://publication.example",
        "--phase",
        "after-local",
        "--output",
        "elsewhere",
      ]),
    ).toThrow(/unexpected/i);
    expect(() =>
      parseCaptureArguments([
        "--origin",
        "https://publication.example",
        "--phase",
        "../../outside",
      ]),
    ).toThrow(/phase/i);
  });

  it("enforces phase-specific capture provenance", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const deploymentId = "dpl_AbCdEf1234567890";
    const parse = (phase: string, extra: string[] = []) =>
      parseCaptureArguments([
        "--origin",
        phase === "after-local"
          ? "http://127.0.0.1:4321"
          : "https://publication.example",
        "--phase",
        phase,
        ...extra,
      ]);

    for (const phase of [
      "before",
      "after-production",
      "runtime-verification",
    ]) {
      expect(() => parse(phase)).toThrow(/expected SHA/i);
      expect(() => parse(phase, ["--expected-sha", sha])).toThrow(
        /deployment ID/i,
      );
      expect(
        parse(phase, ["--expected-sha", sha, "--deployment-id", deploymentId]),
      ).toMatchObject({ deploymentId, expectedGitSha: sha, phase });
    }

    expect(() => parse("after-local")).toThrow(/expected SHA/i);
    expect(parse("after-local", ["--expected-sha", sha])).toMatchObject({
      deploymentId: null,
      expectedGitSha: sha,
      phase: "after-local",
    });
    expect(() =>
      parse("after-local", [
        "--expected-sha",
        sha,
        "--deployment-id",
        deploymentId,
      ]),
    ).toThrow(/after-local.*deployment ID/i);
  });

  it("maps phases to fixed versioned evidence directories", () => {
    const repositoryRoot = createTemporaryRoot("eti-capture-paths-");
    expect(RELEASE_EVIDENCE_ID).toBe("premium-spatial-2026-08-26");
    expect(createCapturePaths(repositoryRoot, "before").outputDirectory).toBe(
      resolve(
        repositoryRoot,
        `artifacts/site-audit/before/${RELEASE_EVIDENCE_ID}`,
      ),
    );
    expect(
      createCapturePaths(repositoryRoot, "after-local").outputDirectory,
    ).toBe(
      resolve(
        repositoryRoot,
        `artifacts/site-audit/after/${RELEASE_EVIDENCE_ID}/local`,
      ),
    );
    expect(
      createCapturePaths(repositoryRoot, "after-production").outputDirectory,
    ).toBe(
      resolve(
        repositoryRoot,
        `artifacts/site-audit/after/${RELEASE_EVIDENCE_ID}/production`,
      ),
    );
    const runtimePaths = createCapturePaths(
      repositoryRoot,
      "runtime-verification",
    );
    expect(runtimePaths.outputDirectory).toBe(
      resolve(
        repositoryRoot,
        `artifacts/site-audit/runtime-verification/${RELEASE_EVIDENCE_ID}-final`,
      ),
    );
    expect(runtimePaths.expectedFileNames).toHaveLength(228);
    expect(
      readFileSync(new URL("../../.gitignore", import.meta.url), "utf8"),
    ).toMatch(/^artifacts\/site-audit\/runtime-verification\/$/m);
    expect(() => createCapturePaths(repositoryRoot, "../outside")).toThrow(
      /phase/i,
    );
  });

  it("exposes the capture command through the package scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["capture:production"]).toBe(
      "node scripts/capture-production-screenshots.mjs",
    );
  });

  it("rejects a Windows junction in the fixed audit path before touching its outside target", async () => {
    const repositoryRoot = createTemporaryRoot("eti-capture-repository-");
    const outsideRoot = createTemporaryRoot("eti-capture-outside-");
    const sentinelPath = join(outsideRoot, "keep.txt");
    writeFileSync(sentinelPath, "keep", "utf8");
    mkdirSync(join(repositoryRoot, "artifacts", "site-audit"), {
      recursive: true,
    });
    const linkedAfterPath = join(
      repositoryRoot,
      "artifacts",
      "site-audit",
      "after",
    );
    symlinkSync(
      outsideRoot,
      linkedAfterPath,
      process.platform === "win32" ? "junction" : "dir",
    );
    temporaryLinks.push(linkedAfterPath);

    const paths = createCapturePaths(repositoryRoot, "after-production");
    await expect(prepareCaptureWorkspace(paths)).rejects.toThrow(
      /symbolic link|junction/i,
    );

    expect(readFileSync(sentinelPath, "utf8")).toBe("keep");
    expect(existsSync(join(outsideRoot, "production.pending"))).toBe(false);
  });

  it("rejects a junction at a per-file output path", async () => {
    const repositoryRoot = createTemporaryRoot("eti-capture-file-repository-");
    const outsideRoot = createTemporaryRoot("eti-capture-file-outside-");
    const sentinelPath = join(outsideRoot, "keep.txt");
    writeFileSync(sentinelPath, "keep", "utf8");
    const paths = createCapturePaths(repositoryRoot, "after-production");
    await prepareCaptureWorkspace(paths);
    const outputPath = join(paths.pendingDirectory, "390-home-full-page.png");
    symlinkSync(
      outsideRoot,
      outputPath,
      process.platform === "win32" ? "junction" : "dir",
    );
    temporaryLinks.push(outputPath);

    await expect(
      assertSafeCaptureOutputPath(paths, outputPath),
    ).rejects.toThrow(/symbolic link|junction/i);
    expect(readFileSync(sentinelPath, "utf8")).toBe("keep");
  });

  it.each([
    ["pendingDirectory", "pending"],
    ["outputDirectory", "production"],
  ] as const)(
    "rejects a junction at the fixed %s directory before touching its outside target",
    async (pathKey, label) => {
      const repositoryRoot = createTemporaryRoot(
        `eti-capture-${label}-repository-`,
      );
      const outsideRoot = createTemporaryRoot(`eti-capture-${label}-outside-`);
      const sentinelPath = join(outsideRoot, "keep.txt");
      writeFileSync(sentinelPath, "keep", "utf8");
      const paths = createCapturePaths(repositoryRoot, "after-production");
      mkdirSync(resolve(paths.outputDirectory, ".."), { recursive: true });
      symlinkSync(
        outsideRoot,
        paths[pathKey],
        process.platform === "win32" ? "junction" : "dir",
      );
      temporaryLinks.push(paths[pathKey]);

      await expect(prepareCaptureWorkspace(paths)).rejects.toThrow(
        /symbolic link|junction/i,
      );
      expect(readFileSync(sentinelPath, "utf8")).toBe("keep");
    },
  );

  it("restores prior production evidence when the final staged rename fails", async () => {
    const repositoryRoot = createTemporaryRoot("eti-capture-publish-");
    const paths = createCapturePaths(repositoryRoot, "after-production");
    mkdirSync(paths.pendingDirectory, { recursive: true });
    mkdirSync(paths.outputDirectory, { recursive: true });
    writeFileSync(join(paths.pendingDirectory, "new.txt"), "new", "utf8");
    writeFileSync(join(paths.outputDirectory, "prior.txt"), "prior", "utf8");

    const renameImpl = async (from: string, to: string): Promise<void> => {
      if (
        resolve(from) === resolve(paths.pendingDirectory) &&
        resolve(to) === resolve(paths.outputDirectory)
      ) {
        throw new Error("injected final rename failure");
      }
      renameSync(from, to);
    };

    await expect(publishCaptureRun(paths, { renameImpl })).rejects.toThrow(
      /injected final rename failure/i,
    );

    expect(readFileSync(join(paths.outputDirectory, "prior.txt"), "utf8")).toBe(
      "prior",
    );
    expect(readFileSync(join(paths.pendingDirectory, "new.txt"), "utf8")).toBe(
      "new",
    );
    expect(existsSync(paths.backupDirectory)).toBe(false);
  });

  it("rejects a same-origin redirect chain that returns to the requested URL", () => {
    const url = "https://publication.example/";
    const response = {
      request: () => ({
        redirectedFrom: () => ({
          url: () => "https://publication.example/temporary",
        }),
      }),
      status: () => 200,
      url: () => url,
    };

    expect(() =>
      assertExpectedNavigation(response, {
        route: { path: "/", status: 200 },
        url,
      }),
    ).toThrow(/redirect chain/i);
  });

  it("records failed same-origin subresources and redirect chains from Playwright responses", async () => {
    const productionCapture =
      (await import("../../scripts/capture-production-screenshots.mjs")) as Record<
        string,
        unknown
      >;
    expect(productionCapture).toHaveProperty("createRuntimeMonitor");
    const createRuntimeMonitor = productionCapture.createRuntimeMonitor;
    if (typeof createRuntimeMonitor !== "function") return;

    type EventHandler = (event: unknown) => void;
    const listeners = new Map<string, EventHandler[]>();
    const mainFrame = {};
    const page = {
      mainFrame: () => mainFrame,
      on: (event: string, handler: EventHandler) => {
        const handlers = listeners.get(event) ?? [];
        handlers.push(handler);
        listeners.set(event, handlers);
        return page;
      },
    };
    const emit = (event: string, value: unknown) => {
      for (const handler of listeners.get(event) ?? []) handler(value);
    };
    const response = ({
      from = null,
      navigation = false,
      status,
      url,
    }: {
      from?: string | null;
      navigation?: boolean;
      status: number;
      url: string;
    }) => {
      const request = {
        frame: () => mainFrame,
        isNavigationRequest: () => navigation,
        redirectedFrom: () => (from ? { url: () => from } : null),
        url: () => url,
      };
      return {
        request: () => request,
        status: () => status,
        url: () => url,
      };
    };

    const origin = "https://publication.example";
    const route = {
      path: "/publication-audit-route-that-does-not-exist/",
      status: 404,
    };
    const errors = createRuntimeMonitor(page, origin, route) as string[];
    expect(listeners.has("response")).toBe(true);

    emit(
      "response",
      response({
        navigation: true,
        status: 404,
        url: `${origin}${route.path}`,
      }),
    );
    expect(errors).toEqual([]);

    emit(
      "response",
      response({ status: 404, url: `${origin}/styles/missing.css` }),
    );
    emit(
      "response",
      response({ status: 503, url: `${origin}/images/unavailable.png` }),
    );
    emit(
      "response",
      response({
        from: `${origin}/scripts/legacy.js`,
        status: 200,
        url: `${origin}/scripts/current.js`,
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/404.*missing\.css/i),
        expect.stringMatching(/503.*unavailable\.png/i),
        expect.stringMatching(/redirect chain.*legacy\.js.*current\.js/i),
      ]),
    );
  });
});

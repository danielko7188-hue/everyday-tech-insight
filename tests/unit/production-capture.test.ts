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

import {
  AFTER_CAPTURE_ROUTES,
  BEFORE_CAPTURE_ROUTES,
  CAPTURE_PHASES,
  CAPTURE_ROUTES,
  CAPTURE_WIDTHS,
  assertExpectedNavigation,
  assertSafeCaptureOutputPath,
  buildCapturePlan,
  createCapturePaths,
  normalizeCaptureOrigin,
  parseCaptureArguments,
  prepareCaptureWorkspace,
  publishCaptureRun,
} from "../../scripts/capture-production-screenshots.mjs";

const temporaryRoots: string[] = [];
const temporaryLinks: string[] = [];

function createTemporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
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
  it("defines five widths, the representative before routes, and exact full after routes", () => {
    expect(CAPTURE_PHASES).toEqual([
      "before",
      "after-local",
      "after-production",
    ]);
    expect(CAPTURE_WIDTHS).toEqual([390, 768, 1024, 1440, 1920]);
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
    expect(AFTER_CAPTURE_ROUTES.map(({ path }) => path)).toEqual([
      "/",
      "/articles/",
      "/categories/",
      "/categories/cybersecurity-data-protection/",
      "/articles/how-to-identify-business-tasks-for-automation/",
      "/articles/evaluate-saas-with-a-practical-checklist/",
      "/articles/respond-to-a-suspected-phishing-message/",
      "/articles/create-a-shared-file-and-folder-system/",
      "/articles/calculate-the-total-cost-of-business-software/",
      "/toolkit/",
      "/toolkit/technology-risk-register/",
      "/about/",
      "/publisher/",
      "/editorial-standards/",
      "/privacy/",
      "/advertising-disclosure/",
      "/contact/",
      "/publication-audit-route-that-does-not-exist/",
    ]);
    expect(CAPTURE_ROUTES).toBe(AFTER_CAPTURE_ROUTES);
  });

  it("builds a deterministic 40-image representative before inventory", () => {
    const plan = buildCapturePlan({
      origin: "https://publication.example",
      phase: "before",
    });

    expect(plan).toHaveLength(40);
    expect(new Set(plan.map(({ fileName }) => fileName)).size).toBe(40);
    expect(plan.every(({ state }) => state === "full-page")).toBe(true);
    expect(plan[0]?.fileName).toBe("390-home-full-page.png");
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

  it("builds the exact 97-image after inventory including keyboard states", () => {
    const plan = buildCapturePlan({
      origin: "https://publication.example",
      phase: "after-production",
    });
    const fileNames = plan.map(({ fileName }) => fileName);

    expect(plan).toHaveLength(97);
    expect(new Set(fileNames).size).toBe(97);
    expect(
      plan
        .filter(({ state }) => state === "menu-open")
        .map(({ width }) => width),
    ).toEqual([390, 768]);
    expect(
      plan
        .filter(({ state }) => state === "skip-link-focus")
        .map(({ width }) => width),
    ).toEqual(CAPTURE_WIDTHS);
    expect(plan.filter(({ state }) => state === "full-page")).toHaveLength(
      AFTER_CAPTURE_ROUTES.length * CAPTURE_WIDTHS.length,
    );
  });

  it("accepts only an explicit canonical HTTPS origin", () => {
    expect(normalizeCaptureOrigin("https://publication.example")).toBe(
      "https://publication.example",
    );
    expect(normalizeCaptureOrigin("https://publication.example/")).toBe(
      "https://publication.example",
    );

    for (const candidate of [
      "",
      " https://publication.example",
      "http://publication.example",
      "https://user:secret@publication.example",
      "https://publication.example/path",
      "https://publication.example/a/..",
      "https://publication.example/?",
      "https://publication.example/#",
      "publication.example",
    ]) {
      expect(() => normalizeCaptureOrigin(candidate)).toThrow(/HTTPS origin/i);
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
    expect(() => parseCaptureArguments([])).toThrow(/--origin/i);
    expect(() =>
      parseCaptureArguments([
        "--origin",
        "https://publication.example",
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

  it("maps phases to fixed versioned evidence directories", () => {
    const repositoryRoot = createTemporaryRoot("eti-capture-paths-");
    expect(createCapturePaths(repositoryRoot, "before").outputDirectory).toBe(
      resolve(
        repositoryRoot,
        "artifacts/site-audit/before/purple-signal-2026-08-25",
      ),
    );
    expect(
      createCapturePaths(repositoryRoot, "after-local").outputDirectory,
    ).toBe(
      resolve(
        repositoryRoot,
        "artifacts/site-audit/after/purple-signal-2026-08-25/local",
      ),
    );
    expect(
      createCapturePaths(repositoryRoot, "after-production").outputDirectory,
    ).toBe(
      resolve(
        repositoryRoot,
        "artifacts/site-audit/after/purple-signal-2026-08-25/production",
      ),
    );
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
});

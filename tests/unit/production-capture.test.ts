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
      "runtime-verification",
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

    expect(productionPlan).toHaveLength(97);
    expect(new Set(fileNames).size).toBe(97);
    expect(
      productionPlan
        .filter(({ state }) => state === "menu-open")
        .map(({ width }) => width),
    ).toEqual([390, 768]);
    expect(
      productionPlan
        .filter(({ state }) => state === "skip-link-focus")
        .map(({ width }) => width),
    ).toEqual(CAPTURE_WIDTHS);
    expect(
      productionPlan.filter(({ state }) => state === "full-page"),
    ).toHaveLength(AFTER_CAPTURE_ROUTES.length * CAPTURE_WIDTHS.length);
    expect(localPlan.map(({ fileName }) => fileName)).toEqual(fileNames);
    expect(runtimePlan.map(({ fileName }) => fileName)).toEqual(fileNames);
    expect(runtimePlan).toHaveLength(97);
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
    const runtimePaths = createCapturePaths(
      repositoryRoot,
      "runtime-verification",
    );
    expect(runtimePaths.outputDirectory).toBe(
      resolve(
        repositoryRoot,
        "artifacts/site-audit/runtime-verification/purple-signal-2026-08-25-final",
      ),
    );
    expect(runtimePaths.expectedFileNames).toHaveLength(97);
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

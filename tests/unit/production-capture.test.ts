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
  CAPTURE_ROUTES,
  CAPTURE_WIDTHS,
  assertExpectedNavigation,
  assertSafeCaptureOutputPath,
  buildCapturePlan,
  createCapturePaths,
  normalizeCaptureOrigin,
  parseCaptureOrigin,
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
  it("defines the original eight audited routes", () => {
    expect(CAPTURE_ROUTES).toEqual([
      { alias: "home", path: "/", status: 200 },
      {
        alias: "category",
        path: "/categories/cybersecurity-data-protection/",
        status: 200,
      },
      {
        alias: "article",
        path: "/articles/back-up-business-files-with-the-3-2-1-method/",
        status: 200,
      },
      { alias: "toolkit", path: "/toolkit/", status: 200 },
      { alias: "about", path: "/about/", status: 200 },
      {
        alias: "editorial-standards",
        path: "/editorial-standards/",
        status: 200,
      },
      { alias: "contact", path: "/contact/", status: 200 },
      {
        alias: "404",
        path: "/publication-after-capture-route-that-does-not-exist/",
        status: 404,
      },
    ]);
    expect(CAPTURE_WIDTHS).toEqual([390, 768, 1440]);
  });

  it("builds exactly 48 unique, deterministic output names", () => {
    const plan = buildCapturePlan("https://publication.example");
    const fileNames = plan.map(({ fileName }) => fileName);

    expect(plan).toHaveLength(48);
    expect(new Set(fileNames).size).toBe(48);
    expect(fileNames).toEqual([
      ...CAPTURE_WIDTHS.flatMap((width) =>
        CAPTURE_ROUTES.flatMap(({ alias }) => [
          `${width}-${alias}-above-fold.png`,
          `${width}-${alias}-full.png`,
        ]),
      ),
    ]);
    expect(plan.every(({ height }) => height === 900)).toBe(true);
    expect(plan.every(({ deviceScaleFactor }) => deviceScaleFactor === 1)).toBe(
      true,
    );
    expect(plan[0]?.url).toBe("https://publication.example/");
    expect(plan.at(-1)?.url).toBe(
      "https://publication.example/publication-after-capture-route-that-does-not-exist/",
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

  it("requires exactly one --origin CLI option", () => {
    expect(
      parseCaptureOrigin(["--origin", "https://publication.example/"]),
    ).toBe("https://publication.example");
    expect(() => parseCaptureOrigin([])).toThrow(/--origin/i);
    expect(() => parseCaptureOrigin(["--origin"])).toThrow(/--origin/i);
    expect(() =>
      parseCaptureOrigin([
        "--origin",
        "https://one.example",
        "--origin",
        "https://two.example",
      ]),
    ).toThrow(/exactly one/i);
    expect(() =>
      parseCaptureOrigin([
        "--origin",
        "https://publication.example",
        "--output",
        "elsewhere",
      ]),
    ).toThrow(/unexpected/i);
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

    const paths = createCapturePaths(repositoryRoot);
    await expect(prepareCaptureWorkspace(paths)).rejects.toThrow(
      /symbolic link|junction/i,
    );

    expect(readFileSync(sentinelPath, "utf8")).toBe("keep");
    expect(existsSync(join(outsideRoot, ".production-capture.pending"))).toBe(
      false,
    );
  });

  it("rejects a junction at a per-file output path", async () => {
    const repositoryRoot = createTemporaryRoot("eti-capture-file-repository-");
    const outsideRoot = createTemporaryRoot("eti-capture-file-outside-");
    const sentinelPath = join(outsideRoot, "keep.txt");
    writeFileSync(sentinelPath, "keep", "utf8");
    const paths = createCapturePaths(repositoryRoot);
    await prepareCaptureWorkspace(paths);
    const outputPath = join(paths.pendingDirectory, "390-home-above-fold.png");
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
      const paths = createCapturePaths(repositoryRoot);
      mkdirSync(paths.auditRoot, { recursive: true });
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
    const paths = createCapturePaths(repositoryRoot);
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

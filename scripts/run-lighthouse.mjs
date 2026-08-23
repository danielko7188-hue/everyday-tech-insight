import { createServer } from "node:http";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const THRESHOLDS = {
  performance: 0.9,
  accessibility: 0.95,
  "best-practices": 0.95,
  seo: 0.95,
};

const RUNS_PER_PAGE = 3;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

export function evaluateLighthouseCategories(scores) {
  return Object.entries(THRESHOLDS)
    .filter(([category, threshold]) => {
      const score = scores[category];
      return typeof score !== "number" || score < threshold;
    })
    .map(([category, threshold]) => ({
      category,
      score: typeof scores[category] === "number" ? scores[category] : null,
      threshold,
    }));
}

export function aggregateLighthouseScores(runScores) {
  if (!Array.isArray(runScores) || runScores.length !== RUNS_PER_PAGE) {
    throw new Error(
      `Expected exactly ${RUNS_PER_PAGE} Lighthouse score sets per page.`,
    );
  }

  const scores = Object.fromEntries(
    Object.keys(THRESHOLDS).map((category) => {
      const values = runScores.map((run) => run?.[category]);
      if (
        values.some(
          (value) => typeof value !== "number" || !Number.isFinite(value),
        )
      ) {
        return [category, null];
      }

      const sorted = [...values].sort((left, right) => left - right);
      return [category, sorted[Math.floor(sorted.length / 2)]];
    }),
  );

  const medianPerformance = scores.performance;
  const representativeRunIndex =
    typeof medianPerformance === "number"
      ? runScores.reduce((closestIndex, run, index) => {
          const performance = run?.performance;
          if (typeof performance !== "number") return closestIndex;
          const closestPerformance = runScores[closestIndex]?.performance;
          if (typeof closestPerformance !== "number") return index;
          return Math.abs(performance - medianPerformance) <
            Math.abs(closestPerformance - medianPerformance)
            ? index
            : closestIndex;
        }, 0)
      : 0;

  return { scores, representativeRunIndex };
}

export function createLighthouseSummary(pages) {
  return {
    status: pages.some(({ failures }) => failures.length > 0) ? "FAIL" : "PASS",
    formFactor: "desktop",
    runsPerPage: RUNS_PER_PAGE,
    thresholds: THRESHOLDS,
    pages,
  };
}

export async function removeDirectoryWithRetries(
  directory,
  {
    attempts = 20,
    delayImpl = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    rmImpl = rm,
  } = {},
) {
  const transientCodes = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rmImpl(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : null;
      if (!transientCodes.has(code) || attempt === attempts) throw error;
      await delayImpl(attempt * 100);
    }
  }
}

export function waitForProcessExit(childProcess, timeoutMs) {
  if (
    !childProcess ||
    childProcess.exitCode !== null ||
    childProcess.signalCode !== null
  ) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (didExit) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      childProcess.removeListener("exit", onExit);
      childProcess.removeListener("close", onExit);
      resolve(didExit);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    childProcess.once("exit", onExit);
    childProcess.once("close", onExit);
  });
}

export async function stopChrome(
  chrome,
  { timeoutMs = 10_000, waitForExitImpl = waitForProcessExit } = {},
) {
  if (!chrome) return;
  const childProcess = chrome.process ?? chrome.chromeProcess;
  if (!childProcess) {
    chrome.kill();
    chrome.destroyTmp?.();
    return;
  }

  const gracefulExit = waitForExitImpl(childProcess, timeoutMs);
  chrome.kill();
  if (await gracefulExit) return;

  const forcedExit = waitForExitImpl(childProcess, timeoutMs);
  childProcess.kill("SIGKILL");
  if (!(await forcedExit)) {
    throw new Error(
      `Chromium process ${childProcess.pid ?? "unknown"} did not exit after launcher and SIGKILL shutdown attempts.`,
    );
  }
}

export async function launchChromeSafely(
  options,
  {
    LauncherImpl = chromeLauncher.Launcher,
    cleanupImpl = stopChrome,
    onCreate = () => undefined,
  } = {},
) {
  const launcher = new LauncherImpl({ ...options, handleSIGINT: false });
  onCreate(launcher);
  try {
    await launcher.launch();
    return launcher;
  } catch (launchError) {
    try {
      await cleanupImpl(launcher);
    } catch (cleanupError) {
      throw new AggregateError(
        [launchError, cleanupError],
        "Chromium launch failed and its owned process could not be cleaned up.",
        { cause: cleanupError },
      );
    }
    throw launchError;
  }
}

export function installSignalCleanup(
  cleanupImpl,
  {
    processImpl = process,
    exitImpl = (code) => {
      process.exit(code);
    },
    logErrorImpl = (error) => console.error(error),
  } = {},
) {
  let handling = false;
  const handlers = new Map();
  const removeHandlers = () => {
    for (const [signal, handler] of handlers) {
      processImpl.removeListener(signal, handler);
    }
    handlers.clear();
  };

  for (const [signal, exitCode] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    const handler = () => {
      if (handling) return;
      handling = true;
      removeHandlers();
      void Promise.resolve()
        .then(cleanupImpl)
        .catch(logErrorImpl)
        .finally(() => exitImpl(exitCode));
    };
    handlers.set(signal, handler);
    processImpl.once(signal, handler);
  }

  return removeHandlers;
}

export async function withSignalCleanupInstalled(
  action,
  cleanup,
  { installImpl = installSignalCleanup } = {},
) {
  const removeHandlers = installImpl(cleanup);
  try {
    return await action();
  } finally {
    removeHandlers();
  }
}

export async function prepareLighthouseReportRun(
  outputDirectory,
  { mkdirImpl = mkdir, removeImpl = removeDirectoryWithRetries } = {},
) {
  const pendingDirectory = `${outputDirectory}.pending`;
  await removeImpl(outputDirectory);
  await removeImpl(pendingDirectory);
  await mkdirImpl(pendingDirectory, { recursive: true });
  return pendingDirectory;
}

export async function publishLighthouseReportRun(
  pendingDirectory,
  outputDirectory,
  { renameImpl = rename } = {},
) {
  await renameImpl(pendingDirectory, outputDirectory);
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function startStaticServer(distDirectory) {
  const root = path.resolve(distDirectory);
  const notFoundPath = path.join(root, "404.html");
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const decoded = decodeURIComponent(requestUrl.pathname);
      const relative = decoded.endsWith("/") ? `${decoded}index.html` : decoded;
      const candidate = path.resolve(root, `.${relative}`);
      const safeCandidate =
        candidate === root || candidate.startsWith(`${root}${path.sep}`)
          ? candidate
          : notFoundPath;
      const exists = await fileExists(safeCandidate);
      const servedPath = exists ? safeCandidate : notFoundPath;
      const statusCode = exists ? 200 : 404;
      const body = await readFile(servedPath);
      const contentType =
        CONTENT_TYPES[path.extname(servedPath).toLowerCase()] ??
        "application/octet-stream";
      response.writeHead(statusCode, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not determine the Lighthouse preview port.");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function runAudit(url, port) {
  const result = await lighthouse(url, {
    port,
    output: "json",
    logLevel: "error",
    onlyCategories: Object.keys(THRESHOLDS),
    formFactor: "desktop",
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
  });
  if (!result) throw new Error(`Lighthouse returned no result for ${url}.`);

  const scores = Object.fromEntries(
    Object.keys(THRESHOLDS).map((category) => [
      category,
      result.lhr.categories[category]?.score ?? null,
    ]),
  );
  return { raw: result.report, scores };
}

async function main() {
  const distDirectory = path.join(process.cwd(), "dist");
  const outputDirectory = path.join(process.cwd(), ".lighthouseci");
  let pendingDirectory = await prepareLighthouseReportRun(outputDirectory);
  let server;
  let chromeProfile;
  let chrome;

  const pages = [
    { name: "home", path: "/" },
    { name: "ai-automation-category", path: "/categories/ai-automation/" },
    {
      name: "automation-candidates-article",
      path: "/articles/how-to-identify-business-tasks-for-automation/",
    },
  ];
  const summary = [];
  let hasFailure = false;
  let resourceCleanupPromise;
  let pendingCleanupPromise;

  const cleanupResources = () => {
    if (!resourceCleanupPromise) {
      resourceCleanupPromise = (async () => {
        const errors = [];
        let browserStopped = true;
        try {
          await stopChrome(chrome);
        } catch (error) {
          browserStopped = false;
          errors.push(error);
        }
        try {
          await server?.close();
        } catch (error) {
          errors.push(error);
        }
        if (browserStopped && chromeProfile) {
          try {
            await removeDirectoryWithRetries(chromeProfile);
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) {
          throw new AggregateError(
            errors,
            "Lighthouse resources did not all clean up safely.",
          );
        }
      })();
    }
    return resourceCleanupPromise;
  };

  const discardPendingReports = () => {
    if (!pendingDirectory) return Promise.resolve();
    if (!pendingCleanupPromise) {
      const directory = pendingDirectory;
      pendingDirectory = null;
      pendingCleanupPromise = removeDirectoryWithRetries(directory);
    }
    return pendingCleanupPromise;
  };

  const signalCleanup = async () => {
    try {
      await cleanupResources();
    } finally {
      await discardPendingReports();
    }
  };

  await withSignalCleanupInstalled(async () => {
    try {
      let operationError;
      try {
        if (!(await fileExists(path.join(distDirectory, "index.html")))) {
          throw new Error(
            "dist/index.html is missing. Run npm run build first.",
          );
        }
        server = await startStaticServer(distDirectory);
        chromeProfile = await mkdtemp(path.join(tmpdir(), "eti-lighthouse-"));
        const chromePath = process.env.CHROME_PATH || chromium.executablePath();
        if (!(await fileExists(chromePath))) {
          throw new Error(
            "The version-matched Chromium executable is missing. Run npm run setup:browsers first.",
          );
        }
        chrome = await launchChromeSafely(
          {
            chromePath,
            userDataDir: chromeProfile,
            connectionPollInterval: 500,
            maxConnectionRetries: 120,
            chromeFlags: [
              "--headless=new",
              "--disable-gpu",
              "--no-first-run",
              "--no-default-browser-check",
              "--no-sandbox",
            ],
          },
          {
            cleanupImpl: cleanupResources,
            onCreate: (launcher) => {
              chrome = launcher;
            },
          },
        );
        if (!Number.isInteger(chrome.port)) {
          throw new Error("Chromium did not expose a valid debugging port.");
        }
        for (const page of pages) {
          const url = `${server.origin}${page.path}`;
          const audits = [];
          for (let runIndex = 0; runIndex < RUNS_PER_PAGE; runIndex += 1) {
            const audit = await runAudit(url, chrome.port);
            audits.push(audit);
            const raw =
              typeof audit.raw === "string"
                ? audit.raw
                : JSON.stringify(audit.raw);
            await writeFile(
              path.join(
                pendingDirectory,
                `${page.name}-run-${runIndex + 1}.json`,
              ),
              raw,
              "utf8",
            );
          }
          const runScores = audits.map(({ scores }) => scores);
          const { scores, representativeRunIndex } =
            aggregateLighthouseScores(runScores);
          const failures = evaluateLighthouseCategories(scores);
          hasFailure ||= failures.length > 0;
          const representativeRaw = audits[representativeRunIndex].raw;
          await writeFile(
            path.join(pendingDirectory, `${page.name}.json`),
            typeof representativeRaw === "string"
              ? representativeRaw
              : JSON.stringify(representativeRaw),
            "utf8",
          );
          summary.push({
            name: page.name,
            path: page.path,
            runScores,
            scores,
            failures,
            representativeRun: representativeRunIndex + 1,
          });
          const printableScores = Object.entries(scores)
            .map(
              ([category, score]) =>
                `${category}=${typeof score === "number" ? Math.round(score * 100) : "missing"}`,
            )
            .join(", ");
          const performanceRuns = runScores
            .map(({ performance }) =>
              typeof performance === "number"
                ? Math.round(performance * 100)
                : "missing",
            )
            .join("/");
          console.log(
            `${page.path} (desktop; median of ${RUNS_PER_PAGE}; performance runs=${performanceRuns}): ${printableScores}`,
          );
        }
        const reportSummary = createLighthouseSummary(summary);
        await writeFile(
          path.join(pendingDirectory, "summary.json"),
          `${JSON.stringify(reportSummary, null, 2)}\n`,
          "utf8",
        );
      } catch (error) {
        operationError = error;
      }

      let cleanupError;
      try {
        await cleanupResources();
      } catch (error) {
        cleanupError = error;
      }
      if (operationError && cleanupError) {
        throw new AggregateError(
          [operationError, cleanupError],
          "Lighthouse failed and its owned resources did not clean up safely.",
          { cause: operationError },
        );
      }
      if (operationError) throw operationError;
      if (cleanupError) throw cleanupError;

      await publishLighthouseReportRun(pendingDirectory, outputDirectory);
      pendingDirectory = null;
    } finally {
      await discardPendingReports();
    }
  }, signalCleanup);

  if (hasFailure) {
    console.error(
      "Lighthouse: FAIL (desktop; performance requires 90; accessibility, best practices, and SEO require 95).",
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Lighthouse: PASS (desktop; median of ${RUNS_PER_PAGE} runs) on all three representative pages.`,
    );
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `Lighthouse: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

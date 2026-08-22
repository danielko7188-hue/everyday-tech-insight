import { createServer } from "node:http";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const THRESHOLDS = {
  performance: 0.9,
  accessibility: 0.95,
  "best-practices": 0.95,
  seo: 0.95,
};

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
  if (!(await fileExists(path.join(distDirectory, "index.html")))) {
    throw new Error("dist/index.html is missing. Run npm run build first.");
  }

  const outputDirectory = path.join(process.cwd(), ".lighthouseci");
  await mkdir(outputDirectory, { recursive: true });
  const server = await startStaticServer(distDirectory);
  const chromeProfile = await mkdtemp(path.join(tmpdir(), "eti-lighthouse-"));
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

  try {
    chrome = await chromeLauncher.launch({
      chromePath: process.env.CHROME_PATH,
      userDataDir: chromeProfile,
      handleSIGINT: false,
      chromeFlags: [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--no-sandbox",
      ],
    });
    for (const page of pages) {
      const url = `${server.origin}${page.path}`;
      const audit = await runAudit(url, chrome.port);
      const failures = evaluateLighthouseCategories(audit.scores);
      hasFailure ||= failures.length > 0;
      const raw =
        typeof audit.raw === "string" ? audit.raw : JSON.stringify(audit.raw);
      await writeFile(
        path.join(outputDirectory, `${page.name}.json`),
        raw,
        "utf8",
      );
      summary.push({
        name: page.name,
        path: page.path,
        scores: audit.scores,
        failures,
      });
      const printableScores = Object.entries(audit.scores)
        .map(
          ([category, score]) =>
            `${category}=${Math.round((score ?? 0) * 100)}`,
        )
        .join(", ");
      console.log(`${page.path}: ${printableScores}`);
    }
    await writeFile(
      path.join(outputDirectory, "summary.json"),
      `${JSON.stringify({ thresholds: THRESHOLDS, pages: summary }, null, 2)}\n`,
      "utf8",
    );
  } finally {
    chrome?.kill();
    await server.close();
    await removeDirectoryWithRetries(chromeProfile);
  }

  if (hasFailure) {
    console.error(
      "Lighthouse: FAIL (performance requires 90; accessibility, best practices, and SEO require 95).",
    );
    process.exitCode = 1;
  } else {
    console.log("Lighthouse: PASS on all three representative pages.");
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

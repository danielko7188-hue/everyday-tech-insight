import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

export const CAPTURE_WIDTHS = Object.freeze([390, 768, 1440]);
export const CAPTURE_HEIGHT = 900;
export const CAPTURE_ROUTES = Object.freeze([
  Object.freeze({ alias: "home", path: "/", status: 200 }),
  Object.freeze({
    alias: "category",
    path: "/categories/cybersecurity-data-protection/",
    status: 200,
  }),
  Object.freeze({
    alias: "article",
    path: "/articles/back-up-business-files-with-the-3-2-1-method/",
    status: 200,
  }),
  Object.freeze({ alias: "toolkit", path: "/toolkit/", status: 200 }),
  Object.freeze({ alias: "about", path: "/about/", status: 200 }),
  Object.freeze({
    alias: "editorial-standards",
    path: "/editorial-standards/",
    status: 200,
  }),
  Object.freeze({ alias: "contact", path: "/contact/", status: 200 }),
  Object.freeze({
    alias: "404",
    path: "/publication-after-capture-route-that-does-not-exist/",
    status: 404,
  }),
]);

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const auditRoot = path.join(repositoryRoot, "artifacts", "site-audit", "after");
const outputDirectory = path.join(auditRoot, "production");
const pendingDirectory = path.join(auditRoot, ".production-capture.pending");

export function normalizeCaptureOrigin(candidate) {
  if (typeof candidate !== "string" || candidate.trim() !== candidate) {
    throw new TypeError(
      "Capture origin must be an explicit HTTPS origin without credentials, path, query, or hash.",
    );
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new TypeError(
      "Capture origin must be an explicit HTTPS origin without credentials, path, query, or hash.",
    );
  }

  const lexicalOrigin =
    candidate === parsed.origin || candidate === `${parsed.origin}/`;
  if (
    !lexicalOrigin ||
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new TypeError(
      "Capture origin must be an explicit HTTPS origin without credentials, path, query, or hash.",
    );
  }

  return parsed.origin;
}

export function parseCaptureOrigin(arguments_) {
  const originIndexes = arguments_.flatMap((argument, index) =>
    argument === "--origin" ? [index] : [],
  );
  if (originIndexes.length !== 1) {
    throw new TypeError("Provide exactly one --origin HTTPS origin.");
  }
  const originIndex = originIndexes[0];
  const candidate = arguments_[originIndex + 1];
  if (!candidate || candidate.startsWith("--")) {
    throw new TypeError("The --origin option requires an HTTPS origin.");
  }
  if (arguments_.length !== 2 || originIndex !== 0) {
    throw new TypeError("Unexpected option; only --origin is supported.");
  }
  return normalizeCaptureOrigin(candidate);
}

export function buildCapturePlan(candidate) {
  const origin = normalizeCaptureOrigin(candidate);
  return CAPTURE_WIDTHS.flatMap((width) =>
    CAPTURE_ROUTES.flatMap((route) =>
      ["above-fold", "full"].map((variant) => ({
        ...route,
        deviceScaleFactor: 1,
        fileName: `${width}-${route.alias}-${variant}.png`,
        fullPage: variant === "full",
        height: CAPTURE_HEIGHT,
        url: new URL(route.path, `${origin}/`).href,
        variant,
        width,
      })),
    ),
  );
}

function createRuntimeMonitor(page, origin, route) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const locationUrl = message.location().url;
    const expectedMissingRouteNoise =
      route.status === 404 &&
      locationUrl === new URL(route.path, `${origin}/`).href &&
      /Failed to load resource.*404/i.test(message.text());
    if (!expectedMissingRouteNoise) {
      errors.push(`console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`page error: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    errors.push(
      `request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown error"})`,
    );
  });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (["http:", "https:"].includes(requestUrl.protocol)) {
      if (requestUrl.origin !== origin) {
        errors.push(`cross-origin request: ${request.url()}`);
      }
    }
  });
  return errors;
}

async function stabilizePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await Promise.all([
      globalThis.document.fonts.load('1rem "Newsreader Variable"'),
      globalThis.document.fonts.load('1rem "Source Sans 3 Variable"'),
      globalThis.document.fonts.ready,
    ]);
    await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
  });
}

export async function captureProductionScreenshots(candidate) {
  const origin = normalizeCaptureOrigin(candidate);
  const expectedNames = buildCapturePlan(origin).map(
    ({ fileName }) => fileName,
  );
  await mkdir(auditRoot, { recursive: true });
  await rm(pendingDirectory, { force: true, recursive: true });
  await mkdir(pendingDirectory);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of CAPTURE_WIDTHS) {
      const context = await browser.newContext({
        colorScheme: "light",
        deviceScaleFactor: 1,
        locale: "en-US",
        reducedMotion: "reduce",
        timezoneId: "America/Los_Angeles",
        viewport: { height: CAPTURE_HEIGHT, width },
      });
      try {
        for (const route of CAPTURE_ROUTES) {
          const page = await context.newPage();
          const runtimeErrors = createRuntimeMonitor(page, origin, route);
          const url = new URL(route.path, `${origin}/`).href;
          const response = await page.goto(url, { waitUntil: "networkidle" });
          if (!response || response.status() !== route.status) {
            throw new Error(
              `${route.path} returned ${response?.status() ?? "no response"}; expected ${route.status}.`,
            );
          }
          if (response.url() !== url) {
            throw new Error(
              `${route.path} unexpectedly redirected to ${response.url()}.`,
            );
          }
          await stabilizePage(page);
          await page.screenshot({
            animations: "disabled",
            caret: "hide",
            path: path.join(
              pendingDirectory,
              `${width}-${route.alias}-above-fold.png`,
            ),
            scale: "css",
          });
          await page.screenshot({
            animations: "disabled",
            caret: "hide",
            fullPage: true,
            path: path.join(
              pendingDirectory,
              `${width}-${route.alias}-full.png`,
            ),
            scale: "css",
          });
          await page.close();
          if (runtimeErrors.length > 0) {
            throw new Error(`${route.path}: ${runtimeErrors.join("; ")}`);
          }
        }
      } finally {
        await context.close();
      }
    }

    const actualNames = (await readdir(pendingDirectory)).sort();
    const sortedExpectedNames = [...expectedNames].sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(sortedExpectedNames)) {
      throw new Error(
        `Capture inventory mismatch: expected ${sortedExpectedNames.length}, found ${actualNames.length}.`,
      );
    }
  } catch (error) {
    await rm(pendingDirectory, { force: true, recursive: true });
    throw error;
  } finally {
    await browser.close();
  }

  await rm(outputDirectory, { force: true, recursive: true });
  await rename(pendingDirectory, outputDirectory);
  return { count: expectedNames.length, origin, outputDirectory };
}

async function main() {
  const origin = parseCaptureOrigin(process.argv.slice(2));
  const result = await captureProductionScreenshots(origin);
  console.log(
    `Production capture: PASS (${result.count} PNGs from ${result.origin} written to ${result.outputDirectory}).`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `Production capture: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

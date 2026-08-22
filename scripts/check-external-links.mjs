import path from "node:path";
import { pathToFileURL } from "node:url";

import { load } from "cheerio";

import { readBuildFiles } from "./qa-build.mjs";
import { readArticleRecords } from "./qa-content.mjs";

function classifyStatus(statusCode) {
  if (statusCode >= 200 && statusCode < 400) return "PASS";
  if (statusCode === 404 || statusCode === 410) return "FAIL";
  return "UNVERIFIED";
}

async function fetchStatus(url, method, fetchImpl, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method,
      redirect: "follow",
      signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
        "User-Agent":
          "EverydayTechInsight-LinkChecker/1.0 (+https://everyday-tech-insight.vercel.app/editorial-standards/)",
      },
    });
    const statusCode = response.status;
    try {
      await response.body?.cancel();
    } catch {
      // A status code is still usable when the remote stream already closed.
    }
    return { statusCode, error: null };
  } catch (error) {
    return {
      statusCode: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkUrl(
  url,
  { fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {},
) {
  const head = await fetchStatus(url, "HEAD", fetchImpl, timeoutMs);
  if (head.statusCode !== null && classifyStatus(head.statusCode) === "PASS") {
    return {
      url,
      status: "PASS",
      method: "HEAD",
      statusCode: head.statusCode,
      detail: `HEAD returned ${head.statusCode}.`,
    };
  }

  const get = await fetchStatus(url, "GET", fetchImpl, timeoutMs);
  if (get.statusCode !== null) {
    return {
      url,
      status: classifyStatus(get.statusCode),
      method: "GET",
      statusCode: get.statusCode,
      detail: `HEAD ${head.statusCode ?? `error (${head.error})`}; GET returned ${get.statusCode}.`,
    };
  }

  return {
    url,
    status: "UNVERIFIED",
    method: "GET",
    statusCode: null,
    detail: `HEAD ${head.statusCode ?? `error (${head.error})`}; GET error (${get.error}).`,
  };
}

export async function checkExternalUrls(
  urls,
  { concurrency = 5, fetchImpl = globalThis.fetch, timeoutMs = 15_000 } = {},
) {
  const uniqueUrls = [...new Set(urls)].sort();
  const results = new Array(uniqueUrls.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < uniqueUrls.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await checkUrl(uniqueUrls[index], {
        fetchImpl,
        timeoutMs,
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, uniqueUrls.length) }, () =>
      worker(),
    ),
  );
  return results;
}

export function collectExternalHttpsUrlsFromHtmlFiles(files, siteUrl) {
  const siteOrigin = new URL(siteUrl).origin;
  const externalUrls = new Set();

  for (const [fileName, html] of files) {
    if (!fileName.replaceAll("\\", "/").endsWith(".html")) continue;
    const $ = load(html);
    $("a[href]").each((_index, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      try {
        const url = new URL(href, siteUrl);
        if (url.protocol !== "https:" || url.origin === siteOrigin) return;
        url.hash = "";
        externalUrls.add(url.toString());
      } catch {
        // Invalid links are reported by built-output QA; they are not fetchable here.
      }
    });
  }

  return [...externalUrls].sort();
}

function collectSourceUrls(articles) {
  return articles.flatMap(({ data }) =>
    Array.isArray(data.sourceList)
      ? data.sourceList
          .map((source) => source?.url)
          .filter((url) => typeof url === "string")
      : [],
  );
}

async function main() {
  const articles = await readArticleRecords();
  const files = await readBuildFiles();
  const sourceUrls = collectSourceUrls(articles);
  const publicExternalUrls = collectExternalHttpsUrlsFromHtmlFiles(
    files,
    "https://everyday-tech-insight.vercel.app/",
  );
  const results = await checkExternalUrls([
    ...sourceUrls,
    ...publicExternalUrls,
  ]);

  for (const result of results) {
    const code = result.statusCode ?? "n/a";
    console.log(
      `${result.status.padEnd(10)} ${String(code).padEnd(4)} ${result.url}`,
    );
    if (result.status !== "PASS") console.log(`  ${result.detail}`);
  }

  const counts = Object.fromEntries(
    ["PASS", "FAIL", "UNVERIFIED"].map((status) => [
      status,
      results.filter((result) => result.status === status).length,
    ]),
  );
  console.log(
    `External HTTPS links: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.UNVERIFIED} UNVERIFIED (${results.length} unique).`,
  );

  if (counts.FAIL > 0 || counts.UNVERIFIED > 0) {
    console.error(
      "External HTTPS links did not fully verify. FAIL means a definitive 404/410; UNVERIFIED means access or network evidence was inconclusive.",
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `External HTTPS links: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { load } from "cheerio";

import { readBuildFiles } from "./qa-build.mjs";
import { readArticleRecords } from "./qa-content.mjs";
import { siteUrl } from "../site.config.mjs";
import { publicEvidenceUrlIssue } from "../src/utils/public-evidence-url.mjs";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 5;

function ipv4Number(address) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return parts.reduce((value, part) => value * 256 + part, 0) >>> 0;
}

function ipv4InCidr(value, base, prefixLength) {
  const mask =
    prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (value & mask) === (ipv4Number(base) & mask);
}

function isUnsafeIpv4(address) {
  const value = ipv4Number(address);
  if (value === null) return true;

  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ].some(([base, prefixLength]) => ipv4InCidr(value, base, prefixLength));
}

function parseIpv6(address) {
  const withoutZone = address.toLowerCase().split("%")[0];
  if (!withoutZone || withoutZone.split("::").length > 2) return null;

  function parseSide(side) {
    if (!side) return [];
    const rawParts = side.split(":");
    const parts = [];
    for (const [index, part] of rawParts.entries()) {
      if (part.includes(".")) {
        if (index !== rawParts.length - 1) return null;
        const ipv4 = ipv4Number(part);
        if (ipv4 === null) return null;
        parts.push((ipv4 >>> 16) & 0xffff, ipv4 & 0xffff);
      } else if (/^[0-9a-f]{1,4}$/.test(part)) {
        parts.push(Number.parseInt(part, 16));
      } else {
        return null;
      }
    }
    return parts;
  }

  const [leftText, rightText] = withoutZone.split("::");
  const left = parseSide(leftText ?? "");
  const right = parseSide(rightText ?? "");
  if (!left || !right) return null;
  if (rightText === undefined) return left.length === 8 ? left : null;

  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}

function isUnsafeIpv6(address) {
  const parts = parseIpv6(address);
  if (!parts) return true;

  const isIpv4Mapped =
    parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
  if (isIpv4Mapped) {
    const mapped = `${parts[6] >>> 8}.${parts[6] & 0xff}.${parts[7] >>> 8}.${parts[7] & 0xff}`;
    return isUnsafeIpv4(mapped);
  }

  const isGlobalUnicast = (parts[0] & 0xe000) === 0x2000;
  const isIetfProtocolAssignment = parts[0] === 0x2001 && parts[1] <= 0x01ff;
  const isDocumentation = parts[0] === 0x2001 && parts[1] === 0x0db8;
  const isBenchmark =
    parts[0] === 0x2001 && parts[1] === 0x0002 && parts[2] === 0;
  const isSixToFour = parts[0] === 0x2002;
  const isAdditionalDocumentation =
    parts[0] === 0x3fff && (parts[1] & 0xf000) === 0;
  const isReturnedSixBone = parts[0] === 0x3ffe;
  return (
    !isGlobalUnicast ||
    isIetfProtocolAssignment ||
    isDocumentation ||
    isBenchmark ||
    isSixToFour ||
    isAdditionalDocumentation ||
    isReturnedSixBone
  );
}

export function isUnsafeNetworkAddress(address) {
  const version = net.isIP(address);
  if (version === 4) return isUnsafeIpv4(address);
  if (version === 6) return isUnsafeIpv6(address);
  return true;
}

export function createPinnedLookup(addresses) {
  const records = addresses
    .map((address) => ({ address, family: net.isIP(address) }))
    .filter(({ family }) => family === 4 || family === 6);
  if (records.length === 0) {
    throw new Error("A pinned HTTPS request requires a validated IP address.");
  }

  return (_hostname, options, callback) => {
    const lookupOptions = typeof options === "function" ? {} : (options ?? {});
    const done = typeof options === "function" ? options : callback;
    const requestedFamily = Number(lookupOptions.family || 0);
    const eligible = requestedFamily
      ? records.filter(({ family }) => family === requestedFamily)
      : records;
    queueMicrotask(() => {
      if (eligible.length === 0) {
        done(
          Object.assign(
            new Error("No validated address matches the requested family."),
            {
              code: "ENOTFOUND",
            },
          ),
        );
      } else if (lookupOptions.all) {
        done(null, eligible);
      } else {
        done(null, eligible[0].address, eligible[0].family);
      }
    });
  };
}

export function pinnedHttpsFetch(
  rawUrl,
  { method, headers, signal, resolvedAddresses } = {},
  { requestImpl = httpsRequest } = {},
) {
  if (!Array.isArray(resolvedAddresses) || resolvedAddresses.length === 0) {
    return Promise.reject(
      new Error("Pinned HTTPS fetch requires DNS-validated addresses."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = requestImpl(
      new URL(rawUrl),
      {
        method,
        headers,
        signal,
        agent: false,
        lookup: createPinnedLookup(resolvedAddresses),
      },
      (response) => {
        resolve({
          status: response.statusCode ?? 0,
          headers: {
            get(name) {
              const value = response.headers[name.toLowerCase()];
              if (Array.isArray(value)) return value[0] ?? null;
              return value === undefined ? null : String(value);
            },
          },
          body: {
            async cancel() {
              response.destroy();
            },
          },
        });
      },
    );
    request.once("error", reject);
    request.end();
  });
}

function resolverAddresses(result) {
  const entries = Array.isArray(result) ? result : [result];
  return entries
    .map((entry) => (typeof entry === "string" ? entry : entry?.address))
    .filter((address) => typeof address === "string");
}

async function lookupWithTimeout(hostname, lookupImpl, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      lookupImpl(hostname, { all: true, verbatim: true }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${timeoutMs} ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function validateFetchTarget(
  rawUrl,
  { lookupImpl = dnsLookup, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const publicUrlIssue = publicEvidenceUrlIssue(rawUrl);
  if (publicUrlIssue) {
    return { ok: false, blocked: true, reason: publicUrlIssue };
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, blocked: true, reason: "URL is not absolute." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, blocked: true, reason: "Only HTTPS is allowed." };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      blocked: true,
      reason: "Credentials in URLs are not allowed.",
    };
  }
  if (url.port && url.port !== "443") {
    return {
      ok: false,
      blocked: true,
      reason: `Port ${url.port} is not allowed.`,
    };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false, blocked: true, reason: "Localhost is not allowed." };
  }

  let addresses;
  if (net.isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      addresses = resolverAddresses(
        await lookupWithTimeout(hostname, lookupImpl, timeoutMs),
      );
    } catch (error) {
      return {
        ok: false,
        blocked: false,
        reason: `DNS lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  if (addresses.length === 0) {
    return {
      ok: false,
      blocked: false,
      reason: "DNS lookup returned no addresses.",
    };
  }
  const unsafeAddress = addresses.find(isUnsafeNetworkAddress);
  if (unsafeAddress) {
    return {
      ok: false,
      blocked: true,
      reason: `Destination resolves to disallowed address ${unsafeAddress}.`,
    };
  }

  return { ok: true, blocked: false, url: url.toString(), addresses };
}

function classifyStatus(statusCode) {
  if (statusCode >= 200 && statusCode < 400) return "PASS";
  if (statusCode === 404 || statusCode === 410) return "FAIL";
  return "UNVERIFIED";
}

export function redactUrlForLogging(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hadCredentials = Boolean(url.username || url.password);
    const hadQuery = Boolean(url.search);
    return `${url.protocol}//${hadCredentials ? "[redacted]@" : ""}${url.host}${url.pathname}${hadQuery ? "?[redacted]" : ""}`;
  } catch {
    return "[invalid URL]";
  }
}

async function fetchStatus(
  url,
  method,
  { fetchImpl, lookupImpl, maxRedirects, timeoutMs },
) {
  const deadline = Date.now() + timeoutMs;
  let currentUrl = url;
  try {
    for (
      let redirectCount = 0;
      redirectCount <= maxRedirects;
      redirectCount += 1
    ) {
      const remainingForLookup = Math.max(1, deadline - Date.now());
      const target = await validateFetchTarget(currentUrl, {
        lookupImpl,
        timeoutMs: remainingForLookup,
      });
      if (!target.ok) {
        return {
          statusCode: null,
          error: `${currentUrl === url ? "Unsafe target" : "Unsafe redirect"}: ${target.reason}`,
          securityBlocked: target.blocked,
        };
      }

      const remainingForFetch = Math.max(1, deadline - Date.now());
      const response = await fetchImpl(target.url, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(remainingForFetch),
        resolvedAddresses: target.addresses,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
          "User-Agent": `EverydayTechInsight-LinkChecker/1.0 (+${new URL("editorial-standards/", siteUrl)})`,
        },
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        try {
          await response.body?.cancel();
        } catch {
          // Continue with the redirect even when the empty stream already closed.
        }
        if (redirectCount === maxRedirects) {
          return {
            statusCode: null,
            error: `Redirect limit (${maxRedirects}) exceeded.`,
            securityBlocked: false,
          };
        }
        currentUrl = new URL(location, target.url).toString();
        continue;
      }

      const statusCode = response.status;
      try {
        await response.body?.cancel();
      } catch {
        // A status code is still usable when the remote stream already closed.
      }
      return { statusCode, error: null, securityBlocked: false };
    }
  } catch (error) {
    return {
      statusCode: null,
      error: error instanceof Error ? error.message : String(error),
      securityBlocked: false,
    };
  }

  return {
    statusCode: null,
    error: `Redirect limit (${maxRedirects}) exceeded.`,
    securityBlocked: false,
  };
}

export async function checkUrl(
  url,
  {
    fetchImpl = pinnedHttpsFetch,
    lookupImpl = dnsLookup,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const options = { fetchImpl, lookupImpl, maxRedirects, timeoutMs };
  const displayUrl = redactUrlForLogging(url);
  const head = await fetchStatus(url, "HEAD", options);
  if (head.securityBlocked) {
    return {
      url: displayUrl,
      status: "FAIL",
      method: "HEAD",
      statusCode: null,
      detail: head.error,
    };
  }
  if (head.statusCode !== null && classifyStatus(head.statusCode) === "PASS") {
    return {
      url: displayUrl,
      status: "PASS",
      method: "HEAD",
      statusCode: head.statusCode,
      detail: `HEAD returned ${head.statusCode}.`,
    };
  }

  const get = await fetchStatus(url, "GET", options);
  if (get.securityBlocked) {
    return {
      url: displayUrl,
      status: "FAIL",
      method: "GET",
      statusCode: null,
      detail: get.error,
    };
  }
  if (get.statusCode !== null) {
    return {
      url: displayUrl,
      status: classifyStatus(get.statusCode),
      method: "GET",
      statusCode: get.statusCode,
      detail: `HEAD ${head.statusCode ?? `error (${head.error})`}; GET returned ${get.statusCode}.`,
    };
  }

  return {
    url: displayUrl,
    status: "UNVERIFIED",
    method: "GET",
    statusCode: null,
    detail: `HEAD ${head.statusCode ?? `error (${head.error})`}; GET error (${get.error}).`,
  };
}

export async function checkExternalUrls(
  urls,
  {
    concurrency = 5,
    fetchImpl = pinnedHttpsFetch,
    lookupImpl = dnsLookup,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
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
        lookupImpl,
        maxRedirects,
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
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.origin === siteOrigin
        )
          return;
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
    siteUrl,
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
    `External HTTP(S) links: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.UNVERIFIED} UNVERIFIED (${results.length} unique).`,
  );

  if (counts.FAIL > 0 || counts.UNVERIFIED > 0) {
    console.error(
      "External HTTP(S) links did not fully verify. FAIL means a definitive 404/410 or a blocked unsafe target/redirect; UNVERIFIED means access or network evidence was inconclusive.",
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
      `External HTTP(S) links: ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}

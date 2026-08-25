import { createHash } from "node:crypto";
import { lstat, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const AUDIT_MANIFEST_FILE = "audit-manifest.json";
export const AUDIT_MANIFEST_SCHEMA_VERSION = 1;

const PHASES = new Set(["before", "after-local", "after-production"]);
const CAPTURE_STATES = new Set(["full-page", "menu-open", "skip-link-focus"]);
const SHA_PATTERN = /^[a-f\d]{40}$/;
const DIGEST_PATTERN = /^[a-f\d]{64}$/;
const DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

function assertPlainFileName(fileName) {
  if (
    typeof fileName !== "string" ||
    fileName.length === 0 ||
    path.basename(fileName) !== fileName ||
    fileName === "." ||
    fileName === ".."
  ) {
    throw new TypeError(`Invalid audit capture filename: ${String(fileName)}`);
  }
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Audit manifest contains a duplicate ${label}.`);
  }
}

function normalizeMetadata({
  capturedAt,
  deploymentId = null,
  expectedGitSha = null,
  origin,
  phase,
}) {
  if (
    typeof capturedAt !== "string" ||
    !Number.isFinite(Date.parse(capturedAt)) ||
    new Date(capturedAt).toISOString() !== capturedAt
  ) {
    throw new TypeError(
      "Audit capture time must be a canonical ISO timestamp.",
    );
  }
  if (!PHASES.has(phase)) {
    throw new TypeError(`Unsupported audit phase: ${String(phase)}`);
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new TypeError("Audit origin must be a canonical HTTPS origin.");
  }
  if (
    parsedOrigin.protocol !== "https:" ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search ||
    parsedOrigin.hash ||
    origin !== parsedOrigin.origin
  ) {
    throw new TypeError("Audit origin must be a canonical HTTPS origin.");
  }

  if (expectedGitSha !== null && !SHA_PATTERN.test(expectedGitSha)) {
    throw new TypeError(
      "Expected Git SHA must be a full lowercase 40-character SHA.",
    );
  }
  if (
    deploymentId !== null &&
    (typeof deploymentId !== "string" ||
      !DEPLOYMENT_ID_PATTERN.test(deploymentId))
  ) {
    throw new TypeError("Deployment ID contains unsupported characters.");
  }

  return {
    capturedAt,
    deploymentId,
    expectedGitSha,
    origin,
    phase,
  };
}

function normalizePlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new Error("Audit capture plan must not be empty.");
  }

  const normalized = plan.map((item) => {
    assertPlainFileName(item?.fileName);
    if (
      typeof item.path !== "string" ||
      !item.path.startsWith("/") ||
      !Number.isInteger(item.status) ||
      !Number.isInteger(item.width) ||
      item.width <= 0 ||
      !Number.isInteger(item.height) ||
      item.height <= 0 ||
      item.deviceScaleFactor !== 1 ||
      !CAPTURE_STATES.has(item.state)
    ) {
      throw new TypeError(
        `Invalid audit capture plan row for ${String(item?.fileName)}.`,
      );
    }
    return item;
  });
  assertUnique(
    normalized.map(({ fileName }) => fileName),
    "planned filename",
  );
  return normalized;
}

function normalizeCaptureRecords(captureRecords) {
  if (!Array.isArray(captureRecords)) {
    throw new TypeError("Audit capture records must be an array.");
  }
  const normalized = captureRecords.map((record) => {
    assertPlainFileName(record?.fileName);
    if (
      !Number.isInteger(record.actualStatus) ||
      !Number.isInteger(record.byteCount) ||
      record.byteCount <= 0 ||
      typeof record.sha256 !== "string" ||
      !DIGEST_PATTERN.test(record.sha256)
    ) {
      throw new TypeError(
        `Invalid audit capture record for ${String(record?.fileName)}.`,
      );
    }
    return record;
  });
  assertUnique(
    normalized.map(({ fileName }) => fileName),
    "capture filename",
  );
  return normalized;
}

function normalizeAssertions(assertions) {
  if (!Array.isArray(assertions)) {
    throw new TypeError("Audit assertions must be an array.");
  }
  const normalized = assertions.map((assertion) => {
    if (
      !assertion ||
      typeof assertion.id !== "string" ||
      !/^[a-z][a-z0-9-]*$/.test(assertion.id) ||
      !["dom", "http"].includes(assertion.evidence) ||
      typeof assertion.route !== "string" ||
      !assertion.route.startsWith("/") ||
      assertion.passed !== true
    ) {
      throw new Error(
        `Audit assertion failed or is invalid: ${String(assertion?.id)}`,
      );
    }
    return structuredClone(assertion);
  });
  assertUnique(
    normalized.map(({ id }) => id),
    "assertion ID",
  );
  return normalized.sort((left, right) => left.id.localeCompare(right.id));
}

export function buildAuditManifest({
  assertions,
  captureRecords,
  capturedAt,
  deploymentId = null,
  expectedGitSha = null,
  origin,
  phase,
  plan,
}) {
  const metadata = normalizeMetadata({
    capturedAt,
    deploymentId,
    expectedGitSha,
    origin,
    phase,
  });
  const normalizedPlan = normalizePlan(plan);
  const normalizedRecords = normalizeCaptureRecords(captureRecords);
  const plannedNames = normalizedPlan.map(({ fileName }) => fileName).sort();
  const actualNames = normalizedRecords.map(({ fileName }) => fileName).sort();
  if (JSON.stringify(plannedNames) !== JSON.stringify(actualNames)) {
    throw new Error(
      `Audit capture inventory mismatch: expected ${plannedNames.length}, found ${actualNames.length}.`,
    );
  }

  const planByFileName = new Map(
    normalizedPlan.map((item) => [item.fileName, item]),
  );
  const captures = normalizedRecords
    .map((record) => {
      const planned = planByFileName.get(record.fileName);
      if (!planned) {
        throw new Error(`Unexpected audit capture: ${record.fileName}`);
      }
      if (record.actualStatus !== planned.status) {
        throw new Error(
          `Audit capture status mismatch for ${record.fileName}: expected ${planned.status}, found ${record.actualStatus}.`,
        );
      }
      return {
        actualStatus: record.actualStatus,
        byteCount: record.byteCount,
        capturedAt: metadata.capturedAt,
        deploymentId: metadata.deploymentId,
        expectedGitSha: metadata.expectedGitSha,
        expectedStatus: planned.status,
        fileName: record.fileName,
        origin: metadata.origin,
        phase: metadata.phase,
        route: planned.path,
        sha256: record.sha256,
        state: planned.state,
        viewport: {
          deviceScaleFactor: planned.deviceScaleFactor,
          height: planned.height,
          width: planned.width,
        },
      };
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));

  return {
    schemaVersion: AUDIT_MANIFEST_SCHEMA_VERSION,
    captureCount: captures.length,
    capturedAt: metadata.capturedAt,
    phase: metadata.phase,
    origin: metadata.origin,
    expectedGitSha: metadata.expectedGitSha,
    deploymentId: metadata.deploymentId,
    captures,
    assertions: normalizeAssertions(assertions),
  };
}

function statusForFile(statusByFileName, fileName) {
  if (statusByFileName instanceof Map) return statusByFileName.get(fileName);
  if (statusByFileName && typeof statusByFileName === "object") {
    return statusByFileName[fileName];
  }
  return undefined;
}

export async function writeAuditManifest({
  assertions,
  capturedAt,
  deploymentId = null,
  expectedGitSha = null,
  origin,
  outputDirectory,
  phase,
  plan,
  statusByFileName,
}) {
  const directoryStats = await lstat(outputDirectory);
  if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
    throw new Error("Audit manifest output must be a real directory.");
  }
  const normalizedPlan = normalizePlan(plan);
  const expectedNames = normalizedPlan.map(({ fileName }) => fileName).sort();
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  const actualNames = entries.map(({ name }) => name).sort();
  if (
    entries.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
    JSON.stringify(actualNames) !== JSON.stringify(expectedNames)
  ) {
    throw new Error(
      `Audit capture inventory mismatch: expected ${expectedNames.length}, found ${actualNames.length}.`,
    );
  }

  const captureRecords = await Promise.all(
    expectedNames.map(async (fileName) => {
      const bytes = await readFile(path.join(outputDirectory, fileName));
      return {
        actualStatus: statusForFile(statusByFileName, fileName),
        byteCount: bytes.byteLength,
        fileName,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
  const manifest = buildAuditManifest({
    assertions,
    captureRecords,
    capturedAt,
    deploymentId,
    expectedGitSha,
    origin,
    phase,
    plan: normalizedPlan,
  });
  const manifestPath = path.join(outputDirectory, AUDIT_MANIFEST_FILE);
  const pendingManifestPath = `${manifestPath}.pending`;
  await writeFile(
    pendingManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  await rename(pendingManifestPath, manifestPath);
  return manifest;
}

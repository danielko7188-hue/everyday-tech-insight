import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AUDIT_MANIFEST_FILE,
  buildAuditManifest,
  writeAuditManifest,
} from "../../scripts/write-audit-manifest.mjs";

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "eti-audit-manifest-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0).reverse()) {
    rmSync(root, { force: true, recursive: true });
  }
});

const metadata = {
  capturedAt: "2026-08-25T19:20:21.000Z",
  deploymentId: "dpl_AbCdEf1234567890",
  expectedGitSha: "0123456789abcdef0123456789abcdef01234567",
  origin: "https://publication.example",
  phase: "after-production",
} as const;

const plan = [
  {
    alias: "home",
    deviceScaleFactor: 1,
    fileName: "768-home-full-page.png",
    height: 900,
    path: "/",
    state: "full-page",
    status: 200,
    width: 768,
  },
  {
    alias: "home",
    deviceScaleFactor: 1,
    fileName: "390-home-full-page.png",
    height: 900,
    path: "/",
    state: "full-page",
    status: 200,
    width: 390,
  },
] as const;

function captureRecords() {
  return plan.map(({ fileName }) => ({
    actualStatus: 200,
    byteCount: 10,
    fileName,
    sha256: "a".repeat(64),
  }));
}

describe("audit manifest contract", () => {
  it("records every required field and sorts captures and assertions deterministically", () => {
    const manifest = buildAuditManifest({
      ...metadata,
      assertions: [
        {
          actual: "absent",
          evidence: "dom",
          expected: "absent",
          id: "monetization-off",
          passed: true,
          route: "/",
        },
        {
          actual: 404,
          evidence: "http",
          expected: 404,
          id: "cms-admin-absent",
          passed: true,
          route: "/admin/",
        },
      ],
      captureRecords: [
        {
          actualStatus: 200,
          byteCount: 22,
          fileName: "768-home-full-page.png",
          sha256: "b".repeat(64),
        },
        {
          actualStatus: 200,
          byteCount: 11,
          fileName: "390-home-full-page.png",
          sha256: "a".repeat(64),
        },
      ],
      plan,
    });

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      captureCount: 2,
      capturedAt: metadata.capturedAt,
      phase: metadata.phase,
      origin: metadata.origin,
      expectedGitSha: metadata.expectedGitSha,
      deploymentId: metadata.deploymentId,
    });
    expect(manifest.captures.map(({ fileName }) => fileName)).toEqual([
      "390-home-full-page.png",
      "768-home-full-page.png",
    ]);
    expect(manifest.captures[0]).toEqual({
      actualStatus: 200,
      byteCount: 11,
      capturedAt: metadata.capturedAt,
      deploymentId: metadata.deploymentId,
      expectedGitSha: metadata.expectedGitSha,
      expectedStatus: 200,
      fileName: "390-home-full-page.png",
      origin: metadata.origin,
      phase: metadata.phase,
      route: "/",
      sha256: "a".repeat(64),
      state: "full-page",
      viewport: { deviceScaleFactor: 1, height: 900, width: 390 },
    });
    expect(manifest.assertions.map(({ id }) => id)).toEqual([
      "cms-admin-absent",
      "monetization-off",
    ]);
  });

  it("fails closed on duplicate, incomplete, unexpected, or status-mismatched inventory", () => {
    const validRecords = captureRecords();

    expect(() =>
      buildAuditManifest({
        ...metadata,
        assertions: [],
        captureRecords: [validRecords[0], validRecords[0]],
        plan,
      }),
    ).toThrow(/duplicate/i);
    expect(() =>
      buildAuditManifest({
        ...metadata,
        assertions: [],
        captureRecords: validRecords.slice(0, 1),
        plan,
      }),
    ).toThrow(/inventory/i);
    expect(() =>
      buildAuditManifest({
        ...metadata,
        assertions: [],
        captureRecords: [
          ...validRecords,
          {
            actualStatus: 200,
            byteCount: 10,
            fileName: "unexpected.png",
            sha256: "a".repeat(64),
          },
        ],
        plan,
      }),
    ).toThrow(/inventory/i);
    expect(() =>
      buildAuditManifest({
        ...metadata,
        assertions: [],
        captureRecords: validRecords.map((record, index) => ({
          ...record,
          actualStatus: index === 0 ? 404 : record.actualStatus,
        })),
        plan,
      }),
    ).toThrow(/status/i);
  });

  it("enforces phase-specific canonical origins and provenance metadata", () => {
    const build = (overrides: Record<string, unknown>) =>
      buildAuditManifest({
        ...metadata,
        assertions: [],
        captureRecords: captureRecords(),
        plan,
        ...overrides,
      });

    expect(
      build({
        deploymentId: null,
        origin: "http://127.0.0.1:4321",
        phase: "after-local",
      }),
    ).toMatchObject({
      deploymentId: null,
      expectedGitSha: metadata.expectedGitSha,
      origin: "http://127.0.0.1:4321",
      phase: "after-local",
    });
    expect(build({ phase: "runtime-verification" })).toMatchObject({
      deploymentId: metadata.deploymentId,
      expectedGitSha: metadata.expectedGitSha,
      origin: metadata.origin,
      phase: "runtime-verification",
    });

    for (const phase of [
      "before",
      "after-production",
      "runtime-verification",
    ]) {
      expect(() => build({ expectedGitSha: null, phase })).toThrow(
        /expected Git SHA/i,
      );
      expect(() => build({ deploymentId: null, phase })).toThrow(
        /deployment ID/i,
      );
      expect(() => build({ origin: "http://127.0.0.1:4321", phase })).toThrow(
        /HTTPS origin/i,
      );
    }

    expect(() =>
      build({
        deploymentId: null,
        expectedGitSha: null,
        origin: "http://127.0.0.1:4321",
        phase: "after-local",
      }),
    ).toThrow(/expected Git SHA/i);
    expect(() =>
      build({
        origin: "http://127.0.0.1:4321",
        phase: "after-local",
      }),
    ).toThrow(/after-local.*deployment ID/i);

    for (const origin of [
      "https://publication.example",
      "http://localhost:4321",
      "http://127.0.0.1:1023",
      "http://127.0.0.1:4321/",
      "http://127.0.0.1:4321/path",
    ]) {
      expect(() =>
        build({ deploymentId: null, origin, phase: "after-local" }),
      ).toThrow(/loopback HTTP origin/i);
    }
    expect(() => build({ origin: `${metadata.origin}/` })).toThrow(
      /HTTPS origin/i,
    );
  });

  it("hashes the exact staged files and writes stable JSON with a factual timestamp", async () => {
    const outputDirectory = temporaryRoot();
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(join(outputDirectory, plan[0].fileName), "second", "utf8");
    writeFileSync(join(outputDirectory, plan[1].fileName), "first", "utf8");

    const manifest = await writeAuditManifest({
      ...metadata,
      assertions: [],
      outputDirectory,
      plan,
      statusByFileName: new Map(
        plan.map(({ fileName }) => [fileName, 200] as const),
      ),
    });
    const written = readFileSync(
      join(outputDirectory, AUDIT_MANIFEST_FILE),
      "utf8",
    );

    expect(written).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
    expect(manifest.capturedAt).toBe(metadata.capturedAt);
    expect(manifest.captures.map(({ byteCount }) => byteCount)).toEqual([5, 6]);
    expect(
      manifest.captures.every(({ sha256 }) => /^[a-f\d]{64}$/.test(sha256)),
    ).toBe(true);
  });

  it("does not publish a manifest when a screenshot is missing", async () => {
    const outputDirectory = temporaryRoot();
    writeFileSync(join(outputDirectory, plan[0].fileName), "only one", "utf8");

    await expect(
      writeAuditManifest({
        ...metadata,
        assertions: [],
        outputDirectory,
        plan,
        statusByFileName: new Map(
          plan.map(({ fileName }) => [fileName, 200] as const),
        ),
      }),
    ).rejects.toThrow(/inventory/i);
    expect(() =>
      readFileSync(join(outputDirectory, AUDIT_MANIFEST_FILE), "utf8"),
    ).toThrow();
  });
});

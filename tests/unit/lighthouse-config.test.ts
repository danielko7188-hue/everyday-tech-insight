import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  LIGHTHOUSE_DEVICES,
  LIGHTHOUSE_PAGES,
  LIGHTHOUSE_THRESHOLDS,
  RUNS_PER_PAGE_DEVICE,
  buildLighthouseAuditPlan,
  createLighthouseSummary,
  lighthouseFlagsForDevice,
  lighthouseRawReportName,
} from "../../scripts/run-lighthouse.mjs";

const passingScores = {
  accessibility: 0.95,
  "best-practices": 0.95,
  performance: 0.9,
  seo: 0.95,
};

describe("Lighthouse production QA matrix", () => {
  it("audits four representative routes on desktop and mobile three times", () => {
    expect(LIGHTHOUSE_PAGES).toEqual([
      { name: "home", path: "/" },
      {
        name: "cybersecurity-category",
        path: "/categories/cybersecurity-data-protection/",
      },
      {
        name: "automation-candidates-article",
        path: "/articles/how-to-identify-business-tasks-for-automation/",
      },
      { name: "toolkit", path: "/toolkit/" },
    ]);
    expect(LIGHTHOUSE_DEVICES.map(({ name }) => name)).toEqual([
      "mobile",
      "desktop",
    ]);
    expect(RUNS_PER_PAGE_DEVICE).toBe(3);

    const auditPlan = buildLighthouseAuditPlan();
    expect(auditPlan).toHaveLength(8);
    expect(
      auditPlan.map(({ device, page }) => `${page.name}:${device.name}`),
    ).toEqual([
      "home:mobile",
      "home:desktop",
      "cybersecurity-category:mobile",
      "cybersecurity-category:desktop",
      "automation-candidates-article:mobile",
      "automation-candidates-article:desktop",
      "toolkit:mobile",
      "toolkit:desktop",
    ]);
  });

  it("omits article audits when no current published representative exists", () => {
    const auditPlan = buildLighthouseAuditPlan({
      representativeArticlePaths: {
        backup: null,
        operationsArchitecture: null,
        primary: null,
        saasEvaluation: null,
        securityWorkflow: null,
        strategyCost: null,
        table: null,
      },
    });

    expect(auditPlan).toHaveLength(6);
    expect(
      auditPlan.map(({ device, page }) => `${page.name}:${device.name}`),
    ).toEqual([
      "home:mobile",
      "home:desktop",
      "cybersecurity-category:mobile",
      "cybersecurity-category:desktop",
      "toolkit:mobile",
      "toolkit:desktop",
    ]);
    expect(auditPlan.every(({ page }) => page.path !== null)).toBe(true);
  });

  it("uses the release thresholds and distinct Lighthouse emulation settings", () => {
    expect(LIGHTHOUSE_THRESHOLDS).toEqual({
      performance: 0.9,
      accessibility: 0.95,
      "best-practices": 0.95,
      seo: 0.95,
    });

    const mobile = lighthouseFlagsForDevice("mobile");
    const desktop = lighthouseFlagsForDevice("desktop");
    expect(mobile.formFactor).toBe("mobile");
    expect(mobile.screenEmulation.mobile).toBe(true);
    expect(desktop.formFactor).toBe("desktop");
    expect(desktop.screenEmulation.mobile).toBe(false);
    expect(desktop.throttling).toMatchObject({
      cpuSlowdownMultiplier: 1,
      rttMs: 40,
      throughputKbps: 10_240,
    });
    expect(desktop.emulatedUserAgent).toContain("Macintosh");
    expect(mobile.screenEmulation.width).toBeLessThan(
      desktop.screenEmulation.width,
    );
  });

  it("creates 24 collision-free raw report names", () => {
    const names = buildLighthouseAuditPlan().flatMap(({ device, page }) =>
      Array.from({ length: RUNS_PER_PAGE_DEVICE }, (_, index) =>
        lighthouseRawReportName(page.name, device.name, index + 1),
      ),
    );
    expect(names).toHaveLength(24);
    expect(new Set(names).size).toBe(24);
    expect(names[0]).toBe("home-mobile-run-1.json");
    expect(names.at(-1)).toBe("toolkit-desktop-run-3.json");
  });

  it("fails closed when an audit is missing instead of reporting a partial pass", () => {
    const results = buildLighthouseAuditPlan()
      .slice(0, -1)
      .map(({ device, page }) => ({
        device: device.name,
        failures: [],
        name: page.name,
        path: page.path,
        representativeRun: 1,
        runScores: [passingScores, passingScores, passingScores],
        scores: passingScores,
      }));

    expect(createLighthouseSummary(results)).toMatchObject({
      status: "FAIL",
      missingAudits: ["toolkit:desktop"],
      runsPerPageDevice: 3,
    });
  });

  it("reports pass only for the complete eight-audit matrix", () => {
    const results = buildLighthouseAuditPlan().map(({ device, page }) => ({
      device: device.name,
      failures: [],
      name: page.name,
      path: page.path,
      representativeRun: 1,
      runScores: [passingScores, passingScores, passingScores],
      scores: passingScores,
    }));

    expect(createLighthouseSummary(results)).toMatchObject({
      status: "PASS",
      auditCount: 8,
      deviceTypes: ["mobile", "desktop"],
      missingAudits: [],
      runsPerPageDevice: 3,
    });
  });

  it("judges completeness against the valid article-less audit plan", () => {
    const auditPlan = buildLighthouseAuditPlan().filter(
      ({ page }) => page.name !== "automation-candidates-article",
    );
    const results = auditPlan.map(({ device, page }) => ({
      device: device.name,
      failures: [],
      name: page.name,
      path: page.path,
      representativeRun: 1,
      runScores: [passingScores, passingScores, passingScores],
      scores: passingScores,
    }));

    expect(createLighthouseSummary(results, { auditPlan })).toMatchObject({
      status: "PASS",
      auditCount: 6,
      missingAudits: [],
      unexpectedAudits: [],
    });
  });

  it("keeps the production QA entry point wired through package scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.lighthouse).toBe(
      "node scripts/run-lighthouse.mjs",
    );
    expect(packageJson.scripts?.["test:release-evidence"]).toBe(
      "vitest --run tests/unit/production-capture.test.ts tests/unit/audit-manifest.test.ts tests/unit/lighthouse-config.test.ts",
    );
  });
});

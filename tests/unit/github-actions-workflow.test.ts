import { readFileSync } from "node:fs";

import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

type WorkflowStep = {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
};

type QualityWorkflow = {
  concurrency?: {
    "cancel-in-progress"?: boolean;
    group?: string;
  };
  env?: Record<string, unknown>;
  jobs?: Record<
    string,
    {
      permissions?: Record<string, unknown>;
      "runs-on"?: string;
      steps?: WorkflowStep[];
      "timeout-minutes"?: number;
    }
  >;
  on?: {
    pull_request?: unknown;
    push?: { branches?: string[] };
    workflow_dispatch?: unknown;
  };
  permissions?: Record<string, unknown>;
};

function readWorkflow(): QualityWorkflow {
  const source = readFileSync(
    new URL("../../.github/workflows/quality.yml", import.meta.url),
    "utf8",
  );
  return load(source) as QualityWorkflow;
}

describe("GitHub Actions quality gate", () => {
  it("runs for main pushes, pull requests, and explicit release verification with read-only repository access", () => {
    const workflow = readWorkflow();

    expect(workflow.on?.push?.branches).toEqual(["main"]);
    expect(workflow.on).toHaveProperty("pull_request");
    expect(workflow.on).toHaveProperty("workflow_dispatch");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.env).toEqual({ CI: true });
  });

  it("cancels superseded runs and bounds the Linux job", () => {
    const workflow = readWorkflow();
    const quality = workflow.jobs?.quality;

    expect(workflow.concurrency).toEqual({
      group: "${{ github.workflow }}-${{ github.ref }}",
      "cancel-in-progress": true,
    });
    expect(quality?.["runs-on"]).toBe("ubuntu-latest");
    expect(quality?.["timeout-minutes"]).toBe(60);
    expect(quality?.permissions).toBeUndefined();
  });

  it("uses pinned official actions, Node 24, and the complete repository QA gate", () => {
    const workflow = readWorkflow();
    const steps = workflow.jobs?.quality?.steps ?? [];

    expect(steps).toEqual([
      {
        name: "Check out repository",
        uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
        with: {
          "fetch-depth": 1,
          "persist-credentials": false,
        },
      },
      {
        name: "Set up Node.js",
        uses: "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
        with: {
          cache: "npm",
          "node-version": 24,
        },
      },
      { name: "Install dependencies", run: "npm ci" },
      {
        name: "Audit high-severity vulnerabilities",
        run: "npm audit --audit-level=high",
      },
      {
        name: "Install Chromium and Linux dependencies",
        run: "npm run setup:browsers:linux",
      },
      { name: "Run full quality gate", run: "npm run qa" },
    ]);
  });
});

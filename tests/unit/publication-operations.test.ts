import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

async function read(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), "utf8");
}

const requiredCommands = [
  "format:check",
  "lint",
  "typecheck",
  "test",
  "build",
  "check:content",
  "check:editorial",
  "check:cms",
  "check:images",
  "check:cms-fixture",
  "check:seo",
  "check:links",
  "test:e2e",
  "lighthouse",
] as const;

describe("publication operations documentation", () => {
  it("documents the current lifecycle and hosted Pages CMS evidence boundary", async () => {
    const [readme, guide] = await Promise.all([
      read("README.md"),
      read("docs/PUBLISHING_GUIDE.md"),
    ]);
    const combined = `${readme}\n${guide}`;

    expect(combined).toMatch(
      /draft\s*(?:->|→)\s*review\s*(?:->|→)\s*published\s*(?:->|→)\s*archived/i,
    );
    expect(combined).toMatch(/Pages CMS/i);
    expect(combined).toMatch(/GitHub App authorization/i);
    expect(combined).toMatch(/save\/commit round-trip|save round-trip/i);
    expect(combined).toMatch(/owner action/i);
    expect(combined).toMatch(
      /archive[^\n]{0,80}(?:not|instead of)[^\n]{0,40}delet/i,
    );
    expect(combined).toMatch(/non-`main` branch|review branch/i);
    expect(combined).toMatch(/pull request/i);
    expect(combined).toMatch(/Vercel preview/i);
  });

  it("documents public-repository media, source, rights, and rollback rules", async () => {
    const [readme, guide, deployment] = await Promise.all([
      read("README.md"),
      read("docs/PUBLISHING_GUIDE.md"),
      read("docs/DEPLOYMENT_GUIDE.md"),
    ]);
    const combined = `${readme}\n${guide}\n${deployment}`;

    expect(combined).toMatch(/repository is public/i);
    expect(combined).toMatch(/src\/content-assets\/articles\//i);
    expect(combined).toMatch(/rights/i);
    expect(combined).toMatch(
      /confidential[^\n]{0,100}(?:outside Git|not[^\n]{0,20}Git)/i,
    );
    expect(deployment).toMatch(/git revert/i);
    expect(deployment).toMatch(/without rewriting shared history/i);
  });

  it("keeps monetization off and distinguishes readiness work from Google approval", async () => {
    const [readme, audit, privacy, deployment] = await Promise.all([
      read("README.md"),
      read("docs/ADSENSE_READINESS_AUDIT_2026-08-25.md"),
      read("docs/PRIVACY_AND_CONSENT_REVIEW.md"),
      read("docs/DEPLOYMENT_GUIDE.md"),
    ]);
    const combined = `${readme}\n${audit}\n${privacy}\n${deployment}`;

    expect(combined).toMatch(/monetization[^\n]{0,60}`?off`?/i);
    expect(combined).toMatch(/no publisher (?:ID|identifier)/i);
    expect(combined).toMatch(
      /ads\.txt[^\n]{0,80}(?:absent|disabled|404|not present|no )/i,
    );
    expect(combined).toMatch(
      /CMP[^\n]{0,100}(?:owner|decision|required|unresolved|not configured)/i,
    );
    expect(combined).toMatch(/Google alone decides/i);
    expect(combined).not.toMatch(
      /(?:guaranteed|guarantees) (?:AdSense )?approval/i,
    );
  });

  it("classifies current evidence without carrying an old READY claim forward", async () => {
    const audit = await read("docs/ADSENSE_READINESS_AUDIT_2026-08-25.md");

    for (const label of [
      "Locally verified",
      "Observed in production",
      "Owner action",
      "Unknown",
    ]) {
      expect(audit).toContain(label);
    }
    expect(audit).toMatch(
      /current release gate[^\n]{0,80}(?:pending|not complete|open)/i,
    );
    expect(audit).not.toMatch(/\bREADY TO (?:APPLY|PUBLISH|UPLOAD)\b/);
  });

  it("keeps the exact owner-gate and content-quality records discoverable", async () => {
    const [audit, source] = await Promise.all([
      read("docs/ADSENSE_READINESS_AUDIT_2026-08-25.md"),
      read("docs/editorial-operations.yml"),
    ]);

    expect(audit).toMatch(/18 owner gates/i);
    expect(audit).toMatch(/15(?:-guide| guide) content-quality/i);
    expect(source.match(/^  - number: /gm)).toHaveLength(18);
    expect(source.match(/^  - slug: /gm)).toHaveLength(15);
  });

  it("references only release commands that exist in package.json", async () => {
    const [packageText, readme, technicalQa, deployment] = await Promise.all([
      read("package.json"),
      read("README.md"),
      read("docs/TECHNICAL_QA.md"),
      read("docs/DEPLOYMENT_GUIDE.md"),
    ]);
    const packageJson = JSON.parse(packageText) as {
      scripts: Record<string, string>;
    };
    const combined = `${readme}\n${technicalQa}\n${deployment}`;

    for (const command of requiredCommands) {
      expect(packageJson.scripts[command]).toBeTruthy();
      expect(combined).toContain(`npm run ${command}`);
    }

    const documentedCommands = [
      ...combined.matchAll(/npm run ([a-z0-9:-]+)/gi),
    ].map((match) => match[1]!);
    for (const command of documentedCommands) {
      expect(packageJson.scripts, `missing script: ${command}`).toHaveProperty(
        command,
      );
    }
  });
});

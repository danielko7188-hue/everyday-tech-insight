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
  it("records the premium spatial system without weakening the static accessibility boundary", async () => {
    const [design, readme, technicalQa] = await Promise.all([
      read("DESIGN.md"),
      read("README.md"),
      read("docs/TECHNICAL_QA.md"),
    ]);
    const combined = `${design}\n${readme}\n${technicalQa}`;

    expect(combined).toMatch(
      /@view-transition\s*\{\s*navigation:\s*auto;?\s*\}/i,
    );
    expect(combined).toMatch(/custom root[^\n]{0,80}200ms/i);
    for (const excludedRuntime of [
      "Astro ClientRouter",
      "Motion",
      "Three.js",
      "WebGL",
      "Lenis",
      "remote presentation runtime",
      "scroll hijacking",
      "continuous or infinite loop",
      "zero executable client JavaScript",
    ]) {
      expect(combined).toContain(excludedRuntime);
    }
    for (const progressiveMode of [
      "static-first",
      "finite",
      "scroll-linked",
      "prefers-reduced-motion",
      "prefers-reduced-data",
      "pointer: coarse",
      "update: slow",
    ]) {
      expect(combined).toContain(progressiveMode);
    }
    expect(design).not.toContain(
      "Do not add scroll hijacking, autoplay, carousels, parallax, decorative entrance animation, or client-side hydration for presentation.",
    );
  });

  it("records the semantic spacing, viewport, and implemented surface contracts", async () => {
    const [design, readme] = await Promise.all([
      read("DESIGN.md"),
      read("README.md"),
    ]);
    const combined = `${design}\n${readme}`;
    const semanticSpacing = new Map([
      ["--space-section-mobile", "48px"],
      ["--space-section-tablet", "64px"],
      ["--space-section-wide", "80px"],
      ["--space-heading-body", "24px"],
      ["--space-card-major", "24px"],
      ["--space-card-compact", "20px"],
      ["--space-grid-standard", "24px"],
      ["--space-grid-compact", "16px"],
    ]);

    for (const [token, value] of semanticSpacing) {
      expect(design).toMatch(
        new RegExp(`${token.replaceAll("-", "\\-")}[^\\n]{0,80}${value}`, "i"),
      );
    }
    expect(design).toMatch(/card[^\n]{0,80}20(?:–|-)24px padding/i);
    expect(design).toMatch(/action[^\n]{0,80}44px/i);
    expect(combined).toContain(
      "320, 390, 600, 768, 1024, 1280, 1440, and 1920px",
    );
    for (const surface of [
      "SignalField",
      "reading progress",
      "real-data Toolkit structure preview",
      "404 Toolkit path",
    ]) {
      expect(combined).toContain(surface);
    }
  });

  it("states the exact owner-only Pages CMS access and public-repository limits", async () => {
    const [readme, guide] = await Promise.all([
      read("README.md"),
      read("docs/PUBLISHING_GUIDE.md"),
    ]);
    const combined = `${readme}\n${guide}`;

    expect(combined).toContain("danielko7188-hue/everyday-tech-insight");
    expect(combined).toMatch(/release branch[^\n]{0,40}`main`/i);
    expect(combined).toMatch(
      /recommended owner-created[^\n]{0,80}`content\/editorial`/i,
    );
    expect(combined).toMatch(
      /creation and selection[^\n]{0,60}(?:remain|are) unverified/i,
    );
    expect(combined).toMatch(/GitHub App[^\n]{0,120}exact repository only/i);
    expect(combined).toMatch(/do not invite Pages CMS collaborators/i);
    for (const hostedUnknown of [
      "hosted collaborator absence",
      "exact GitHub App scope",
      "hosted sign-in",
      "selected branch",
      "branch protection",
      "media upload",
      "save/commit round-trip",
    ]) {
      expect(combined).toMatch(new RegExp(hostedUnknown, "i"));
    }
    expect(combined).toMatch(
      /create: true[^\n]{0,100}rename: false[^\n]{0,100}delete: false/i,
    );
    expect(combined).toMatch(/UI only[^\n]{0,80}direct Git/i);
    expect(combined).toMatch(
      /owner-only[^\n]{0,100}intended write access[^\n]{0,60}not privacy/i,
    );
    expect(combined).toMatch(
      /every committed public branch, file, and managed-media byte[^\n]{0,80}publicly visible/i,
    );
    expect(combined).not.toMatch(
      /hosted Pages CMS (?:is|has been) (?:configured|verified|connected)/i,
    );
  });

  it("classifies the premium spatial evidence and future inventory without claiming unfinished phases", async () => {
    const technicalQa = await read("docs/TECHNICAL_QA.md");

    expect(technicalQa).toContain("premium-spatial-2026-08-26");
    expect(technicalQa).toContain("2026-08-26T09:36:03.617Z");
    expect(technicalQa).toContain("af8dd44843860f3a055c76f934c02ae389ec1a81");
    expect(technicalQa).toContain("dpl_CptkBhg1Q5Gw7dCD11et1bw66HPd");
    expect(technicalQa).toMatch(
      /64 PNGs[^\n]{0,120}8 routes[^\n]{0,40}8 widths/i,
    );
    expect(technicalQa).toMatch(/56[^\n]{0,30}HTTP 200/i);
    expect(technicalQa).toMatch(/8 expected 404/i);
    expect(technicalQa).toMatch(/64 unique[^\n]{0,30}(?:hashes|SHA-256)/i);
    expect(technicalQa).toMatch(/6\/6 safety assertions/i);
    expect(technicalQa).toMatch(
      /planned[^\n]{0,80}after[^\n]{0,80}runtime[^\n]{0,80}156 PNGs/i,
    );
    expect(technicalQa).toMatch(
      /18[^\n]{0,20}8[^\n]{0,30}144[^\n]{0,50}4 menu[^\n]{0,80}8 skip/i,
    );
    expect(technicalQa).toMatch(
      /not (?:yet )?(?:generated|captured) or verified/i,
    );
    expect(technicalQa).toMatch(/32 reviewed states/i);
    expect(technicalQa).not.toMatch(/34 reviewed states/i);
    expect(technicalQa).toMatch(
      /Purple Signal[^\n]{0,100}(?:historical|dated|separate)/i,
    );
  });

  it("keeps the premium spatial release in exact ads-off mode", async () => {
    const [design, readme, technicalQa] = await Promise.all([
      read("DESIGN.md"),
      read("README.md"),
      read("docs/TECHNICAL_QA.md"),
    ]);
    const combined = `${design}\n${readme}\n${technicalQa}`;

    expect(combined).toMatch(
      /monetization[^\n]{0,80}(?:exact )?mode[^\n]{0,20}`?off`?/i,
    );
    for (const absentOutput of [
      "publisher or account IDs",
      "ad scripts",
      "ad slots",
      "ad placeholders",
      "ad layout gaps",
      "ads.txt",
      "analytics",
      "tracking",
      "CMP",
    ]) {
      expect(combined).toContain(absentOutput);
    }
    expect(combined).toMatch(/changes do not establish AdSense eligibility/i);
    expect(combined).toMatch(/Google alone decides/i);
  });

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
    const [readme, audit, privacy, deployment, trustPages] = await Promise.all([
      read("README.md"),
      read("docs/ADSENSE_READINESS_AUDIT_2026-08-25.md"),
      read("docs/PRIVACY_AND_CONSENT_REVIEW.md"),
      read("docs/DEPLOYMENT_GUIDE.md"),
      read("src/data/trust-pages.ts"),
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
    expect(trustPages).toMatch(
      /privacy:[\s\S]*implementation state dated August 25, 2026/i,
    );
    expect(trustPages).not.toMatch(
      /privacy:[\s\S]*reviewed on August 25, 2026/i,
    );
    expect(trustPages).not.toMatch(
      /privacy:[\s\S]*reviewed on August 22, 2026/i,
    );
  });

  it("retrieves trusted deployment metadata from the SHA-bearing Vercel API", async () => {
    const deployment = await read("docs/DEPLOYMENT_GUIDE.md");

    expect(deployment).toMatch(
      /vercel@latest api\s+"?\/v13\/deployments\/\$deploymentHost"?\s+--raw/i,
    );
    expect(deployment).not.toMatch(/vercel@latest inspect[^\n]*--json/i);
    expect(deployment).toMatch(/authoritative `gitSource\.sha`/i);
    expect(deployment).toMatch(/Git-triggered production deployment/i);
    expect(deployment).not.toMatch(/deploy[^\n]*--meta/i);
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
    expect(source.match(/^ {2}- number: /gm)).toHaveLength(18);
    expect(source.match(/^ {2}- slug: /gm)).toHaveLength(15);
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

import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AFTER_CAPTURE_ROUTES,
  BEFORE_CAPTURE_ROUTES,
  CAPTURE_WIDTHS,
  buildCapturePlan,
} from "../../scripts/capture-production-screenshots.mjs";

const root = process.cwd();

async function read(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), "utf8");
}

type LocatedSentence = Readonly<{
  line: number;
  sentence: string;
}>;

type AuditCapture = Readonly<{
  actualStatus: number;
  byteCount: number;
  expectedStatus: number;
  fileName: string;
  route: string;
  sha256: string;
  state: string;
  viewport: Readonly<{ width: number }>;
}>;

type AuditManifest = Readonly<{
  assertions: ReadonlyArray<Readonly<{ passed: boolean }>>;
  captureCount: number;
  capturedAt: string;
  captures: ReadonlyArray<AuditCapture>;
  deploymentId: string;
  expectedGitSha: string;
  origin: string;
  phase: string;
}>;

function locateSentences(text: string): LocatedSentence[] {
  return text.split(/\r?\n/).flatMap((line, lineIndex) =>
    line
      .split(/(?<=[.!?])\s+(?=[A-Z“"`#*-])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((sentence) => ({ line: lineIndex + 1, sentence })),
  );
}

function findUnsupportedHostedCompletionClaims(
  text: string,
): LocatedSentence[] {
  const hostedSubject =
    /(?:Pages CMS hosted (?:access|authorization|sign-in|connection)|hosted (?:Pages )?CMS(?: access| authorization| sign-in| connection)?)/i;
  const affirmativeCompletion =
    /(?:(?:\bis\b|\bare\b|\bwas\b|\bwere\b|\bhas been\b|\bhave been\b)[^.!?]{0,50}\b(?:verified|configured|connected|complete|completed|ready|active|owner-only)\b|\b(?:verified|configured|connected|completed)\b[^.!?]{0,40}(?:hosted (?:Pages )?CMS|Pages CMS hosted))/i;
  const explicitBoundary =
    /\b(?:unverified|unknown|not configured|not verified|not performed|not observed|owner action)\b/i;

  return locateSentences(text).filter(
    ({ sentence }) =>
      hostedSubject.test(sentence) &&
      affirmativeCompletion.test(sentence) &&
      !explicitBoundary.test(sentence),
  );
}

function findUnsupportedEnabledClaims(
  text: string,
  subject: RegExp,
): LocatedSentence[] {
  const affirmative =
    /\b(?:uses?|enables?|activates?|loads?|ships?|runs?|serves?)\b|\b(?:is|are|was|were|has been|have been)\b[^.!?]{0,35}\b(?:used|enabled|active|activated|loaded|in use)\b/i;
  const explicitBoundary =
    /\b(?:does not|do not|must not|no|not used|not enabled|not active|without|disabled|off|absent|absence|rejects?|excludes?|forbids?|prohibits?|never|cannot|future)\b/i;

  return locateSentences(text).filter(
    ({ sentence }) =>
      subject.test(sentence) &&
      affirmative.test(sentence) &&
      !explicitBoundary.test(sentence),
  );
}

function findStaleBlanketMotionBans(text: string): LocatedSentence[] {
  const prohibition = /\b(?:do not|must not|never|ban|bans|prohibit|forbid)\b/i;
  const blanketScope =
    /\bdecorative entrance (?:motion|animation)\b|\b(?:any|all) nonessential (?:motion|animation|transition)s?\b/i;

  return locateSentences(text).filter(
    ({ sentence }) => prohibition.test(sentence) && blanketScope.test(sentence),
  );
}

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
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
  it("distinguishes unsupported hosted completion claims from explicit uncertainty", () => {
    for (const unsupported of [
      "Pages CMS hosted access is verified.",
      "The hosted CMS is connected.",
      "Hosted Pages CMS sign-in has been completed.",
      "Pages CMS hosted authorization is owner-only and complete.",
    ]) {
      expect(findUnsupportedHostedCompletionClaims(unsupported)).toEqual([
        { line: 1, sentence: unsupported },
      ]);
    }

    for (const bounded of [
      "Pages CMS hosted access is unverified.",
      "The hosted CMS is not verified.",
      "Hosted Pages CMS sign-in is an owner action and has not been observed.",
      "Pages CMS hosted authorization remains unknown.",
      "Hosted CMS access is not configured.",
    ]) {
      expect(findUnsupportedHostedCompletionClaims(bounded)).toEqual([]);
    }
    expect(
      findUnsupportedHostedCompletionClaims(
        "Pages CMS hosted access is verified. The selected branch remains unverified.",
      ),
    ).toEqual([{ line: 1, sentence: "Pages CMS hosted access is verified." }]);

    const runtimeSubject =
      /\b(?:Motion|Astro ClientRouter|Three\.js|WebGL|Lenis|remote (?:presentation )?runtime)\b/i;
    const advertisingSubject =
      /(?:\b(?:ads?|advertising|analytics|CMP)\b|\btracking\b(?=[^.!?\n]{0,20}\b(?:is|are|was|were|enabled|active|activated|loaded|runs?|serves?)\b)|\btracking (?:script|code|identifier|pixel|technology|tooling)\b)/i;
    expect(
      findUnsupportedEnabledClaims("Motion is enabled.", runtimeSubject),
    ).toHaveLength(1);
    expect(
      findUnsupportedEnabledClaims(
        "Astro ClientRouter runs this publication.",
        runtimeSubject,
      ),
    ).toHaveLength(1);
    expect(
      findUnsupportedEnabledClaims("Three.js is used.", runtimeSubject),
    ).toHaveLength(1);
    expect(
      findUnsupportedEnabledClaims(
        "A remote runtime is enabled.",
        runtimeSubject,
      ),
    ).toHaveLength(1);
    expect(
      findUnsupportedEnabledClaims("Motion is not enabled.", runtimeSubject),
    ).toEqual([]);
    expect(
      findUnsupportedEnabledClaims("WebGL is not used.", runtimeSubject),
    ).toEqual([]);
    expect(
      findUnsupportedEnabledClaims("Analytics is active.", advertisingSubject),
    ).toHaveLength(1);
    expect(
      findUnsupportedEnabledClaims("Tracking is active.", advertisingSubject),
    ).toHaveLength(1);
    expect(
      findUnsupportedEnabledClaims("Ads are active.", advertisingSubject),
    ).toHaveLength(1);
    expect(
      findUnsupportedEnabledClaims("CMP is enabled.", advertisingSubject),
    ).toHaveLength(1);
    expect(
      findUnsupportedEnabledClaims(
        "Advertising and analytics are disabled.",
        advertisingSubject,
      ),
    ).toEqual([]);
  });

  it("detects rephrased blanket motion bans without rejecting safety-specific bans", () => {
    for (const staleBan of [
      "Do not add decorative entrance motion, parallax, or any nonessential transition.",
      "Never use decorative entrance animation in this publication.",
      "The standard must prohibit all nonessential animations.",
    ]) {
      expect(findStaleBlanketMotionBans(staleBan)).toHaveLength(1);
    }
    expect(
      findStaleBlanketMotionBans(
        "Do not add scroll hijacking, runtime motion, or continuous or infinite loops.",
      ),
    ).toEqual([]);
  });

  it("records the native premium spatial architecture in every operating document", async () => {
    const documents = new Map([
      ["DESIGN.md", await read("DESIGN.md")],
      ["README.md", await read("README.md")],
      ["docs/TECHNICAL_QA.md", await read("docs/TECHNICAL_QA.md")],
    ]);
    const runtimeSubject =
      /\b(?:Astro ClientRouter|Motion|Three\.js|WebGL|Lenis|remote (?:presentation )?runtime)\b/i;

    for (const [documentName, document] of documents) {
      expect(document, documentName).toMatch(
        /@view-transition\s*\{\s*navigation:\s*auto;?\s*\}/i,
      );
      expect(document, documentName).toMatch(/custom root[^\n]{0,80}200ms/i);
      expect(document, documentName).toMatch(/static-first/i);
      expect(document, documentName).toMatch(/finite/i);
      expect(document, documentName).toMatch(/scroll-linked/i);
      expect(document, documentName).toMatch(
        /zero executable client JavaScript/i,
      );
      for (const fallback of [
        "prefers-reduced-motion",
        "prefers-reduced-data",
        "pointer: coarse",
        "update: slow",
      ]) {
        expect(document, `${documentName}: ${fallback}`).toContain(fallback);
      }
      for (const excludedRuntime of [
        "Astro ClientRouter",
        "Motion",
        "Three.js",
        "WebGL",
        "Lenis",
        "remote presentation runtime",
        "scroll hijacking",
        "continuous or infinite loop",
      ]) {
        expect(document, `${documentName}: ${excludedRuntime}`).toContain(
          excludedRuntime,
        );
      }
      expect(
        findUnsupportedEnabledClaims(document, runtimeSubject),
        `${documentName} must not affirm an enabled presentation runtime`,
      ).toEqual([]);
    }

    expect(findStaleBlanketMotionBans(documents.get("DESIGN.md")!)).toEqual([]);
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
    const documents = new Map([
      ["README.md", await read("README.md")],
      ["docs/PUBLISHING_GUIDE.md", await read("docs/PUBLISHING_GUIDE.md")],
    ]);

    for (const [documentName, document] of documents) {
      expect(document, documentName).toContain(
        "danielko7188-hue/everyday-tech-insight",
      );
      expect(document, documentName).toMatch(
        /release branch[^\n]{0,40}`main`/i,
      );
      expect(document, documentName).toMatch(
        /recommended owner-created editorial branch[^\n]{0,80}`content\/editorial`/i,
      );
      expect(document, documentName).toMatch(
        /creation and selection[^\n]{0,60}(?:remain|are) unverified/i,
      );
      expect(document, documentName).toMatch(
        /GitHub App[^\n]{0,140}exact repository only/i,
      );
      expect(document, documentName).toMatch(
        /(?:do|must) not invite Pages CMS collaborators/i,
      );
      for (const hostedUnknown of [
        "hosted collaborator absence",
        "exact GitHub App scope",
        "hosted sign-in",
        "selected branch",
        "branch protection",
        "media upload",
        "save/commit round-trip",
      ]) {
        expect(document, `${documentName}: ${hostedUnknown}`).toMatch(
          new RegExp(hostedUnknown, "i"),
        );
      }
      expect(document, documentName).toMatch(
        /create: true[^\n]{0,100}rename: false[^\n]{0,100}delete: false/i,
      );
      expect(document, documentName).toMatch(/UI only[^\n]{0,80}direct Git/i);
      expect(document, documentName).toMatch(
        /owner-only[^\n]{0,100}intended write access[^\n]{0,60}not privacy/i,
      );
      expect(document, documentName).toMatch(
        /every committed public branch, file, and managed-media byte[^\n]{0,80}publicly visible/i,
      );
      expect(
        findUnsupportedHostedCompletionClaims(document),
        `${documentName} must not claim hosted Pages CMS completion`,
      ).toEqual([]);
    }

    const guide = documents.get("docs/PUBLISHING_GUIDE.md")!;
    const hostedRoundTripBoundarySentences = locateSentences(guide).filter(
      ({ sentence }) =>
        /hosted[^.!?]{0,260}save\/commit round-trip[^.!?]{0,120}unverified/i.test(
          sentence,
        ),
    );
    expect(hostedRoundTripBoundarySentences).toHaveLength(1);
  });

  it("classifies the premium spatial evidence and future inventory without claiming unfinished phases", async () => {
    const evidenceDirectory = path.join(
      root,
      "artifacts/site-audit/before/premium-spatial-2026-08-26",
    );
    const [technicalQa, manifestText, directoryEntries] = await Promise.all([
      read("docs/TECHNICAL_QA.md"),
      read(
        "artifacts/site-audit/before/premium-spatial-2026-08-26/audit-manifest.json",
      ),
      readdir(evidenceDirectory),
    ]);
    const manifest = JSON.parse(manifestText) as AuditManifest;
    const expectedBeforePlan = buildCapturePlan({
      origin: manifest.origin,
      phase: "before",
    });
    const afterPlans = [
      buildCapturePlan({
        origin: "http://127.0.0.1:4321",
        phase: "after-local",
      }),
      buildCapturePlan({
        origin: manifest.origin,
        phase: "after-production",
      }),
      buildCapturePlan({
        origin: manifest.origin,
        phase: "runtime-verification",
      }),
    ];
    const pngEntries = directoryEntries.filter((entry) =>
      entry.endsWith(".png"),
    );

    expect(manifest.phase).toBe("before");
    expect(expectedBeforePlan).toHaveLength(64);
    expect(manifest.captureCount).toBe(expectedBeforePlan.length);
    expect(manifest.captures).toHaveLength(expectedBeforePlan.length);
    expect(pngEntries).toHaveLength(expectedBeforePlan.length);
    expect(pngEntries.toSorted()).toEqual(
      expectedBeforePlan.map(({ fileName }) => fileName).toSorted(),
    );

    const recomputedFiles = await Promise.all(
      manifest.captures.map(async (capture) => {
        const bytes = await readFile(
          path.join(evidenceDirectory, capture.fileName),
        );
        return {
          byteCount: bytes.byteLength,
          fileName: capture.fileName,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        };
      }),
    );
    expect(recomputedFiles).toEqual(
      manifest.captures.map(({ byteCount, fileName, sha256 }) => ({
        byteCount,
        fileName,
        sha256,
      })),
    );

    const widths = [
      ...new Set(manifest.captures.map(({ viewport }) => viewport.width)),
    ].toSorted((left, right) => left - right);
    const routes = [
      ...new Set(manifest.captures.map(({ route }) => route)),
    ].toSorted();
    const matching200 = manifest.captures.filter(
      ({ actualStatus, expectedStatus }) =>
        actualStatus === 200 && expectedStatus === 200,
    ).length;
    const matching404 = manifest.captures.filter(
      ({ actualStatus, expectedStatus }) =>
        actualStatus === 404 && expectedStatus === 404,
    ).length;
    const uniqueHashes = new Set(manifest.captures.map(({ sha256 }) => sha256))
      .size;
    const passedAssertions = manifest.assertions.filter(
      ({ passed }) => passed,
    ).length;

    expect(widths).toEqual([...CAPTURE_WIDTHS]);
    expect(routes).toEqual(
      BEFORE_CAPTURE_ROUTES.map(({ path: route }) => route).toSorted(),
    );
    expect(manifest.captures.every(({ state }) => state === "full-page")).toBe(
      true,
    );
    expect(
      new Set(manifest.captures.map(({ fileName }) => fileName)).size,
    ).toBe(manifest.captureCount);
    expect(uniqueHashes).toBe(manifest.captureCount);
    expect(passedAssertions).toBe(manifest.assertions.length);

    expect(technicalQa).toContain("premium-spatial-2026-08-26");
    expect(technicalQa).toContain(manifest.capturedAt);
    expect(technicalQa).toContain(manifest.expectedGitSha);
    expect(technicalQa).toContain(manifest.deploymentId);
    expect(technicalQa).toMatch(
      new RegExp(
        `${manifest.captureCount} PNGs[^\\n]{0,120}${routes.length} routes[^\\n]{0,40}${widths.length} widths`,
        "i",
      ),
    );
    expect(technicalQa).toMatch(
      new RegExp(`${matching200}[^\\n]{0,30}HTTP 200`, "i"),
    );
    expect(technicalQa).toMatch(new RegExp(`${matching404} expected 404`, "i"));
    expect(technicalQa).toMatch(
      new RegExp(`${uniqueHashes} unique[^\\n]{0,30}(?:hashes|SHA-256)`, "i"),
    );
    expect(technicalQa).toMatch(
      new RegExp(
        `${passedAssertions}/${manifest.assertions.length} safety assertions`,
        "i",
      ),
    );

    expect(afterPlans[0]).toHaveLength(afterPlans[1]!.length);
    expect(afterPlans[1]).toHaveLength(afterPlans[2]!.length);
    const plannedAfterCount = afterPlans[0]!.length;
    const plannedFullPages =
      AFTER_CAPTURE_ROUTES.length * CAPTURE_WIDTHS.length;
    const plannedMenuStates = afterPlans[0]!.filter(
      ({ state }) => state === "menu-open",
    ).length;
    const plannedSkipStates = afterPlans[0]!.filter(
      ({ state }) => state === "skip-link-focus",
    ).length;
    expect(technicalQa).toMatch(
      new RegExp(
        `planned[^\\n]{0,80}after[^\\n]{0,80}runtime[^\\n]{0,80}${plannedAfterCount} PNGs`,
        "i",
      ),
    );
    expect(technicalQa).toMatch(
      new RegExp(
        `${AFTER_CAPTURE_ROUTES.length}[^\\n]{0,20}${CAPTURE_WIDTHS.length}[^\\n]{0,30}${plannedFullPages}[^\\n]{0,50}${plannedMenuStates} menu[^\\n]{0,80}${plannedSkipStates} skip`,
        "i",
      ),
    );
    expect(technicalQa).toMatch(
      /not (?:yet )?(?:generated|captured) or verified/i,
    );
    for (const ungeneratedPath of [
      "artifacts/site-audit/after/premium-spatial-2026-08-26/local",
      "artifacts/site-audit/after/premium-spatial-2026-08-26/production",
      "artifacts/site-audit/runtime-verification/premium-spatial-2026-08-26-final",
    ]) {
      expect(await pathExists(ungeneratedPath), ungeneratedPath).toBe(false);
    }

    expect(technicalQa).toMatch(/32 reviewed states/i);
    expect(technicalQa).not.toMatch(/34 reviewed states/i);
    expect(technicalQa).toMatch(
      /Purple Signal[^\n]{0,100}(?:historical|dated|separate)/i,
    );
  });

  it("keeps the premium spatial release in exact ads-off mode", async () => {
    const documents = new Map([
      ["DESIGN.md", await read("DESIGN.md")],
      ["README.md", await read("README.md")],
      ["docs/TECHNICAL_QA.md", await read("docs/TECHNICAL_QA.md")],
    ]);
    const advertisingSubject =
      /(?:\b(?:monetization|ads?|ad scripts?|ad slots?|ad placeholders?|advertising|analytics|CMP)\b|\btracking\b(?=[^.!?\n]{0,20}\b(?:is|are|was|were|enabled|active|activated|loaded|runs?|serves?)\b)|\btracking (?:script|code|identifier|pixel|technology|tooling)\b)/i;

    for (const [documentName, document] of documents) {
      expect(document, documentName).toMatch(/Google alone decides/i);
      expect(document, documentName).not.toMatch(
        /(?:guaranteed|guarantees) (?:AdSense )?approval/i,
      );
      expect(
        findUnsupportedEnabledClaims(document, advertisingSubject),
        `${documentName} must not affirm enabled monetization or tracking`,
      ).toEqual([]);
    }

    for (const documentName of ["DESIGN.md", "docs/TECHNICAL_QA.md"]) {
      const document = documents.get(documentName)!;
      expect(document, documentName).toMatch(
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
        expect(document, `${documentName}: ${absentOutput}`).toContain(
          absentOutput,
        );
      }
      expect(document, documentName).toMatch(
        /changes do not establish AdSense eligibility/i,
      );
    }

    const readme = documents.get("README.md")!;
    expect(readme).toMatch(
      /Advertising[^\n]{0,100}analytics[^\n]{0,100}disabled/i,
    );
    expect(readme).toMatch(/AdSense:[^\n]{0,120}no publisher ID/i);
    expect(readme).toMatch(/AdSense:[^\n]{0,120}ads\.txt/i);
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

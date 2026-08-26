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
  capturedAt: string;
  deploymentId: string;
  expectedGitSha: string;
  expectedStatus: number;
  fileName: string;
  origin: string;
  phase: string;
  route: string;
  sha256: string;
  state: string;
  viewport: Readonly<{
    deviceScaleFactor: number;
    height: number;
    width: number;
  }>;
}>;

type AuditManifest = Readonly<{
  assertions: ReadonlyArray<Readonly<{ id: string; passed: boolean }>>;
  captureCount: number;
  capturedAt: string;
  captures: ReadonlyArray<AuditCapture>;
  deploymentId: string;
  expectedGitSha: string;
  origin: string;
  phase: string;
}>;

type CapturePlanEntry = ReturnType<typeof buildCapturePlan>[number];

function locateSentences(text: string): LocatedSentence[] {
  return text.split(/\r?\n/).flatMap((line, lineIndex) =>
    line
      .split(/(?<=[.!?])\s+(?=[A-Z“"`#*-])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((sentence) => ({ line: lineIndex + 1, sentence })),
  );
}

function locateClauses(text: string): LocatedSentence[] {
  return locateSentences(text).flatMap(({ line, sentence }) =>
    sentence
      .split(/\s*(?:,\s*but\s+|;|\s+but\s+|,\s+)\s*/i)
      .map((clause) => clause.trim())
      .filter(Boolean)
      .map((clause) => ({ line, sentence: clause })),
  );
}

function splitCoordinatedHostedClaims(
  clause: string,
  hostedSubject: RegExp,
): string[] {
  for (const match of clause.matchAll(/\s+and\s+/gi)) {
    const splitIndex = match.index;
    const left = clause.slice(0, splitIndex).trim();
    const right = clause.slice(splitIndex + match[0].length).trim();

    if (hostedSubject.test(left) && hostedSubject.test(right)) {
      return [
        ...splitCoordinatedHostedClaims(left, hostedSubject),
        ...splitCoordinatedHostedClaims(right, hostedSubject),
      ];
    }
  }

  return [clause];
}

function subjectOnlyFollowsExclusionConnector(
  sentence: string,
  subject: RegExp,
): boolean {
  const subjectMatcher = new RegExp(
    subject.source,
    `${subject.flags.replace(/[gy]/g, "")}g`,
  );
  const subjectMatches = [...sentence.matchAll(subjectMatcher)];

  return (
    subjectMatches.length > 0 &&
    subjectMatches.every(({ index = 0 }) =>
      /\b(?:instead of|rather than|without)\s+(?:(?:a|an|the|any)\s+)?$/i.test(
        sentence.slice(0, index),
      ),
    )
  );
}

function hasTrailingConditionalMarker(
  clause: string,
  affirmativeCompletion: RegExp,
): boolean {
  const completionIndex = clause.search(affirmativeCompletion);
  const conditionalIndex = clause.search(/\b(?:if|when|once|after)\b/i);

  return completionIndex >= 0 && conditionalIndex > completionIndex;
}

function findUnsupportedHostedCompletionClaims(
  text: string,
): LocatedSentence[] {
  const hostedSubject = /(?:Pages CMS hosted\b|hosted (?:Pages )?CMS\b)/i;
  const affirmativeCompletion =
    /\b(?:verified|configured|connected|complete|completed|succeeded|works|authorized|operational|ready|active|owner-only)\b/i;
  const explicitBoundary = /\b(?:not|unverified|unknown|owner actions?)\b/i;
  const leadingConditional = /^(?:[-*]\s*)?(?:if|when|once|after)\b/i;

  return locateSentences(text).flatMap(({ line, sentence }) =>
    leadingConditional.test(sentence)
      ? []
      : locateClauses(sentence)
          .flatMap(({ sentence: clause }) =>
            splitCoordinatedHostedClaims(clause, hostedSubject),
          )
          .map((clause) => ({ line, sentence: clause }))
          .filter(
            ({ sentence: clause }) =>
              hostedSubject.test(clause) &&
              affirmativeCompletion.test(clause) &&
              !explicitBoundary.test(clause) &&
              !hasTrailingConditionalMarker(clause, affirmativeCompletion),
          ),
  );
}

function findUnsupportedEnabledClaims(
  text: string,
  subject: RegExp,
): LocatedSentence[] {
  const affirmative =
    /\b(?:uses?|used|enables?|enabled|activates?|activated|active|loads?|loaded|ships?|runs?|serves?|in use)\b/i;
  const explicitBoundary =
    /\b(?:not loaded|not used|not enabled|not active|does not|do not|must not|no|disabled|off|absent|absence|rejects?|excludes?|forbids?|prohibits?|never|cannot|future)\b/i;

  return locateClauses(text).filter(
    ({ sentence }) =>
      subject.test(sentence) &&
      affirmative.test(sentence) &&
      !explicitBoundary.test(sentence) &&
      !subjectOnlyFollowsExclusionConnector(sentence, subject),
  );
}

function findStaleBlanketMotionBans(text: string): LocatedSentence[] {
  const prohibition =
    /\b(?:do not|must not|never|bans?|banned|prohibits?|prohibited|forbids?|forbidden)\b/i;
  const blanketScope =
    /\bdecorative entrance (?:motions?|animations?)\b|\b(?:any|all) nonessential (?:motion|animation|transition)s?\b/i;
  const safetyScope =
    /\b(?:legal|trust|downloads?|toolkit|ads?|advertising|controls?)\b/i;

  return locateClauses(text).filter(
    ({ sentence }) =>
      prohibition.test(sentence) &&
      blanketScope.test(sentence) &&
      !safetyScope.test(sentence),
  );
}

function findCaptureBindingErrors(
  captures: ReadonlyArray<AuditCapture>,
  plan: ReadonlyArray<CapturePlanEntry>,
  manifest: AuditManifest,
): string[] {
  const errors: string[] = [];
  const expectedByFileName = new Map(
    plan.map((entry) => [entry.fileName, entry] as const),
  );
  const captureFileNames = new Set(captures.map(({ fileName }) => fileName));

  for (const expected of plan) {
    if (!captureFileNames.has(expected.fileName)) {
      errors.push(`${expected.fileName}: missing capture`);
    }
  }

  for (const capture of captures) {
    const expected = expectedByFileName.get(capture.fileName);
    if (!expected) {
      errors.push(`${capture.fileName}: unexpected fileName`);
      continue;
    }

    const comparisons = [
      ["route", capture.route, expected.path],
      ["state", capture.state, expected.state],
      ["viewport.width", capture.viewport.width, expected.width],
      ["viewport.height", capture.viewport.height, expected.height],
      [
        "viewport.deviceScaleFactor",
        capture.viewport.deviceScaleFactor,
        expected.deviceScaleFactor,
      ],
      ["expectedStatus", capture.expectedStatus, expected.status],
      ["actualStatus", capture.actualStatus, capture.expectedStatus],
      ["capturedAt", capture.capturedAt, manifest.capturedAt],
      ["origin", capture.origin, manifest.origin],
      ["phase", capture.phase, manifest.phase],
      ["expectedGitSha", capture.expectedGitSha, manifest.expectedGitSha],
      ["deploymentId", capture.deploymentId, manifest.deploymentId],
    ] as const;

    for (const [field, actual, expectedValue] of comparisons) {
      if (actual !== expectedValue) {
        errors.push(`${capture.fileName}: ${field}`);
      }
    }
  }

  return errors;
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
  it("classifies coordinated and trailing-conditional hosted claims directionally", () => {
    expect(
      findUnsupportedHostedCompletionClaims(
        "Hosted CMS access is unverified and hosted CMS authorization succeeded.",
      ),
    ).toEqual([{ line: 1, sentence: "hosted CMS authorization succeeded." }]);

    for (const marker of ["if", "when", "once", "after"]) {
      expect(
        findUnsupportedHostedCompletionClaims(
          `Hosted CMS access works ${marker} the owner authorizes it.`,
        ),
        marker,
      ).toEqual([]);
    }
  });

  it("classifies runtime connector direction from the prohibited runtime", () => {
    const runtimeSubject =
      /\b(?:Motion|(?:Astro )?ClientRouter|Three\.js|WebGL|Lenis|remote (?:presentation )?runtime)\b/i;

    for (const excludedObject of [
      "The site uses native CSS instead of Motion.",
      "The site uses native CSS rather than Motion.",
      "The site works without ClientRouter.",
    ]) {
      expect(
        findUnsupportedEnabledClaims(excludedObject, runtimeSubject),
        excludedObject,
      ).toEqual([]);
    }

    for (const affirmativeRuntime of [
      "Motion is used instead of ClientRouter.",
      "Motion is used rather than CSS.",
      "Motion is enabled without ClientRouter.",
    ]) {
      expect(
        findUnsupportedEnabledClaims(affirmativeRuntime, runtimeSubject),
        affirmativeRuntime,
      ).toEqual([{ line: 1, sentence: affirmativeRuntime }]);
    }
  });

  it("distinguishes unsupported hosted completion claims from explicit uncertainty", () => {
    for (const unsupported of [
      "Pages CMS hosted access is verified.",
      "The hosted CMS is connected.",
      "Hosted Pages CMS sign-in has been completed.",
      "Pages CMS hosted authorization is owner-only and complete.",
      "Hosted CMS access remains operational.",
      "The hosted CMS works.",
      "Hosted CMS access succeeded.",
      "Hosted CMS access is authorized.",
      "Hosted CMS access is configured.",
      "Hosted CMS access operational.",
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
      "Hosted CMS access is not yet verified.",
      "Hosted CMS access is not currently configured.",
      "Hosted CMS access is operational and not performed.",
      "Hosted CMS access is operational and not observed.",
      "If hosted CMS access is authorized, verify the repository scope.",
      "When hosted CMS access works, inspect the saved commit.",
      "Once hosted CMS access is operational, record evidence.",
      "After hosted CMS access succeeds, inspect the diff.",
      "Once the owner authorizes access, the hosted CMS is operational.",
    ]) {
      expect(findUnsupportedHostedCompletionClaims(bounded)).toEqual([]);
    }
    expect(
      findUnsupportedHostedCompletionClaims(
        "Pages CMS hosted access is verified. The selected branch remains unverified.",
      ),
    ).toEqual([{ line: 1, sentence: "Pages CMS hosted access is verified." }]);
    expect(
      findUnsupportedHostedCompletionClaims(
        "Hosted CMS access is unverified, but hosted CMS save access works.",
      ),
    ).toEqual([{ line: 1, sentence: "hosted CMS save access works." }]);
    expect(
      findUnsupportedHostedCompletionClaims(
        "Hosted CMS access is unknown; hosted CMS authorization succeeded.",
      ),
    ).toEqual([{ line: 1, sentence: "hosted CMS authorization succeeded." }]);

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
      findUnsupportedEnabledClaims(
        "The site uses CSS rather than Motion.",
        runtimeSubject,
      ),
    ).toEqual([]);
    expect(
      findUnsupportedEnabledClaims(
        "The page works without Lenis.",
        runtimeSubject,
      ),
    ).toEqual([]);
    expect(
      findUnsupportedEnabledClaims("Lenis remains loaded.", runtimeSubject),
    ).toEqual([{ line: 1, sentence: "Lenis remains loaded." }]);
    expect(
      findUnsupportedEnabledClaims("WebGL loaded at runtime.", runtimeSubject),
    ).toEqual([{ line: 1, sentence: "WebGL loaded at runtime." }]);
    expect(
      findUnsupportedEnabledClaims(
        "Motion is not loaded, but WebGL is active.",
        runtimeSubject,
      ),
    ).toEqual([{ line: 1, sentence: "WebGL is active." }]);
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
      "Decorative entrance motions are prohibited.",
      "Decorative entrance animations are banned.",
      "Never use decorative entrance animations.",
    ]) {
      expect(findStaleBlanketMotionBans(staleBan)).toHaveLength(1);
    }
    expect(
      findStaleBlanketMotionBans(
        "Do not add scroll hijacking, runtime motion, or continuous or infinite loops.",
      ),
    ).toEqual([]);
    expect(
      findStaleBlanketMotionBans(
        "Never use decorative entrance motion on legal and trust controls.",
      ),
    ).toEqual([]);
    expect(
      findStaleBlanketMotionBans(
        "Do not add decorative entrance animation to Toolkit download controls.",
      ),
    ).toEqual([]);
    expect(
      findStaleBlanketMotionBans(
        "Decorative entrance animations are prohibited in advertising controls.",
      ),
    ).toEqual([]);
  });

  it("rejects per-capture mutations against the manifest header and capture plan", async () => {
    const manifest = JSON.parse(
      await read(
        "artifacts/site-audit/before/premium-spatial-2026-08-26/audit-manifest.json",
      ),
    ) as AuditManifest;
    const plan = buildCapturePlan({
      origin: manifest.origin,
      phase: "before",
    });

    expect(findCaptureBindingErrors(manifest.captures, plan, manifest)).toEqual(
      [],
    );

    const original = manifest.captures[0]!;
    const mutations: ReadonlyArray<
      Readonly<{ capture: AuditCapture; expectedField: string }>
    > = [
      { capture: { ...original, route: "/mutated/" }, expectedField: "route" },
      {
        capture: { ...original, state: "menu-open" },
        expectedField: "state",
      },
      {
        capture: {
          ...original,
          viewport: { ...original.viewport, width: 321 },
        },
        expectedField: "viewport.width",
      },
      {
        capture: {
          ...original,
          viewport: { ...original.viewport, height: 901 },
        },
        expectedField: "viewport.height",
      },
      {
        capture: {
          ...original,
          viewport: { ...original.viewport, deviceScaleFactor: 2 },
        },
        expectedField: "viewport.deviceScaleFactor",
      },
      {
        capture: { ...original, expectedStatus: 500 },
        expectedField: "expectedStatus",
      },
      {
        capture: { ...original, actualStatus: 500 },
        expectedField: "actualStatus",
      },
      {
        capture: { ...original, capturedAt: "mutated" },
        expectedField: "capturedAt",
      },
      {
        capture: { ...original, origin: "https://example.invalid" },
        expectedField: "origin",
      },
      {
        capture: { ...original, phase: "after-production" },
        expectedField: "phase",
      },
      {
        capture: { ...original, expectedGitSha: "mutated" },
        expectedField: "expectedGitSha",
      },
      {
        capture: { ...original, deploymentId: "mutated" },
        expectedField: "deploymentId",
      },
    ];

    for (const { capture, expectedField } of mutations) {
      expect(
        findCaptureBindingErrors(
          [capture, ...manifest.captures.slice(1)],
          plan,
          manifest,
        ),
        expectedField,
      ).toContain(`${capture.fileName}: ${expectedField}`);
    }
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
      expect(
        findStaleBlanketMotionBans(document),
        `${documentName} must retain the selected finite/native motion architecture`,
      ).toEqual([]);
    }
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
    expect(manifest.origin).toBe("https://everyday-tech-insight.vercel.app");
    expect(expectedBeforePlan).toHaveLength(64);
    expect(manifest.captureCount).toBe(expectedBeforePlan.length);
    expect(manifest.captures).toHaveLength(expectedBeforePlan.length);
    expect(pngEntries).toHaveLength(expectedBeforePlan.length);
    expect(pngEntries.toSorted()).toEqual(
      expectedBeforePlan.map(({ fileName }) => fileName).toSorted(),
    );
    expect(
      findCaptureBindingErrors(manifest.captures, expectedBeforePlan, manifest),
    ).toEqual([]);

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
    const requiredSafetyAssertionIds = [
      "ads-txt-absent",
      "cms-admin-absent",
      "cms-config-absent",
      "cms-draft-absent",
      "cms-keystatic-absent",
      "monetization-off",
    ];

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
    expect(manifest.assertions.map(({ id }) => id).toSorted()).toEqual(
      requiredSafetyAssertionIds.toSorted(),
    );
    expect(manifest.assertions.every(({ passed }) => passed)).toBe(true);

    expect(technicalQa).toContain("premium-spatial-2026-08-26");
    expect(technicalQa).toContain(manifest.origin);
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

    expect(technicalQa).toMatch(
      /compares 34 reviewed states on each supported test platform/i,
    );
    expect(technicalQa).toMatch(/for 68 baseline files/i);
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

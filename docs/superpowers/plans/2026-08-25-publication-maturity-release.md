# Publication Maturity and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for implementation and superpowers:verification-before-completion before any release claim.

**Goal:** Add fail-closed monetization readiness, reproducible release evidence, expanded mobile/desktop quality gates, and a GitHub-first Vercel production release whose exact live state is verified.

**Architecture:** One discriminated monetization configuration drives code, disclosure copy, and production assertions. One capture manifest records immutable screenshot hashes and observed HTTP/runtime facts. `npm run qa` remains the local release gate; GitHub `main` is pushed and SHA-verified before Vercel deployment. External owner, Pages CMS, AdSense, legal, rights, and human-review gates remain explicitly open.

**Tech stack:** Astro 7 static output, Node.js ESM, Zod, Vitest, Playwright, axe, Lighthouse, Sharp, GitHub, Vercel CLI.

---

### Task 1: Encode fail-closed monetization modes without enabling ads

**Files:**

- Modify: `site.config.mjs`
- Create: `src/utils/monetization.ts`
- Modify: `src/components/AdSlot.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/privacy.astro`
- Modify: `src/pages/advertising-disclosure.astro`
- Create: `tests/unit/monetization.test.ts`
- Modify: `tests/unit/site-config.test.ts`
- Modify: `tests/unit/qa-rules.test.ts`
- Modify: `tests/unit/production-smoke.test.ts`
- Modify: `scripts/qa-build.mjs`
- Modify: `scripts/check-production.mjs`

- [ ] **Step 1: Write failing discriminated-union tests**

Require exact `off | verification | live` modes. Off rejects provider/ID/meta/ads.txt/CMP/placement values. Verification requires a complete exact `meta` or `ads-txt` tuple and forbids display units. Live requires the exact owner-provided public tuple, site-status evidence, authorization, disclosure state, authorized ads.txt line, and applicable certified-CMP decision. Partial tuples fail closed.

Also require a pure placement allowlist containing only `article-after-intro` and `article-before-sources`; exclude unpublished, Toolkit/download, trust/legal, 404, feed/sitemap, CMS, navigation-adjacent, and short-content contexts.

- [ ] **Step 2: Run red tests**

Run: `npm test -- --run tests/unit/monetization.test.ts tests/unit/site-config.test.ts tests/unit/qa-rules.test.ts tests/unit/production-smoke.test.ts`  
Expected: FAIL because the current config is a boolean.

- [ ] **Step 3: Implement only the off configuration**

Code the dormant validation and conditional interfaces without sample publisher IDs or verification values. Current output must contain no ad script, meta identifier, ad request, slot, label, gap, CMP, analytics, tracking, or `ads.txt`. Disclosure/privacy wording derives from the active off mode.

- [ ] **Step 4: Verify and commit**

Run focused unit tests plus `npm run build && npm run check:seo`. Confirm `/ads.txt`, `/admin/`, `/keystatic/`, and `/.pages.yml` are absent from static output.

```text
git add site.config.mjs src scripts/qa-build.mjs scripts/check-production.mjs tests/unit
git commit -m "feat(monetization): enforce advertising-off safety modes"
```

### Task 2: Build a versioned evidence capture and manifest harness

**Files:**

- Modify: `scripts/capture-production-screenshots.mjs`
- Create: `scripts/write-audit-manifest.mjs`
- Modify: `tests/unit/production-capture.test.ts`
- Create: `tests/unit/audit-manifest.test.ts`
- Modify: `package.json`
- Modify: `.vercelignore`

- [ ] **Step 1: Write failing plan/path/hash tests**

Require explicit `--origin`, `--phase before|after-local|after-production`, and an optional expected SHA/deployment ID. Reject implicit roots, HTTP, credentials, paths, unknown options, target escape, symlink escape, duplicate filenames, route/status mismatch, redirect, cross-origin request, and incomplete capture inventory. Include 390, 768, 1024, 1440, and 1920 widths.

Manifest rows must contain capture time, phase, origin, expected SHA, optional deployment ID, route, expected/actual status, viewport/state, filename, byte count, and SHA-256. Sort deterministically but keep timestamps factual. Use safe staged publication so a failed capture preserves prior evidence.

- [ ] **Step 2: Confirm red state**

Run: `npm test -- --run tests/unit/production-capture.test.ts tests/unit/audit-manifest.test.ts`  
Expected: FAIL on widths, route matrix, phases, and manifest support.

- [ ] **Step 3: Implement the representative-before/full-after plans**

Before: home, archive, one category, one article, Toolkit, about, editorial standards, and 404 at all five widths. After: the exact 18-route matrix plus 390/768 menu-open and five skip-focus states. DOM/HTTP assertions prove CMS absence and monetization off; do not fabricate screenshots for nonexistent UI.

Exclude `.planning`, test baselines, local temporary captures, and non-runtime evidence from Vercel upload while retaining committed source evidence in Git. Add `artifacts/site-audit/runtime-verification/` to `.gitignore`; it is the explicit non-self-referential location for the final deployment’s direct smoke/capture record.

- [ ] **Step 4: Verify and commit**

```text
npm test -- --run tests/unit/production-capture.test.ts tests/unit/audit-manifest.test.ts
git add scripts/capture-production-screenshots.mjs scripts/write-audit-manifest.mjs tests/unit package.json .vercelignore
git commit -m "test(qa): add versioned publication evidence captures"
```

### Task 3: Expand Lighthouse and production smoke gates

**Files:**

- Modify: `scripts/run-lighthouse.mjs`
- Modify: `scripts/check-production.mjs`
- Modify: `tests/unit/production-smoke.test.ts`
- Create: `tests/unit/lighthouse-config.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing audit-matrix tests**

Require desktop and mobile audits for home, one category, one representative article, and Toolkit. Each page/device runs three times; use the median. Thresholds: performance 90+, accessibility 95+, best practices 95+, SEO 95+. Preserve failure details and raw JSON artifacts without claiming a pass on a missing run.

Production smoke must verify canonical alias, exact requested URL/no redirects, all expected routes/assets, security headers, canonical/metadata shell parity, CMS route absence, ads.txt 404, monetization off, no unexpected cross-origin requests, and an exact deployed Git SHA when Vercel metadata exposes it.

- [ ] **Step 2: Implement and verify tests**

Run: `npm test -- --run tests/unit/lighthouse-config.test.ts tests/unit/production-smoke.test.ts`  
Expected: FAIL before matrix changes, then PASS.

- [ ] **Step 3: Commit**

```text
git add scripts/run-lighthouse.mjs scripts/check-production.mjs tests/unit package.json
git commit -m "test(release): expand Lighthouse and production smoke gates"
```

### Task 4: Complete publication operations and AdSense readiness documentation

**Files:**

- Modify: `README.md`
- Modify: `DESIGN.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Create: `docs/PUBLISHING_GUIDE.md` if not already created by the CMS plan
- Modify: `docs/TECHNICAL_QA.md`
- Modify: `docs/DEPLOYMENT_GUIDE.md`
- Create: `docs/ADSENSE_READINESS_AUDIT_2026-08-25.md`
- Modify: `docs/PRIVACY_AND_CONSENT_REVIEW.md`
- Modify: `docs/HUMAN_REVIEW_CHECKLIST.md`
- Modify: `docs/CMS_BRAND_ADSENSE_SOURCE_LOG.md`
- Create: `tests/unit/publication-operations.test.ts` if not already created

- [ ] **Step 1: Add failing documentation-contract tests**

Require exact lifecycle, Pages CMS owner steps, Git branch/PR/Vercel preview flow, archive-not-delete behavior, media/source/rights rules, rollback, 18 owner inputs, content-quality queue, monetization mode, current off state, no approval claim, CMP/ads.txt gates, current production URL, and commands that actually exist in `package.json`.

- [ ] **Step 2: Write evidence-bounded documentation**

Classify every result as observed, locally verified, inferred, owner action, or unknown. Do not carry forward old `READY` wording without a fresh dated measurement. State that configuration compatibility does not prove Pages CMS hosted authorization/round-trip and that software/quality improvements cannot guarantee AdSense approval.

- [ ] **Step 3: Verify and commit**

Run: `npm test -- --run tests/unit/publication-operations.test.ts && npm run format:check`  
Expected: PASS.

```text
git add README.md DESIGN.md docs tests/unit/publication-operations.test.ts
git commit -m "docs(release): document CMS and AdSense readiness boundaries"
```

### Task 5: Capture the live before state and the local release candidate

**Files:**

- Create through the tested capture command: `artifacts/site-audit/before/purple-signal-2026-08-25/`
- Create through the tested capture command: `artifacts/site-audit/after/purple-signal-2026-08-25/local/`

- [ ] **Step 1: Record the unchanged live rollback deployment**

Before replacing production, resolve and record the live deployment identity and current origin SHA, then run the representative before capture against `https://everyday-tech-insight.vercel.app`. Verify status/no-redirect/runtime/request assertions and manifest hashes.

- [ ] **Step 2: Run the release candidate locally**

Build once, serve `dist` without source mutation, capture the full after-local matrix, and validate every hash. Visually inspect the homepage, all page families, one article per category, menu/focus states, 404, tables, and long-content bottoms at all required widths.

- [ ] **Step 3: Commit observed evidence**

```text
git add artifacts/site-audit/before/purple-signal-2026-08-25 artifacts/site-audit/after/purple-signal-2026-08-25/local
git commit -m "docs(evidence): record Purple Signal before and local states"
```

### Task 6: Run independent review and the complete local release gate

**Files:**

- Modify only findings from review; never weaken a failing gate to obtain green.

- [ ] **Step 1: Run focused preflight**

```text
npm ci
npm run setup:browsers
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run check:content
npm run check:editorial
npm run check:cms
npm run check:images
npm run check:cms-fixture
npm run check:seo
npm run check:links
npm run test:e2e
npm run lighthouse
npm run test:visual
```

- [ ] **Step 2: Request independent code and visual review**

Review the complete diff from `6473acaa64c64a64de6d3d1e6900cdad9a52d06c`, classify findings by severity, fix all material findings with focused failing tests, and rerun affected gates. Do not conflate a reviewer’s opinion with human editorial/legal approval.

- [ ] **Step 3: Run the single complete gate from a clean dependency install**

Run: `npm run qa`  
Expected: PASS with measured output recorded. Then run `git status --short`; only intended committed files may remain.

- [ ] **Step 4: Commit final fixes/results**

Inspect `git status --short`, `git diff --name-status`, and `git diff --cached --name-status`. Stage each reviewed intended literal path individually, using the path inventory from the finding that authorized the change. Never use `git add -A`, a workspace-wide path, or a glob in a dirty or public-repository worktree. Reinspect the staged name/status and full staged diff; if no intended fixes remain, do not create an empty release commit.

```text
git status --short
git diff --name-status
git diff --cached --name-status
git diff --cached --check
git commit -m "chore(release): prepare Purple Signal production candidate"
```

### Task 7: Push GitHub first, deploy Vercel second, and verify production

- [ ] **Step 1: Establish the exact candidate SHA**

```text
git status --short
git rev-parse HEAD
git push origin main
git ls-remote origin refs/heads/main
```

Expected: clean tree and identical local/remote SHA. Stop on any mismatch.

- [ ] **Step 2: Deploy the pushed source**

Check authenticated Vercel CLI help/current project link, then run the noninteractive production deployment from the repository. Record deployment URL/ID and canonical alias. Do not deploy a dirty tree or unpushed source.

- [ ] **Step 3: Verify the live release**

Run production smoke and the complete after-production capture against the canonical alias. Confirm exact statuses, no redirect drift, security headers, assets, metadata shell, no CMS/admin route, no ads.txt, no advertising/analytics/CMP/tracking request, and expected Git metadata.

- [ ] **Step 4: Commit deployment-A screenshots, push, and redeploy for SHA parity**

Commit only the deterministic production evidence from deployment A, whose manifest names deployment A and its release-candidate SHA. Push it and deploy the new GitHub HEAD once more so the live deployment references final SHA B. The evidence-only commit must change no runtime input and all evidence paths must be excluded from the Vercel upload. Do not claim the committed screenshots directly identify SHA B.

```text
git add artifacts/site-audit/after/purple-signal-2026-08-25/production
git commit -m "chore(release): record Purple Signal production evidence"
git push origin main
git ls-remote origin refs/heads/main
```

- [ ] **Step 5: Capture and verify final SHA B outside the commit loop**

Run final production smoke and the complete screenshot/manifest plan again into Git-ignored `artifacts/site-audit/runtime-verification/purple-signal-2026-08-25-final/`. This direct local record must name SHA B and deployment B. Confirm final GitHub SHA equals final Vercel source SHA, canonical alias serves the same shell, all screenshot hashes are complete, and production smoke passes. Compare the runtime shell/hash inventory to deployment A; if only ignored evidence changed and the runtime results match, classify the committed A screenshots as runtime-equivalent evidence—not direct B evidence. Retain `6473acaa64c64a64de6d3d1e6900cdad9a52d06c` and its verified prior deployment as the direct rollback baseline. Preferred rollback is `git revert`, full QA, push, production deploy, and smoke; never rewrite shared history or touch Blogger.

## Completion boundary

The release is complete only when local QA, GitHub push, Vercel deployment, exact-SHA parity, live smoke, and reviewed production captures pass. Pages CMS hosted authorization/round-trip, verified identity/contact/domain, human/editorial/expert/legal/privacy/rights review, AdSense account state, publisher/verification values, ads.txt, CMP selection, and Google approval remain owner/external actions unless separately observed.

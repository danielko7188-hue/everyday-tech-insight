# Premium Spatial Editorial Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the Toolkit action defect and add a script-free, accessible spatial editorial layer with native page transitions, a homepage signal field, article reading progress, balanced spacing, and exact production evidence.

**Architecture:** Preserve Astro static multi-page rendering and the current no-executable-script contract. Use local Astro components plus CSS/SVG for all presentation, progressively enhance with cross-document view transitions and scroll timelines, and fail safely to the complete static design. Keep Pages CMS external and advertising fully off.

**Tech Stack:** Astro 7.2.4, TypeScript, CSS, local inline SVG, Vitest, Playwright, axe, Lighthouse, GitHub, Vercel.

---

## File structure

- `src/components/SignalField.astro`: one decorative local SVG/CSS signal composition shared by the homepage and 404.
- `src/components/ReadingProgress.astro`: semantic-free progress presentation used only by article pages.
- `src/components/ToolkitStructurePreview.astro`: data-driven static preview of a worksheet's ordered fields.
- `src/styles/global.css`: semantic spacing tokens, native transitions, progressive motion, Toolkit geometry, and page-specific depth.
- `tests/e2e/premium-spatial.spec.ts`: rendered geometry, fallback, motion, and overflow contracts.
- `tests/unit/brand-system.test.ts`: source-level native-transition and reduced-motion contracts.
- `scripts/capture-production-screenshots.mjs`: new evidence release ID and the eight-width review matrix.
- `tests/unit/production-capture.test.ts`: exact release paths and capture widths.
- `DESIGN.md`, `README.md`, `docs/TECHNICAL_QA.md`: final architecture, operating, and evidence boundaries.

### Task 1: Version the release evidence and capture the unchanged production baseline

**Files:**

- Modify: `scripts/capture-production-screenshots.mjs`
- Modify: `tests/unit/production-capture.test.ts`
- Create through the tested command: `artifacts/site-audit/before/premium-spatial-2026-08-26/`

- [ ] **Step 1: Write failing release-path and viewport tests**

Update the expected ID and path assertions to require:

```ts
expect(RELEASE_EVIDENCE_ID).toBe("premium-spatial-2026-08-26");
expect(CAPTURE_WIDTHS).toEqual([320, 390, 600, 768, 1024, 1280, 1440, 1920]);
expect(resolveCapturePaths(repositoryRoot, "before").outputDirectory).toBe(
  join(
    repositoryRoot,
    "artifacts/site-audit/before/premium-spatial-2026-08-26",
  ),
);
```

- [ ] **Step 2: Run the focused test and observe the expected failure**

Run:

```text
npm test -- --run tests/unit/production-capture.test.ts
```

Expected: FAIL because the current release ID is `purple-signal-2026-08-25` and the current width list omits 320, 600, and 1280.

- [ ] **Step 3: Implement the exact evidence constants**

Use:

```js
export const RELEASE_EVIDENCE_ID = "premium-spatial-2026-08-26";
export const CAPTURE_WIDTHS = Object.freeze([
  320, 390, 600, 768, 1024, 1280, 1440, 1920,
]);
```

Preserve the owned-path, staging, hash, response, CMS-absence, and monetization-off protections.

- [ ] **Step 4: Verify the focused test and capture production before editing application source**

Run:

```text
npm test -- --run tests/unit/production-capture.test.ts
npm run capture:production -- --origin https://everyday-tech-insight.vercel.app --phase before --expected-sha af8dd44843860f3a055c76f934c02ae389ec1a81 --deployment-id dpl_CptkBhg1Q5Gw7dCD11et1bw66HPd
```

Expected: PASS and 64 before-state PNGs plus a hash-validated manifest.

- [ ] **Step 5: Commit the evidence harness and baseline**

```text
git add scripts/capture-production-screenshots.mjs tests/unit/production-capture.test.ts artifacts/site-audit/before/premium-spatial-2026-08-26
git commit -m "test(evidence): capture premium spatial baseline"
```

### Task 2: Fix Toolkit action geometry test-first

**Files:**

- Create: `tests/e2e/premium-spatial.spec.ts`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write the failing five-width Toolkit test**

For 390, 600, 768, 1024, and 1440px, assert four stretched cards and inspect every action footer:

```ts
for (const width of [390, 600, 768, 1024, 1440] as const) {
  test(`Toolkit actions remain balanced at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/toolkit/");
    const cards = page.locator(".toolkit-card");
    await expect(cards).toHaveCount(4);
    const geometry = await cards.evaluateAll((elements) =>
      elements.map((card) => {
        const actions = card.querySelector<HTMLElement>(
          ".toolkit-card__actions",
        )!;
        const primary = actions.querySelector<HTMLElement>(
          ".toolkit-card__primary",
        )!;
        const style = getComputedStyle(actions);
        const primaryStyle = getComputedStyle(primary);
        const primaryBox = primary.getBoundingClientRect();
        return {
          actionDisplay: style.display,
          actionColumns: style.gridTemplateColumns,
          cardBottom: Math.round(card.getBoundingClientRect().bottom),
          justify: primaryStyle.justifyContent,
          minHeight: primaryBox.height,
          overflow: primary.scrollWidth - primary.clientWidth,
          paddingInline: Number.parseFloat(primaryStyle.paddingInlineStart),
          primaryCenter: primaryBox.left + primaryBox.width / 2,
          textCenter:
            primary.firstChild instanceof Text
              ? (() => {
                  const range = document.createRange();
                  range.selectNodeContents(primary);
                  const box = range.getBoundingClientRect();
                  return box.left + box.width / 2;
                })()
              : 0,
        };
      }),
    );
    for (const item of geometry) {
      expect(item.actionDisplay).toBe("grid");
      expect(item.justify).toBe("center");
      expect(item.minHeight).toBeGreaterThanOrEqual(44);
      expect(item.paddingInline).toBeGreaterThanOrEqual(12);
      expect(item.overflow).toBeLessThanOrEqual(0);
      expect(Math.abs(item.primaryCenter - item.textCenter)).toBeLessThan(2);
    }
  });
}
```

Add one long-label fixture by replacing the first card's labels in the browser before measuring and confirm no horizontal overflow.

- [ ] **Step 2: Run the test and observe the expected failure**

Run:

```text
npx playwright test tests/e2e/premium-spatial.spec.ts
```

Expected: FAIL because actions currently compute to wrapping flex and the primary link has no inline padding or centered justification.

- [ ] **Step 3: Implement the grid footer**

Use the existing spacing tokens:

```css
.toolkit-grid {
  align-items: stretch;
  grid-auto-rows: 1fr;
}

.toolkit-card {
  grid-template-rows: minmax(0, 1fr) auto;
  min-block-size: 100%;
}

.toolkit-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3) var(--space-4);
  align-content: start;
  padding: var(--space-5) var(--space-6) var(--space-6);
}

.toolkit-card__primary {
  grid-column: 1 / -1;
  justify-content: center;
  padding: var(--space-3) var(--space-4);
  text-align: center;
}

.toolkit-card__actions > a:not(.toolkit-card__primary) {
  justify-content: flex-start;
  padding: var(--space-2) var(--space-3);
}

@media (max-width: 40rem) {
  .toolkit-card__actions {
    grid-template-columns: 1fr;
  }

  .toolkit-card__primary {
    grid-column: auto;
  }
}
```

- [ ] **Step 4: Verify and commit the isolated defect fix**

Run the focused Playwright test and the existing Toolkit, responsive, accessibility, and visual tests. Commit only the new test and CSS fix.

```text
git add tests/e2e/premium-spatial.spec.ts src/styles/global.css
git commit -m "fix(toolkit): balance card action geometry"
```

### Task 3: Add the native spatial system and page-specific components

**Files:**

- Create: `src/components/SignalField.astro`
- Create: `src/components/ReadingProgress.astro`
- Create: `src/components/ToolkitStructurePreview.astro`
- Modify: `src/layouts/ArticleLayout.astro`
- Modify: `src/layouts/ToolkitDetailLayout.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/404.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/unit/brand-system.test.ts`
- Modify: `tests/e2e/premium-spatial.spec.ts`

- [ ] **Step 1: Write failing source and rendered contracts**

Require the stylesheet to contain `@view-transition`, `prefers-reduced-motion`, `prefers-reduced-data`, view-timeline/scroll-timeline progressive enhancement, and no infinite animation. Require the built homepage to contain one `[data-signal-field]`, articles to contain one `[data-reading-progress]`, Toolkit detail pages to contain one `[data-toolkit-structure]`, and the 404 to expose Home, Guides, Topics, and Toolkit recovery links. Assert that every page still has zero executable scripts.

- [ ] **Step 2: Run focused tests and observe the missing-feature failures**

```text
npm test -- --run tests/unit/brand-system.test.ts
npx playwright test tests/e2e/premium-spatial.spec.ts
```

Expected: FAIL on missing native-transition, signal, progress, Toolkit preview, and 404 contracts.

- [ ] **Step 3: Implement static-first components**

`SignalField.astro` renders one `aria-hidden="true"` wrapper with three planes and a local inline SVG signal path. It accepts `variant="hero" | "compact"` and exposes no script.

`ReadingProgress.astro` renders:

```astro
<div class="reading-progress" data-reading-progress aria-hidden="true">
  <span></span>
</div>
```

`ToolkitStructurePreview.astro` derives three groups from the real ordered field array and renders a labeled visual preview without changing download actions or claiming completed data.

- [ ] **Step 4: Implement progressive CSS motion and depth**

- Add `@view-transition { navigation: auto; }` and 200ms root old/new animations.
- Add all motion only under `@media (prefers-reduced-motion: no-preference)`.
- Use finite or scroll-linked transforms only; do not add `infinite` animations.
- Apply no more than 3px elevation, 1 degree rotation, and 1.005 scale to eligible cards.
- Use `@supports (animation-timeline: scroll())` for reading progress and `@supports (animation-timeline: view())` for bounded signal displacement.
- Under reduced motion, reduced data, coarse pointer, or slow update, remove the decorative transforms and hide reading progress.

- [ ] **Step 5: Integrate the components**

- Homepage: place the hero signal after the promise summary.
- Article: place reading progress immediately inside the article element before the hero.
- Toolkit detail: place the structure preview after the introduction and before Purpose.
- 404: place compact signal before recovery links and add Toolkit.

- [ ] **Step 6: Verify and commit**

Run focused unit/E2E tests, axe, responsive tests, and a build. Inspect homepage, article, Toolkit detail, and 404 at 320, 390, 600, 768, 1024, 1280, 1440, and 1920px.

```text
git add src/components/SignalField.astro src/components/ReadingProgress.astro src/components/ToolkitStructurePreview.astro src/layouts/ArticleLayout.astro src/layouts/ToolkitDetailLayout.astro src/pages/index.astro src/pages/404.astro src/styles/global.css tests/unit/brand-system.test.ts tests/e2e/premium-spatial.spec.ts
git commit -m "feat(design): add native spatial editorial system"
```

### Task 4: Align the design and operating documentation

**Files:**

- Modify: `DESIGN.md`
- Modify: `README.md`
- Modify: `docs/TECHNICAL_QA.md`
- Modify: `docs/PUBLISHING_GUIDE.md`
- Modify: `tests/unit/publication-operations.test.ts`

- [ ] **Step 1: Write a failing documentation contract**

Require the documents to state native CSS transitions, no ClientRouter, no Motion/WebGL/Lenis, no continuous loop, the semantic spacing contract, external Pages CMS authorization limits, the public-branch privacy warning, the new evidence ID, and the ads-off/Google-only boundary.

- [ ] **Step 2: Run and observe the expected failure**

```text
npm test -- --run tests/unit/publication-operations.test.ts
```

Expected: FAIL because `DESIGN.md` still contains the blanket motion prohibition and evidence docs name only the prior release.

- [ ] **Step 3: Update the finished documentation**

Replace only the obsolete blanket motion restriction. Preserve the no-script, no-tracking, no-ad, no-invented-identity, static rendering, human-review, and Blogger boundaries. Record Pages CMS defaults accurately: this repository disables rename/delete explicitly; hosted owner-only facts remain unverified.

- [ ] **Step 4: Verify and commit**

```text
npm test -- --run tests/unit/publication-operations.test.ts
npm run format:check
git add DESIGN.md README.md docs/TECHNICAL_QA.md docs/PUBLISHING_GUIDE.md tests/unit/publication-operations.test.ts
git commit -m "docs(design): record native motion and CMS boundaries"
```

### Task 5: Visual review, full QA, and local release evidence

**Files:**

- Update through Playwright: current platform visual baselines only when the reviewed change is intentional.
- Create through capture command: `artifacts/site-audit/after/premium-spatial-2026-08-26/local/`

- [ ] **Step 1: Run focused and visual checks**

Run all explicit commands from the brief. Do not infer one stage from another:

```text
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
npm run test:visual
npm run lighthouse
```

- [ ] **Step 2: Inspect the rendered matrix**

Inspect homepage, all guides, categories, every category, one article per category, Toolkit, every Toolkit detail, trust/legal pages, sitemap, 404, mobile menu, keyboard focus, and reduced motion across the eight widths. Fix visible imbalance before acceptance.

- [ ] **Step 3: Run the full release gate**

```text
npm run qa
git status --short
```

Expected: all automated gates pass; any owner/editorial external gate remains reported, not rewritten as a pass.

- [ ] **Step 4: Serve the built output and capture after-local evidence**

Serve `dist` at `http://127.0.0.1:4321`, then run:

```powershell
$premiumReleaseSha = (git rev-parse HEAD).Trim()
npm run capture:production -- --origin http://127.0.0.1:4321 --phase after-local --expected-sha $premiumReleaseSha
```

The exact SHA is resolved immediately before execution. The manifest must contain the complete eight-width matrix, correct statuses, unique hashes, and passing CMS/monetization absence assertions.

- [ ] **Step 5: Commit reviewed release evidence**

```text
git add artifacts/site-audit/after/premium-spatial-2026-08-26/local tests/e2e/__screenshots__
git commit -m "test(visual): record premium spatial release"
```

### Task 6: Push GitHub, deploy Vercel, and verify exact production

**Files:**

- Create through capture command: `artifacts/site-audit/after/premium-spatial-2026-08-26/production/`
- Create ignored final verification: `artifacts/site-audit/runtime-verification/premium-spatial-2026-08-26-final/`

- [ ] **Step 1: Establish and push the exact candidate**

```text
git status --short
git rev-parse HEAD
git push origin main
git ls-remote origin refs/heads/main
```

Expected: clean tree and identical local/remote full SHA.

- [ ] **Step 2: Deploy the pushed source to production**

Use the linked Vercel project and a noninteractive production deployment. Record deployment ID, source SHA, READY state, and canonical alias. Stop on a dirty tree, source-SHA mismatch, build failure, or alias failure.

- [ ] **Step 3: Run exact-SHA production smoke and capture**

```powershell
$premiumReleaseSha = (git rev-parse HEAD).Trim()
$premiumDeploymentMetadata = Get-Content -LiteralPath '.vercel\deployment-metadata.json' -Raw | ConvertFrom-Json
$premiumDeploymentId = $premiumDeploymentMetadata.id
npm run check:production -- --origin https://everyday-tech-insight.vercel.app --expected-sha $premiumReleaseSha --deployment-metadata .vercel\deployment-metadata.json
npm run capture:production -- --origin https://everyday-tech-insight.vercel.app --phase after-production --expected-sha $premiumReleaseSha --deployment-id $premiumDeploymentId
```

Expected: all routes/assets, security, metadata, CMS absence, monetization off, deployment state, and Git SHA pass; production screenshots match the reviewed local design.

- [ ] **Step 4: Commit production evidence, push, redeploy, and close the evidence loop**

Commit only production evidence, push it, and redeploy the final GitHub HEAD. Then run smoke and the ignored runtime-verification capture against that final SHA. Classify the committed screenshots as runtime-equivalent only if the intervening commit changes deployment-excluded evidence and final runtime results match.

- [ ] **Step 5: Final handoff**

Report the before and after commits, verified live link, Pages CMS configured-versus-hosted boundary, selected/rejected motion technologies, exact Toolkit fix, test/Lighthouse results, screenshot paths, final GitHub/Vercel SHA parity, and all remaining owner/external gates. State plainly that Google alone decides AdSense approval.

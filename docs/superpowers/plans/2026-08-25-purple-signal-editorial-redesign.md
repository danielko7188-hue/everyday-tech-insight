# Purple Signal Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task, with superpowers:test-driven-development for every behavior change.

**Goal:** Replace the beige/orange interface with the approved Purple Signal Editorial system and make every publication surface explain what a guide helps the reader do and produce.

**Architecture:** Keep Astro static rendering, the existing five-category information architecture, and the 15 distinct explanatory visuals. Establish one tested token layer in `global.css`, one type-safe category/visual mapping, and explicit `lead | feature | standard | compact | list` story treatments. Typography, rules, alignment, and whitespace carry hierarchy; violet and magenta remain structural signals rather than decoration.

**Tech stack:** Astro 7, TypeScript 6, CSS custom properties, local Source Sans 3 and Newsreader fonts, deterministic SVG/social-image generation, Vitest, Playwright, axe.

---

## File responsibility map

- `src/styles/global.css`: authoritative brand tokens, component states, page compositions, responsive and reduced-motion rules.
- `src/data/categories.ts`: accessible category accent family and category copy.
- `src/components/PublicationMark.astro`: original ETI signal-bar mark plus full publication name.
- `src/components/Header.astro` and `Footer.astro`: masthead, navigation state, mobile menu, and publication footer.
- `src/components/ArticleCard.astro`: five explicit editorial story treatments.
- `src/components/EditorialVisual*.astro`: 15 distinct, informative story diagrams and decorative category motifs.
- `src/layouts/ArticleLayout.astro`: evidence-first article hero and reading system.
- `src/layouts/ToolkitDetailLayout.astro` and `TrustPageLayout.astro`: restrained task and trust shells.
- `public/favicon.svg`, `public/apple-touch-icon.png`, `public/manifest.webmanifest`, `public/social/*.png`: deterministic Purple Signal identity assets.
- `tests/unit/brand-system.test.ts`: tokens, contrast, focus context, and prohibited pairings.
- `tests/e2e/*`: public meaning, accessibility, responsive geometry, and intentional visual baselines.

### Task 1: Lock the Purple Signal token and contrast contract

**Files:**

- Create: `tests/unit/brand-system.test.ts`
- Modify: `src/styles/global.css`
- Modify: `src/data/categories.ts`
- Modify: `tests/unit/site-config.test.ts`

- [ ] **Step 1: Write the failing token tests**

Parse `global.css` and require every token in the approved design spec. Add a deterministic WCAG relative-luminance helper and assert the measured foreground/background pairs. Explicitly reject white normal text on magenta or the full gradient, yellow focus on paper, and decorative rule colors as meaningful control boundaries.

```ts
expect(contrast("#ffffff", "#0d0618")).toBeGreaterThanOrEqual(7);
expect(contrast("#171221", "#d946ef")).toBeGreaterThanOrEqual(4.5);
expect(contrast("#ffffff", "#d946ef")).toBeLessThan(4.5);
expect(contrast("#fde047", "#faf8ff")).toBeLessThan(3);
```

- [ ] **Step 2: Confirm the red state**

Run: `npm test -- --run tests/unit/brand-system.test.ts tests/unit/site-config.test.ts`  
Expected: FAIL because the existing palette and focus contexts are beige/orange.

- [ ] **Step 3: Implement exact tokens and global primitives**

Replace the old palette at the source. Keep Source Sans 3 for UI/body and Newsreader for editorial headlines. Define contextual focus, meaningful boundary, paper/mist/night surfaces, restrained radii, rules, selection, table, figure, error/success, and reduced-motion primitives. Do not mass-replace category or diagram colors without checking their semantic use.

- [ ] **Step 4: Verify and commit**

Run: `npm run format:check && npm test -- --run tests/unit/brand-system.test.ts tests/unit/site-config.test.ts`  
Expected: PASS.

```text
git add src/styles/global.css src/data/categories.ts tests/unit/brand-system.test.ts tests/unit/site-config.test.ts
git commit -m "feat(brand): establish Purple Signal design tokens"
```

### Task 2: Rebuild the publication identity and navigation

**Files:**

- Modify: `src/components/PublicationMark.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Add failing semantic and keyboard tests**

Require the full `Everyday Tech Insight` name, a secondary ETI tile, Guides/Toolkit/About desktop row, five-topic row, a 44px mobile Menu/Close control, `aria-current` plus visible underline, keyboard open/close, no scroll leak, and contextual focus on both dark and light surfaces.

- [ ] **Step 2: Run the focused red tests**

Run: `npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/accessibility.spec.ts --project=chromium --grep "masthead|menu|navigation|focus"`  
Expected: FAIL on the new identity/state contract.

- [ ] **Step 3: Implement the two-row desktop and compact mobile masthead**

Use semantic `nav`, native disclosure behavior where appropriate, explicit labels, and no full-screen animation or remote runtime. Keep the current path visible through text decoration/weight as well as color. Build the footer from truthful existing routes only; do not add social profiles.

- [ ] **Step 4: Verify and commit**

Run the focused tests at 390, 768, and 1440px, then commit.

```text
git add src/components/PublicationMark.astro src/components/Header.astro src/components/Footer.astro src/layouts/BaseLayout.astro src/styles/global.css tests/e2e
git commit -m "feat(brand): rebuild the Purple Signal publication shell"
```

### Task 3: Make story treatments explain reader value

**Files:**

- Modify: `src/components/ArticleCard.astro`
- Modify: `src/components/StoryMeta.astro`
- Modify: `src/utils/presentation.ts`
- Modify: `tests/unit/presentation.test.ts`
- Modify: `tests/e2e/public-routes.spec.ts`

- [ ] **Step 1: Write failing variant-contract tests**

Require:

- `lead`: promise, deliverable under `What you will produce`, date, and time;
- `feature`: promise and selective metadata;
- `standard`: visual, promise, date, and time;
- `compact`: title, promise, time, optional thumbnail, no deliverable;
- `list`: topic/date, title, promise, time, no default card box or deliverable.

Ensure `summary` remains metadata/RSS copy rather than silently substituting for `guidePromise`.

- [ ] **Step 2: Confirm failure and implement**

Run: `npm test -- --run tests/unit/presentation.test.ts && npx playwright test tests/e2e/public-routes.spec.ts --project=chromium --grep "story treatment"`  
Expected: FAIL before component changes, then PASS.

- [ ] **Step 3: Commit**

```text
git add src/components/ArticleCard.astro src/components/StoryMeta.astro src/utils/presentation.ts tests/unit/presentation.test.ts tests/e2e/public-routes.spec.ts
git commit -m "feat(editorial): explain guide value across story treatments"
```

### Task 4: Implement home, archive, and topic compositions

**Files:**

- Modify: `src/pages/index.astro`
- Modify: `src/pages/articles/index.astro`
- Modify: `src/pages/categories/index.astro`
- Modify: `src/pages/categories/[slug].astro`
- Modify: `src/components/SectionHeading.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: Add failing public-inventory and geometry tests**

Home must expose one dominant lead, two support stories, a typographic latest rail, five topics, and nine distinct guide links. Archive must contain all 15 published guides exactly once with a static topic jump and all promises. Categories directory must expose five topics. Each category page must show exactly its three guides with no manufactured featured hierarchy.

- [ ] **Step 2: Run red tests**

Run: `npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts --project=chromium --grep "home|archive|categor"`  
Expected: FAIL on the approved composition and promise rendering.

- [ ] **Step 3: Implement selected sketch decisions**

Build the dark 5/7 homepage opening, compact editorial rail, and pale-lavender topic entries. Keep all content in semantic source order and avoid duplicated mobile/desktop DOM. Use list/rule hierarchy rather than equal rounded card grids.

- [ ] **Step 4: Verify and commit in two reviewable units**

```text
git add src/pages/index.astro src/components/SectionHeading.astro src/styles/global.css tests/e2e
git commit -m "feat(ui): ship the Purple Signal homepage"

git add src/pages/articles/index.astro src/pages/categories src/components/ArticleCard.astro src/styles/global.css tests/e2e
git commit -m "feat(ui): add editorial guide and topic rails"
```

### Task 5: Implement the evidence-first reading system

**Files:**

- Modify: `src/layouts/ArticleLayout.astro`
- Modify: `src/components/ArticleEvidence.astro`
- Modify: `src/components/FitSummary.astro`
- Modify: `src/components/TableOfContents.astro`
- Modify: `src/components/SourceList.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Add failing article-structure tests**

Require one H1; category/type; guide promise; publication byline; genuine dates/time; `When to use`; one At a Glance region with four named fields including `What you will produce`; one TOC; 44rem reading measure; underlined prose links; accessible tables/figures; source list; concise byline disclosure; and related published guides only.

At a Glance must be 4 columns only when space permits, 2×2 at tablet, and 1 column at mobile. TOC may be sticky only at sufficiently tall/wide viewports and must not obscure content at 200% zoom.

- [ ] **Step 2: Run red tests and implement**

Run: `npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts tests/e2e/accessibility.spec.ts --project=chromium --grep "article|glance|contents|table|figure"`  
Expected: FAIL, then PASS after the 7/5 hero and reading system are implemented.

- [ ] **Step 3: Commit**

```text
git add src/layouts/ArticleLayout.astro src/components/ArticleEvidence.astro src/components/FitSummary.astro src/components/TableOfContents.astro src/components/SourceList.astro src/styles/global.css tests/e2e
git commit -m "feat(ui): implement evidence-first guide reading"
```

### Task 6: Restyle Toolkit, trust surfaces, and 404 without adding claims

**Files:**

- Modify: `src/pages/toolkit.astro`
- Modify: `src/layouts/ToolkitDetailLayout.astro`
- Modify: `src/components/ToolkitCard.astro`
- Modify: `src/layouts/TrustPageLayout.astro`
- Modify: `src/pages/404.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/public-routes.spec.ts`

- [ ] **Step 1: Add failing surface tests**

Require four Toolkit resources, purpose, record produced, related guide, format/details/download, limitations, data-handling notes, and no advertising adjacency. Trust pages remain factual and light. 404 exposes Home, Guides, and Topics with no search fiction or ad gap.

- [ ] **Step 2: Implement and verify**

Run: `npx playwright test tests/e2e/public-routes.spec.ts --project=chromium --grep "Toolkit|trust|404"`  
Expected: PASS with zero third-party request and no invented fact.

- [ ] **Step 3: Commit**

```text
git add src/pages/toolkit.astro src/layouts/ToolkitDetailLayout.astro src/components/ToolkitCard.astro src/layouts/TrustPageLayout.astro src/pages/404.astro src/styles/global.css tests/e2e/public-routes.spec.ts
git commit -m "feat(ui): mature Toolkit and publication trust surfaces"
```

### Task 7: Rework diagrams and generated identity assets

**Files:**

- Modify: `src/components/EditorialVisual.astro`
- Modify: `src/components/EditorialVisualSymbols.astro`
- Create: `tests/unit/editorial-visuals.test.ts`
- Modify: `scripts/generate-social-images.mjs`
- Modify: `tests/unit/social-images.test.ts`
- Modify: `public/favicon.svg`
- Modify: `public/manifest.webmanifest`
- Regenerate: `public/apple-touch-icon.png`
- Regenerate: `public/social/*.png`

- [ ] **Step 1: Write failing diagram/asset tests**

Require 15 recognized and structurally distinct article symbols, exact key/type pairing, one informative accessible name/description per article visual, decorative category fallbacks, non-color labels/shapes, meaningful boundaries at 3:1, no old orange/beige palette, 1200×630 social assets, and Purple Signal favicon/manifest colors.

- [ ] **Step 2: Confirm red state**

Run: `npm test -- --run tests/unit/editorial-visuals.test.ts tests/unit/social-images.test.ts`  
Expected: FAIL on palette and new mapping assertions.

- [ ] **Step 3: Implement, regenerate, inspect, and commit**

Run: `npm run generate:social && npm test -- --run tests/unit/editorial-visuals.test.ts tests/unit/social-images.test.ts`  
Visually inspect a representative article visual, each category social image, default social image, favicon, and touch icon before committing.

```text
git add src/components/EditorialVisual.astro src/components/EditorialVisualSymbols.astro scripts/generate-social-images.mjs tests/unit/editorial-visuals.test.ts tests/unit/social-images.test.ts public
git commit -m "feat(visuals): restyle explanatory diagrams and identity assets"
```

### Task 8: Expand responsive, accessibility, and visual regression coverage

**Files:**

- Modify: `tests/e2e/responsive.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Modify: `tests/e2e/visual-regression.spec.ts`
- Modify: `playwright.config.ts`
- Regenerate after review: `tests/e2e/__screenshots__/visual-regression.spec.ts/*`
- Modify: `DESIGN.md`

- [ ] **Step 1: Add failing functional coverage**

Use 320, 360, 390, 768, 1024, 1280, 1440, and 1920px functional widths. Cover 200% zoom, reflow, unique IDs, landmarks, headings, 44px controls, Menu/Close, active state beyond color, contextual focus, short-viewport TOC, reduced motion, tables/figures, no clipped words, no horizontal overflow, no duplicated responsive content, and no unexpected third-party request.

- [ ] **Step 2: Add the exact five-width visual matrix**

Use the 18 routes and interaction states locked in the design spec. Generate Windows baselines only after all functional tests pass; Linux baselines are updated in the Linux/CI environment or by an explicit platform-aware deterministic generation pass. Never hide a mismatch with a broad pixel threshold.

- [ ] **Step 3: Run and review every diff**

```text
npx playwright test tests/e2e/accessibility.spec.ts tests/e2e/responsive.spec.ts --project=chromium
npx playwright test tests/e2e/visual-regression.spec.ts --project=visual-chromium --update-snapshots
npm run test:visual
```

Expected: PASS after intentional baselines are visually reviewed.

- [ ] **Step 4: Update design documentation and commit**

```text
git add tests/e2e playwright.config.ts DESIGN.md
git commit -m "test(ui): lock Purple Signal publication behavior"
```

## Plan self-review

- Spec coverage: mark, masthead, palette, contrast/focus contexts, story treatments, all page families, 15 distinct visuals, Toolkit/trust boundary, responsive behavior, and visual baselines map to explicit tasks.
- Evidence boundary: the plan changes no owner identity, source fact, ad status, CMS authorization, or human-review result.
- Placeholder scan: no unscoped design decision remains; exact tokens, routes, widths, treatments, and tests are named.
- Rollback: each task is an atomic commit; the pre-redesign source point remains `6473acaa64c64a64de6d3d1e6900cdad9a52d06c`.

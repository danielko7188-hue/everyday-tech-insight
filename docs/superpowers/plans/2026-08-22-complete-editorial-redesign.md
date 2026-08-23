# Complete Editorial Redesign Implementation Plan

> **Historical plan:** Retained as implementation history and superseded by the publication-maturity plan. Current behavior is documented in `README.md`, `DESIGN.md`, and `docs/TECHNICAL_QA.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain, repetitive visual system with the approved Signal & Structure editorial publication design while preserving every truthful content, route, metadata, privacy, and monetization boundary.

**Architecture:** Keep Astro static generation and the content collection as the source of truth. Add small server-rendered presentation components and pure utilities, build all art as local inline SVG/CSS, use native HTML for the mobile menu and table of contents, and centralize the complete visual system in CSS custom properties. No hydration or third-party runtime is required.

**Tech Stack:** Astro 7, strict TypeScript, Astro Content Collections, CSS custom properties/Grid, Vitest, Playwright, axe-core, Lighthouse, Vercel.

---

## File structure

- Create `DESIGN.md`: durable design-system source of truth and font/asset license record.
- Create `src/components/PublicationMark.astro`: accessible wordmark treatment.
- Create `src/components/EditorialVisual.astro`: deterministic five-topic inline SVG system.
- Create `src/components/StoryMeta.astro`: shared type/category/date/reading-time metadata.
- Create `src/components/SectionHeading.astro`: consistent editorial section heading/link.
- Create `src/components/TableOfContents.astro`: desktop and native mobile heading navigation.
- Create `src/components/TrustModule.astro`: homepage transparency summary.
- Create `src/components/AdSlot.astro`: disabled-by-config future slot boundary.
- Create `src/utils/presentation.ts`: reading-time and deterministic visual-variant helpers.
- Modify `src/components/ArticleCard.astro`: lead/feature/standard/compact/list variants.
- Modify `src/components/Header.astro`, `Footer.astro`, `FitSummary.astro`, `SourceList.astro`, and `CategoryNav.astro`: publication-grade shared chrome and semantics.
- Modify `src/layouts/BaseLayout.astro` and `ArticleLayout.astro`: font loading, masthead route context, article hierarchy, TOC, and related content.
- Modify `src/pages/index.astro`, `src/pages/categories/index.astro`, and `src/pages/categories/[slug].astro`: editorial compositions.
- Modify supporting pages only where a shared class/structure is needed; preserve their factual copy.
- Replace `src/styles/global.css`: tokenized responsive editorial system.
- Modify `public/favicon.svg`: new ETI mark.
- Modify tests under `tests/unit` and `tests/e2e`: new behavior and visual-contract coverage.

### Task 1: Record the approved system and add failing utility tests

**Files:**

- Create: `DESIGN.md`
- Create: `tests/unit/presentation.test.ts`
- Test: `tests/unit/presentation.test.ts`

- [ ] **Step 1: Write tests that import `estimateReadingTime` and `visualVariantForSlug` from the not-yet-created `src/utils/presentation.ts`.** Assert 0 words returns 1 minute, 225 words returns 1 minute, 226 words returns 2 minutes, Markdown punctuation does not inflate the count, and the same slug always returns an integer in the requested variant range.
- [ ] **Step 2: Run `npm test -- --run tests/unit/presentation.test.ts`.** Expected: FAIL because `src/utils/presentation.ts` does not exist.
- [ ] **Step 3: Write `DESIGN.md` from the approved spec, including exact fonts, colors, spacing, layout, motion, responsive behavior, asset strategy, and OFL-1.1 package licenses.**
- [ ] **Step 4: Commit with `docs: define editorial redesign system` after the spec and plan have passed completeness and consistency scans.**

### Task 2: Implement presentation utilities and core primitives

**Files:**

- Create: `src/utils/presentation.ts`
- Create: `src/components/PublicationMark.astro`
- Create: `src/components/EditorialVisual.astro`
- Create: `src/components/StoryMeta.astro`
- Create: `src/components/SectionHeading.astro`
- Create: `src/components/AdSlot.astro`
- Modify: `public/favicon.svg`

- [ ] **Step 1: Implement `estimateReadingTime(markdown, wordsPerMinute = 225)` with stripped Markdown syntax and a one-minute minimum; implement a stable string hash and modulo range for `visualVariantForSlug`.**
- [ ] **Step 2: Run `npm test -- --run tests/unit/presentation.test.ts`.** Expected: PASS.
- [ ] **Step 3: Build the mark, shared metadata, section heading, config-gated ad slot, and five-category decorative SVG grammars.** Every component must have typed props, no client script, and no remote asset.
- [ ] **Step 4: Run `npm run typecheck` and fix only implementation defects.** Expected: zero Astro diagnostics.

### Task 3: Add failing rendered-page contracts

**Files:**

- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Add homepage assertions for a single lead story, two or three secondary stories, a latest briefing region, five topic sections, trust module, and at least three distinct card variants.**
- [ ] **Step 2: Add article assertions for reading time, Business Technology Fit, a generated TOC linked to real heading IDs, editorial visual, sources, truthful byline, and explicitly related guides.**
- [ ] **Step 3: Add mobile keyboard assertions for the native menu at 360/390px and overflow tests for 360, 390, 768, 1024, 1280, 1440, and 1920px.**
- [ ] **Step 4: Run the focused Playwright tests against the existing build.** Expected: FAIL on the newly required components/regions, proving the redesign contract is active.

### Task 4: Rebuild publication chrome and story components

**Files:**

- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/components/ArticleCard.astro`
- Modify: `src/components/FitSummary.astro`
- Modify: `src/components/SourceList.astro`
- Modify: `src/components/CategoryNav.astro`
- Create: `src/components/TableOfContents.astro`
- Create: `src/components/TrustModule.astro`

- [ ] **Step 1: Replace the utility header with the two-level masthead and native mobile menu, passing the current pathname for `aria-current`.**
- [ ] **Step 2: Add typed card variants and metadata/art composition without changing content destinations.**
- [ ] **Step 3: Rework fit, sources, related navigation, TOC, trust, and grouped footer semantics.**
- [ ] **Step 4: Run `npm run typecheck` and `npm run lint`.** Expected: no errors.

### Task 5: Recompose homepage and category routes

**Files:**

- Modify: `src/pages/index.astro`
- Modify: `src/pages/categories/index.astro`
- Modify: `src/pages/categories/[slug].astro`

- [ ] **Step 1: Derive lead, secondary, briefing, featured, topic, and latest sets deterministically from published collection data; preserve links to all five categories and every category's full article set.**
- [ ] **Step 2: Build the asymmetric lead grid, briefing strip, Start Here module, varied topic modules, compact latest feed, and trust module.**
- [ ] **Step 3: Build category lead/support/list compositions using the real category accent and complete membership.**
- [ ] **Step 4: Run `npm run build && npm run check:content && npm run check:seo`.** Expected: the existing public route set builds with no content or SEO finding.

### Task 6: Rebuild article reading experience

**Files:**

- Modify: `src/pages/articles/[slug].astro`
- Modify: `src/layouts/ArticleLayout.astro`

- [ ] **Step 1: Use Astro render headings and raw article body to compute a genuine TOC and estimated reading time.**
- [ ] **Step 2: Build the art-directed header, metadata, fit module, sticky/collapsible TOC, readable body, sources, byline boundary, related content, and correction footer.**
- [ ] **Step 3: Preserve BreadcrumbList output and omit unsupported person/organization/article entity claims.**
- [ ] **Step 4: Run the focused article Playwright tests.** Expected: PASS.

### Task 7: Apply the complete responsive visual system

**Files:**

- Replace: `src/styles/global.css`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install exact OFL-1.1 variable-font packages and import only the required upright variable CSS.**
- [ ] **Step 2: Implement the full token system, masthead, modular homepage, story variants, category art direction, article reading grid, trust pages, footer, focus treatment, native menu states, and reduced-motion behavior.**
- [ ] **Step 3: Verify no component uses a generic universal rounded card, gradient, remote image, tracking request, or fake function.**
- [ ] **Step 4: Run `npm run format && npm run lint && npm run typecheck && npm run test -- --run && npm run build`.** Expected: all pass.

### Task 8: Responsive, accessibility, performance, and art-direction polish

**Files:**

- Modify as findings require: `src/styles/global.css`, affected components/pages, and a reproducing test.
- Generate (ignored QA artifacts): desktop/mobile screenshots and Lighthouse reports.

- [ ] **Step 1: Run `npm run check:content`, `npm run check:seo`, `npm run check:links`, and focused route checks.**
- [ ] **Step 2: Run Playwright/axe across the required routes and viewports, inspect console/network failures, and add a failing regression test before each defect fix.**
- [ ] **Step 3: Capture 1440px desktop and 390px mobile screenshots for the homepage, one category, and one article; inspect hierarchy, whitespace, stacking, ratios, and rhythm.**
- [ ] **Step 4: Run Lighthouse and meet project thresholds of performance 90+, accessibility/best-practices/SEO 95+ on all representative routes.**
- [ ] **Step 5: Run `npm run qa` as the authoritative local release gate.** Expected: complete pass with no weakened validator.

### Task 9: GitHub then Vercel release

**Files:**

- No source changes unless production verification reveals a reproduced defect.

- [ ] **Step 1: Confirm the worktree is clean after commits, scan the staged/committed diff for secrets and generated QA artifacts, and verify the remote repository URL.**
- [ ] **Step 2: Push the final commit to GitHub `main` first and confirm remote `main` resolves to the same commit SHA.**
- [ ] **Step 3: Deploy that committed tree to the linked Vercel production project only after the GitHub confirmation.**
- [ ] **Step 4: Verify production homepage, categories index, all five categories, a representative article, every trust/legal page, sitemap, RSS, robots, and a nonexistent URL. Confirm status codes, metadata, navigation, no console errors, no ad/tracking code, and correct mobile menu behavior.**
- [ ] **Step 5: Compare representative production artifacts with the local build and report the exact live URL, GitHub URL, commit, deployment, QA evidence, screenshots, and remaining human/AdSense limitations.**

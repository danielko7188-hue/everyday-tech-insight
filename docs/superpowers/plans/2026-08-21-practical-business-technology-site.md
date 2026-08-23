# Practical Business Technology Site Implementation Plan

> **Historical plan:** Retained as implementation history and superseded by the publication-maturity plan. Current behavior is documented in `README.md`, `DESIGN.md`, and `docs/TECHNICAL_QA.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, verify, publish to GitHub, and deploy a source-backed Practical Business Technology publication under the Everyday Tech Insight brand.

**Architecture:** A new isolated Astro 7 static site uses typed content collections and fully generated HTML. Public routes are derived only from `published` content; custom validation inspects both content metadata and the built output. The existing Blogger workspace remains untouched and excluded from Git/Vercel.

**Tech Stack:** Astro 7, TypeScript 7, Astro content collections, vanilla CSS, Vitest, ESLint, Playwright, axe, Lighthouse CI, GitHub, Vercel.

---

### Task 1: Foundation and failing contracts

**Files:**

- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `vercel.json`
- Create: `src/content.config.ts`, `src/data/site.ts`, `src/data/categories.ts`
- Create: `tests/unit/content-contract.test.ts`, `tests/unit/site-config.test.ts`

- [ ] Write unit tests requiring five exact categories, a non-placeholder production identity, disabled monetization, valid status/date/source fields, and a five-part topic-fit contract.
- [ ] Run `npm test -- --run` and confirm the tests fail because the configuration and validators do not exist.
- [ ] Add the smallest typed configuration and validation utilities that satisfy the contracts.
- [ ] Run the unit suite and confirm it passes.
- [ ] Add scripts for `dev`, `build`, `preview`, `format`, `lint`, `typecheck`, `test`, `test:e2e`, `check:links`, `check:content`, `check:seo`, `lighthouse`, and `qa`.
- [ ] Commit the foundation.

### Task 2: Public architecture and design system

**Files:**

- Create: `src/layouts/BaseLayout.astro`, `src/layouts/ArticleLayout.astro`
- Create: `src/components/Header.astro`, `Footer.astro`, `Breadcrumbs.astro`, `ArticleCard.astro`, `CategoryNav.astro`, `SourceList.astro`, `FitSummary.astro`
- Create: `src/styles/global.css`
- Create: route files under `src/pages/`
- Create: `public/favicon.svg`, `public/robots.txt`
- Create: `tests/e2e/public-routes.spec.ts`, `tests/e2e/accessibility.spec.ts`

- [ ] Write Playwright contracts for the homepage, one category, one article, a trust page, keyboard focus, mobile overflow, and a real 404.
- [ ] Run the focused E2E suite against an intentionally incomplete build and record the expected failures.
- [ ] Implement the shared shell, metadata, WebSite/Breadcrumb JSON-LD, five category routes, article generation, trust routes, RSS, HTML sitemap, and 404.
- [ ] Implement the approved editorial visual system with semantic landmarks, visible focus, reduced motion, readable measures, and no JS-dependent primary content.
- [ ] Build and run the focused E2E suite until it passes.
- [ ] Commit the public architecture.

### Task 3: Fifteen source-backed articles and editorial records

**Files:**

- Create: `src/content/articles/*.md` (15 published entries)
- Create: `docs/CONTENT_PLAN.md`, `docs/POLICY_SOURCE_LOG.md`, `docs/CONTENT_AUDIT.md`
- Create: `docs/HUMAN_REVIEW_CHECKLIST.md`, `docs/PRIVACY_AND_CONSENT_REVIEW.md`

- [ ] Add failing content tests requiring three articles per category, fifteen distinct slugs/titles/descriptions, real 2026-08-21 dates, primary-source URLs, and all five topic-fit fields.
- [ ] Run the content tests and record the expected count/coverage failures.
- [ ] Research and draft three practical articles per category using current official or primary sources and no first-hand claims.
- [ ] Apply the topic-fit and duplication review; keep any weak entry out of `published` status.
- [ ] Write the content plan, source log, audit, privacy boundary, and unchecked human review gate.
- [ ] Run content tests until they pass.
- [ ] Commit the content portfolio.

### Task 4: Built-output QA, documentation, and performance

**Files:**

- Create: `scripts/qa-content.mjs`, `scripts/qa-build.mjs`, `scripts/check-external-links.mjs`
- Create: `tests/unit/qa-rules.test.ts`
- Create: `docs/TECHNICAL_QA.md`, `docs/DEPLOYMENT_GUIDE.md`, `docs/ASSUMPTIONS.md`, `README.md`, `AGENTS.md`
- Modify: route/content files only when QA exposes a defect

- [ ] Write failing tests for duplicate metadata, missing H1/canonical/robots/Open Graph, broken internal links, draft leakage, placeholder text, AdSense/analytics identifiers, and sitemap/feed membership.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Implement the built-output validators and external-source checker.
- [ ] Run format, lint, typecheck, unit, build, content, SEO, link, E2E, and axe checks; fix every failure through a failing regression test where applicable.
- [ ] Run Lighthouse on the homepage, one category, and one article; record exact results or a tooling limitation.
- [ ] Complete the README, deployment guide, assumptions, technical QA, and durable repository guidance.
- [ ] Commit QA and documentation.

### Task 5: Independent review, GitHub release, and Vercel production

**Files:**

- Modify only files required to close review findings
- Vercel writes ignored `.vercel/` linkage metadata locally

- [ ] Perform independent specification review, then independent code/content/security/accessibility review; fix all critical and important findings.
- [ ] Run the full `npm run qa` plus production build from a clean working tree and record exact output.
- [ ] Scan tracked files and Git history for private Blogger artifacts, tokens, publisher IDs, placeholder secrets, and personal data not intended for publication.
- [ ] Merge the verified feature branch to `main` and rerun the full QA suite.
- [ ] Create the GitHub repository, push `main`, and confirm the remote commit matches local `HEAD`.
- [ ] Link the Vercel project to the GitHub repository, deploy the pushed commit to production, and confirm the production hostname.
- [ ] If the hostname differs from the configured canonical, update the configuration, repeat full QA, push the correction, and redeploy.
- [ ] Verify production HTTP status, canonical metadata, robots, sitemap, RSS, representative routes, and absence of deployment errors.
- [ ] Report the truthful AdSense boundary: disabled, no publisher ID added, no review requested, and Google alone decides approval.

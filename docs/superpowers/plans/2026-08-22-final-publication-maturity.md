# Final Publication Maturity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Everyday Tech Insight into a curated, scalable, distinctive static publication while preserving every factual, privacy, security, accessibility, and no-tracking boundary.

**Architecture:** Keep Astro static generation and the existing article content collection. Add typed data modules for Toolkit resources and article visual concepts, one supporting-page layout, a reader-facing archive, deterministic local social-image generation, and reusable built-output/production checks. Server-render one semantic copy of all article content and use CSS for responsive presentation.

**Tech Stack:** Astro 7, TypeScript, Zod, static HTML/CSS, inline local SVG, Sharp for build-time PNG generation, Vitest, Cheerio, Playwright, axe-core, Lighthouse, Vercel.

---

### Task 1: Record production truth and regression contracts

**Files:**

- Create: `scripts/check-production.mjs`
- Create: `tests/unit/production-smoke.test.ts`
- Modify: `package.json`
- Create: `artifacts/site-audit/before/README.md`
- Test: `tests/unit/production-smoke.test.ts`

- [ ] **Step 1: Write failing production-smoke unit tests**

Add fixtures that assert `inspectHtml()` rejects redirects, zero/two H1s,
missing header/footer signatures, a mismatched canonical origin, missing title or
description, an old `Current issue` shell signature, repeated `At a glance`,
repeated `On this page`, duplicate IDs, and broken root-relative assets.

```ts
expect(inspectHtml(validHtml, route, origin).problems).toEqual([]);
expect(
  inspectHtml(validHtml.replace("<h1>", "<h1></h1><h1>"), route, origin)
    .problems,
).toContain("expected exactly one H1; found 2");
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm run test -- --run tests/unit/production-smoke.test.ts`

Expected: FAIL because `scripts/check-production.mjs` does not exist.

- [ ] **Step 3: Implement the reusable smoke checker**

Export pure `inspectHtml`, `collectInternalAssets`, and `normalizeOrigin`
helpers. The CLI accepts `--origin https://host.example` or
`PRODUCTION_ORIGIN`, requests the required public routes without automatic
redirect following, checks response status/content, and prints one PASS/FAIL
line per route plus a summary. Use the masthead link accessible name `Everyday
Tech Insight home` and footer headings `Publication`, `Topics`, `Standards &
transparency`, and `Legal & feeds` as current shell signatures.

```js
const origin = normalizeOrigin(
  readFlag("--origin") ?? process.env.PRODUCTION_ORIGIN,
);
const response = await fetch(new URL(route.path, origin), {
  redirect: "manual",
});
```

- [ ] **Step 4: Add the command and document before evidence**

Add `"check:production": "node scripts/check-production.mjs"`. Record commit
`dc4a4bd`, capture date `2026-08-22`, 390/768/1440 widths, the eight audited
routes, exact live/local HTML parity, the duplicated Fit/TOC defect, homepage
inventory problem, Toolkit mobile table problem, and the article Lighthouse
baseline of 89.

- [ ] **Step 5: Run GREEN verification and commit**

Run: `npm run test -- --run tests/unit/production-smoke.test.ts`

Expected: PASS.

Commit: `test: add production truth smoke checks`

### Task 2: Remove semantic duplication and unify supporting-page shells

**Files:**

- Modify: `src/components/FitSummary.astro`
- Modify: `src/components/TableOfContents.astro`
- Create: `src/layouts/TrustPageLayout.astro`
- Create: `src/data/trust-pages.ts`
- Modify: `src/pages/about.astro`
- Modify: `src/pages/publisher.astro`
- Modify: `src/pages/editorial-standards.astro`
- Modify: `src/pages/corrections.astro`
- Modify: `src/pages/contact.astro`
- Modify: `src/pages/privacy.astro`
- Modify: `src/pages/advertising-disclosure.astro`
- Modify: `src/pages/404.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Test: `tests/unit/qa-rules.test.ts`

- [ ] **Step 1: Write failing built-output and browser assertions**

Assert every article output has exactly one `.fit-summary`, one `At a glance`,
one `nav[aria-label='On this page']`, no desktop/mobile duplicate classes, one
TOC link per article heading ID, and globally unique IDs. Assert all trust pages
contain `.trust-page`, `.trust-page__intro`, and the same related-page nav.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm run test -- --run tests/unit/qa-rules.test.ts && npm run test:e2e -- tests/e2e/public-routes.spec.ts tests/e2e/accessibility.spec.ts`

Expected: FAIL on duplicate Fit/TOC output and missing shared trust shell.

- [ ] **Step 3: Refactor Fit and TOC to one semantic copy**

`FitSummary.astro` renders one section/heading/dl. `TableOfContents.astro`
renders one nav/visible label/list. CSS controls compact mobile layout and
desktop sticky placement; do not add client JavaScript.

```astro
<section class="fit-summary" aria-labelledby="fit-heading">
  <h2 id="fit-heading">At a glance</h2>
  <dl>{fields.map(([term, value]) => <div><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
</section>
```

- [ ] **Step 4: Create and adopt `TrustPageLayout`**

The layout owns `BaseLayout`, breadcrumbs, eyebrow, H1, deck, measured article
column, and related trust-page navigation. Page files keep their factual body
sections in slots. About and Publisher lead with purpose/audience and move the
identity boundary lower. Contact presents GitHub as the available channel and
retains the confidentiality warning. Editorial Standards keeps the specific
AI-assistance boundary without claiming universal human review.

- [ ] **Step 5: Run GREEN checks and commit**

Run the focused commands from Step 2 plus `npm run typecheck`.

Expected: PASS with no duplicate responsive content and zero Astro diagnostics.

Commit: `refactor: unify article and trust page semantics`

### Task 3: Curate discovery and add the All Guides archive

**Files:**

- Create: `src/pages/articles/index.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/categories/[slug].astro`
- Modify: `src/data/editorial.ts`
- Modify: `src/utils/category-edition.ts`
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/components/PublicationMark.astro`
- Modify: `src/components/TrustModule.astro`
- Modify: `src/pages/sitemap.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/unit/editorial.test.ts`
- Modify: `tests/unit/category-edition.test.ts`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: Add RED tests for curation, archive, and category branches**

Assert homepage allocation contains exactly nine distinct published slugs and
never `moreGuides`; `/articles/` lists all 15 once, grouped by five topics; all
header/footer/home `All guides` links target `/articles/`; and a three-entry
category uses the compact branch without a lead card. Unit-test branches at
counts 0, 3, 6, 11, and 12.

```ts
expect(selectCategoryLayout(3)).toBe("compact");
expect(selectCategoryLayout(6)).toBe("editorial");
expect(selectCategoryLayout(12)).toBe("archive");
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm run test -- --run tests/unit/editorial.test.ts tests/unit/category-edition.test.ts && npm run test:e2e -- tests/e2e/public-routes.spec.ts`

Expected: FAIL because `/articles/` and count-aware compact rendering are absent
and the homepage still allocates the remaining corpus.

- [ ] **Step 3: Implement curated homepage and positive How we work module**

Keep one lead, two support, three latest, and three foundations. Remove `Current
issue`, `Complete issue`, `edition`, and `More guides`. Add one featured Toolkit
resource, topic discovery, lower `How we work`, and a clear `/articles/` link.
Use selective metadata by card importance and do not introduce popularity data.

- [ ] **Step 4: Implement `/articles/` and count-aware categories**

The archive statically groups every published article under its category,
including content type, genuine date, and concise summary. Category branches
render each article exactly once: compact for fewer than six, lead/support/list
for six to eleven, and featured/recent/complete archive for twelve or more.

- [ ] **Step 5: Refine header, mark, footer, sitemap, and CSS**

Add Guides, keep Toolkit prominent, subordinate policy links, keep the full
publication name on one line when space permits, and preserve a compact narrow
fallback. Maintain the native mobile Menu and clear active states.

- [ ] **Step 6: Run GREEN checks and commit**

Run the focused commands from Step 2 plus `npm run typecheck`.

Expected: PASS at 390, 768, and 1440 without horizontal overflow.

Commit: `feat: curate publication discovery and guide archive`

### Task 4: Add 15 story-specific accessible editorial visuals

**Files:**

- Modify: `src/utils/content-contract.ts`
- Modify: `src/components/EditorialVisual.astro`
- Modify: `src/components/ArticleCard.astro`
- Modify: `src/layouts/ArticleLayout.astro`
- Modify: all 15 files under `src/content/articles/*.md`
- Modify: `src/styles/global.css`
- Modify: `tests/unit/content-contract.test.ts`
- Modify: `tests/unit/content-portfolio.test.ts`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Add RED schema and portfolio tests**

Define the controlled visual family enum from the design contract. Assert every
published article supplies `type`, unique stable `key`, non-empty `alt`, optional
caption, and `decorative: false`; all 15 keys are unique; at least 12 visual
families are represented; informative output is not `aria-hidden`; and each
article renders `data-visual-key` matching frontmatter.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm run test -- --run tests/unit/content-contract.test.ts tests/unit/content-portfolio.test.ts`

Expected: FAIL because the visual schema and frontmatter are absent.

- [ ] **Step 3: Implement visual schema and 15 metadata records**

Use these stable mappings:

```text
automation candidates -> decision-tree / automation-candidate-screen
AI output quality -> comparison / ai-quality-scorecard
AI acceptable use -> governance / ai-use-governance
SaaS evaluation -> checklist / saas-evidence-checklist
CRM vs PM -> comparison / work-object-comparison
SaaS lock-in -> data-flow / saas-exit-data-flow
MFA rollout -> security-boundary / mfa-rollout-boundary
phishing response -> workflow / phishing-response-workflow
3-2-1 backup -> backup-topology / three-two-one-topology
shared files -> information-architecture / shared-file-architecture
workflow documentation -> process-lane / workflow-exception-lane
technology onboarding -> checklist / access-onboarding-checklist
technology risk -> risk-matrix / technology-risk-matrix
software total cost -> cost-stack / software-cost-stack
30-day pilot -> timeline / thirty-day-pilot-timeline
```

- [ ] **Step 4: Implement deterministic semantic SVG compositions**

Render different geometry and readable short labels for each key. Informative
SVGs use `role="img"`, unique `<title>`/`<desc>` IDs, `aria-labelledby`, and an
optional visible caption. Category-directory visuals may keep the decorative
fallback. Do not add remote assets or imply product testing.

- [ ] **Step 5: Run GREEN checks and commit**

Run focused tests, `npm run typecheck`, and the article axe/browser tests.

Expected: 15 distinct informative article visuals, no accessibility violations.

Commit: `feat: add story-specific editorial visuals`

### Task 5: Rebuild Toolkit as landing and detail pages

**Files:**

- Create: `src/data/toolkit.ts`
- Create: `src/components/ToolkitCard.astro`
- Create: `src/layouts/ToolkitDetailLayout.astro`
- Create: `src/pages/toolkit/[slug].astro`
- Modify: `src/pages/toolkit.astro`
- Remove: `src/components/ToolkitResource.astro`
- Modify: `src/layouts/ArticleLayout.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/unit/content-portfolio.test.ts`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: Add RED data and route tests**

Assert exactly four unique Toolkit records, stable detail/download/guide URLs,
every CSV exact ordered header, one related article mapping, and all detail pages
with purpose, audience, when, when-not, field definitions, limitation, data
notice, guide link, and download. At 390px assert visible `.toolkit-field-card`
items and no horizontal primary field guide.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm run test -- --run tests/unit/content-portfolio.test.ts && npm run test:e2e -- tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts`

Expected: FAIL because detail routes and mobile field cards do not exist.

- [ ] **Step 3: Centralize data and build landing/detail templates**

Move existing accurate field guidance into `src/data/toolkit.ts`; add factual
purpose/audience/use/not-use/limitation/data-handling copy. Landing cards show
outcome, related guide, CSV, detail link, and direct download. Detail pages use
definition cards on mobile and an optional semantic table at wide widths.

- [ ] **Step 4: Add contextual article callouts**

For the four related articles, render one callout explaining the record the
worksheet helps produce and linking to its detail route. Do not add generic
promotion to unrelated articles.

- [ ] **Step 5: Run GREEN checks and commit**

Run the focused commands plus `npm run check:content` and `npm run typecheck`.

Expected: four working detail routes and unchanged valid header-only CSVs.

Commit: `feat: add practical toolkit detail pages`

### Task 6: Centralize origin and generate complete social previews

**Files:**

- Modify: `site.config.mjs`
- Create: `.env.example`
- Modify: `astro.config.mjs`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/layouts/ArticleLayout.astro`
- Modify: `src/pages/categories/[slug].astro`
- Create: `scripts/generate-social-images.mjs`
- Create: `public/social/*.png`
- Create: `public/manifest.webmanifest`
- Create: `public/apple-touch-icon.png`
- Modify: `public/favicon.svg`
- Modify: `package.json`
- Modify: `tests/unit/site-config.test.ts`
- Create: `tests/unit/social-images.test.ts`
- Modify: `scripts/qa-build.mjs`
- Modify: `vercel.json`

- [ ] **Step 1: Add RED configuration and social-image tests**

Assert `resolveSiteUrl()` accepts only an HTTPS origin with no credentials,
path, query, or hash and normalizes one trailing slash. Assert explicit
`PUBLIC_SITE_URL` wins over the verified Vercel fallback. Assert default, five
category, and 15 article PNGs exist, are 1200x630, are local, and have matching
OG/Twitter URL/alt/dimension/type tags on built pages.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm run test -- --run tests/unit/site-config.test.ts tests/unit/social-images.test.ts`

Expected: FAIL on missing resolver, PNG files, and metadata.

- [ ] **Step 3: Implement validated environment-aware origin**

Export `DEFAULT_SITE_URL`, `resolveSiteUrl(candidate)`, `siteUrl`, and
`siteOrigin`. Read only explicit `PUBLIC_SITE_URL`; never derive the canonical
from Vercel preview variables. Update `.env.example` and deployment docs.

- [ ] **Step 4: Generate deterministic 1200x630 PNG previews**

Use Sharp at build time to convert locally generated SVG buffers into optimized
PNG files. Use local publication typography where supported, publication name,
title, category accent, and each story's visual key without external requests.
Add `generate:social` and run it before the Astro build.

- [ ] **Step 5: Emit complete Open Graph and Twitter metadata**

`BaseLayout` accepts a typed social image path/alt. Emit `og:image`, width 1200,
height 630, `image/png`, alt, `twitter:card=summary_large_image`, image, and alt.
Set default, category, and article-specific values from local metadata. Add the
verified ETI mark manifest/icon without Person or Organization claims.

- [ ] **Step 6: Run GREEN checks and commit**

Run focused tests, `npm run build`, and `npm run check:seo`.

Expected: PASS with origin consistency and all local PNG references resolving.

Commit: `feat: add domain-ready social metadata`

### Task 7: Add stable visual regression coverage and reconcile documentation

**Files:**

- Create: `tests/e2e/visual-regression.spec.ts`
- Create: `tests/e2e/visual-regression.spec.ts-snapshots/*.png`
- Modify: `playwright.config.ts`
- Modify: `DESIGN.md`
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT_GUIDE.md`
- Modify: prior plan documents with a historical-status notice where needed
- Create: `artifacts/site-audit/after/README.md`
- Create: `artifacts/site-audit/after/production/*.png`
- Modify: `scripts/run-lighthouse.mjs` only if measured performance evidence supports a minimal fix

- [ ] **Step 1: Add RED visual-regression cases**

Cover homepage, one category, one article, Toolkit landing/detail, About,
Editorial Standards, Contact, 404, open mobile menu, and a keyboard focus state
at 390/768/1440 where applicable. Disable animations, use reduced motion, and
wait for both local fonts before capture.

- [ ] **Step 2: Run without baselines and confirm RED**

Run: `npm run test:e2e -- tests/e2e/visual-regression.spec.ts`

Expected: FAIL because approved baseline screenshots do not yet exist.

- [ ] **Step 3: Review screenshots and write approved baselines**

Run: `npm run test:e2e -- tests/e2e/visual-regression.spec.ts --update-snapshots`

Inspect every output for nonblank content, balanced hierarchy, no clipping,
complete mobile navigation, logical focus, and no accidental duplication. Then
rerun without `--update-snapshots` and require PASS.

- [ ] **Step 4: Capture matching after-state audit evidence**

Use the exact before routes and widths. Record commit, date, viewport, strengths,
remaining limitations, and file naming in `artifacts/site-audit/after/README.md`.
Remove only duplicate local before screenshots after confirming production/local
hash parity; retain the requested production before/after evidence.

- [ ] **Step 5: Reconcile design and operational documentation**

Measure font rendering/Lighthouse. Keep `font-display: optional` if it produces
stable first render and document it accurately; change to `swap` only if fresh
measurements show it is better without material layout movement. Mark earlier
redesign plans historical, document Guides/Toolkit/social images/origin config,
and preserve the AdSense and human-review limits.

- [ ] **Step 6: Run the full local gate and commit**

Run: `npm ci`, `npm run setup:browsers`, `npm run qa`, and
`npm run check:production -- --origin https://everyday-tech-insight.vercel.app`
before deployment (the smoke command is expected to describe the old production
revision until deployment).

Expected local result: all tests and fresh Lighthouse thresholds PASS. The
pre-deploy smoke result must be reported as current production truth, not as the
new release.

Commit: `test: add publication visual release evidence`

### Task 8: Independent review, GitHub push, Vercel deployment, and production proof

**Files:**

- Modify only files required to resolve review or production defects
- Update: `artifacts/site-audit/after/README.md` with deployed evidence
- Update: release/audit documentation with exact commit and deployment ID

- [ ] **Step 1: Run spec-compliance and code-quality reviews**

Review the final diff against all acceptance criteria. Fix every Critical or
Important item through a failing regression test, re-run the focused gate, and
repeat review until approved.

- [ ] **Step 2: Run fresh release verification**

Run: `npm run qa`, `git diff --check`, `git status --short`, and inspect the
before/after screenshots.

Expected: clean checks, no unexplained files, Lighthouse at or above
90/95/95/95, no ads/analytics/tracking, and no Blogger/XML changes.

- [ ] **Step 3: Integrate and push GitHub first**

Fast-forward or merge the reviewed feature branch into `main`, run the release
gate on `main`, and push `main` to `origin`. Verify the remote SHA with
`git ls-remote origin refs/heads/main` before any Vercel production deployment.

- [ ] **Step 4: Deploy the verified GitHub commit to Vercel**

Deploy the exact pushed commit to the linked production project. Record the
deployment ID, production URL, Ready state, and deployed commit/build identity.
Do not add credentials, domains, publisher IDs, analytics, or CMP settings.

- [ ] **Step 5: Verify production after deployment**

Run: `npm run check:production -- --origin https://everyday-tech-insight.vercel.app`

Then run representative Playwright/axe/console/network checks at 390, 768, and
1440 and verify live HTML/hash signatures against the built commit. Capture the
production after screenshots only after the new deployment is confirmed.

Expected: all public routes on the same shell, one H1, correct canonicals and
social images, valid downloads, no redirect surprises, no mixed generation, no
duplicate Fit/TOC, no console/network/accessibility defects, and Ready status.

- [ ] **Step 6: Publish the factual final report**

Use the user's required 18-section order. Separate confirmed local evidence,
confirmed production evidence, owner-dependent actions, and remaining human or
Google decisions. Never claim AdSense approval or guaranteed approval readiness.

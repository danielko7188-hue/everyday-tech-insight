# Technical QA

Date recorded: 2026-08-23

## Release command

Run from a clean checkout with a supported Node version:

```text
npm ci
npm run setup:browsers
npm run qa
```

On a fresh Linux CI/workstation that needs browser system packages, replace the browser step with `npm run setup:browsers:linux`. Both commands install Chromium for the exact Playwright version in `package-lock.json`; neither belongs in the Vercel production build.

The release command runs formatting, lint, Astro type checks, unit tests, a production build, content checks, built-output checks, external-source verification, Playwright/axe and visual-regression checks, and Lighthouse in that order. Playwright always starts a new built preview and never reuses an existing server.

## Blocking contracts

### Content

- At least 15 Markdown articles and at least 3 in each of the 5 categories. The launch evidence remains exactly 15 and 3 per category; later valid additions do not require weakening QA.
- Unique slug, title, and 50-180-character description.
- File name equals slug; complete schema and five-part business-technology fit.
- The confirmed launch date, 2026-08-21, is the lower bound. Publication, review, modification, and source-access dates may advance truthfully through the current date in `America/Los_Angeles`.
- Publication cannot follow review or modification; `dateModified` is absent at initial publication and valid only on a later date after a substantive change.
- Published/source-checked/indexable status, at least two unique HTTPS primary sources, and an access date for each source.
- Every frontmatter source URL appears in the body.
- At least 650 words, at least four H2 sections, an explicit limitation, and no unsupported first-hand claim.
- No placeholder, advertising, analytics, tracking identifier, invalid related article, or off-origin canonical.

### Built output

- The expected fixed pages, five category pages, and published article pages match the generated indexable route set exactly.
- One H1, unique title and description, canonical, robots, Open Graph fields, and valid JSON-LD on every HTML page.
- Descriptions remain between 50 and 180 characters.
- JSON-LD is limited to the implemented `WebSite`, `BreadcrumbList`, and nested `ListItem` shapes. `WebSite` facts must match configured/visible metadata, and breadcrumb names, positions, and URLs must match the visible trail and canonical page. Review, Rating, Person, Organization, and other unsupported claims fail QA.
- The non-indexable 404 page publishes no JSON-LD claims.
- Internal links and local resources resolve in `dist`.
- No draft/review article leakage, placeholder text, executable client script, advertising, analytics, tracking ID, or `ads.txt`.
- Every sitemap and RSS URL must be absolute HTTPS, use the configured origin, and contain no query or fragment before path membership is considered.
- Sitemap and RSS documents must be strictly well-formed XML and retain their required single roots, direct containers, and one direct location/link/guid per entry; matching URL text in a truncated, mismatched, or malformed document does not pass.
- XML sitemap URLs equal the indexable route set exactly. The RSS channel is the configured home URL, and every item link/guid pair equals the published article route set exactly.
- Category pages and the HTML sitemap contain their exact required memberships.
- The homepage contains exactly nine distinct curated guide destinations; `/articles/` contains all fifteen published guides exactly once, grouped under the five configured topics.
- Four Toolkit detail routes and their CSVs remain discoverable from public navigation/sitemap surfaces and preserve the exact typed record contracts.

### External HTTP(S) destinations

The checker deduplicates article source URLs and every external HTTP(S) anchor rendered in built public HTML, then attempts `HEAD` and falls back to `GET` when needed. It rejects plain HTTP; accepts only HTTPS without credentials or unsafe ports; rejects localhost and non-public literal/DNS-resolved addresses; handles redirects manually; and revalidates every bounded redirect hop. Each production HTTPS socket lookup is pinned to the exact public address set that passed validation for that hop, avoiding an unconstrained second DNS resolution:

- `PASS`: final HTTP status is 200-399.
- `FAIL`: final HTTP status is a definitive 404/410, or the destination/redirect violates the network-safety policy.
- `UNVERIFIED`: authentication, access denial, rate limiting, server error, timeout, DNS, TLS, or other network evidence prevents a reliable conclusion.

`FAIL` and `UNVERIFIED` both stop `npm run qa`. `UNVERIFIED` does not claim that a source is broken; it records that this run could not prove reachability. Address validation, socket pinning, and redirect revalidation reduce SSRF exposure but are not a claim of perfect network isolation; network routing, TLS, the Node runtime, and the host's outbound firewall remain platform boundaries.

### Browser and performance

- Playwright verifies representative routes, the Toolkit and its exact header-only CSV downloads, real 404 behavior, metadata, RSS/robots, mobile overflow, keyboard focus, reduced-motion support, unique navigation landmarks, and axe moderate/serious/critical WCAG results.
- Lighthouse runs in desktop form factor against the home page, AI and automation category, and a representative automation article using the Playwright-installed Chromium.
- Thresholds: Performance at least 90; Accessibility, Best Practices, and SEO at least 95.
- Stale Lighthouse output is cleared at startup. Raw reports and a status/form-factor-labeled `summary.json` are first written to a pending directory and then replace ignored `.lighthouseci/` atomically, so an interrupted run cannot leave an apparently current success summary. The runner owns the Launcher instance before readiness polling, applies bounded startup polling, and uses one idempotent cleanup path for normal completion, launch failure, `SIGINT`, and `SIGTERM`. Signal protection stays installed through browser/server/profile cleanup and report publication or discard.

### Visual release evidence

- The serial `visual-chromium` project owns only `visual-regression.spec.ts`; the regular Chromium project excludes it.
- It compares 32 reviewed states on each supported test platform: nine full-page routes at 390, 768, and 1440 CSS pixels, two keyboard-open menu viewport states, and three keyboard-focused skip-link viewport states. Windows and Linux references are committed separately, for 64 baseline files.
- Captures use a fixed 900px viewport height, DPR 1, light mode, `en-US`, `America/Los_Angeles`, reduced motion, both local faces loaded, one animation frame, disabled animation, hidden caret, and CSS-scale screenshots.
- Snapshot paths include the test file, snapshot argument, Playwright project, and platform. The documented tolerance is `maxDiffPixelRatio: 0.001`; it is not a license to accept an unexplained visual change.
- Console errors, page errors, failed requests, and cross-origin requests fail the visual run. The intentional missing route permits only its expected primary 404 resource message.
- `npm run capture:production -- --origin https://production.example` is a separate after-deployment step. It accepts only an explicit canonical HTTPS origin and writes the exact original eight-route × three-width × two-mode inventory (48 PNGs) to `artifacts/site-audit/after/production/`. It must not be run against an old deployment.

## Current publication-maturity evidence

Fresh feature-branch release run on 2026-08-23:

- `npm run qa`: pass end to end.
- Formatting and ESLint: pass.
- Astro typecheck: 76 files, 0 errors, 0 warnings, 0 hints.
- Vitest: 11 files, 234 tests passed.
- Astro production build: 37 generated pages; 21 social images and one Apple touch icon generated.
- Content QA and built-output QA: pass.
- External HTTP(S) links: 33 pass, 0 fail, 0 unverified.
- Playwright, axe, responsive, and visual-regression checks: 139 tests passed, including all 32 reviewed visual baselines.
- Lighthouse desktop home: Performance 91, Accessibility 100, Best Practices 100, SEO 100; performance runs 91/88/91.
- Lighthouse desktop AI and automation category: Performance 91, Accessibility 100, Best Practices 100, SEO 100; performance runs 87/91/91.
- Lighthouse desktop automation-candidates article: Performance 91, Accessibility 100, Best Practices 100, SEO 100; performance runs 91/91/91.
- Production after-state screenshots: not captured because the publication-maturity release is not deployed.

## Historical evidence record

The following pre-publication-maturity feature-branch run was recorded on 2026-08-22. It is retained as historical evidence and is not a claim about the current tree or a new deployment:

- `npm run qa`: pass end to end after the ignored local `.gstack/` QA-output directory was added to ESLint’s explicit ignore boundary.
- Formatting: pass.
- ESLint: pass.
- Astro typecheck: 63 files, 0 errors, 0 warnings, 0 hints.
- Vitest: 8 files, 121 tests passed.
- Astro production build: 32 generated pages.
- Content QA: pass.
- Built-output QA: pass.
- External HTTP(S) links: 33 pass, 0 fail, 0 unverified.
- Playwright and axe: 79 tests passed, including the Toolkit, exact CSV/MIME contracts, 600px table overflow guidance, positive modified-date metadata, dynamic category membership, capped home-page allocation, unique desktop landmarks, and moderate-impact WCAG checks.
- Dependency audit: 0 production vulnerabilities and 0 total vulnerabilities in the current lockfile audit.
- Independent content/code re-review: pass with no remaining Critical, Important, or Minor findings in the reviewed scope.
- Independent responsive visual/accessibility re-review: pass at 390, 600, and 1440 pixels with no remaining actionable findings in the reviewed scope.
- Lighthouse desktop home: Performance 94, Accessibility 100, Best Practices 100, SEO 100; performance runs 93/94/94.
- Lighthouse desktop AI and automation category: Performance 95, Accessibility 100, Best Practices 100, SEO 100; performance runs 95/95/95.
- Lighthouse desktop automation-candidates article: Performance 92, Accessibility 100, Best Practices 100, SEO 100; performance runs 92/92/92.

Do not infer a pass for one stage from another stage's result. The current branch requires a fresh complete QA run, and the Vercel production deployment requires separate HTTP, metadata, download, browser-console, and visual verification.

# Technical QA

Date recorded: 2026-08-26, with earlier release evidence retained in dated historical sections.

## Release command

Run from a clean checkout with Node.js `24.x`, the same maintained major pinned in `package.json`, GitHub Actions, and Vercel:

```text
npm ci
npm run setup:browsers
npm run qa
```

On a fresh Linux CI/workstation that needs browser system packages, replace the browser step with `npm run setup:browsers:linux`. Both commands install Chromium for the exact Playwright version in `package-lock.json`; neither belongs in the Vercel production build.

The release command runs formatting, lint, Astro type checks, unit tests, a production build, content, editorial, CMS, image, CMS-lifecycle-fixture, built-output, and external-source checks, Playwright/axe, the separate visual-regression project, and Lighthouse in that order. The npm `prebuild` lifecycle also runs the deterministic content, editorial, CMS, and image checks before every production build, including Vercel builds; `postbuild` runs the deterministic built-output gate before that build can succeed. Playwright always starts a new built preview and never reuses an existing server.

Exact local candidate `679bc6c23313e29693c68aec0acdce111fe2fb0e` passed the complete release command on 2026-08-26: 129 Astro files with zero diagnostics; 1,042 unit tests passed and 3 intentionally skipped; 37 static pages built; 33/33 external HTTPS destinations passed; 201 Playwright checks passed, including 34 platform-specific visual checks, followed by a separate 34/34 Windows visual rerun; and Lighthouse scored 99–100 performance with 100 accessibility, best practices, and SEO across all eight mobile/desktop audits. This is exact local evidence, not production evidence. Linux production-build and browser evidence must come from the matching pushed GitHub/Vercel revision before release parity is claimed.

## Blocking contracts

### Content

- The 15 named launch records and their original three-per-category distribution remain immutable historical evidence. Current public routes derive only from records whose lifecycle status is `published`; a truthful archive/withdrawal may reduce the public count immediately, and later valid records may expand it without weakening the launch-record contract.
- Unique slug, title, and 50-180-character description.
- File name equals slug; complete schema and five-part business-technology fit.
- The confirmed launch date, 2026-08-21, is the lower bound. Publication, review, modification, and source-access dates may advance truthfully through the current date in `America/Los_Angeles`.
- Publication cannot follow review or modification; `dateModified` is absent at initial publication and valid only on a later date after a substantive change.
- Published/source-checked/indexable status, at least two unique HTTPS primary sources, and an access date for each source.
- Every frontmatter source URL appears in the body.
- Public evidence and Markdown link destinations reject credentials, secret-bearing query keys, fragments or unsafe ports where prohibited, IP literals, and reserved/internal hosts before any external checker performs DNS or HTTP work. Safe relative links remain subject to built-output resolution.
- Raw article frontmatter and Markdown reject detected private keys, assigned passwords/API keys, bearer tokens, JWTs, and private-email patterns. This deployment gate cannot erase a sensitive value already committed through a public CMS workflow.
- At least 650 words, at least four H2 sections, an explicit limitation, and no unsupported first-hand claim.
- No placeholder, advertising, analytics, tracking identifier, invalid related article, or unsupported canonical override.
- Managed raster sources reject detected EXIF, IPTC, XMP, Photoshop TIFF tags, and PNG text comments before publication; editors must strip and inspect metadata before the CMS creates a public Git commit.

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
- The homepage curates up to nine distinct currently published guide destinations, using deterministic fallbacks when a configured guide is archived; the current launch output remains exactly nine. `/articles/` contains every published guide exactly once, grouped under the five configured topics. The 15-guide launch subset remains an exact named historical regression contract while lifecycle changes and later valid records are allowed.
- Four Toolkit detail routes and their CSVs remain discoverable from public navigation/sitemap surfaces and preserve the exact typed record contracts.
- Monetization remains in exact mode `off`: no publisher or account IDs, ad scripts, ad slots, ad placeholders, ad layout gaps, `ads.txt`, analytics, tracking, or CMP. These changes do not establish AdSense eligibility; Google alone decides eligibility and approval.

### External HTTP(S) destinations

The checker deduplicates article source URLs and every external HTTP(S) anchor rendered in built public HTML, then attempts `HEAD` and falls back to `GET` when needed. It rejects plain HTTP; accepts only HTTPS without credentials or unsafe ports; rejects localhost and non-public literal/DNS-resolved addresses; handles redirects manually; and revalidates every bounded redirect hop. Each production HTTPS socket lookup is pinned to the exact public address set that passed validation for that hop, avoiding an unconstrained second DNS resolution:

- `PASS`: final HTTP status is 200-399.
- `FAIL`: final HTTP status is a definitive 404/410, or the destination/redirect violates the network-safety policy.
- `UNVERIFIED`: authentication, access denial, rate limiting, server error, timeout, DNS, TLS, or other network evidence prevents a reliable conclusion.

`FAIL` and `UNVERIFIED` both stop `npm run qa`. `UNVERIFIED` does not claim that a source is broken; it records that this run could not prove reachability. Address validation, socket pinning, and redirect revalidation reduce SSRF exposure but are not a claim of perfect network isolation; network routing, TLS, the Node runtime, and the host's outbound firewall remain platform boundaries.

### Browser and performance

- Playwright verifies representative routes, the Toolkit and its exact header-only CSV downloads, real 404 behavior, metadata, RSS/robots, mobile overflow, keyboard focus, reduced-motion support, unique navigation landmarks, and axe moderate/serious/critical WCAG results.
- Source and browser contracts verify native CSS `@view-transition { navigation: auto; }`, a custom root transition no longer than 200ms, and zero executable client JavaScript. Static-first, finite, and scroll-linked enhancements exclude Astro ClientRouter, Motion, Three.js, WebGL, Lenis, any remote presentation runtime, scroll hijacking, and any continuous or infinite loop. `prefers-reduced-motion`, `prefers-reduced-data`, `(pointer: coarse)`, and `(update: slow)` preserve static fallbacks.
- Lighthouse audits the home page, cybersecurity category, Toolkit, and—when one exists—the representative automation article on mobile and desktop, using the Playwright-installed Chromium for three runs per route and device profile. The current inventory therefore produces eight audits across four pages; a valid zero-published inventory produces six across three pages.
- Thresholds: Performance at least 90; Accessibility, Best Practices, and SEO at least 95.
- Stale Lighthouse output is cleared at startup. Raw reports and a status/form-factor-labeled `summary.json` are first written to a pending directory and then replace ignored `.lighthouseci/` atomically, so an interrupted run cannot leave an apparently current success summary. The runner owns the Launcher instance before readiness polling, applies bounded startup polling, and uses one idempotent cleanup path for normal completion, launch failure, `SIGINT`, and `SIGTERM`. Signal protection stays installed through browser/server/profile cleanup and report publication or discard.

### Visual release evidence

- The serial `visual-chromium` project owns only `visual-regression.spec.ts`; the regular Chromium project excludes it.
- It compares 34 reviewed states on each supported test platform: nine full-page routes at 390, 768, and 1440 CSS pixels, Toolkit full-page states at the additional 600 and 1024px review widths, two keyboard-open menu viewport states, and three keyboard-focused skip-link viewport states. Windows and Linux references are committed separately, for 68 baseline files.
- Captures use a fixed 900px viewport height, DPR 1, light mode, `en-US`, `America/Los_Angeles`, reduced motion, both local faces loaded, one animation frame, disabled animation, hidden caret, and CSS-scale screenshots.
- Snapshot paths include the test file, snapshot argument, Playwright project, and platform. The documented tolerance is `maxDiffPixelRatio: 0.001`; it is not a license to accept an unexplained visual change.
- Console errors, page errors, failed requests, and cross-origin requests fail the visual run. The intentional missing route permits only its expected primary 404 resource message.
- `capture:production` requires `--origin`, `--phase`, and the exact expected 40-character Git SHA. `before`, `after-production`, and `runtime-verification` require a deployment ID and canonical HTTPS origin; `after-local` requires a canonical `http://127.0.0.1[:port]` origin and forbids a deployment ID.
- Release `premium-spatial-2026-08-26` uses 320, 390, 600, 768, 1024, 1280, 1440, and 1920px capture widths. Its completed before baseline contains 64 PNGs across 8 routes and 8 widths: 56 matching HTTP 200 responses, 8 expected 404 responses, 64 unique SHA-256 hashes, and 6/6 safety assertions.
- The before manifest was captured at `2026-08-26T09:36:03.617Z` from `https://everyday-tech-insight.vercel.app` for Git SHA `af8dd44843860f3a055c76f934c02ae389ec1a81` and deployment `dpl_CptkBhg1Q5Gw7dCD11et1bw66HPd`.
- The expanded after-local capture completed at `2026-08-26T16:58:13.990Z` from `http://127.0.0.1:4321` for exact source SHA `679bc6c23313e29693c68aec0acdce111fe2fb0e`: 228 PNGs, 220 matching HTTP 200 responses, 8 expected 404 responses, 228 unique SHA-256 hashes, and 6/6 safety assertions. It comprises 27 routes × 8 widths = 216 full-page PNGs, 4 menu states at 320, 390, 600, and 768px, and 8 skip-link states. Representative mobile and desktop outputs, menu-open, focus, Toolkit, trust, sitemap, and 404 states were inspected. This after-local result is local evidence only and is not deployment evidence.
- The after-production capture completed with 228 PNGs at `2026-08-26T18:41:09.773Z` from `https://everyday-tech-insight.vercel.app` for exact deployed SHA `17a09a40f6045311ad9a5d6f66516ccdca8b1b3c` and Vercel deployment `dpl_6LwKJsjsYUoB4rdJiTRyinnrj2js`: 220 matching HTTP 200 responses, 8 expected 404 responses, 228 unique SHA-256 hashes, and 6/6 safety assertions. All 228 production PNG hashes exactly matched the corresponding after-local filename. Authenticated Vercel metadata reported `READY`, production target, the exact Git SHA, and the canonical `everyday-tech-insight.vercel.app` alias. The exact-commit production smoke passed 46 routes and 30 root-relative assets with security headers, metadata parity, monetization-off behavior, deployment provenance, and Git SHA match.
- The Git-ignored runtime-verification phase is planned and unverified at 228 PNGs for the final evidence commit. It must use that later commit's exact READY deployment and must not be committed.
- Fixed premium-spatial outputs are `artifacts/site-audit/before/premium-spatial-2026-08-26/`, `artifacts/site-audit/after/premium-spatial-2026-08-26/local/`, `artifacts/site-audit/after/premium-spatial-2026-08-26/production/`, and the ignored `artifacts/site-audit/runtime-verification/premium-spatial-2026-08-26-final/`. Each successful run atomically publishes an `audit-manifest.json` containing provenance, route/status, viewport/state, byte count, SHA-256 digest, and monetization/CMS-absence assertions.

### Premium spatial deployment provenance

Seven Git-triggered deployments failed closed during source-provenance hardening and did not replace the canonical production release: `dpl_HkLhe7vhiJzw1m8z7ZXKyEeKMW6z`, `dpl_9KSXoW94sJ1LdWpFGocSCXKYS69s`, `dpl_BjN8sYG3DtQdqzKXKYssf7vhUHZQ`, `dpl_GqttgmgLFL67oJzEUrcxT3BWaaGd`, `dpl_FZ39BFCgTNztGmRHQtyC2947uSQb`, `dpl_AGRRi6Tamfer4XTM2SUEHCBMsyfT`, and the intentional bounded-diagnostic deployment `dpl_EjcjXtv9aQHMihqvRErHH11dfs1F`. Each ended in `ERROR` at the production build gate. The bounded diagnostic established that Vercel rewrote the tracked `vercel.json` from formatted JSON to one-line JSON while preserving its parsed values.

The final provenance policy accepts only the exact unstaged ` M vercel.json` condition in a complete Vercel Git build and only when recursively canonicalized committed and working JSON values are identical. Any value change, staged config change, parse/read failure, or additional source change still fails closed. Commit `17a09a40f6045311ad9a5d6f66516ccdca8b1b3c` passed the GitHub Actions `Full quality gate`; Vercel deployment `dpl_6LwKJsjsYUoB4rdJiTRyinnrj2js` then ran the project-level `npm ci`, installed 622 packages with zero reported vulnerabilities, built all 37 pages, passed built-output QA, reached `READY`/`PROMOTED`, and assigned the canonical alias.

```text
npm run capture:production -- --origin https://production.example --phase before --expected-sha $fullGitSha --deployment-id $vercelDeploymentId
npm run capture:production -- --origin http://127.0.0.1:4321 --phase after-local --expected-sha $fullGitSha
npm run capture:production -- --origin https://production.example --phase after-production --expected-sha $fullGitSha --deployment-id $vercelDeploymentId
npm run capture:production -- --origin https://production.example --phase runtime-verification --expected-sha $fullGitSha --deployment-id $vercelDeploymentId
```

## Dated Purple Signal release evidence snapshot

This Purple Signal section is historical, dated, and separate from `premium-spatial-2026-08-26`. The evidence records named commits and deployments observed on 2026-08-25. It remains evidence for those exact artifacts, not an evergreen claim about the current tree or the next deployment. Every release requires fresh exact-SHA live checks. Its committed after-production record is intentionally complemented by a Git-ignored runtime-verification record for the final deployed SHA, avoiding an evidence-commit recursion.

The post-fix candidate code commit `95ab2fde3bc3973d6f42715dea480a72145c6644` completed a fresh local `npm run qa` on 2026-08-25:

- Formatting and ESLint: pass.
- Astro typecheck: 109 files, 0 errors, 0 warnings, 0 hints.
- Vitest: 30 files; 948 tests passed and 3 intentionally skipped (951 total).
- Astro production build: 37 generated pages; 21 social images and one Apple touch icon generated.
- Content, editorial, CMS, managed-image, CMS lifecycle fixture, and built-output gates: pass. The lifecycle fixture confirmed 15 public article routes and excluded 3 nonpublic fixtures.
- External HTTP(S) destinations: 33 pass, 0 fail, 0 unverified.
- Playwright, axe, responsive, and integrated visual checks: 157 passed. The separate serial visual-regression run passed all 32 reviewed Windows states.
- The slow-first-visit font regression failed 6 of 6 controlled repetitions before the `font-display` correction and passed 30 of 30 after it. The release QA retained one delayed-font assertion without relaxing the mobile geometry threshold.
- Lighthouse, median of three runs per page/device: home 99 mobile and 100 desktop; cybersecurity category 99 mobile and 100 desktop; automation article 97 mobile and 100 desktop; Toolkit 100 mobile and desktop. Accessibility, Best Practices, and SEO were 100 in all eight audits.
- Dependency audits: 0 production vulnerabilities and 0 total vulnerabilities.

The after-local capture completed at `2026-08-25T22:35:30.143Z` against commit `c4d2ae63637cf53f43d9971a6c55256fac681b5b` from `http://127.0.0.1:4321`. Its manifest contains 97 rows and 97 unique PNG hashes: 92 expected/actual 200 responses, 5 expected/actual 404 responses, and six passing CMS/monetization-absence assertions. Representative images at 390, 768, 1024, 1440, and 1920 pixels were inspected. This is local evidence only and must not be inferred to describe another commit or deployment.

After the fast-forward to `main`, commit `830f2c99bcf98a95946a54ce2e62e444194fae2c` repeated the complete `npm run qa` gate successfully. The structural counts remained 109 checked files, 948 passed and 3 intentionally skipped Vitest tests, 37 generated pages, 33 verified external destinations, 157 integrated Playwright tests, and 32 separate visual states. Its Lighthouse medians were 99/100 for home, 98/100 for cybersecurity category, 99/100 for automation article, and 99/100 for Toolkit on mobile/desktop respectively; Accessibility, Best Practices, and SEO remained 100 in all eight audits.

The first two Git-triggered Vercel attempts did not pass and never replaced the canonical production release: deployment `dpl_FHDEDCt5quw1hbBczoV6EcWPg9gi` at commit `830f2c99bcf98a95946a54ce2e62e444194fae2c` exposed the omitted editorial YAML, and deployment `dpl_J8fmHY9ctfUfbdWeUC6agT6ijRbV` at commit `bf2235c1c1b34d799582019db121c925377746f7` exposed the remaining ignored design input. The `.vercelignore` boundary and its regression test were then corrected so all editorial prebuild inputs remain available.

Commit `a921e08f1655aec184e386131573ceecb66b0721` was pushed to GitHub `main` before Vercel deployment `dpl_Cqnru4yBwkQ1pmr6S971hd85EveH` reached `READY`. Vercel v13 metadata records `source: git`, GitHub ref `main`, the exact commit SHA, production target, and the canonical `everyday-tech-insight.vercel.app` alias. The exact-commit production smoke passed 46 routes and 30 root-relative assets, including security headers, metadata parity, monetization-off behavior, 404/CMS absence contracts, and Git SHA match.

The after-production capture completed at `2026-08-25T22:56:00.997Z` against that deployment. Its manifest contains 97 rows and 97 unique PNG hashes, the same 92 expected/actual 200 responses, 5 expected/actual 404 responses, and six passing CMS/monetization-absence assertions. All 97 production PNG hashes exactly match the inspected local after-state. This committed record is a dated deployment snapshot; it is not direct evidence for a later evidence-only or code-changing commit.

The directly observed rollback baseline was captured on 2026-08-25 at `2026-08-25T18:41:08.633Z` from `https://everyday-tech-insight.vercel.app`:

- Git SHA: `6473acaa64c64a64de6d3d1e6900cdad9a52d06c`.
- Vercel deployment: `dpl_A4prJX9FUrtzkBcw8bGRhS3qHW75`.
- Before-state evidence: 40 captures and 40 unique SHA-256 hashes.
- Exact 404 assertions passed for `/ads.txt`, `/admin/`, `/.pages.yml`, the CMS draft route, and `/keystatic/`; the homepage monetization-off DOM assertion passed.
- The focused release-evidence suite passed 29 tests across 3 files.

For each final release, direct verification of the deployed SHA is written only by its corresponding successful run to the Git-ignored runtime-verification directory. Keeping that record out of Git avoids creating a new commit that would immediately make its own SHA evidence stale.

## Historical evidence record

The following publication-maturity release was recorded on 2026-08-23 at code commit `54c31bcafeacc3ce3ba8828a8d403f76ff1ccc48`. It remains valid for that recorded tree and deployment, not for the current Purple Signal branch:

- `npm run qa`: pass end to end.
- Clean install and dependency audit: 0 total vulnerabilities; 0 production vulnerabilities.
- Formatting and ESLint: pass.
- Astro typecheck: 76 files, 0 errors, 0 warnings, 0 hints.
- Vitest: 11 files, 324 tests passed.
- Astro production build: 37 generated pages; 21 social images and one Apple touch icon generated.
- Content QA and built-output QA: pass.
- External HTTP(S) links: 33 pass, 0 fail, 0 unverified.
- Playwright, axe, responsive, and visual-regression checks on Windows: 142 tests passed, including all 32 reviewed Windows visual states and the cold-page deferred-rendering geometry contract.
- Exact-commit Linux visual rerun: 32 of 32 reviewed states passed. The repository contains 64 platform-specific baseline PNGs with 64 unique SHA-256 hashes.
- Lighthouse desktop home: Performance 93, Accessibility 100, Best Practices 100, SEO 100; performance runs 93/93/93.
- Lighthouse desktop AI and automation category: Performance 93, Accessibility 100, Best Practices 100, SEO 100; performance runs 94/93/93.
- Lighthouse desktop automation-candidates article: Performance 90, Accessibility 100, Best Practices 100, SEO 100; performance runs 91/90/90.
- Independent final code/release review: approved with no remaining P0-P3 findings at the recorded code commit.
- Production after-state evidence: Vercel deployment `dpl_4h7us2N5TFFtP6xz8763ZLn7TzvK` reached `READY`; the canonical alias passed the 42-route/30-asset production smoke gate; 48 production PNGs were captured with 48 unique verified SHA-256 hashes.

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

Do not infer a pass for one stage from another stage's result. The local QA, Git/Vercel metadata, exact-commit production smoke, and committed after-production capture are separate successful observations. Owner/editorial/CMS/AdSense gates remain separate, and the final evidence commit still requires its own direct runtime verification.

# Everyday Tech Insight

Everyday Tech Insight is a static, source-backed publication for small-business decision makers choosing, using, securing, and governing everyday technology.

The site is built with Astro and contains five categories, fifteen practical guides, four downloadable decision worksheets, trust pages, an HTML sitemap, XML sitemaps, and RSS. The homepage curates exactly nine distinct guides; `/articles/` groups all fifteen once across the five topics. Primary content renders as HTML without client-side JavaScript.

The premium spatial layer remains zero executable client JavaScript. It uses native CSS `@view-transition { navigation: auto; }`, a custom root transition capped at 200ms, finite and scroll-linked progressive enhancement, and local SVG. It does not use Astro ClientRouter, Motion, Three.js, WebGL, Lenis, a remote presentation runtime, scroll hijacking, or a continuous or infinite loop. Static-first output and `prefers-reduced-motion`, `prefers-reduced-data`, `(pointer: coarse)`, and `(update: slow)` fallbacks preserve the complete experience.

Implemented surfaces include the local `SignalField` on the homepage and 404, CSS-only reading progress on article pages, a real-data Toolkit structure preview on each Toolkit detail route, and a direct 404 Toolkit path. Required release-review widths are 320, 390, 600, 768, 1024, 1280, 1440, and 1920px.

## Current publication boundary

- Public byline: `Everyday Tech Insight`, a publication name only.
- Production canonical: `https://everyday-tech-insight.vercel.app/`.
- Contact and corrections: the public GitHub issue tracker linked from the site.
- Advertising, analytics, affiliate links, sponsorship, and consent tooling: disabled.
- AdSense: no publisher ID, ad code, `ads.txt`, review request, or approval claim.
- Human editorial, legal, privacy, ownership, and content-rights review: still required before any AdSense application.

Google alone decides AdSense eligibility and approval.

## Editorial workflow

Pages CMS is configured and locally tested as a Git-backed editor through `.pages.yml`. Hosted Pages CMS sign-in, GitHub App authorization, repository selection, and a real save/commit round-trip are owner actions and remain unverified. There is no public CMS or admin route.

The exact repository is `danielko7188-hue/everyday-tech-insight`; the release branch is `main`; and the recommended owner-created editorial branch is `content/editorial`. Branch creation and selection remain unverified. The owner should grant the Pages CMS GitHub App access to this exact repository only and must not invite Pages CMS collaborators. Hosted collaborator absence, exact GitHub App scope, hosted sign-in, selected branch, branch protection, media upload, and save/commit round-trip all remain unverified.

The checked YAML exposes `create: true`, `rename: false`, and `delete: false`; these operations constrain the Pages CMS UI only and do not prevent direct Git changes. “Owner-only” describes intended write access, not privacy. Every committed public branch, file, and managed-media byte is publicly visible.

This GitHub repository is public: every committed file and branch is publicly visible. Repository-tracked editorial records and managed media are non-deployed source, not confidential storage. Confidential owner, account, legal, review, and rights evidence must stay outside Git; commit only a nonsecret evidence reference and truthful status.

Editorial records move through `draft -> review -> published -> archived`. Only published records enter public routes, navigation, feeds, sitemaps, related guides, or social images. Routine work happens on a non-`main` branch and reaches `main` through a reviewed pull request; Vercel previews do not make review-status articles routable.

See the [Publishing Guide](docs/PUBLISHING_GUIDE.md) for the complete workflow, [Owner Inputs Required](docs/OWNER_INPUTS_REQUIRED.md) for unresolved external facts, and [Content Quality Review Queue](docs/CONTENT_QUALITY_REVIEW_QUEUE.md) for the evidence-bounded 15-guide review record.

## Requirements

- Node.js `24.x` (the same maintained major used by GitHub Actions and Vercel)
- npm 11 or the npm version bundled with a supported Node release
- The version-matched Playwright Chromium installed by the setup command below

## Local commands

```text
npm ci
npm run setup:browsers
npm run qa
```

On a fresh Linux CI/workstation that also needs Chromium system libraries, use `npm run setup:browsers:linux` instead of `npm run setup:browsers`. These commands use the repository-pinned Playwright version. They are local/CI setup steps, not part of a Vercel production build.

Development and focused build commands:

```text
npm run dev
npm run generate:social
npm run build
npm run preview
```

`generate:social` is an authoring command, not a production-build step. Run it
after changing a published guide's title, category, slug, visual key, the local
social-image generator, or its bundled font. Review and commit the resulting
PNGs together with `scripts/social-images.manifest.json`. `npm run build` reads
those committed bytes and fails closed if their source signatures, inventory,
hashes, PNG structure, or dimensions are stale; it never rerasterizes them.

Focused checks:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run test:release-evidence
npm run check:content
npm run check:editorial
npm run check:cms
npm run check:images
npm run check:social
npm run check:cms-fixture
npm run check:seo
npm run check:links
npm run test:e2e
npm run test:visual
npm run lighthouse
```

The visual suite selects its committed platform-specific references automatically. The repository retains the same 34 reviewed states for Windows and Linux, including Toolkit full-page coverage at 390, 600, 768, 1024, and 1440px, for 68 paired baseline files. Update either platform set only after examining the rendered change.

After a reviewed release is actually deployed, capture the production evidence set with an explicit canonical HTTPS origin:

```text
npm run capture:production -- --origin https://production.example --phase after-production --expected-sha $fullGitSha --deployment-id $vercelDeploymentId
```

Set `$fullGitSha` and `$vercelDeploymentId` from the exact pushed commit and authenticated Vercel deployment metadata. The command validates the explicit HTTPS origin and release metadata and verifies protected CMS/advertising routes remain exact non-redirecting 404s.

For release `premium-spatial-2026-08-26`, the expanded after-local capture completed at `2026-08-26T16:58:13.990Z` from `http://127.0.0.1:4321` for exact source SHA `679bc6c23313e29693c68aec0acdce111fe2fb0e`: 228 PNGs, 220 matching HTTP 200 responses, 8 expected 404 responses, 228 unique SHA-256 hashes, and 6/6 safety assertions. It covers 27 routes across all eight required widths (216 full-page states), four keyboard-open menu states at 320, 390, 600, and 768px, and eight focused skip-link states. This after-local result is local evidence only and is not deployment evidence.

The after-production capture completed with 228 PNGs at `2026-08-26T18:41:09.773Z` from `https://everyday-tech-insight.vercel.app` for exact deployed SHA `17a09a40f6045311ad9a5d6f66516ccdca8b1b3c` and Vercel deployment `dpl_6LwKJsjsYUoB4rdJiTRyinnrj2js`: 220 matching HTTP 200 responses, 8 expected 404 responses, 228 unique SHA-256 hashes, and 6/6 safety assertions. All 228 production PNG hashes exactly matched the corresponding after-local filename. Authenticated Vercel metadata reported `READY`, production target, and the canonical alias; exact-commit production smoke passed 46 routes and 30 root-relative assets with security, metadata, monetization-off, and Git SHA checks.

The Git-ignored runtime-verification phase is planned and unverified at 228 PNGs for the final evidence commit. Do not run the capture command against an old deployment or treat local visual baselines as deployment evidence. The dated Purple Signal evidence remains a separate historical record in [Technical QA](docs/TECHNICAL_QA.md).

`npm run check:links` checks article sources and every external HTTP(S) destination rendered in public HTML. It uses `PASS`, `FAIL`, and `UNVERIFIED` deliberately. Plain HTTP, a definitive 404/410, or a blocked unsafe target is `FAIL`; access controls, rate limits, server errors, timeouts, and network failures are `UNVERIFIED`. Either state blocks the full QA command until a human can establish the destination is reachable.

## Repository map

- `src/content/articles/`: article source files and source records.
- `src/content-assets/articles/`: repository-tracked, non-deployed source media. The build publishes only validated, referenced files to public URLs under `/images/articles/`.
- `docs/editorial-operations.yml`: strict source of truth for owner gates and guide-quality records; `npm run generate:editorial` produces the two finished Markdown documents, and `npm run check:editorial` rejects drift plus its defined secret-like, placeholder, and state-contract hazards. Human review remains required.
- `.pages.yml`: Pages CMS collection, lifecycle fields, homepage-featured control, and repository-tracked source-media configuration; it does not prove hosted authorization.
- `public/toolkit/`: blank CSV worksheets linked from the Toolkit page; publication rights remain an owner-review gate.
- `src/data/toolkit.ts`: four typed Toolkit records, their detail-page guidance, unchanged CSV contracts, and related-guide mappings.
- `src/pages/`: generated public route templates.
- `src/layouts/` and `src/components/`: shared publication shell.
- `src/data/`: publication and category configuration.
- `site.config.mjs`: the validated single source of truth for the canonical origin and publication identity used by Astro, runtime pages, robots, and QA. The optional `PUBLIC_SITE_URL` build variable accepts only an HTTPS origin; preview-host variables are ignored.
- `public/social/`: committed 1200×630 previews generated during authoring for the publication, five categories, and every published article; production validates and consumes these exact bytes.
- `scripts/`: content, social-asset integrity, built-output, external-link, and Lighthouse QA. `scripts/social-images.manifest.json` binds normalized visual-source signatures to the committed PNG hashes without requiring cross-platform rerasterization.
- `tests/`: unit, route, responsive, keyboard, accessibility, and deterministic visual-regression contracts.
- `artifacts/site-audit/`: retained before-state evidence and the deliberately separate after-state production-capture workflow.
- `docs/`: editorial evidence, assumptions, review gates, deployment, and QA records.

Generated folders such as `dist/`, `.astro/`, `.vercel/`, and `.lighthouseci/` are intentionally ignored. Do not hand-edit generated social PNGs or their manifest; update their source inputs, run the authoring generator, inspect the images, and commit the complete portfolio.

Category pages adapt to content volume: fewer than six guides use one compact list, six to eleven use a lead and supporting sequence, and twelve or more use a three-guide priority opening, the next three recent guides, and the remaining archive. Every published category guide remains linked exactly once. Ordering is deterministic: published featured guides first, then the newest `dateModified` or `datePublished`, then title and slug. The opening label reflects whether its three guides are featured, latest fallbacks, or a mix; the compact branch does not manufacture a separate visual featured tier. Article illustrations are informative, story-specific local SVGs with text alternatives; category fallbacks remain decorative. Toolkit field guidance is stacked on mobile, with no horizontally scrolling primary field table.

## Add or update an article

1. Create a safe draft with `npm run new:article -- --slug a-safe-lowercase-slug --title "A factual working title"`, or create it through Pages CMS on a non-`main` branch after the owner completes hosted authorization.
2. Keep the slug and filename identical and immutable after first publication.
3. Advance the record through draft and review only as its required fields become complete. Do not use `published` merely to obtain a preview.
4. Before publication, complete all topic-fit fields and include at least two HTTPS source records. Human review must confirm what each source actually establishes and whether it is substantively suitable; a label alone does not make a page primary.
5. Cite every frontmatter source URL in the article body.
6. Before upload, strip and inspect camera/location metadata—including EXIF GPS, device, author, XMP, IPTC, and comments—because Pages CMS commits raw source bytes to the public repository before CI can respond. Put managed source media only in `src/content-assets/articles/` using a lowercase slug-prefixed raster filename. Complete the hero image's alt/decorative, caption, credit, license, and source fields truthfully. Body images use a validated Markdown path plus meaningful alt text; record their provenance and publication-rights decision in the guide's `mediaRights` quality record in `docs/editorial-operations.yml`. Image QA blocks detected ancillary metadata before deployment, but it cannot erase an unsafe public commit or prove rights.
7. Use `datePublished` only for first publication. Omit `dateModified` at initial publication; add it only on a later calendar date after a substantive change. Update `lastReviewed` after a real review. Dates may advance through the current date but never be backdated before the confirmed launch.
8. Archive withdrawn material instead of deleting it. Permanent deletion requires a separately reviewed Git operation.
9. Run `npm run qa` and complete the human review checklist before release.

See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md), [Technical QA](docs/TECHNICAL_QA.md), [Publishing Guide](docs/PUBLISHING_GUIDE.md), and [Assumptions](docs/ASSUMPTIONS.md) for operating details.

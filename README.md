# Everyday Tech Insight

Everyday Tech Insight is a static, source-backed publication for small-business decision makers choosing, using, securing, and governing everyday technology.

The site is built with Astro and contains five categories, fifteen practical guides, four downloadable decision worksheets, trust pages, an HTML sitemap, XML sitemaps, and RSS. The homepage curates exactly nine distinct guides; `/articles/` groups all fifteen once across the five topics. Primary content renders as HTML without client-side JavaScript.

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

This GitHub repository is public: every committed file and branch is publicly visible. Repository-tracked editorial records and managed media are non-deployed source, not confidential storage. Confidential owner, account, legal, review, and rights evidence must stay outside Git; commit only a nonsecret evidence reference and truthful status.

Editorial records move through `draft -> review -> published -> archived`. Only published records enter public routes, navigation, feeds, sitemaps, related guides, or social images. Routine work happens on a non-`main` branch and reaches `main` through a reviewed pull request; Vercel previews do not make review-status articles routable.

See the [Publishing Guide](docs/PUBLISHING_GUIDE.md) for the complete workflow, [Owner Inputs Required](docs/OWNER_INPUTS_REQUIRED.md) for unresolved external facts, and [Content Quality Review Queue](docs/CONTENT_QUALITY_REVIEW_QUEUE.md) for the evidence-bounded 15-guide review record.

## Requirements

- Node.js `^22.19.0` or `>=24.0.0`
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
npm run check:cms-fixture
npm run check:seo
npm run check:links
npm run test:e2e
npm run test:visual
npm run lighthouse
```

The visual suite selects its committed platform-specific references automatically. The repository retains the same 32 reviewed states for Windows and Linux; update either set only after examining the rendered change.

After a reviewed release is actually deployed, capture the production evidence set with an explicit canonical HTTPS origin:

```text
npm run capture:production -- --origin https://production.example --phase after-production --expected-sha $fullGitSha --deployment-id $vercelDeploymentId
```

Set `$fullGitSha` and `$vercelDeploymentId` from the exact pushed commit and authenticated Vercel deployment metadata. The command validates the explicit HTTPS origin and release metadata, verifies protected CMS/advertising routes remain exact non-redirecting 404s, and captures 97 reviewed states: 18 page families at 390, 768, 1024, 1440, and 1920 CSS pixels plus mobile-menu and skip-link focus states. It writes the fixed versioned set and a SHA-256 manifest under `artifacts/site-audit/after/purple-signal-2026-08-25/production/`. Do not run it against an old deployment or treat local visual baselines as deployment evidence.

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
- `public/social/`: deterministic local 1200×630 previews generated for the publication, five categories, and every published article.
- `scripts/`: content, built-output, external-link, and Lighthouse QA.
- `tests/`: unit, route, responsive, keyboard, accessibility, and deterministic visual-regression contracts.
- `artifacts/site-audit/`: retained before-state evidence and the deliberately separate after-state production-capture workflow.
- `docs/`: editorial evidence, assumptions, review gates, deployment, and QA records.

Generated folders such as `dist/`, `.astro/`, `.vercel/`, and `.lighthouseci/` are intentionally ignored. Edit source files, never generated output.

Category pages use one neutral, complete compact list in stable public-slug order. No guide is promoted as featured, and every current or future category member remains linked exactly once. Article illustrations are informative, story-specific local SVGs with text alternatives; category fallbacks remain decorative. Toolkit field guidance is stacked on mobile, with no horizontally scrolling primary field table.

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

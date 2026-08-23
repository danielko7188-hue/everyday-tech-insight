# Everyday Tech Insight

Everyday Tech Insight is a static, source-backed publication for small-business decision makers choosing, using, securing, and governing everyday technology.

The site is built with Astro and contains five categories, fifteen practical guides, four downloadable decision worksheets, trust pages, an HTML sitemap, XML sitemaps, and RSS. Primary content renders as HTML without client-side JavaScript.

## Current publication boundary

- Public byline: `Everyday Tech Insight`, a publication name only.
- Production canonical: `https://everyday-tech-insight.vercel.app/`.
- Contact and corrections: the public GitHub issue tracker linked from the site.
- Advertising, analytics, affiliate links, sponsorship, and consent tooling: disabled.
- AdSense: no publisher ID, ad code, `ads.txt`, review request, or approval claim.
- Human editorial, legal, privacy, ownership, and content-rights review: still required before any AdSense application.

Google alone decides AdSense eligibility and approval.

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
npm run build
npm run preview
```

Focused checks:

```text
npm run format:check
npm run lint
npm run typecheck
npm test -- --run
npm run check:content
npm run check:seo
npm run check:links
npm run test:e2e
npm run lighthouse
```

`npm run check:links` checks article sources and every external HTTP(S) destination rendered in public HTML. It uses `PASS`, `FAIL`, and `UNVERIFIED` deliberately. Plain HTTP, a definitive 404/410, or a blocked unsafe target is `FAIL`; access controls, rate limits, server errors, timeouts, and network failures are `UNVERIFIED`. Either state blocks the full QA command until a human can establish the destination is reachable.

## Repository map

- `src/content/articles/`: article source files and source records.
- `public/toolkit/`: blank first-party CSV worksheets linked from the Toolkit page.
- `src/pages/`: generated public route templates.
- `src/layouts/` and `src/components/`: shared publication shell.
- `src/data/`: publication and category configuration.
- `site.config.mjs`: the single source of truth for the canonical origin and publication identity used by Astro, runtime pages, robots, and QA.
- `scripts/`: content, built-output, external-link, and Lighthouse QA.
- `tests/`: unit, route, responsive, keyboard, and accessibility contracts.
- `docs/`: editorial evidence, assumptions, review gates, deployment, and QA records.

Generated folders such as `dist/`, `.astro/`, `.vercel/`, and `.lighthouseci/` are intentionally ignored. Edit source files, never generated output.

## Add or update an article

1. Add or revise one Markdown file in `src/content/articles/`.
2. Keep the slug and file name identical.
3. Complete all topic-fit fields and include at least two current HTTPS primary sources.
4. Cite every frontmatter source URL in the article body.
5. Use `datePublished` only for first publication. Omit `dateModified` at initial publication; add it only on a later calendar date after a substantive change. Update `lastReviewed` after a real review. Dates may advance through the current date but never be backdated before the confirmed launch.
6. Keep unfinished work out of `published` status.
7. Run `npm run qa` and complete the human review checklist before release.

See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md), [Technical QA](docs/TECHNICAL_QA.md), and [Assumptions](docs/ASSUMPTIONS.md) for operating details.

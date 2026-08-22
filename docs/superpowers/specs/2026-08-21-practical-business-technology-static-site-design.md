# Everyday Tech Insight Practical Business Technology Site Design

**Date:** 2026-08-21  
**Status:** Approved by delegated user judgment  
**Target:** GitHub source repository and Vercel production deployment  
**Evidence boundary:** This is a new, isolated static site. It must not contain or publish any Blogger XML, publisher ID, verification token, account evidence, or private operator artifact from the parent workspace.

## Decision

Build a separate Astro static publication under the existing public brand **Everyday Tech Insight**. This is safer and more maintainable than rewriting the current Blogger control room, and it directly supports the requested typed content model, deterministic routes, build-time validation, Vercel deployment, and Git-based editorial workflow.

The production project will use `https://everyday-tech-insight.vercel.app/` if Vercel assigns that canonical domain. If Vercel assigns a different production hostname, update the site configuration and rebuild before the final production handoff.

## Considered approaches

### 1. Separate Astro/Vercel publication — selected

- Preserves the existing Blogger workspace and its private identifiers.
- Supports typed content collections, exact draft/review/published filtering, custom category routes, static feeds and sitemaps, and strong automated QA.
- Requires a new GitHub repository and Vercel project, but the user explicitly authorized both.

### 2. Adapt the current Blogger property

- Preserves existing URLs and Blogger content management.
- Cannot satisfy the requested Astro/Replit-style content schema, route inventory, repository workflow, or Vercel deployment without substantial compromise.
- Carries live widget-graph, account, and identifier risks that are unrelated to the new editorial build.

### 3. Replace Blogger with a full migration

- Could eventually consolidate the properties.
- Requires a content export, redirect map, custom-domain decision, account review, and explicit live migration authorization. It is outside this build.

## Identity and truth boundary

- Site name: `Everyday Tech Insight`, established by the existing public project.
- Tagline: `Practical guidance for choosing, using, and securing business technology.`
- Public byline: `Everyday Tech Insight`, described only as the publication name—not a person, company, team, credential, or legal entity.
- No personal owner biography, location, credentials, or first-hand testing claims are invented.
- Contact and correction requests use the public GitHub issue tracker. Visitors are warned not to post private information.
- `Person`, `Organization`, and author structured data are withheld until truthful owner facts are supplied.
- AdSense, analytics, affiliate links, sponsored content, and consent tooling are disabled.
- The deployed site is a functioning information publication, but it is not represented as ready for an AdSense application until the owner identity, legal/privacy, content-rights, and human-review gates are completed.

## Editorial architecture

Five integrated categories:

1. AI & Automation
2. Business Software & SaaS
3. Cybersecurity & Data Protection
4. Digital Operations & Productivity
5. Technology Decisions & Strategy

The initial portfolio contains three articles per category. Every published entry must declare and pass:

- a specific business problem;
- a central technology focus;
- a defined small-business reader;
- a practical reader outcome; and
- traceable source support.

All 15 articles use the genuine first-publication date of 2026-08-21. No dates are staggered or backdated. No owner columns are published because no genuine owner notes were provided.

## Information architecture

Public routes:

- `/`
- `/categories/`
- `/categories/[slug]/`
- `/articles/[slug]/`
- `/about/`
- `/publisher/`
- `/editorial-standards/`
- `/corrections/`
- `/contact/`
- `/privacy/`
- `/advertising-disclosure/`
- `/sitemap/`
- `/rss.xml`
- `/robots.txt`
- `/sitemap-index.xml` and generated sitemap files
- `/404.html`

Only `published` entries generate article pages, category listings, homepage cards, feeds, or sitemap entries. Draft and review entries remain repository-only.

## Visual system

Quiet editorial design with no stock imagery, gradients, popups, carousels, fake dashboards, or promotional social proof.

- Ink: `#172033`
- Navy: `#15314B`
- Teal: `#0B6B68`
- Amber: `#C77A16`
- Canvas: `#F7F5EF`
- Surface: `#FFFFFF`
- Muted: `#5C6675`
- Border: `#D8D9D3`
- Focus: `#FFBF47`

Use system sans-serif text and a system serif display stack. The homepage uses an editorial lead and category index rather than a generic marketing hero. Articles use a 68–72ch reading measure, visible source lists, practical checklists, and restrained callouts. Controls meet a 44px target where practical, focus is always visible, and reduced-motion preferences are respected.

## Technical architecture

- Astro 7 static output
- TypeScript strict mode
- Astro content collections with schema validation
- Vanilla CSS and minimal/no client JavaScript
- `@astrojs/sitemap` and `@astrojs/rss`
- Vitest for content/model utilities
- Astro Check and ESLint for source validation
- Playwright plus axe for rendered routing, accessibility, mobile, and 404 tests
- A build-output QA script for internal links, metadata, canonicals, headings, sitemap membership, and draft exclusion
- Lighthouse CI for representative performance/accessibility/best-practice/SEO evidence when Chromium runs reliably

Astro static sites need no Vercel adapter unless Vercel runtime services are used. This site uses no server rendering or runtime service.

## Metadata and structured data

- Unique title, description, canonical, robots, Open Graph type/title/description/URL per indexable page.
- `WebSite` JSON-LD on the home page and `BreadcrumbList` where visible breadcrumbs exist.
- No fabricated author/publisher entity, ratings, reviews, FAQ markup, or social preview image.
- Real Vercel production URL becomes the canonical site URL.

## Security and privacy

- No secrets, tokens, account IDs, analytics IDs, or ad code.
- No contact form or fake backend.
- Static security headers are configured in `vercel.json`.
- Repository and deployment contain only the isolated project.
- `.vercel`, environment files, build output, and test reports remain untracked.

## Error handling and resilience

- Invalid frontmatter fails the build.
- Unknown article/category routes return the generated 404 page.
- Missing internal routes fail QA.
- Missing or invalid sources, duplicate slugs/titles/descriptions, placeholder text, future/backdated dates, and non-published output fail content QA.
- External source checks record network limitations rather than silently passing.

## Acceptance

Before GitHub push and Vercel deployment:

- dependency install, format, lint, type check, unit tests, production build, content checks, SEO checks, and link checks pass;
- rendered representative routes pass Playwright and axe;
- Lighthouse runs are recorded or an honest tooling limitation is documented;
- all 15 published articles pass the Business Technology Fit Test and source audit;
- no placeholders, private values, invented identity claims, AdSense code, analytics code, drafts, review content, or fake legal assurances appear in `dist/`;
- Git history contains only this new static project;
- the exact pushed commit is deployed to Vercel and the production URLs are rechecked.

Google alone decides AdSense approval. This build does not request review and cannot guarantee approval.

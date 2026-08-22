# Everyday Tech Insight Editorial Balance V2

## Status and authority

The owner asked for a stronger overall result and explicitly delegated the design judgment: “알아서 잘 improve 해줘.” This specification selects the recommended direction and authorizes implementation within the static Astro publication. It does not authorize changes to the separate Blogger theme, advertising, analytics, consent, AdSense, owner identity, or factual article claims.

## Evidence-based diagnosis

The current **Signal & Structure** visual language is credible and distinctive, but the composition overstates a fifteen-article library.

- The homepage is approximately 10,272px tall at 1440px and 15,851px tall at 390px.
- It renders 30 article-link placements for 15 unique articles, so every article is repeated.
- The first story headline begins below the first viewport on desktop and mobile.
- Category pages use the same category diagram for the hero and each article, making distinct guides look interchangeable.
- Category pages delay the first article headline until roughly one viewport down.
- On mobile article pages, the first substantive section begins about 2.86 viewports down because breadcrumbs, hero art, metadata, and the four-part fit module stack before the prose.
- At 1920px, display type grows without enough width, causing more headline wrapping than at 1440px.
- Trust signals are accurate but appear too late to help first-impression credibility.

The problem is not insufficient decoration. It is insufficient editing: too many modules, repeated content, repeated art, and weak separation between primary, supporting, and utility material.

## Considered approaches

1. **Issue Front Page — selected.** Preserve the existing brand system but rebuild the composition around one lead package, a small number of non-overlapping story groups, a compact topic directory, and early evidence cues. This best improves balance, scanability, and credibility without changing factual content.
2. **Incremental polish.** Reduce padding and font sizes while keeping the same modules. This is lower risk but leaves duplicate article placement and structural repetition intact.
3. **High-energy digital magazine.** Add more imagery, motion, color, and visual modules. This may feel more dramatic, but it would increase noise, performance cost, and the risk of generic technology-brand styling.

## Design direction: Issue Front Page

The site should feel like a carefully edited issue, not a catalog that gives every item equal weight. Preserve the warm paper palette, Newsreader/Source Sans pairing, square geometry, disciplined rules, truthful publication mark, and five category accents. Change the hierarchy, density, and use of artwork.

### Hierarchy rules

Only three story treatments remain:

1. **Lead feature:** one dominant story with one illustration.
2. **Supporting headline:** medium-weight story with metadata and a concise deck, normally without art.
3. **Compact index item:** headline-first row with metadata and no art.

Category emblems appear once per page. Decorative art must clarify a lead, not fill every card. Repeated red eyebrows, white boxes, and large diagrams are reduced so major sections do not all carry the same visual weight.

## Homepage composition

### Opening viewport

- Replace the oversized mission hero with a slim publication-promise line.
- Put one complete lead-story package in the opening 12-column composition.
- Pair it with two typography-led supporting stories.
- Ensure a complete story headline and clear destination appear in the first viewport at 1440×900 and 390×844.
- Keep one lead illustration only; supporting stories remain image-free.

### Remaining page

Assign article placements in deterministic priority order and de-duplicate them before rendering. Every homepage article destination may appear at most once.

1. Lead package: 3 unique stories.
2. Latest briefing: 3 different stories.
3. Start here: 3 different foundational guides.
4. Topic directory: 5 compact category rows containing topic purpose, article count, and category link, not repeated article cards.
5. More guides: the remaining unique stories as compact index rows.
6. Evidence ribbon: sourcing, corrections, commercial status, and publication-byline boundaries with links to the existing trust pages.

Remove the redundant full “Latest articles” repetition and the five oversized category shelves. All fifteen articles remain reachable, but no article is promoted twice on the same homepage.

Target outcome: reduce homepage height by at least 35% at both 1440px and 390px while preserving all routes and article discoverability.

## Category-page composition

- Combine the compact topic introduction and lead story within the opening viewport.
- Use the category illustration once as the page’s visual anchor.
- Present the remaining two guides as typography-led ordered entries without repeated art.
- Keep the complete category membership visible and preserve category breadcrumbs, metadata, and accent color.
- Target the first article headline above 760px at 1440×900 and above 820px at 390×844.

## Article-page composition

### Header and evidence

- Cap wide-screen headline size and allow the text column to widen so 1920px never wraps a headline more than 1440px.
- Keep the category, content type, genuine dates, reading time, truthful byline, and breadcrumb data.
- Hide the redundant current-page breadcrumb label visually on mobile while retaining semantic breadcrumb data.
- Use smaller hero art on desktop and omit decorative hero art on narrow mobile screens.
- Add a compact evidence strip near the deck using only computed or existing facts: source count, last-reviewed date, editorial standards link, and corrections link.

### Faster start on mobile

- Keep the four Business Technology Fit fields visible in a compact desktop grid.
- On mobile, place the same fields inside a native `details` disclosure titled “Business technology fit.” No JavaScript is added, and all content remains accessible.
- Target the first substantive article paragraph by approximately 1.5–1.75 390×844 viewports.

### Reading instruments

Do not fabricate new research or claims. Improve scannability using only existing article material:

- style existing Markdown tables as decision instruments;
- strengthen list, step, warning, and comparison treatments;
- keep the sticky desktop table of contents and compact mobile disclosure;
- keep sources, related reading, corrections, limitations, and publication-boundary text prominent.

This iteration does not rewrite all fifteen articles or invent diagrams unsupported by their text.

## Supporting and trust pages

- Center long-form trust/legal content within a deliberate reading frame on large screens.
- When a real page outline exists, use a restrained sticky contents rail; otherwise do not manufacture filler.
- Move the homepage evidence ribbon earlier so users can reach standards, corrections, privacy, and disclosure routes without traversing the whole page.

## Responsive and accessibility behavior

- Required widths remain 360, 390, 768, 1024, 1280, 1440, and 1920px.
- Keep the compact native menu through the tablet range; do not force the five-link desktop taxonomy rail into undersized type before approximately 900px.
- Let the mobile menu expand in normal document flow or use a fully opaque bounded sheet; it must not expose partial underlying sentences behind an open menu.
- Use a two-column mobile footer below the full-width publication identity so the footer does not consume roughly one-third of a short category page.
- Keep table text readable on narrow screens by providing a contained horizontal reading region rather than shrinking three-column tables to 13px.
- Give topic-directory actions and other prominent navigation links a practical 44px minimum target on mobile.
- Preserve logical source order, one H1, landmarks, keyboard navigation, native menu semantics, visible focus, zoom usability, and reduced-motion handling.
- Body text remains at least 16px, article text 18–19px, metadata at least 14px, and interactive controls approximately 44px where practical.
- No horizontal overflow, orphaned metadata separators, or clipped headlines are allowed.
- Link destinations remain visually identifiable without relying on hover or color alone.

## Component and data boundaries

- The homepage route owns selection and de-duplication. It passes explicit article groups to presentational components.
- Story components remain content-agnostic and render one of the three approved treatments.
- Category pages render one visual anchor and typography-first remaining entries.
- Article layout computes source count and uses existing dates and links; it never creates identity or credential claims.
- Existing article Markdown, routes, frontmatter, citations, RSS, sitemaps, canonical URLs, metadata, and structured-data boundaries remain unchanged unless a test-proven presentation fix requires otherwise.

## Error and fallback behavior

- If fewer than the expected featured articles exist, selection falls back to the next published article without duplicating an already assigned slug.
- If a category has no valid visual, the layout remains complete as typography-first content with no empty placeholder.
- If an article has no headings, the table of contents remains absent.
- Disabled monetization continues to render no element or layout gap.

## Testing contract

Add or update tests before implementation for the new observable contracts:

- no duplicate article destination on the homepage;
- all fifteen published articles remain reachable from the homepage or topic directory flow;
- first-story and first-guide positions meet the opening-viewport targets;
- category art appears once per category page;
- mobile article hero art is omitted and Business Technology Fit uses a native disclosure;
- 1920px headline wrapping is no worse than 1440px;
- trust links appear in the early homepage evidence ribbon;
- all existing content, SEO, privacy, no-script, accessibility, responsive, and route contracts continue to pass.

Before release, run formatting, lint, Astro type checks, unit tests, production build, content QA, SEO/build QA, external-link checks, Playwright/axe, responsive checks, and Lighthouse. Capture and inspect before/after screenshots for homepage, category, article, and a trust page at desktop and mobile.

## Release boundaries

- Push GitHub first, confirm the remote commit, then deploy Vercel production.
- Verify live 200/404 behavior, metadata, security headers, fonts, RSS, sitemap, and representative rendering.
- Keep advertising, analytics, CMP, tracking, and AdSense disabled.
- Keep the separate Blogger theme untouched and Preview-only.
- Automated checks do not complete human editorial, legal, ownership, privacy, accessibility, or content-rights review.

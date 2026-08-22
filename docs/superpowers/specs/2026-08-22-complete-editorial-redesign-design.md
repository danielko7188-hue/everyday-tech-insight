# Everyday Tech Insight Complete Editorial Redesign

## Status and authority

This document translates the owner's complete-redesign brief into an implementation contract for the isolated Astro publication at `everyday-tech-insight-static`. The supplied brief is specific and explicitly says to proceed through implementation, so it is treated as the approved direction. The separate Blogger XML/theme project remains untouched and `PREVIEW ONLY - DO NOT SAVE OR PUBLISH`.

## Diagnosis

The current site is structurally sound, fast, truthful, and readable, but its visual language is too uniform. One two-column list pattern serves the homepage, categories, and article collections; the header is a small utility bar; cards have no visual distinction; the homepage lacks a dominant story; category identity is weak; and article pages do not provide a table of contents, reading-time cue, or editorial art. The result reads more like a well-formatted reference site than a designed technology publication.

## Considered approaches

1. **Signal & Structure — selected.** Warm editorial paper, deep ink, a vermilion publication accent, restrained topic colors, Newsreader display type, Source Sans 3 body/UI type, asymmetric modular grids, and original diagrammatic artwork. It delivers the requested 80% timeless editorial / 20% modern technology balance without imitating a reference publication.
2. **Monochrome journal.** Nearly black-and-white, typography-led, and highly restrained. It would feel premium but would under-serve topic discovery and the requested technology energy.
3. **High-energy technology magazine.** Dark surfaces, saturated topic colors, and more aggressive modular composition. It would be distinctive but risks looking theatrical, trend-led, or like a generic technology brand rather than practical guidance for business operators.

## Brand system: Signal & Structure

### Identity

- Keep the full name `Everyday Tech Insight` prominent and legible.
- Use `ETI` only as a compact secondary mark inside a strict square frame.
- Build the wordmark from accessible text and CSS. No copied logo, proprietary type, or invented organization claim.
- Use an editorial positioning line: practical, independent guidance for business technology decisions.

### Typography

- Display/headlines: **Newsreader Variable**, self-hosted through the OFL-1.1 `@fontsource-variable/newsreader` package.
- Body/UI/metadata: **Source Sans 3 Variable**, self-hosted through the OFL-1.1 `@fontsource-variable/source-sans-3` package.
- Article body: 18–19px responsive size, approximately 70 characters per line, generous leading.
- Headlines use optical sizing and restrained negative tracking. Metadata remains at least 14px with high contrast.
- Fonts use `font-display: swap`; system fallbacks remain available.

### Color

- Ink: `#171918`
- Soft ink: `#3f4544`
- Canvas: `#f2efe7`
- Paper: `#fffdf8`
- Rule: `#c9c5ba`
- Muted: `#59605e`
- Publication accent: vermilion `#d84a2f`, with dark interaction state `#8f2f20`
- Focus: gold `#f2b134` paired with dark ink
- Topic accents, used only for small labels, rules, and artwork:
  - AI & Automation: `#0f746c`
  - Business Software & SaaS: `#315f98`
  - Cybersecurity & Data Protection: `#a83d3a`
  - Digital Operations & Productivity: `#397143`
  - Technology Decisions & Strategy: `#9a5b13`
- Full-page category backgrounds and rainbow card systems are prohibited.

### Geometry, spacing, and motion

- Use a 4px base spacing unit with a comfortable editorial scale from 4px to 96px.
- Use square geometry for major editorial modules, 2–6px radii only on small controls and bounded callouts, and no giant rounded cards.
- Use rules, alignment, and background shifts instead of shadows for hierarchy.
- Use 160–220ms transitions for links, menu states, and visual hover treatment.
- Respect `prefers-reduced-motion`; no scroll hijacking, autoplay, carousels, or decorative entrance animation.

## Layout system

- Publication maximum width: 84rem.
- Reading column: approximately 44rem / 68–74 characters.
- Desktop grid: 12 columns, with intentionally unequal spans.
- Tablet: 6 columns.
- Mobile: one logical source order with the lead story first.
- Breakpoints are content-driven around 480px, 768px, and 1080px; required QA widths are 360, 390, 768, 1024, 1280, 1440, and 1920.

## Original editorial-art system

Create a reusable local SVG component with five visual grammars:

- AI & Automation: branching workflow nodes and decision paths.
- Business Software & SaaS: layered modules and connected service blocks.
- Cybersecurity & Data Protection: protected boundaries, segmented grids, and controlled access paths.
- Digital Operations & Productivity: routed work streams, handoff points, and process lanes.
- Technology Decisions & Strategy: decision matrices, axes, and directional markers.

The component is decorative (`aria-hidden`) because adjacent text carries the story meaning. Article slug-derived variants change placement and rhythm so the artwork is not mechanically repeated. SVG uses current design tokens, explicit aspect ratios, no remote assets, and no testing/photo implication.

## Components and behavior

### Masthead

- Two-level desktop header: publication identity/utility row, then the five topic links.
- Compact mobile masthead with native `details`/`summary` menu for keyboard and screen-reader support without client JavaScript.
- Active route indicated with `aria-current` and a visible accent rule.
- No search control is shown in this release because a static, fully tested search destination is not part of the verified content architecture. This is preferable to fake search.

### Story system

- `ArticleCard` supports meaningful `lead`, `feature`, `standard`, `compact`, and `list` variants.
- Shared metadata displays content type, category, genuine date, and computed reading time.
- Labels are typographic, not universal pills.
- Original editorial art is used for visual variants; compact lists remain image-free.

### Homepage

- Dominant lead story with editorial art and two secondary stories.
- Three-item numbered latest/briefing strip.
- Start Here module using selected featured practical guides.
- Five topic sections, each with one highlighted article and two supporting articles; section orientation varies by index while source order remains consistent.
- Compact latest-articles feed designed to scale beyond fifteen entries.
- Restrained transparency module covering sourcing, corrections, guide production, and the publication-name byline.

### Category pages

- Distinct topic accent and original art.
- One lead article, two supporting features, and a complete compact listing.
- All real articles remain linked so the existing category-membership QA contract is preserved.
- Category index becomes a designed editorial directory rather than a generic two-column list.

### Article pages

- Category/content-type labels, headline, deck, publication-name byline, genuine dates, and computed reading time.
- Original category visual in the article header.
- Four-part Business Technology Fit decision module.
- Generated table of contents from real Markdown headings: sticky desktop rail, native collapsible mobile presentation, anchor links, and reduced-motion-safe scrolling.
- Reading column at 65–75 characters with improved headings, lists, procedures, tables, blockquotes, warnings, sources, and link/focus styling.
- Prominent sources, truthful byline boundary, corrections route, and related articles based only on existing explicit relationships.

### Supporting pages and footer

- Trust/legal pages use the shared editorial page shell, strong intro treatment, measured reading width, and section rules without changing factual content.
- Footer groups Publication, Topics, Standards & Transparency, and Legal & Feeds. No invented social profiles or newsletter form.

### Future advertising architecture

- Add a reusable reserved-dimension ad-slot component gated by `site.integrations.monetization.enabled`.
- With the current false configuration it renders nothing: no fake ad, empty box, script, publisher ID, or layout gap.
- A future enabled state must be explicitly configured, clearly labeled, and separately privacy/policy tested.

## SEO, accessibility, and performance

- Preserve routes, canonical URLs, metadata, RSS, sitemap, robots directives, BreadcrumbList, and factual WebSite schema.
- Do not add fictional Person or Organization data. Article schema remains omitted until a truthful author/publisher entity model is available.
- Preserve one H1, landmarks, skip link, semantic lists/tables, underlined body links, and 44px practical touch targets.
- Use visible high-contrast focus treatment, accessible native menu semantics, logical source order, and AA color combinations.
- Keep static rendering and avoid hydration. Local SVG and self-hosted font subsets are the only new visual requests.
- Fonts are preloaded only when verified useful; below-fold art remains ordinary static SVG markup.

## Testing contract

- Unit-test reading-time calculation and deterministic visual variant selection.
- Extend Playwright tests for the mobile menu, table of contents, card hierarchy, category/article visuals, reading width, required viewports, overflow, focus, and reduced motion.
- Preserve content, metadata, route, source, no-tracking, RSS, sitemap, and 404 checks.
- Run formatting, lint, Astro type checks, unit tests, production build, content QA, SEO/build QA, external-link checks, Playwright/axe, and Lighthouse.
- Inspect homepage, category, article, all trust/legal pages, sitemap, RSS, and 404 on the production deployment; confirm no console errors.

## Explicit boundaries

- Preserve all fifteen articles, their URLs, factual text, citations, dates, and publication-name byline boundary.
- Do not modify the parent Blogger theme or claim Blogger/AdSense readiness.
- Do not activate ads, analytics, consent tooling, newsletter capture, social proof, or unverified author identity.
- Google alone decides AdSense approval; human editorial, legal, privacy, accessibility, and rights review remains open.

# Everyday Tech Insight Design System

## Status and scope

This document records the approved **Signal & Structure** editorial system for the Astro publication. It governs the static site only. It does not authorize changes to the separate Blogger theme, live publishing, analytics, advertising, consent tooling, or AdSense configuration.

The design balances approximately 80% timeless editorial character with 20% modern technology energy. It must preserve the publication's factual content, routes, metadata, accessibility, privacy boundaries, and static rendering.

## Publication identity

- The primary name is **Everyday Tech Insight** and must remain visible and legible.
- `ETI` is a compact secondary mark inside a strict square frame. It is never the only accessible name where the full publication name can be shown.
- The mark is built from text and CSS. Do not copy a logo, imply a separate organization, or invent a person, credential, endorsement, or publisher identity.
- Editorial positioning: practical, independent guidance for business technology decisions.

## Typography

- Display and headline family: **Newsreader Variable**.
- Body, user-interface, and metadata family: **Source Sans 3 Variable**.
- Installed self-hosted packages: `@fontsource-variable/newsreader@5.3.0` and `@fontsource-variable/source-sans-3@5.3.0`.
- The installed package metadata and bundled license files were inspected on 2026-08-22; both declare the **SIL Open Font License 1.1 (OFL-1.1)**. Retain those package license files in dependency distributions.
- Only the required upright variable CSS should be imported. Use `font-display: optional` and keep suitable system fallbacks.
- Article body text should be 18–19px responsively, with generous leading and a 65–75 character measure.
- Headlines use optical sizing and restrained negative tracking. Metadata must remain at least 14px with strong contrast.

The exact font packages above are installed dependencies in this phase, and the stylesheet imports only their upright variable CSS.

## Color tokens

| Role                     | Exact value |
| ------------------------ | ----------- |
| Ink                      | `#171918`   |
| Soft ink                 | `#3f4544`   |
| Canvas                   | `#f2efe7`   |
| Paper                    | `#fffdf8`   |
| Rule                     | `#c9c5ba`   |
| Muted                    | `#59605e`   |
| Publication accent       | `#d84a2f`   |
| Accent interaction state | `#8f2f20`   |
| Focus                    | `#f2b134`   |

Category accents are limited to small labels, rules, focus-safe decorative details, and editorial artwork:

| Category                          | Exact value |
| --------------------------------- | ----------- |
| AI & Automation                   | `#0f746c`   |
| Business Software & SaaS          | `#315f98`   |
| Cybersecurity & Data Protection   | `#a83d3a`   |
| Digital Operations & Productivity | `#397143`   |
| Technology Decisions & Strategy   | `#9a5b13`   |

Do not use full-page category backgrounds, rainbow card systems, gradients, or color alone to communicate meaning.

## Spacing, geometry, and hierarchy

- Base spacing unit: **4px**.
- Editorial spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, and 96px.
- Major editorial modules use square geometry.
- Small controls and bounded callouts may use 2–6px radii.
- Giant rounded cards and ornamental shadows are prohibited.
- Create hierarchy with rules, alignment, whitespace, typography, and restrained background shifts.

## Layout

- Publication maximum width: **84rem**.
- Reading-column target: **44rem**, approximately 68–74 characters in the normal body treatment.
- Desktop: 12-column grid with intentionally unequal spans.
- Tablet: 6-column grid.
- Mobile: one logical source order, with the lead story first.
- Content-driven breakpoints are centered around 480px, 768px, and 1080px.
- Required QA widths are 360, 390, 768, 1024, 1280, 1440, and 1920px.

The layout must preserve one H1, logical landmarks and source order, visible focus, usable zoom, and no ordinary-content horizontal overflow.

## Motion and interaction

- Link, menu-state, and visual-hover transitions last **160–220ms**.
- Motion must not carry essential meaning.
- Respect `prefers-reduced-motion` and remove nonessential transitions when requested.
- Do not add scroll hijacking, autoplay, carousels, parallax, decorative entrance animation, or client-side hydration for presentation.
- Touch targets should be practical at approximately 44px where the control permits it.

## Editorial artwork

All publication artwork is deterministic local inline SVG using design tokens, explicit aspect ratios, and no remote requests. Each of the fifteen articles has a stable, unique visual key and an informative composition with a nonempty text alternative, `role="img"`, unique title/description IDs, and an optional visible caption. Unknown informative keys fail instead of silently falling back. Category-level fallback art remains decorative with `aria-hidden="true"`. Neither form suggests that a photograph, product test, measured result, or firsthand demonstration occurred.

The five category grammars are genuinely distinct:

1. **AI & Automation:** branching workflow nodes and decision paths.
2. **Business Software & SaaS:** layered modules and connected service blocks.
3. **Cybersecurity & Data Protection:** protected boundaries, segmented grids, and controlled access paths.
4. **Digital Operations & Productivity:** routed work streams, handoff points, and process lanes.
5. **Technology Decisions & Strategy:** decision matrices, axes, and directional markers.

The article metadata selects one of thirteen supported visual families and a stable story-specific symbol. Decorative category art may use a slug-derived numeric variant so placement and rhythm change without randomness or client JavaScript.

## Core compositions

### Masthead

- Desktop uses a publication identity/utility row followed by the five topic links.
- Mobile uses native `details` and `summary` semantics.
- Active routes use `aria-current` plus a visible accent rule.
- No search control appears until a real static search destination exists and is tested.

### Story system

- Story treatments are `lead`, `feature`, `standard`, `compact`, and `list`.
- Shared metadata contains the real content type, category, publication date, and computed reading time.
- Labels are typographic, not universal pills.
- Lead, feature, and standard treatments may use original editorial art. Compact lists remain image-free.
- Editorial headlines must preserve whole words at every required QA width; a larger display size is never allowed to create an isolated character or mid-word line break.

### Homepage and categories

- The homepage leads with one dominant illustrated story and two typographic secondary stories, followed by a three-item guide list and three-item practical-foundations list.
- The homepage exposes exactly nine distinct, explicitly curated guides. `/articles/` is the complete archive and groups all fifteen published guides once across the five topics.
- Each of the five topic rows provides a direct category path and a concise editorial cue without repeating the same article cards.
- The homepage and each category opening use at most one editorial illustration. Additional hierarchy comes from typography, numbering, rules, and whitespace.
- The lower “How we work” module may describe sourcing, corrections, guide production, and the publication-name byline only within the verified factual boundary.
- Category pages select from membership-driven compositions: compact for fewer than six guides, editorial for six through eleven, and featured/recent/archive for twelve or more. Every real category article remains linked exactly once in stable order.

### Article pages

- Headers contain real category/content-type labels, headline, deck, publication-name byline, genuine dates, computed reading time, and a story-specific informative visual. The visual remains available at mobile widths and must not cause horizontal overflow.
- The Business Technology Fit module retains its four factual decision fields.
- Article evidence exposes only measured facts: cited-source count, genuine publication and review dates, and links to standards and corrections. At tablet width it uses a balanced two-by-two grid, expanding to one desktop row only when there is enough space.
- The Business Technology Fit module and a single table-of-contents content structure are generated from real content. CSS changes its placement responsively without duplicating its heading/link structure in the document.
- Markdown tables sit inside named, keyboard-focusable horizontal regions and retain a 16px minimum text size on narrow screens.
- Body links remain visibly underlined, and sources, corrections, truthful byline boundaries, and explicit related-article relationships remain prominent.
- Do not add fictional Person, Organization, or Article entities.

### Supporting pages and footer

- Trust and legal pages share an editorial page shell and measured reading width without changing their factual copy.
- Footer groups are Publication, Topics, Standards & Transparency, and Legal & Feeds.
- Do not invent social profiles or add an unimplemented newsletter form.

### Toolkit

- The Toolkit landing page exposes exactly four typed resources with outcome, detail, related-guide, and direct CSV actions.
- Each detail route explains purpose, audience, when to use, when not to use, field definitions, limitation, data notice, related guide, and download without claiming an observed result.
- Stacked semantic field cards are the primary mobile guide. A wide-only table may supplement them, but the primary 390px experience must not require horizontal scrolling.

## Advertising boundary

`site.integrations.monetization.enabled` is currently `false`. In this state the reusable ad-slot component renders no element, text, script, publisher identifier, empty box, or layout gap.

If a future reviewed configuration explicitly enables the component, it may render only a reserved-dimension region labeled **Advertising**. Network code, ad requests, identifiers, analytics, and consent behavior require separate implementation and privacy/policy testing.

## Asset, performance, and accessibility rules

- Use only self-hosted fonts, local inline SVG, and existing local content assets.
- No remote visual assets, executable client JavaScript, tracking, or third-party presentation runtime.
- Font preloads are added only when measured and verified useful.
- Preserve static generation, canonical URLs, factual metadata, RSS, sitemap, robots directives, BreadcrumbList data, one H1, semantic lists and tables, the skip link, and underlined body links.
- Use visible high-contrast focus treatment and color combinations that meet WCAG AA for their actual text size and use.
- Preserve practical keyboard access, 200% zoom usability, reduced-motion handling, and logical mobile source order.
- Social previews are deterministic local 1200×630 PNGs: one default, five category images, and fifteen story-specific article images. Builds use only the validated `PUBLIC_SITE_URL` HTTPS origin and ignore preview-host environment variables.

## Change control and verification

Any visual-system change must preserve the no-tracking, no-ad-output, no-invented-identity, no-remote-asset, and static-rendering boundaries. Validate formatting, lint, Astro type checks, unit tests, production build, content/SEO/link checks, Playwright/axe, required viewport behavior, and Lighthouse before a release claim. The deterministic visual project additionally compares 32 reviewed screenshots at 390, 768, and 1440 CSS pixels with DPR 1, fixed 900px height, reduced motion, loaded local fonts, and a documented 0.1% pixel-ratio tolerance. Local validation does not imply deployment, Blogger publication, AdSense readiness, or Google approval.

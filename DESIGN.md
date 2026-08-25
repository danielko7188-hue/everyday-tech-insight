# Everyday Tech Insight Design System

## Status and scope

This document records the approved **Purple Signal / A Balanced Signal** editorial system for the Astro publication. It governs the static site only. It does not authorize changes to the separate Blogger theme, live publishing, analytics, advertising, consent tooling, or AdSense configuration.

The design balances approximately 70% disciplined editorial character with 30% modern technology energy. A deep-purple publication frame, violet-to-magenta signal details, serif headlines, and evidence-led copy distinguish the publication without manufacturing authority. The system must preserve factual content, routes, metadata, accessibility, privacy boundaries, and static rendering.

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
| Night publication frame  | `#0d0618`   |
| Deep navigation surface  | `#17102a`   |
| Raised dark surface      | `#24143d`   |
| Ink                      | `#171221`   |
| Paper                    | `#faf8ff`   |
| Mist                     | `#f4f0ff`   |
| White                    | `#ffffff`   |
| Violet signal            | `#7c3aed`   |
| Violet interaction state | `#5b21b6`   |
| Lavender                 | `#c4b5fd`   |
| Magenta signal           | `#d946ef`   |
| Light rule               | `#ddd6fe`   |
| Dark rule                | `#3a2e51`   |
| Light-surface muted text | `#5b5566`   |
| Dark-surface muted text  | `#c9c3d8`   |
| Focus on dark surfaces   | `#fde047`   |
| Focus on light surfaces  | `#5b21b6`   |

Category accents are limited to small labels, rules, focus-safe decorative details, and editorial artwork:

| Category                          | Exact value |
| --------------------------------- | ----------- |
| AI & Automation                   | `#6d28d9`   |
| Business Software & SaaS          | `#4338ca`   |
| Cybersecurity & Data Protection   | `#a21caf`   |
| Digital Operations & Productivity | `#5b21b6`   |
| Technology Decisions & Strategy   | `#be185d`   |

The violet-to-magenta gradient is reserved for small publication-signal details. Category color is never the only carrier of meaning.

## Spacing, geometry, and hierarchy

- Base spacing unit: **4px**.
- Editorial spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, and 96px.
- Major modules use restrained 8–16px radii where the boundary improves scanning.
- Giant rounded cards and ornamental shadows are prohibited.
- Create hierarchy with rules, alignment, whitespace, typography, and restrained background shifts.

## Layout

- Publication maximum width: **84rem**.
- Reading-column target: **44rem**, approximately 68–74 characters in the normal body treatment.
- Desktop: 12-column grid with intentionally unequal spans.
- Tablet: 6-column grid.
- Mobile: one logical source order, with the lead story first.
- Content-driven breakpoints are centered around 480px, 768px, and 1080px.
- Required QA widths are 320, 360, 390, 768, 1024, 1280, 1440, and 1920px.

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

- Desktop uses a deep-purple publication identity/utility row followed by five topic links on a distinct dark surface.
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

- The homepage opens full-bleed in the night palette with the promise **Make technology decisions you can explain.** A 5/7 desktop composition pairs that promise with one dominant illustrated guide and two typographic support guides.
- Three latest guides, three practical foundations, and the opening curation expose exactly nine distinct guide destinations.
- The homepage exposes exactly nine distinct, explicitly curated guides. `/articles/` is the complete archive and groups all fifteen published guides once across the five topics.
- Each of the five topic cards provides a direct category path, guide count, concise editorial cue, and decorative category motif without repeating article links.
- The all-guides archive uses one static topic jump and fifteen promise-led rows. Each guide destination appears once.
- The lower “How we work” module may describe sourcing, corrections, guide production, and the publication-name byline only within the verified factual boundary.
- Category pages use one neutral, complete compact list with no manufactured featured hierarchy. Every published category guide remains linked exactly once in stable order.

### Article pages

- Headers contain real category/content-type labels, headline, deck, publication-name byline, genuine dates, computed reading time, and a story-specific informative visual. The visual remains available at mobile widths and must not cause horizontal overflow.
- The at-a-glance module presents four factual fields: Business problem, Technology focus, Intended reader, and What you will produce.
- Article evidence exposes only measured facts: cited-source count and links to standards and corrections. It does not expose the internal `lastReviewed` field until a real reviewer and review date are recorded in the authoritative editorial record. At tablet width it uses a compact grid, expanding to one desktop row only when there is enough space.
- The Business Technology Fit module and a single table-of-contents content structure are generated from real content. CSS changes its placement responsively without duplicating its heading/link structure in the document.
- Markdown tables sit inside named, keyboard-focusable horizontal regions and retain a 16px minimum text size on narrow screens.
- Body links remain visibly underlined, and sources, corrections, truthful byline boundaries, and explicit related-article relationships remain prominent.
- Do not add fictional Person, Organization, or Article entities.

### Supporting pages and footer

- Trust and legal pages share an editorial page shell and measured reading width without changing their factual copy.
- Footer groups are Publication, Topics, Standards & Transparency, and Legal & Feeds.
- Do not invent social profiles or add an unimplemented newsletter form.

### Toolkit

- The Toolkit opening is a restrained dark panel inside the publication frame so it remains balanced at wide viewports.
- The Toolkit landing page exposes exactly four typed resources with outcome, detail, related-guide, and direct CSV actions.
- Each detail route explains purpose, audience, when to use, when not to use, field definitions, limitation, data notice, related guide, and download without claiming an observed result.
- Stacked semantic field cards are the primary mobile guide. A wide-only table may supplement them, but the primary 390px experience must not require horizontal scrolling.

## Advertising boundary

`site.integrations.monetization` accepts exactly `{ mode: "off" }` in this release. It rejects every provider, publisher/account value, verification method, `ads.txt` value, display unit, placement, advertising CMP value, or other extra field. The site renders no verification marker, ad script, request, slot, label, empty box, or layout gap, and no dormant ad component is shipped.

`verification` and `live` are deliberately not implemented states. A future owner-authorized release must design and test the exact account verification artifact, `ads.txt` output, route eligibility, provider initialization, production CSP, account-side ad settings, consent/CMP behavior where applicable, privacy/disclosure copy, and production requests as one end-to-end change. Supplying a value or changing one flag can never activate advertising in the current code.

## Asset, performance, and accessibility rules

- Use only self-hosted fonts, local inline SVG, and existing local content assets.
- No remote visual assets, executable client JavaScript, tracking, or third-party presentation runtime.
- Font preloads are added only when measured and verified useful.
- Preserve static generation, canonical URLs, factual metadata, RSS, sitemap, robots directives, BreadcrumbList data, one H1, semantic lists and tables, the skip link, and underlined body links.
- Use visible high-contrast focus treatment and color combinations that meet WCAG AA for their actual text size and use.
- Preserve practical keyboard access, 200% zoom usability, reduced-motion handling, and logical mobile source order.
- Social previews are deterministic local 1200×630 PNGs: one default, five category images, and fifteen story-specific article images. Builds use only the validated `PUBLIC_SITE_URL` HTTPS origin and ignore preview-host environment variables.

## Change control and verification

Any visual-system change must preserve the no-tracking, no-ad-output, no-invented-identity, no-remote-asset, and static-rendering boundaries. Validate formatting, lint, Astro type checks, unit tests, production build, content/SEO/link checks, Playwright/axe, required viewport behavior, and Lighthouse before a release claim. The deterministic visual project additionally compares 32 reviewed states at 390, 768, and 1440 CSS pixels with DPR 1, fixed 900px height, reduced motion, loaded local fonts, and a documented 0.1% pixel-ratio tolerance. The same 32 states have committed Windows and Linux references, for 64 platform-specific baseline files. Local validation does not imply deployment, Blogger publication, AdSense readiness, or Google approval.

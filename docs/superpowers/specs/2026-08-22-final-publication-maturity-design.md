# Final Publication Maturity Design Contract

## Status

Approved for implementation on the static Astro publication. The user's final
publication-maturity brief is the design authority for this pass. It does not
authorize edits to the separate Blogger theme, AdSense activation, tracking,
analytics, invented identity, or an unverified custom domain.

## Product direction

Everyday Tech Insight should read as a focused independent business-technology
publication rather than a launch inventory or compliance dossier. Preserve the
existing quiet editorial palette, local typography, static architecture,
article facts, sources, dates, corrections, privacy boundaries, and security
headers. Improve maturity through curation, hierarchy, story-specific visual
explanation, and a consistent supporting-page system.

The reference publications are principle references only:

- Semafor: modular story hierarchy and compact summaries.
- IEEE Spectrum: technical density and clear taxonomy.
- The New Yorker: typographic restraint and whitespace.
- WIRED and The Verge: story differentiation and responsive prioritization.
- Webby Awards and Siteinspire: craft, spacing, and interaction polish.

No reference brand, asset, layout, or source code may be copied.

## Information architecture

- Header destinations: Home through the publication mark, Guides, Toolkit,
  About, plus the five topic destinations at desktop and in the mobile menu.
- `/articles/` becomes the reader-facing complete archive. The technical HTML
  sitemap remains available but is no longer the primary all-guides link.
- The homepage contains exactly nine curated article entries: one lead, two
  supporting stories, three latest stories, and three practical foundations.
  Topic discovery, one featured Toolkit resource, and How we work follow the
  story modules. The full corpus never appears on the homepage.
- Category pages are count-aware. The current three-article categories render
  a concise intro, one category visual, and one complete list/grid with each
  article exactly once. Six to eleven and twelve-plus article branches remain
  explicit and testable without client-side filtering.
- Toolkit uses a landing page plus four stable detail routes under
  `/toolkit/<resource-slug>/`. CSV URLs and header-only files remain unchanged.
- About, Publisher, Editorial Standards, Corrections, Contact, Privacy, and
  Advertising Disclosure use one supporting-page layout and related-page nav.

## Page and component contracts

### Article pages

- `FitSummary.astro` emits one section, one `At a glance` heading, and one `dl`.
- `TableOfContents.astro` emits one `nav` named `On this page`; CSS alone makes
  it compact on small screens and sticky on wide screens.
- The hero prioritizes category, content type, headline, deck, byline, genuine
  dates, and one story-specific visual. Evidence links are quieter and remain
  factual.
- One calm publication-name disclosure appears near the article footer.
- Articles with a first-party worksheet show one contextual Toolkit callout.

### Visual system

Each article frontmatter includes:

```yaml
visual:
  type: decision-tree
  key: automation-candidate-screen
  alt: A task funnel that rejects unstable or high-risk work before a bounded pilot.
  caption: Screen repeatability, exceptions, consequences, review, and fallback before piloting.
  decorative: false
```

The schema accepts the controlled families `workflow`, `decision-tree`,
`comparison`, `cost-stack`, `security-boundary`, `backup-topology`,
`process-lane`, `risk-matrix`, `checklist`, `timeline`, `data-flow`,
`governance`, and `information-architecture`. The 15 published articles use 15
stable keys and recognizably different compositions. Informative SVGs expose a
title and description; category-only flourishes remain decorative.

### Toolkit

Toolkit records live in one typed data module. A landing card communicates the
resource outcome, related guide, CSV format, detail link, and direct download.
Each detail page states purpose, intended user, when to use it, when not to use
it, field definitions, limitations, and data handling. Field definitions are
stacked semantic cards on mobile and a table at wide widths; horizontal scrolling
is not the primary mobile interaction.

### Trust tone

Homepage trust language becomes a positive lower-page `How we work` module:
practical problem, primary/official sources, explicit limitations, and documented
material corrections. Publisher and About lead with what is published and for
whom; the factual identity boundary moves lower. No owner biography, private
email, entity structured data, testing claim, or reviewer claim is invented.

## Metadata, social previews, and domain readiness

- The canonical production URL is resolved by a validated helper from an
  explicit `PUBLIC_SITE_URL` build variable, falling back to the verified
  Vercel origin. Preview deployment hostnames never silently become canonicals.
- Canonical, sitemap, RSS, Open Graph, Twitter, robots, and structured-data URLs
  use the same resolved origin.
- A deterministic local generator produces optimized 1200x630 PNG images for
  the default publication view, five categories, and all 15 articles. Metadata
  includes image URL, width, height, PNG type, and accurate alt text.
- The verified text/CSS ETI publication mark may supply favicon and app-icon
  assets. No Person or Organization identity is implied.

## Accessibility and interaction

Preserve one H1, skip link, logical landmarks, keyboard-visible focus,
underlined body links, unique IDs, reduced motion, 200% zoom usability, and no
ordinary horizontal overflow. Native mobile menu semantics remain. Informative
visuals have programmatic alternatives; decorative visuals stay hidden. No
framework hydration, fake search, animation library, carousel, or remote asset
is introduced.

## Verification contract

- Reusable production smoke tests validate status, redirects, canonical origin,
  current header/footer signatures, one H1, titles/descriptions, assets, and
  duplicate article modules.
- Playwright covers all public routes, 390/768/1440 responsive behavior, axe,
  keyboard/menu/focus states, and deterministic visual baselines.
- Before and after screenshots cover the same eight representative routes and
  three widths.
- Fresh QA must include formatting, lint, Astro diagnostics, unit tests, static
  build, content/SEO/external-link checks, Playwright, production smoke, and
  Lighthouse. Thresholds remain 90/95/95/95.
- Passing automated tests is not human editorial, legal, accessibility,
  content-rights, AdSense, or owner-identity approval.

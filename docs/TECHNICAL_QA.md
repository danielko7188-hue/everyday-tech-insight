# Technical QA

Date recorded: 2026-08-21

## Release command

Run from a clean checkout with a supported Node version and Chrome installed:

```text
npm ci
npm run qa
```

The release command runs formatting, lint, Astro type checks, unit tests, a production build, content checks, built-output checks, external-source verification, Playwright/axe checks, and Lighthouse in that order. Playwright always starts a new built preview and never reuses an existing server.

## Blocking contracts

### Content

- Exactly 15 Markdown articles and exactly 3 in each of the 5 categories.
- Unique slug, title, and 50-180-character description.
- File name equals slug; complete schema and five-part business-technology fit.
- Initial publication and review date are the real 2026-08-21 launch date.
- `dateModified` is absent at initial publication and valid only after a later substantive change.
- Published/source-checked/indexable status, at least two unique HTTPS primary sources, and an access date for each source.
- Every frontmatter source URL appears in the body.
- At least 650 words, at least four H2 sections, an explicit limitation, and no unsupported first-hand claim.
- No placeholder, advertising, analytics, tracking identifier, invalid related article, or off-origin canonical.

### Built output

- The expected fixed pages, five category pages, and published article pages match the generated indexable route set exactly.
- One H1, unique title and description, canonical, robots, Open Graph fields, and valid JSON-LD on every HTML page.
- Descriptions remain between 50 and 180 characters.
- Home uses `WebSite` JSON-LD; inner indexable pages use `BreadcrumbList`; no unverified `Person` or `Organization` entity claim.
- Internal links and local resources resolve in `dist`.
- No draft/review article leakage, placeholder text, executable client script, advertising, analytics, tracking ID, or `ads.txt`.
- XML sitemap URLs equal the indexable route set exactly.
- RSS item URLs equal the published article route set exactly.
- Category pages and the HTML sitemap contain their exact required memberships.

### External HTTPS destinations

The checker deduplicates article source URLs and every external HTTPS anchor rendered in built public HTML, then attempts `HEAD` and falls back to `GET` when needed:

- `PASS`: final HTTP status is 200-399.
- `FAIL`: final HTTP status is a definitive 404 or 410.
- `UNVERIFIED`: authentication, access denial, rate limiting, server error, timeout, DNS, TLS, or other network evidence prevents a reliable conclusion.

`FAIL` and `UNVERIFIED` both stop `npm run qa`. `UNVERIFIED` does not claim that a source is broken; it records that this run could not prove reachability.

### Browser and performance

- Playwright verifies representative routes, real 404 behavior, metadata, RSS/robots, mobile overflow, keyboard focus, reduced-motion support, and axe serious/critical results.
- Lighthouse audits the home page, AI and automation category, and a representative automation article.
- Thresholds: Performance at least 90; Accessibility, Best Practices, and SEO at least 95.
- Raw reports and `summary.json` are written to ignored `.lighthouseci/` output.

## Evidence record

Fresh local production-candidate run on 2026-08-21:

- `npm ci`: installed 554 packages; npm audit reported 0 vulnerabilities. npm emitted the upstream `whatwg-encoding` deprecation warning.
- Formatting: pass.
- ESLint: pass.
- Astro typecheck: 42 files, 0 errors, 0 warnings, 0 hints.
- Vitest: 4 files, 48 tests passed.
- Astro production build: 31 generated pages.
- Content QA: pass.
- Built-output QA: pass.
- External HTTPS links: 32 pass, 0 fail, 0 unverified.
- Playwright and axe: 15 tests passed.
- Lighthouse home: Performance 99, Accessibility 100, Best Practices 100, SEO 100.
- Lighthouse AI and automation category: Performance 99, Accessibility 100, Best Practices 100, SEO 100.
- Lighthouse automation-candidates article: Performance 97, Accessibility 100, Best Practices 100, SEO 100.

Do not infer a pass for one stage from another stage's result. A live production deployment needs a separate HTTP and metadata verification after Vercel finishes.

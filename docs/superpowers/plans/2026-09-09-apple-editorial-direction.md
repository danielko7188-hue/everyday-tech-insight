# Apple Editorial Direction Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development. Root coordinates design, integration and release; the implementation worker owns the presentation layer and its new tests. Preserve concurrent work.

**Goal:** Replace the remaining enterprise-template styling with a cohesive Apple-inspired editorial interface across all public pages.

**Architecture:** Preserve Astro's static content and semantic components. Add one last-loaded presentation stylesheet, and align category/social accents with the same neutral-blue palette. Keep informative SVG typography stable while changing the surrounding UI type system.

**Tech Stack:** Astro, native CSS, Playwright, Vitest, existing GitHub and Vercel workflow.

## Task 1: Appearance contract and implementation

Files: new `tests/e2e/apple-editorial.regression.spec.ts`, new `src/styles/apple-editorial.css`, `src/layouts/BaseLayout.astro`; presentation-only adjustments to `src/components/SignalField.astro` if required.

- [x] Add tests against the real DOM for the native sans stack, non-purple colors, unboxed category intro, hidden decorative motif, no accent bar, reduced panel chrome, all topic destinations and readable informative diagrams. Example assertions: `expect(getComputedStyle(hero).backgroundColor).toBe("rgba(0, 0, 0, 0)")`; `expect(getComputedStyle(label).textTransform).toBe("none")`. Preserve 44px controls, focus and no overflow at 320/390/768/1440.
- [x] Run the new tests against the existing production origin using an ignored Playwright config with exact baseline SHA `f31d520009321b56c5b22a4f984bafc9141340ec`. Record intended assertion failures before implementation.
- [x] Implement the acceptance contract in a last-loaded CSS module. Import it with `import "../styles/apple-editorial.css";` immediately after the existing global import. Use native font tokens, neutral backgrounds and rules, blue interactions, transparent unboxed category/reading panels, and responsive typography.
- [x] Preserve the native mobile menu and desktop topic navigation; adjust visual density without hiding navigation or content. Keep all semantic article diagram descriptions and stable diagram type metrics.
- [x] Run new tests and the existing premium UX, backup diagram, responsive and accessibility browser suites. Inspect native screenshots for home/category/article/toolkit on phone, tablet and desktop. Commit only intended source/test files.

## Task 2: Palette parity and documentation

Files: `src/data/categories.ts`, `scripts/generate-social-images.mjs`, generated `public/social/` and associated manifest via its generator, `DESIGN.md`, appearance-specific tests if exact old design values are asserted.

- [x] Align all five category accent values to the blue action family and replace purple visited links with a distinct darker blue. Preserve schema, names, ordering and URLs.
- [x] Make generated social previews consume the revised accent values without changing article claims, dates or identity. Run `npm run generate:social` then `npm run check:social`.
- [x] Update the current-direction pointer in DESIGN.md to the new specification; keep historical contracts labeled historical.
- [x] Review old appearance tests individually. Update only obsolete visual expectations with equally specific new checks; retain all accessibility, source, provenance and publication assertions.

## Task 3: Review and release

Implementation verification at `6ae8fbe`: all 233 functional browser cases pass. Independent specification review passed the repeated-item cascade correction; rendered checks additionally caught and fixed worksheet breadcrumb alignment and its heavy divider with two new regressions covering all four resources. Full release evidence is recorded separately under `.gstack/apple-direction-2026-09-09/` so deployment receipts can name the exact frozen commit without changing its tracked source.

- [x] Independent spec review, then code-quality review. Resolve findings, rerun relevant checks and re-review.
- [x] Inspect before/after native screenshots, then update intended Windows/Linux visual references. Preserve all older dated release evidence.
- [ ] Run `npm run qa` on the exact final candidate; require all gates pass without relaxed thresholds. Push a `codex/` branch and open the normal protected PR.
- [ ] Require GitHub checks, merge normally, verify Vercel READY identity and exact merged SHA. Rebuild final main and run strict production smoke, new live regressions and eight-width runtime captures.
- [ ] Write an observed release receipt, link the live site, and distinguish verified tests from subjective design judgment and external approval decisions.

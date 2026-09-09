# Editorial Art Direction Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development. Execute autonomously under the owner's standing instruction, preserving content and publishing boundaries.

**Goal:** Replace the generic document-template impression with a story-led, image-led editorial publication.

**Architecture:** Shared decorative cover component and scoped editorial styles over the current static Astro site. Preserve existing curation/data lifecycle, informative diagrams and browser-native controls. Update appearance-only assertions only where the new design contract explicitly supersedes them.

**Tech Stack:** Astro, TypeScript, CSS, self-hosted Instrument Sans, existing Sharp image encoder, Vitest, Playwright.

## Task1 — assets and typography

Files: `public/images/editorial/`, `src/components/EditorialCover.astro`, `src/data/editorial-covers.ts`, `docs/EDITORIAL_COVERS_2026-09-09.md`, package manifests, `src/styles/apple-editorial.css`, `src/layouts/BaseLayout.astro`.

- [x] Fresh native baseline audit and unit baseline (1061passed,4platformskips).
- [ ] Generate and inspect five subject-specific still-life covers; preserve generator originals, record prompts and hashes. Encode widths480/960/1536 WebP/AVIF using the existing image encoding approach; no creative image manipulation.
- [ ] Install pinned `@fontsource-variable/instrument-sans@5.3.0`; import Latin upright variable styles, keep license and preload the emitted font URL.
- [ ] Add typed cover lookup and native picture component. The interface is `category: CategorySlug; eager?: boolean; class?: string`; use width1536 height1024, empty alt and visible illustration credit. Use responsive sizes reflecting actual full/split widths.
- [ ] Validate all five file families exist and have explicit dimensions. All informative SVGs keep Source Sans metrics.

## Task2 — editorial page composition

Files: `src/pages/index.astro`, `src/pages/categories/[slug].astro`, `src/components/ArticleCard.astro`, `src/components/StoryMeta.astro`, `src/styles/apple-editorial.css`, `src/layouts/ArticleLayout.astro`, `src/components/FitSummary.astro`.

- [ ] Add failing browser regression `tests/e2e/editorial-art-direction.spec.ts`: home first title top<780 at390/1440, cover loads, no page overflow, three category guides each once, native fit disclosure keyboard opens. Run focused test and record RED before implementation.
- [ ] ArticleCard optional `cover?: boolean`, `hideCategory?: boolean` selects EditorialCover instead of guide diagram only for browsing views. StoryMeta optional `showCategory = true` suppresses redundant same-category labels, preserving time/date/type.
- [ ] Home remove SignalField import/render; compact existing promise/actions, use cover on lead and two feature cards. Preserve nine curated article destinations and all lower sections.
- [ ] Compact categories keep list and data-layout identity; first ArticleCard gets cover/lead presentation and others clean supporting rows. Remove duplicated introductory labels/purpose prose. Preserve empty/editorial/archive branches and membership.
- [ ] FitSummary uses `<details class="fit-summary"><summary><h2 id="fit-heading">At a glance</h2></summary>...existing fields...</details>`. All fields remain keyboard-accessible and print-visible. Keep article diagram uncropped and readable; move it into reading column above prose, below the compact fit summary. Bring article facts/evidence into a quiet compact hierarchy.
- [ ] Refine desktop/mobile proportions against actual renders. Record purposeful design-contract replacements in tests, never alter functional content/security gates or CI tolerance.
- [ ] Run focused tests, typecheck, full functional browser suite; independent spec review then code-quality review. Commit scoped implementation.

## Task3 — release verification

- [ ] Preserve previous production evidence before shared output paths are reused.
- [ ] Independently inspect native mobile/desktop home/category/article/toolkit; fix concrete findings.
- [ ] Update Windows/Linux visual reference PNGs only after rendered review, verifying copied hashes. Tolerances unchanged.
- [ ] `npm run qa` must pass. Commit final candidate; protected GitHub PR with both required checks, normal merge before deployment.
- [ ] Verify exact merged SHA via Vercel authenticated receipt, `npm run check:production`, live targeted regressions and native responsive review. Run eight-width228capture audit, verify integrity, and final-main CI.
- [ ] Write ignored exact-SHA release receipt under `.gstack/editorial-art-direction-2026-09-09/`. Do not change tracked docs after the final tested freeze merely to check post-deploy boxes.

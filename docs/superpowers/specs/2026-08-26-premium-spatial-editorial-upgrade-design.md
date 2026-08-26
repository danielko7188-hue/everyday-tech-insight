# Premium Spatial Editorial Upgrade Design

**Date:** 2026-08-26  
**Status:** Approved through the user's attached implementation brief and delegated owner judgment  
**Applies to:** `everyday-tech-insight-static` only  
**Production baseline:** `af8dd44843860f3a055c76f934c02ae389ec1a81` at `https://everyday-tech-insight.vercel.app/`

## 1. Decision

The site already has a strong editorial hierarchy, verified static rendering, a distinctive Purple Signal identity, Pages CMS source configuration, and an advertising-off release contract. This pass does not replace those systems. It corrects the confirmed Toolkit action defect and adds a restrained spatial layer that makes the publication feel more authored without turning it into a product landing page or animation demo.

The user directed Codex to decide and finish without another question. The attached premium-publication brief therefore supplies design approval. Implementation still follows the repository's truth, privacy, accessibility, performance, and live-change boundaries.

The separate Blogger theme remains `PREVIEW ONLY — DO NOT SAVE OR PUBLISH`. Nothing in this design changes Blogger, AdSense accounts, Search Console, analytics, consent tooling, or advertising.

## 2. Confirmed diagnosis

### Retain

- Full publication name and secondary ETI mark.
- Deep-purple masthead, topic row, editorial serif headlines, local artwork, and clear trust pages.
- Five-category taxonomy, 15 published guides, four Toolkit resources, and existing content contracts.
- Static Astro output, normal links, no executable client JavaScript, no remote presentation assets, and the strict Content Security Policy.
- Pages CMS as an external Git-backed editor with no public administration route.
- Advertising, analytics, tracking, affiliate, sponsorship, CMP, and `ads.txt` output disabled.

### Correct

- Toolkit landing actions currently use wrapping flex layout. The full-width purple action has no internal inline padding or centered justification, while the secondary actions have unstable geometry.
- The design contract still prohibits all decorative entrance motion and parallax, so it does not distinguish lightweight native CSS motion from client-side presentation runtime.
- The homepage has strong editorial content but no dedicated spatial brand composition in the promise column.
- Article pages have no reading-progress affordance.
- The 404 page lacks the requested Toolkit recovery path and branded signal object.
- Toolkit detail pages explain fields well but have no immediate visual preview of the worksheet structure.
- Existing spacing uses a 4px scale but lacks semantic section, card, and grid tokens that make the final rhythm measurable.

## 3. Motion architecture

### Selected

- Browser-native cross-document view transitions through CSS `@view-transition { navigation: auto; }`.
- CSS transforms, perspective, local SVG, gradients, and scroll-linked CSS animation as progressive enhancement.
- A static-first signal field whose optional movement is limited to transforms and remains nonessential.
- A transform-based article reading-progress rule implemented with CSS scroll timelines where supported.
- Short 180–220ms hover and focus feedback with no change to link semantics.

This preserves normal multi-page links, browser history, native focus/title behavior, and a complete no-motion fallback. Unsupported browsers receive the unchanged static page.

### Rejected

- Astro `ClientRouter`: no persistent shared state or SPA-only benefit justifies link interception, script lifecycle changes, or client JavaScript.
- Motion: the current requirements are fully achievable with CSS/SVG; adding a library would overturn the verified script-free architecture without a measured benefit.
- Three.js/WebGL and remote Spline: no demonstrated visual benefit justifies their cost.
- Lenis or any scroll-physics replacement: native scrolling remains mandatory.
- A 16–24 second continuous hero loop: persistent motion beside content creates an avoidable pause/stop/hide obligation. The retained effect is scroll-linked or finite, never an endless loop.

### Motion limits

- Root page transition: 200ms opacity plus no more than 4px translation.
- Card hover/focus elevation: no more than 3px translation, 1 degree rotation, or 1.005 scale.
- Decorative signal displacement: no more than 20px over its complete view-timeline range.
- No paragraph, source-list, disclosure, legal-copy, navigation-control, download-control, or future-ad motion.
- No motion carries meaning or delays text.
- `prefers-reduced-motion: reduce` removes all effective animation and hides the reading-progress rule.
- Coarse-pointer, slow-update, and reduced-data media conditions remove spatial movement when the browser exposes those preferences.

## 4. Spacing contract

The existing 4px base remains. Semantic tokens map the design brief to the existing scale:

```css
--space-section-mobile: var(--space-12); /* 48px */
--space-section-tablet: var(--space-16); /* 64px */
--space-section-wide: var(--space-20); /* 80px */
--space-heading-body: var(--space-6); /* 24px */
--space-card-major: var(--space-6); /* 24px */
--space-card-compact: var(--space-5); /* 20px */
--space-grid-standard: var(--space-6); /* 24px */
--space-grid-compact: var(--space-4); /* 16px */
```

Major modules use 48px separation on mobile, 64px on tablet, and 80px on wide screens. Card internals use 20–24px padding. Action controls retain a minimum 44px block size. Existing one-off values remain only where they encode a deliberate layout breakpoint or optical correction.

## 5. Page changes

### Global shell

- Keep the current accessible Header and native `details` mobile menu.
- Add only static layered depth to the masthead and footer through local CSS pseudo-elements.
- Keep the full publication name immediately visible and all existing link groups factual.
- Add native cross-document transitions without a client router.

### Homepage

- Add one original decorative `SignalField` beneath the publication promise, using three depth planes, routed signal lines, and bounded nodes.
- Keep the lead guide and two supporting guides as the dominant editorial content.
- Add restrained hover/focus depth to story and topic surfaces; the latest guide rail remains typographic.
- Do not add a generic brain, robot, chip, stock image, remote asset, or product-style CTA.

### Archive and categories

- Preserve the complete one-link-per-guide archive and count-aware category logic.
- Refine section rhythm and use controlled perspective on category motifs only for fine-pointer hover/focus.
- Do not manufacture popularity, trending, or an elaborate hierarchy for three-guide categories.

### Articles

- Add a 3px decorative reading-progress rule, transform-based and progressively enhanced.
- Add subtle static depth to the existing dark article hero and local visual.
- Keep article paragraphs, sources, disclosures, and corrections calm and unanimated.
- Keep one table of contents; no duplicated mobile structure or focus/URL manipulation is introduced.

### Toolkit

- Change `.toolkit-grid` to stretched equal grid rows.
- Change each card to `grid-template-rows: minmax(0, 1fr) auto` with no fixed height.
- Change actions to a two-column grid. The primary action spans both columns, centers its label, and receives 12px × 16px padding. Secondary actions receive 8px × 12px padding and the same 44px minimum target height.
- Collapse actions to one column below 40rem.
- Add a static, data-driven worksheet-structure preview to each detail page, away from download controls.
- Keep all Toolkit routes advertising-free and do not animate download controls.

### Trust, sitemap, and 404

- Trust and legal pages keep their restrained light shells; spacing and link transitions are their only visual movement.
- Sitemap behavior remains functional and unchanged.
- Add a compact branded signal object and Toolkit recovery link to the 404 page. No ads or fake search.

## 6. Owner-only CMS boundary

The repository can verify `.pages.yml`, collection fields, `create: true`, `rename: false`, `delete: false`, media paths, lifecycle values, and public-route absence. It cannot verify hosted Pages CMS sign-in, GitHub App repository scope, collaborator absence, branch protection, image-upload round trips, or real save/commit behavior.

Documentation continues to require:

```text
Pages CMS -> dedicated non-main content branch -> pull request and QA
-> Vercel preview -> reviewed merge to main -> production
```

The public repository warning remains prominent: committed drafts and source media are publicly readable even when write access is owner-only.

## 7. AdSense boundary

Monetization stays exactly `{ mode: "off" }`. This release adds no publisher ID, verification token, ad script, slot, label, placeholder, reserved gap, `ads.txt`, analytics, tracking request, or advertising CMP. Toolkit, trust/legal, sitemap, RSS, robots, and 404 routes remain free of advertising output.

The visual changes improve usability but do not establish AdSense eligibility, account state, ownership, privacy/legal applicability, content originality, or approval. Google alone decides approval.

## 8. Verification and evidence

- Add focused geometry tests for Toolkit actions at 390, 600, 768, 1024, and 1440px, including long labels, padding, centering, grid columns, target height, card-footer alignment, and overflow.
- Add source/build contracts for native transitions, the signal field, reading progress, reduced motion, CMS absence, and no executable script.
- Retain pixel baselines at the repository's deterministic reviewed widths and run responsive geometry at 320, 390, 600, 768, 1024, 1280, 1440, and 1920px.
- Version new production capture evidence as `premium-spatial-2026-08-26`, preserving the prior Purple Signal evidence.
- Run every command in the attached brief and the single `npm run qa` release gate.
- Push GitHub `main` first, then deploy the exact pushed SHA to Vercel, run production smoke, and capture the live design.

## 9. Completion boundary

Technical completion requires the confirmed layout defect fixed, the native spatial layer implemented, focused and full QA passing, screenshots visually inspected, GitHub and Vercel matching the intended commit, and the canonical deployment passing production checks.

Hosted CMS authorization, repository-only GitHub App access, absence of external collaborators, a real CMS upload/save round trip, human editorial/expert/legal/privacy/rights review, AdSense account facts, and Google approval remain external owner gates unless directly observed.

## 10. Primary references checked on 2026-08-26

- [Astro view transitions](https://docs.astro.build/en/guides/view-transitions/)
- [Pages CMS operations](https://pagescms.org/docs/configuration/content/operations/)
- [Pages CMS authentication](https://pagescms.org/docs/development/authentication/)
- [Google AdSense page readiness](https://support.google.com/adsense/answer/7299563?hl=en)
- [Google ad placement policies](https://support.google.com/adsense/answer/1346295?hl=en)
- [WCAG 2.2 pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
- [WCAG technique C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)

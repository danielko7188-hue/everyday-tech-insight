# Apple editorial direction

The owner explicitly requests removal of the remaining WEKA-like visual feel and a transformation toward apple.com. This supersedes the previous color, typography and decorative-container decisions, not the publication's content, navigation, accessibility or owner-only publishing controls. The owner has asked us to choose and execute without further design questions.

## Observed problem and decision

The live AI category still has a large rounded intro panel, a purple circuit-chip tile, short purple rules above each guide, all-caps labels and narrow humanist typography. Home and toolkit repeat inset gray panels. This reads as a business software template despite the light palette.

References inspected September 9: https://www.apple.com/ and https://www.apple.com/newsroom/. Apply their hierarchy, typographic confidence, sparse controls and separation by generous space. Do not copy their content, assets, proprietary web fonts or branding.

Three approaches considered: recolor the existing cards (insufficient structural change); reproduce an Apple store page (wrong content model); adopt Apple's restrained presentation with publication-specific reading layouts (selected).

## Acceptance contract

- Use a deliberate native Apple-style sans stack for display and body: `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`. This explicit owner direction supersedes the generic skill preference against system stacks. Keep the existing licensed Source Sans only where needed inside explanatory SVGs to preserve text fit.
- White and soft-neutral-gray surfaces, charcoal type, blue actions. No purple category marks, visited-link purple, circuit decoration, accent bars or category-color borders. A darker blue distinguishes visited editorial links. Preserve category names and all five routes.
- Slim the masthead and soften topic navigation. Retain all existing named navigation landmarks, current-location states, native mobile disclosure, skip link and practical 44px controls.
- Category introductions become an unboxed typographic composition; remove the decorative motif. Keep all substantive descriptions and purpose text. The first guide remains within the initial 900px viewport on phone and desktop.
- Home uses compact, frameless original hero artwork, a clear headline and two existing actions. Informative story figures remain readable and correctly described. Preserve nine distinct curated guide destinations, five topics and real counts. Design refinement after the September 9 native before-review: cap decorative home art at 420px wide / 280px high (240px high on phones), so it supports the introduction without postponing the actual guides; informative article figures retain their reading width.
- Remove all-caps visual styling and repeated short accent rules. Use fine neutral separators or space for story rows. Cards retain containers only where they aid a real interaction; no nested decorative panels or hover-lift shadows.
- Article prose and informative diagrams are not hidden or truncated. Preserve reading measure, sticky desktop contents, native anchors, source lists, limitations, dates and bylines.
- Toolkit and trust pages use the same typography and flat layout, retain safety information and usable actions, and preserve aligned paired toolkit actions.
- Zero executable client JavaScript, ads, tracking and consent integrations. Do not change CI, publishing protections, CMS permissions, identities or account values.

## Implementation boundaries

Use a clearly identified, last-loaded presentation stylesheet rather than expanding the already large historical stylesheet again. Change only presentation bindings or component markup needed for this direction. Category data accents and generated social preview accents must also be neutral/blue, so shared previews do not retain the retired direction. Preserve old evidence separately.

## Verification

Write new appearance-contract browser tests first and observe baseline failure. Keep functional/content/policy tests intact. Update appearance-specific expectations and reviewed visual references only where this owner's new direction supersedes them; no weakened thresholds or removed assertions. Run complete `npm run qa`, independent specification/code review and rendered review, then protected GitHub PR followed by exact-SHA Vercel production checks. Verify eight widths from 320 to 1920px, including menus and focus states. Automated checks do not prove universal perfection, full human accessibility review or AdSense approval.

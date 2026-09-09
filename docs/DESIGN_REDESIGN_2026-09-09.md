# Editorial Clarity design contract

Date: 2026-09-09. Scope: the Everyday Tech Insight static publication. This is the user-authorized successor to the Purple Signal visual direction, not a redesign of the separate Blogger theme.

## Direction

The user requested the restraint and finish associated with Apple's website. Apply the underlying principles: a clear hierarchy, generous but purposeful space, neutral surfaces, consistent typography, and selective emphasis. Keep the publication's own name, explanatory diagrams, content, and navigation. Do not copy Apple branding, product imagery, proprietary fonts, or imply an affiliation.

The previous large purple surfaces, serif display face, and repeated accent rules competed with the guides. The new hierarchy gives the publication promise, the next useful action, and the article title distinct roles. Decorative artwork must not be mistaken for a product test or evidence supporting a guide.

## Visual system

| Role                            | Contract                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| Canvas and panels               | White `#ffffff` and soft gray `#f5f5f7`                                                 |
| Primary text                    | Charcoal `#1d1d1f`                                                                      |
| Secondary text                  | `#515154`, with WCAG AA contrast on both light surfaces                                 |
| Actions and light-surface focus | Blue `#0066cc`; white text on filled actions                                            |
| Rules and boundaries            | `#d2d2d7` for decorative separators; stronger `#86868b` when a boundary conveys meaning |
| Visited editorial links         | Distinct `#663b80`; navigation and action colors remain stable                          |
| Typography                      | Locally hosted Source Sans 3 Variable for display and body text                         |
| Layout                          | Maximum 1200px content shell, fluid outer gutters, controlled article reading measure   |

Legacy purple-named custom properties may remain as compatibility names, but their values map to the new neutral/blue palette. The decorative multicolor brand gradient is retired. Category colors remain small, consistent identifiers: AI `#6e3cbc`, software `#0066cc`, security `#216e4e`, operations `#9a4a00`, and strategy `#4141a5`. Color is never the only category label.

Preserve the semantic 4px-derived spacing scale: 48px mobile, 64px tablet, and 80px wide section spacing; 24px heading-to-body and major-card spacing; 20px compact-card padding; and 24px/16px grid gaps. Individual layouts may adapt these tokens to their role rather than imposing equal empty space everywhere.

## Page hierarchy

- The masthead and footer use light surfaces. The publication mark is legible at 320px without expanding its clickable area into unrelated empty space.
- The home introduction is centered and retains the actual publication promise: “Make technology decisions you can explain.” Its summary and primary guide-browsing action are visible without scrolling at 390 × 844 and 1440 × 900.
- A decorative hero graphic is separate from the explanatory article visuals. It is inert, hidden from assistive technology, and does not load a remote runtime.
- The home page retains one lead guide, two supporting guides, nine distinct guide destinations in total, and five named topic entries. The featured guide title remains reachable within a short scroll, no later than 1200px from the document top in the tested introductory viewports.
- Archive and category pages prioritize the actual guide title and promise. They retain the complete published inventory without manufactured rankings or repeated entries.
- Article visuals remain informative and accessible, with titles and descriptions. Diagram labels must not be cropped to make a decorative card treatment fit.
- Toolkit download actions remain clear and keyboard accessible. Trust pages use readable prose, not an implied certification or a claim of human review that has not occurred.

## Interaction and accessibility

Maintain at least 44px action targets, visible keyboard focus, adequate text and meaningful-boundary contrast, native mobile disclosure navigation, the skip link, properly named tables, and one H1 per public page. Headlines and diagrams must remain inside the page at 320px. Shortening or hiding substantive content is not an overflow fix.

The presentation remains static-first with zero executable client JavaScript. Existing finite native motion and the custom root 200ms view transition may remain. `prefers-reduced-motion`, `prefers-reduced-data`, `pointer: coarse`, and `update: slow` fallbacks preserve a complete usable page. No continuous or infinite loop, scroll hijacking, remote presentation runtime, or third-party tracking is introduced.

## Verification and evidence boundaries

Required layout coverage is 320, 390, 600, 768, 1024, 1280, 1440, and 1920px, including keyboard-open menus and focused skip links. Run the full existing `npm run qa` release gate. Review new screenshots before accepting replacement visual baselines; do not loosen pixel thresholds, suppress functional regressions, or remove accessibility and content assertions to accommodate a redesign.

September release evidence uses `editorial-clarity-2026-09-09`. Preserve all dated August screenshots, manifests, hashes, and deployment identifiers unchanged. Those artifacts prove their recorded releases, not this redesign. A passing local test is not evidence that GitHub CI passed or that Vercel serves the corresponding commit; those require separate fresh observations.

This document defines the design contract, not a test result or deployment receipt. Keep validation and release status in the release evidence records.

## AdSense and publication boundary

The visual work supports clear navigation, legibility, and useful content; visual polish alone does not establish AdSense eligibility or approval. Ads, analytics, affiliate integrations, sponsorship integrations, CMP integrations, and tracking remain disabled. The owner-only publishing controls remain in scope and must not be weakened by UI work.

Do not invent a legal publisher identity, credentials, hands-on testing, contact channel, account status, or publisher identifier. Any unresolved publisher verification, rights, claim-level review, and account requirements remain explicit external checks. Google alone decides AdSense approval.

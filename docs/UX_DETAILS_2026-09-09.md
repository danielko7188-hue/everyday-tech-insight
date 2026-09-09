# Premium UX detail pass — September 9, 2026

## Design decision

Refine the approved Editorial Clarity system, rather than replace it. Retain the light canvas, charcoal typography, blue controls, original artwork, static rendering, and substantive guidance. Prioritize discovery, readable labels, consistent interactions, and navigation that works throughout a long article.

The live baseline is `f6e21b94f7ca459626dbb0524d209259948104f8`. Read-only browser measurements identified six issues:

1. The category directory inherits a prose-list width cap (680px inside a 1200px section). Its large decorative panels also delay topic selection on phones, and only the heading is clickable.
2. Story metadata inherits an 8px sibling margin. Slash separators become stranded when metadata wraps.
3. Category hero proportions push the first guide title below a 900px viewport.
4. The desktop contents navigation is sticky inside an unstretched, short grid item, so it leaves the viewport during reading.
5. Two backup-diagram labels cross their boxes.
6. Wrapped secondary toolkit actions move otherwise paired primary actions out of alignment.

## Acceptance contract

- Equal-weight category entries use the available directory width. At 768px and above, use two balanced columns; on phones, compact horizontal icon-and-copy rows. Home keeps its five-column wide-screen treatment and uses compact rows at smaller widths.
- Topic cards are one native link target across the card, have visible keyboard focus, and preserve descriptions, counts, and accessible names. Do not add JavaScript or duplicate links.
- Story metadata has no inherited sibling offsets or ornamental slash separators. Normal article prose lists retain their spacing.
- Category introductions retain meaningful descriptions and purpose text; the first guide title appears within the initial 900px viewport at 390px and 1440px widths.
- One semantic contents tree follows desktop reading in sufficiently tall viewports; mobile and short viewports remain static. Anchors still reach the correct heading.
- Backup-diagram text fits its associated boxes. Preserve the meaning and caption. Informative article diagrams stack below the introduction at tablet widths, where the former side column made their labels smaller than on phones.
- Paired toolkit cards align their primary actions using shared layout tracks, not fixed content heights. Use distinct labels for worksheet instructions and the related article.
- No invented identity, publishing claims, external scripts, ad activation, or change to owner-only publication controls. This is a UX improvement, not a guarantee of AdSense approval or universal perfection.

## Implementation and verification plan

1. Add browser regression tests for measured failures and run them against the exact live baseline (RED).
2. Root owns the category/home layouts, metadata reset, category hero, sticky parent, and toolkit layout. A bounded implementation agent owns backup SVG labels and their independent regression test. Work on `codex/premium-ux-details`; preserve all unrelated work.
3. Implement minimal CSS/component corrections. Run focused browser tests (GREEN), inspect native viewport and materialized full-page screenshots, and review spec compliance followed by code quality.
4. Update only intentionally changed Windows/Linux visual references after inspection. Run the complete project QA suite, including content, security/publishing safeguards, accessibility, responsive tests, screenshots, and Lighthouse.
5. Push to GitHub, use the normal protected PR workflow, then verify Vercel production against the exact merged SHA. Preserve prior release evidence and capture the new release separately.

## Reference principles

- [Apple Human Interface Guidelines: layout](https://developer.apple.com/design/human-interface-guidelines/layout): clear hierarchy and layouts that adapt to available space; not a request to copy Apple assets.
- [W3C: reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow): keep information and functionality available at narrow widths.
- [W3C: text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing): preserve usable content when readers change spacing.

Release results must be recorded after execution, separately from these acceptance criteria.

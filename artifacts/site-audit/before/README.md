# Publication maturity before-state evidence

This directory records the site before the publication-maturity release. It is
historical baseline evidence, not evidence that the new release has been
deployed.

- Baseline commit: `dc4a4bde6e410f85b58987fcd83e3dd0c31bb6c2`
- Capture date: `2026-08-22` (America/Los_Angeles)
- Live origin: `https://everyday-tech-insight.vercel.app/`
- Local baseline origin: `http://127.0.0.1:4321/`

## Screenshot inventory

The `production/` and `local/` directories each contain 48 PNG captures: eight
views at 390, 768, and 1440 CSS pixels, with both above-fold and full-page
captures.

| Alias                 | Audited route                                                  |
| --------------------- | -------------------------------------------------------------- |
| `home`                | `/`                                                            |
| `category`            | `/categories/cybersecurity-data-protection/`                   |
| `article`             | `/articles/back-up-business-files-with-the-3-2-1-method/`      |
| `toolkit`             | `/toolkit/`                                                    |
| `about`               | `/about/`                                                      |
| `editorial-standards` | `/editorial-standards/`                                        |
| `contact`             | `/contact/`                                                    |
| `404`                 | an intentional nonexistent route returning the custom 404 page |

Filenames follow `<width>-<alias>-<above-fold|full>.png`. At capture time, the
audit recorded 46/46 compared live/local HTML and referenced-asset files as
byte-identical for this baseline. That is a contemporaneous observation, not a
claim derived from the PNGs. This directory retains the 96 screenshots, but it
does not retain the 46 compared file pairs or a hash manifest; therefore the
payload-parity result cannot be independently reproduced from this directory.
The separately retained screenshot sets are visual capture evidence and are
not claimed to be byte-identical to one another.

## Baseline observations

Strengths confirmed across the audited routes and widths:

- The pages used the shared publication header, main-content shell, and footer.
- No horizontal document overflow or unexpected browser/network errors were
  observed in the audited cases.

Release defects present at the baseline:

- Article HTML contained separate desktop and mobile Fit and table-of-contents
  implementations. CSS exposed one copy at a time, but the raw document still
  duplicated that content.
- The homepage exposed the entire 15-article corpus instead of a curated
  selection.
- Category pages forced the same lead/support hierarchy even for categories
  containing only three articles.
- Toolkit field tables required horizontal scrolling on mobile.
- Social-preview coverage was incomplete.
- The canonical production origin was hardcoded.
- The article Lighthouse performance median was `89`, below the release gate
  of `>=90`.

No item in this record establishes an AdSense decision, a Blogger change, or a
deployment of the publication-maturity release.

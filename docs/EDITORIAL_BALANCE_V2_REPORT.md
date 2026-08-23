# Editorial Balance V2: Pre-deploy Evidence

Date: August 22, 2026

Status: Local candidate verified; GitHub push and Vercel deployment not yet performed

## Outcome

The candidate makes the publication materially shorter, less repetitive, and faster to scan while preserving the complete article inventory. The homepage now links to all 15 articles exactly once, category pages keep their full source membership, articles begin reading sooner on mobile, and shared trust/footer content is better balanced.

## Visual comparison

The comparison covered baseline production and the local candidate across four representative routes at 390, 768, 1440, and 1920 pixels: 32 inspected states total.

| Area                                   |       Baseline production |            Candidate local | Result                                                                |
| -------------------------------------- | ------------------------: | -------------------------: | --------------------------------------------------------------------- |
| Homepage links / unique articles       |                   30 / 15 |                    15 / 15 | Repetition removed; full inventory retained                           |
| Homepage editorial visuals             |                        11 |                          1 | One clear lead image instead of repeated artwork                      |
| Homepage document height, 390 px       |                 16,309 px |                   6,918 px | 57.6% shorter                                                         |
| Homepage document height, 1440 px      |                 10,272 px |                   4,156 px | 59.5% shorter                                                         |
| Homepage lead-title bottom, 390 px     |                 989.39 px |                  558.42 px | Primary story appears 430.97 px sooner                                |
| AI category editorial visuals          |                         4 |                          1 | One category motif; all 3 articles retained                           |
| AI category lead-title bottom, 390 px  |               1,096.72 px |                  648.22 px | Lead appears 448.50 px sooner                                         |
| AI category lead-title bottom, 1440 px |               1,182.83 px |                  760.30 px | Lead appears 422.53 px sooner                                         |
| Article first-body start, 390 px       |               1,687.66 px |                  792.92 px | Reading begins 894.74 px sooner                                       |
| Article table text, 390 px             |                     13 px |                      16 px | Improved mobile legibility; table has a named focusable scroll region |
| Mobile footer height, 390 px           |               1,113.53 px |                  772.09 px | 341.44 px shorter                                                     |
| Standards content, 1440 px             | 704 px wide at 48 px left | 704 px wide at 368 px left | Reading column is centered                                            |

Visual budgets stayed deliberate: homepage 11 to 1, category 4 to 1, article 1 to 1, and editorial standards 0 to 0.

All 32 states returned HTTP 200 with:

- no horizontal overflow;
- no console or page errors;
- no failed requests; and
- local fonts ready.

The screenshots and measurement file under `.gstack/editorial-balance-v2/` are local, ignored verification evidence and are not part of the committed release source.

## Quality gates

The latest completed local QA run passed:

- 119 unit tests;
- 72 Playwright browser tests;
- production build of 31 static pages;
- content, SEO, and external-link checks; and
- Lighthouse thresholds using the median of three runs per representative route.

| Lighthouse route   | Performance | Accessibility | Best practices | SEO |
| ------------------ | ----------: | ------------: | -------------: | --: |
| Homepage           |          92 |           100 |            100 | 100 |
| AI category        |          94 |           100 |            100 | 100 |
| Automation article |          93 |           100 |            100 | 100 |

These are local pre-deploy results. They do not establish that GitHub or Vercel has received this revision.

## Unchanged boundaries

- Ads, analytics, affiliate scripts, sponsorships, consent tooling, and tracking remain disabled.
- The byline remains the publication name only; no person or organization identity is invented.
- The separate Blogger theme and Blogger publication state were not changed.

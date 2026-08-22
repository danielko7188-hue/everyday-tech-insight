# Initial Content Audit

**Audit date:** 2026-08-21

**Scope:** `src/content/articles/*.md`

**Automated status:** Passing content portfolio contracts and Astro content build
**Human status:** Unchecked; no owner or expert review is claimed

## Portfolio result

| Measure                                                 |        Result |
| ------------------------------------------------------- | ------------: |
| Published Markdown entries                              |            15 |
| Categories                                              |             5 |
| Entries per category                                    |        3 each |
| Total article body words                                |        17,203 |
| Body word-count range                                   |   1,030–1,670 |
| Source citations                                        |            33 |
| Distinct source URLs                                    |            29 |
| Direct source URLs returning HTTP 200 on the audit date |      29 of 29 |
| Related published links                                 | 2 per article |
| Initial entries with `dateModified`                     |             0 |
| Columns based on owner experience                       |             0 |

Word counts are descriptive audit evidence, not a ranking or publication rule. Content quality was not inferred from length alone.

## Tests run

### Required red phase

Command:

```text
npm test -- --run tests/unit/content-portfolio.test.ts
```

Initial result: 1 test failed and 5 passed. The expected failure reported one article against the required fifteen. This established that the count and category-coverage contract detected the missing portfolio.

After the 14 new entries were added, the focused suite passed 6 of 6 tests.

### Relationship regression

Command:

```text
npm test -- --run tests/unit/content-portfolio.test.ts -t "links every article"
```

Expected red result: the original automation article had zero related entries. The contract required two distinct, non-self, published slugs and failed on that exact file.

Fix: linked the original article to the AI-output evaluation guide and workflow-documentation guide.

Final focused result:

```text
Test Files  1 passed (1)
Tests       7 passed (7)
```

### Astro schema and production generation

Command:

```text
npm run build
```

Result: Astro content synchronization and static build passed; 31 pages were generated, including all 15 article routes, five category routes, RSS, HTML sitemap, trust pages, and the 404 document. The sitemap integration completed.

### Content and external-source checks

Commands:

```text
npm run check:content
npm run check:links
```

Results:

- `Content QA: PASS`
- `External source links: 29 PASS, 0 FAIL, 0 UNVERIFIED (29 unique).`

Full repository lint, type checking, built-output QA, Playwright, axe, and Lighthouse are tracked separately in `TECHNICAL_QA.md`; this content audit does not claim those final project checks occurred here.

## Contract coverage

The content portfolio test verifies:

- exactly 15 Markdown article files;
- exactly three articles in each approved category;
- unique slug, title, and description values;
- file names matching frontmatter slugs;
- `published` status and `source-checked` verification status;
- genuine `2026-08-21` publication and review dates;
- no same-day `dateModified` field for an initial publication;
- all five Business Technology Fit fields;
- at least two distinct HTTPS sources per entry;
- source hosts restricted to the reviewed official or first-party allowlist;
- every listed source URL cited in the article body;
- two distinct, non-self, resolvable related published articles per entry;
- at least 650 body words and four second-level sections per entry;
- explicit limitation language; and
- no match for a defined set of unsupported first-person testing claims.

Astro’s content schema separately enforces metadata length, date validity, category vocabulary, byline, source shape, status, verification status, source count, local-image pairing, same-origin canonical override, indexing status, and advertising/analytics identifier exclusions.

## Business Technology Fit result

All 15 entries identify:

1. a specific business problem;
2. a central technology focus;
3. an intended small-business audience;
4. a practical reader outcome; and
5. traceable source support.

The fit was reviewed for substance in the content plan, not only field presence. No entry was added solely to fill a category.

## Duplication and category review

The final portfolio assigns one primary reader question to each article:

- automation candidate selection;
- AI acceptable-use governance;
- AI output-quality evaluation;
- CRM versus project-management category choice;
- full SaaS due diligence;
- export, integration, and portability testing;
- MFA rollout;
- backup and restoration;
- phishing first response;
- shared file organization;
- workforce technology onboarding;
- current-state workflow documentation;
- total software cost;
- general 30-day pilot execution; and
- technology risk governance.

The closest overlaps were intentionally bounded:

- AI evaluation owns task-specific cases and rubrics; the strategy pilot owns the general four-week procurement and decision process.
- Automation selection chooses a candidate; workflow documentation maps the current process before automation.
- The SaaS checklist owns broad due diligence; portability and total cost each provide a deeper independent test.
- MFA, onboarding, phishing response, and backup cover different preventive, provisioning, response, and recovery decisions.

## Source audit

- All 33 citations use HTTPS.
- All 29 distinct URLs returned HTTP `200` in a direct GET/redirect snapshot on 2026-08-21.
- Sources are NIST/AIRC, CISA, FTC, EPA, National Archives, Digital.gov, Salesforce, or Atlassian.
- Salesforce and Atlassian are used only as first-party definitions of CRM and project-management categories; CISA supplies the neutral secure-procurement lens.
- Older NIST, CISA, and National Archives materials are identified by context in the article and are not presented as current product instructions.
- Articles say when an exact checklist, score, schedule, or decision method is editorial adaptation rather than a source-prescribed standard.
- No secondary SEO blog, affiliate site, social post, search snippet, or unverifiable AI-generated citation is included.

The HTTP snapshot is not continuous monitoring and does not prove future availability, unchanged meaning, or product conformance. The final link checker may encounter rate limits or bot protections and must report them honestly.

## Failures found and fixes applied

1. **Portfolio shortfall:** The initial single-article architecture failed the 15-entry and three-per-category contract. Fourteen source-backed entries were added.
2. **Premature modification dates:** The original and newly drafted launch entries initially repeated the publication date in `dateModified`. The field was removed from all 15; it is reserved for a later substantive revision.
3. **Unresolved related-reading gap:** The original automation guide had an empty related list. A failing relationship test was added, then two genuinely related published slugs were assigned.
4. **Strict TypeScript captures:** The file-based portfolio parser initially treated regular-expression groups as always defined. Explicit guards were added without weakening assertions.
5. **Potential AI-pilot overlap:** The AI topic was narrowed to output-quality evaluation while the strategy article retained the general 30-day pilot workflow.

## Remaining limitations

- Every article is source-checked, not represented as personally tested.
- No software product, price, account configuration, backup restore, MFA rollout, phishing incident, migration, or technology pilot was performed for the publication.
- A successful build and source check do not prove legal, privacy, security, accessibility, accounting, employment, records, or sector suitability.
- Automated word, phrase, and metadata checks cannot establish full originality, fairness, clarity, or factual completeness.
- Source pages, laws, contracts, product plans, APIs, and technical guidance can change after the review date.
- The public byline is the publication name; real owner identity and biography remain unknown.
- The site has no genuine private contact email, owner legal facts, AdSense account, publisher identifier, consent-management platform, analytics, advertising, or `ads.txt` record.

## Manual review required

The unchecked `HUMAN_REVIEW_CHECKLIST.md` is the controlling human gate. At minimum, the owner must read every article, recheck material and current claims, confirm source fairness and rights, verify publication identity and contact, review privacy and consent for the live deployment, and approve any specialist-dependent guidance.

In this repository, `published` means the static generator includes the route. It does not mean a human owner, subject-matter expert, or Google reviewed or approved the content. This portfolio must not be described as ready for an AdSense application while the human gate remains unchecked.

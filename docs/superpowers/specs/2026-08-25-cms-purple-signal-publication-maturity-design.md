# Everyday Tech Insight CMS and Purple Signal Publication Maturity Design

**Date:** 2026-08-25  
**Status:** Approved through delegated owner judgment  
**Applies to:** `everyday-tech-insight-static` Astro repository only  
**Selected direction:** Balanced Purple Signal + Editorial Rail + Evidence-first Reading

## 1. Decision and evidence boundary

The user directed Codex to finish the work, make the design decisions, research uncertainty, and choose the strongest option without additional questions. The selected design is therefore treated as approved for implementation. It supersedes the visual direction in the existing `DESIGN.md` after the implementation and verification pass updates that file.

The static Astro site and the separate Blogger project remain distinct. This design does not authorize or change Blogger XML, Blogger settings, AdSense accounts, Search Console, analytics, CMP configuration, or a Google review request. Advertising remains disabled. Google alone decides AdSense approval.

External owner actions—Pages CMS GitHub authorization, verified public identity, contact email, custom domain, AdSense account values, ads.txt, CMP selection, human review, firsthand testing, and legal/privacy conclusions—are documented as open gates and are never fabricated.

## 2. Current source of truth

The production rollback baseline is GitHub/Vercel commit `6473acaa64c64a64de6d3d1e6900cdad9a52d06c` at `https://everyday-tech-insight.vercel.app/`. Local design exploration advanced `main` to `67db035` without changing public application source; design/source documents remain a later local commit until recorded. Origin remains at the production rollback SHA until the final reviewed push. These three states—production, origin, and local implementation—must be reported separately throughout the work.

The current public application has five categories, 15 published Markdown guides, four Toolkit resources, no CMS, no public management route, no advertising, and a verified static production baseline. Fresh pre-change evidence is stored under `artifacts/site-audit/before/purple-signal-2026-08-25/`; its manifest records origin, deployment identity, timestamp, route, viewport, response state, and hashes. Existing older screenshots are historical evidence only.

Article source remains:

```text
src/content/articles/**/*.{md,mdx}
```

The current public loaders already filter to `status === "published"`, but the schema and QA reject incomplete drafts. The implementation must make draft/review/archived content valid without allowing it to leak into public routes, sitemap, RSS, categories, archive, related guides, or social images.

## 3. Selected design direction

Purple Signal Editorial is an original publication identity with an intended balance of approximately 70% serious editorial publication and 30% high-energy modern technology.

Selected qualities:

- Intelligent, clear, contemporary, confident, practical, premium, technical, and independent.
- Dark plum surfaces for identity and selected story openings.
- Paper, white, and pale lavender for reading, archive, trust, and instructions.
- Violet for structural emphasis; magenta for limited signal moments.
- Typography, rules, alignment, and whitespace carry hierarchy before cards, shadows, or gradients.
- No WEKA diagonal mark, copied palette, asset, 3D composition, typography, product language, or source code.
- No mystical, crypto, gaming, neon-only, corporate SaaS, or AI-template treatment.

The retained alternatives and the selected winners are documented in `.planning/sketches/`.

## 4. Exact visual tokens

Core requested tokens remain, with contextual accessibility tokens added:

```css
--brand-night: #0d0618;
--brand-deep: #17102a;
--brand-surface-dark: #24143d;
--brand-ink: #171221;
--brand-paper: #faf8ff;
--brand-mist: #f4f0ff;
--brand-white: #ffffff;
--brand-violet: #7c3aed;
--brand-violet-dark: #5b21b6;
--brand-violet-light: #a78bfa;
--brand-lavender: #c4b5fd;
--brand-magenta: #d946ef;
--brand-pink: #ec4899;
--brand-rule-light: #ddd6fe;
--brand-rule-dark: #3a2e51;
--brand-boundary: #756884;
--brand-text-muted-light: #5b5566;
--brand-text-muted-dark: #c9c3d8;
--brand-focus-dark: #fde047;
--brand-focus-light: #5b21b6;
--brand-error: #b42318;
--brand-success: #166534;
--brand-gradient: linear-gradient(
  135deg,
  #7c3aed 0%,
  #a855f7 48%,
  #d946ef 100%
);
```

Category structure stays in a coherent family:

```css
--category-ai: #6d28d9;
--category-software: #4338ca;
--category-security: #a21caf;
--category-operations: #5b21b6;
--category-strategy: #be185d;
```

Rules:

- White normal text is permitted on solid violet and night, not on magenta or the complete gradient.
- Ink is used on magenta.
- Yellow focus is limited to dark surfaces; deep violet focus is used on light surfaces.
- Light/dark rule tokens are decorative only. `--brand-boundary` is used for meaningful control and diagram boundaries.
- Gradient use is limited to a 1–4px signal rule, contained visual detail, selected Toolkit emphasis, favicon/social artwork, and small motifs.
- Color never communicates category, state, link, selection, error, publication status, ad label, or diagram meaning alone.

## 5. Typography and geometry

- Source Sans 3: full publication wordmark, navigation, homepage promise, UI, labels, metadata, Toolkit instructions, and article body.
- Newsreader: article headlines and editorial section headings.
- Homepage promise: Source Sans 3 at `clamp(3rem, 5.5vw, 5.75rem)`; mobile `clamp(2.4rem, 11vw, 3.6rem)`.
- Article headline: Newsreader at `clamp(3rem, 5vw, 5.25rem)`; mobile `clamp(2.25rem, 9vw, 3.35rem)`.
- Body: 18–19px, approximately 1.7 line height, 65–75 character measure.
- Controls: 8px radius; story cards: 10–12px; major visual containers: no more than 16px.
- Feature shadow is limited to one or two genuinely elevated modules.
- Giant rounded panels, glassmorphism, heavy shadows, decorative pills, and random asymmetry are prohibited.

## 6. Publication mark and masthead

The full name `Everyday Tech Insight` remains visible and is the accessible identity. `ETI` is secondary.

Mark:

- Compact night/deep tile.
- Original vertical violet-to-magenta signal bar.
- White `ETI` lettering.
- Full Source Sans 3 wordmark beside it.
- No copied or diagonal emblem and no generic robot, chip, brain, lightning bolt, or globe.

Desktop masthead:

- Dark identity row, approximately 72–80px.
- Guides, Toolkit, and About on the right.
- Slightly lighter 44–50px topic row beneath it.
- Active route uses `aria-current`, weight, and a visible underline.
- A thin gradient signal rule frames the masthead.

Mobile:

- 64–72px identity row with a 44px menu control.
- Native semantic menu behavior is preserved, with an explicit Menu/Close state.
- Guides and Toolkit appear first, then topics and publication links.
- No full-screen animation; no scroll leak or focus trap.

## 7. Page compositions

### Homepage

- Full-bleed dark opening with an 84rem internal grid.
- A 5/7 publication-promise and lead-story composition on desktop.
- One dominant story-specific visual, guide promise, deliverable, date, reading time, and clear action.
- Two smaller supporting stories without duplicated metadata blocks.
- Latest Guides becomes a compact typographic editorial rail rather than three equal cards.
- Five topic entries use pale lavender surfaces, names, counts, and original motifs.
- The existing nine-distinct-guide homepage boundary remains intact.

### Story treatments

- `lead`: largest headline, full guide promise, deliverable, and high-contrast visual.
- `feature`: medium visual, one-sentence promise, selective metadata.
- `standard`: visual plus text, date, time, and promise.
- `compact`: optional thumbnail, title, promise, and time; no deliverable.
- `list`: typographic row with separator, topic/date, title, promise, and time; no default card box.

### Archive and categories

- `/articles/` remains the complete archive with all published guides exactly once.
- Add a static topic-jump navigation; heavy client filtering remains unnecessary at 15 guides.
- Every row shows content type, date, reading time, and guide promise.
- Three-guide category pages retain one introduction, one motif, and one complete list without manufactured featured hierarchy.

### Article

- Dark 7/5 hero with text first in source order and story-specific visual second.
- Category, type, H1, guide promise, publication-name byline, genuine dates, and reading time.
- Evidence no longer competes with the H1.
- One semantic At a Glance component: business problem, technology focus, intended reader, and `What you will produce`.
- Four columns only at wide widths, 2×2 at tablet, one column at mobile.
- One semantic TOC; sticky only when viewport space permits.
- Light article body at approximately 44rem with underlined links, accessible tables, notes, figures, sources, corrections, and related guides.

### Toolkit

- Dark or restrained gradient introduction and four typed resource cards.
- Each landing card states purpose, record produced, related guide, format, details, and download action.
- Detail pages remain mostly light and explain purpose, audience, when to use/not use, fields, limitation, data handling, guide, and download.
- No advertising may appear beside or inside Toolkit actions.

### Trust, footer, and 404

- Trust/legal pages retain calm light editorial shells and factual copy.
- Footer uses night purple plus a thin signal rule, truthful link groups, and no invented social profiles.
- 404 includes explicit Home, Guides, and Topics paths; no ads and no fake search.

## 8. Editorial data contract

Every published guide gains:

- `guidePromise`: 90–180 characters.
- `deliverable`: 20–150 characters and concrete output language.
- `whenToUse`: 40–180 characters.

These values are checked against each existing article body before publication and appear selectively by story treatment.

Lifecycle:

```text
draft -> review -> published -> archived
```

- Draft requires `title`, `slug`, publication-name `author`, `status`, and a safe nonempty Markdown body that may still be incomplete. Category, content type, summary, publication/review/archive dates, sources, fit fields, guide explanation, visual, related guides, and hero metadata may be absent. Repository defaults force `verificationStatus: "unverified"`, `featured: false`, `relatedArticles: []`, and `noindex: true`. It is excluded everywhere public.
- Review requires all draft fields plus `description`, `guidePromise`, `deliverable`, `whenToUse`, the four fit fields, a valid informative visual, and at least one source record. It may omit publication/review dates and the final two-source minimum. It is excluded everywhere public.
- Published requires the complete strict contract, at least two HTTPS source records, a human source-suitability classification in the quality queue, date/order/content/media/route validation, and public discovery. Automated validation proves HTTPS/count/shape, not whether a source is substantively primary.
- Archived requires the formerly complete published record plus `dateArchived >= datePublished` and any later modification/review date. The file and Git history remain, public listings/feeds/routes exclude it, and its former URL returns the site’s ordinary 404 unless a separately reviewed closely equivalent replacement justifies an explicit redirect. Normal workflow is archive, not delete.

Review preview decision: Pages CMS edits a non-`main` content branch and GitHub opens a pull request. Vercel previews that branch’s published-only public build and validates shell/integration changes, but review-status articles remain nonroutable. Editors use Pages CMS Markdown preview for the article itself until an owner-authorized protected content-preview mechanism is separately designed. No hidden-but-public review URL is created.

Published related guides cannot self-reference, duplicate, reference missing entries, or reference nonpublished entries.

### Locked 15-guide explanation and visual mapping

| Slug                                                       | Guide promise                                                                                                                         | Deliverable                                                               | When to use                                                                                                        | Visual key                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `how-to-identify-business-tasks-for-automation`            | Inventory recurring work, screen repeatability and risk, and select one bounded automation candidate with a human-owned fallback.     | Ranked automation-candidate shortlist and one-page pilot brief.           | Use before comparing automation products or connecting AI tools to an existing business workflow.                  | `automation-candidate-screen` |
| `evaluate-ai-output-quality-in-a-small-team-pilot`         | Test AI output against representative cases, a defined rubric, a baseline, and the real time required for human correction.           | AI pilot scorecard with a go, revise, or stop recommendation.             | Use before expanding an AI drafting, extraction, classification, or summarization pilot into normal operations.    | `ai-quality-scorecard`        |
| `write-a-practical-ai-acceptable-use-policy`               | Define which AI tools, data, and use cases are allowed, restricted, or prohibited before employees begin using them.                  | Short AI acceptable-use policy draft with approval and reporting duties.  | Use when employees are already experimenting with AI or before the business authorizes broader AI use.             | `ai-use-governance`           |
| `evaluate-saas-with-a-practical-checklist`                 | Turn business requirements into test scenarios and verify workflow, security, data, administration, and exit claims before buying.    | SaaS evidence sheet and documented buy, revise, or reject decision.       | Use during a trial, vendor demonstration, renewal review, or replacement decision for important business software. | `saas-evidence-checklist`     |
| `crm-vs-project-management-software`                       | Choose software by whether the durable record is the customer relationship or the coordinated delivery of project work.               | System-category decision and documented CRM-to-project handoff.           | Use when sales, customer, and delivery tools appear to offer overlapping tasks, notes, owners, and reports.        | `work-object-comparison`      |
| `test-data-export-and-integrations-before-saas-lock-in`    | Export representative data and test critical integrations before dependence grows and migration becomes expensive.                    | Portability test record, dependency map, and exit-effort estimate.        | Use before selecting, renewing, or deeply integrating a SaaS product that will hold important business records.    | `saas-exit-data-flow`         |
| `roll-out-mfa-across-a-small-business`                     | Prioritize critical accounts, protect recovery paths, stage enrollment, and verify that MFA is actually enforced.                     | Prioritized MFA rollout, recovery procedure, and coverage record.         | Use when introducing MFA, correcting uneven enrollment, or reviewing privileged and recovery-account protection.   | `mfa-rollout-boundary`        |
| `respond-to-a-suspected-phishing-message`                  | Verify a suspicious request through a known channel and escalate containment based on clicks, credentials, payments, or exposed data. | Phishing response checklist and initial incident record.                  | Use immediately after a suspicious email, text, call, attachment, login page, or payment request is received.      | `phishing-response-workflow`  |
| `back-up-business-files-with-the-3-2-1-method`             | Separate live data from independent backup copies and prove that representative files can be restored before an incident.             | Backup inventory, 3-2-1 plan, and documented restore-test log.            | Use when cloud sync is being treated as backup or when recovery has never been tested.                             | `three-two-one-topology`      |
| `create-a-shared-file-and-folder-system`                   | Organize shared files by durable business function, consistent naming, ownership, permissions, and lifecycle.                         | Shared-folder map, naming convention, and file-governance rules.          | Use when important files are scattered across personal drives, inboxes, duplicate folders, or inconsistent names.  | `shared-file-architecture`    |
| `document-a-repetitive-workflow-before-automating`         | Map the real workflow, including decisions and exceptions, before choosing what should be improved or automated.                      | Verified current-state workflow map and automation-requirements packet.   | Use before purchasing workflow software or automating a recurring administrative or operational process.           | `workflow-exception-lane`     |
| `onboard-employees-and-contractors-to-business-technology` | Provision role-based accounts, devices, access, and training while preserving the records needed for later changes or departure.      | Technology onboarding checklist and approved-access record.               | Use before an employee, contractor, temporary worker, or service provider receives business-system access.         | `access-onboarding-checklist` |
| `calculate-the-total-cost-of-business-software`            | Compare software using the full cost of implementation, labor, operation, change, and exit—not subscription price alone.              | Transparent total-cost range and assumptions register.                    | Use when comparing, renewing, consolidating, replacing, building, or retaining business software.                  | `software-cost-stack`         |
| `create-a-simple-technology-risk-register`                 | Turn vague technology concerns into prioritized event-to-consequence risks with evidence, ownership, treatment, and review.           | Prioritized technology risk register with owners and treatment actions.   | Use when technology concerns are scattered, appear equally urgent, or lack ownership and review dates.             | `technology-risk-matrix`      |
| `run-a-30-day-business-technology-pilot`                   | Run a controlled four-week technology test without allowing a trial to become production by default.                                  | Pilot charter, evidence log, and documented go, revise, or stop decision. | Use before a broader commitment to SaaS, automation, collaboration, security, or operational technology.           | `thirty-day-pilot-timeline`   |

## 9. CMS architecture

```text
Pages CMS -> GitHub Markdown/media -> Astro validation/build -> Vercel preview/production
```

`.pages.yml` provides:

- List fields in this order: `title`, `status`, `category`, `contentType`, `datePublished`, `lastReviewed`, `featured`.
- Search fields: `title`, `slug`, `summary`, `category`, `status`, `contentType`.
- Sort fields: `datePublished`, `lastReviewed`, `title`, `category`, `status`; default publication-date descending.
- Plain-language helper descriptions.
- Read-only publication-name author.
- Fixed category/type/status/verification/visual options.
- Rich-text Markdown body.
- Repeatable collapsible sources.
- Slug-storing related-guide references.
- Flat private source media in `src/content-assets/articles/` with slug-prefixed filenames; the validated build publishes referenced files to `/images/articles/` URLs only.
- `delete: false` and `rename: false`.
- `settings.content.merge: true` and app commit identity.
- Empty date defaults so a CMS action does not manufacture publication or review dates.

The collection uses `filename.template: "{fields.slug}.md"`, `filename.field: false`, `subfolders: false`, `operations: { create: true, rename: false, delete: false }`, and app commit identity. Slug is editable while drafting, but the CMS cannot lock it only after creation. Therefore the guide states that slug becomes immutable after the first commit, rename remains disabled, and QA rejects filename/slug mismatch. Any later URL change is a reviewed Git operation with redirect analysis.

Branch workflow: editors select or create a `content/<slug>` branch, Pages CMS commits there, GitHub opens a pull request, repository CI runs the full publication contract, and Vercel creates a branch preview. Only a reviewed merge to `main` can trigger production. Branch protection and Pages CMS GitHub App installation are owner actions documented as unverified until observed.

Repository validators enforce every rule that Pages CMS cannot express: lifecycle requirements, date ordering, slug/filename parity, related status/self references, visual type/key pairing, safe markup, media existence/path/extension/dimensions/size/duplicate naming, alt coupling, and published minimums.

No public CMS link, script, route, token, credential, or configuration is rendered. Repository-valid configuration and synthetic fixtures may be completed locally. Hosted configuration parsing, actual author defaulting, Markdown table/blockquote/code/image preservation, media upload, same-collection reference storage, delete/rename control absence, and commit identity remain explicit owner-authorized Pages CMS acceptance gates.

## 10. Media architecture

CMS-managed raster source media is stored privately in:

```text
src/content-assets/articles/
```

Allowed CMS formats: WebP and PNG, with JPEG only when necessary. SVG is not exposed to ordinary CMS upload; existing reviewed deterministic SVG illustrations remain engineering-controlled. Pages CMS safe-renames the filename supplied by the editor but cannot prepend the article slug, so the slug prefix is a documented manual naming rule enforced by repository QA. Only validated and referenced sources are projected into the published output under `/images/articles/`; the source directory itself is never a public route.

Required checks:

- Root-relative safe path under the exact media root.
- Slug-prefixed filename.
- Existing file and safe extension.
- Explicit decoded dimensions, maximum 3200×3200 pixels.
- Maximum 1.5MB file-size budget.
- No path traversal, remote hotlink, executable/HTML upload, or duplicate filename.
- Informative media requires meaningful alt text; decorative media uses empty alt and explicit decorative state.
- Hero media is one validated tuple: `heroImage`, `heroImageAlt`, `heroImageDecorative`, optional `heroImageCaption`, `heroImageCredit`, `heroImageSourceUrl`, and `heroImageLicense`. No hero-only metadata may exist without `heroImage`; informative images require nonempty alt, decorative images require explicit `true` plus empty alt.
- Optional caption, credit, source URL, and license note are factual and never invented.

## 11. Verified-author and publisher boundary

Add a typed `authors.ts` architecture but render no real person until owner-approved values exist. Until then:

- `Everyday Tech Insight` remains a publication-name byline, never a person or legal organization.
- One concise disclosure appears near the article footer.
- No fake identity, credentials, photograph, organization, Person schema, or Organization schema.
- Missing owner inputs are recorded in `docs/OWNER_INPUTS_REQUIRED.md`, never displayed as placeholders.

The future-author record is intentionally strict:

```ts
interface VerifiedAuthorRecord {
  id: string; // lowercase stable slug
  kind: "person";
  displayName: string;
  role: string;
  shortBio: string;
  profilePath: `/authors/${string}/`;
  photo?: {
    src: `/images/authors/${string}`;
    alt: string;
    credit: string;
    rightsBasis: string;
  };
  credentials?: readonly {
    label: string;
    evidenceUrl: `https://${string}`;
  }[];
  sameAs?: readonly `https://${string}`[];
  ownerVerifiedAt: string; // YYYY-MM-DD
}
```

`authors.ts` initially exports an empty, typed registry. A future `authorId` may be accepted only when it resolves to that registry and the matching public author page exists. Until both are true, frontmatter remains the literal publication byline. `Person` structured data is emitted only from an owner-verified record and only for fields visible on the author page. No `Organization` structured data is emitted until a legal organization identity is owner-provided and publicly disclosed.

`docs/OWNER_INPUTS_REQUIRED.md` contains 18 numbered gates with status, reason, accepted evidence, public effect, and next action:

1. legal owner or publisher identity;
2. approved public publisher wording;
3. durable public contact email or contact method;
4. custom-domain decision and ownership proof;
5. named-author identity, if any;
6. author role, biography, and credential evidence;
7. author-photo file, alt text, credit, and rights basis;
8. firsthand-use or testing evidence for any claim that implies it;
9. human editorial review of all 15 guides;
10. expert review for security, legal, privacy, financial, or other consequential claims where needed;
11. image and worksheet rights review;
12. privacy/legal review for the actual operating jurisdiction and data practices;
13. Pages CMS GitHub App authorization and repository selection;
14. protected `main` branch and pull-request review rules;
15. AdSense account/site status and exact owner-provided publisher values;
16. approved verification method and exact value;
17. authorized `ads.txt` line and certified CMP decision where applicable;
18. final owner acceptance of content, disclosures, placements, and production release.

## 12. Content-quality control

`docs/CONTENT_QUALITY_REVIEW_QUEUE.md` records the 15 guides’ purpose, reader, promise, deliverable, primary sources, original method/visual/worksheet contribution, unsupported claims, repetition, evidence limits, recommendation, owner action, and expert-review need.

Each row has these exact fields: `slug`, `title`, `category`, `publicationStatus`, `wordCount`, `reader`, `businessNeed`, `guidePromise`, `deliverable`, `whenToUse`, `sourceUrls`, `sourceSuitability`, `sourceLastChecked`, `originalMethod`, `originalVisual`, `toolkitContribution`, `claimRisks`, `repetitionRisks`, `evidenceLimits`, `mediaRights`, `automationReview`, `humanEditorialReview`, `expertReviewNeeded`, `recommendation`, `ownerAction`, `reviewedBy`, `reviewedAt`, and `releaseGate`.

`automationReview` can prove only repository-observable checks. `humanEditorialReview` starts as `OWNER REVIEW REQUIRED`; it is never auto-completed. `sourceSuitability` records a reasoned editorial classification but does not turn an external page into a primary source by assertion. `reviewedBy` and `reviewedAt` stay empty until a real reviewer supplies them.

Release-gate values are:

- `software-blocker`: schema, route, date, source-shape, media, accessibility, security, or build failure. Production may not ship.
- `publication-blocker`: known unsupported consequential claim, missing rights, deceptive identity/experience statement, or materially duplicated content. Production may not ship.
- `owner-action`: external identity, account, legal, hosted-CMS, or human-review evidence is absent. The truthful ads-off software release may ship only when the missing evidence is disclosed and no public claim depends on it.
- `clear`: repository-observable release checks pass and no known publication blocker remains. This never means Google approval or legal/editorial certification.

Automated word/source/route checks remain necessary but cannot prove originality, usefulness, rights, firsthand experience, or human review. No new articles are added merely to increase count.

## 13. Monetization architecture

The three internal safety modes are:

```text
off | verification | live
```

`off` is the only configured mode in this implementation.

- No AdSense script, publisher/meta ID, request, slot, blank gap, ads.txt, or advertising CMP.
- Privacy and disclosure pages describe the inactive factual state.

The typed configuration is validated as a discriminated union:

- `off`: provider, publisher ID, verification value, ads.txt line, CMP, and placements must all be absent or disabled.
- `verification`: provider is `google-adsense`; an explicit method is either `meta` or `ads-txt`; one exact owner-provided public value is required; ad script and display placements remain disabled. The `meta` method may render only the exact verification meta value. The `ads-txt` method requires a reviewed generated file. Neither method implies approval.
- `live`: provider is `google-adsense`; exact owner-provided publisher ID, confirmed AdSense site status, explicit owner authorization, reviewed disclosure copy, an authorized ads.txt line, and the applicable certified-CMP decision are required. A non-applicable CMP decision requires recorded jurisdiction/legal reasoning rather than an automated guess.

The production environment must not be able to enter `verification` or `live` by setting only one flag. Validation fails closed when the mode and its complete evidence/configuration tuple disagree. Secrets are never placed in public config; AdSense publisher and verification values are public only after the owner deliberately supplies and authorizes them.

`verification` renders no display units. `live` can render only explicitly eligible placements, never a generic blank slot. Initial eligibility is limited to `article-after-intro` and `article-before-sources` on a published guide whose body clears the documented length threshold. Every rendered unit has a visible `Advertisement` label, fixed responsive geometry to prevent layout shift, and a programmatic label. The current release renders none.

Conservative future placement eligibility is encoded but inactive. Toolkit/download, trust/legal, 404, sitemap/RSS, CMS, unpublished content, and other noneditorial surfaces are excluded. No approval or compliance guarantee is made.

`ads.txt` is absent in `off` mode and therefore returns 404. It is generated only for an owner-authorized `ads-txt` verification or `live` configuration, and its line must round-trip exactly through validation. Privacy and advertising-disclosure pages derive their factual integration-state wording from the same mode so copy cannot claim active ads, cookies, or consent tooling while code is off.

## 14. SEO, structured data, performance, and security

Preserve static HTML, canonical URLs, robots, sitemap, RSS, breadcrumbs, descriptive metadata, local social images, internal links, correct dates, and local fonts/media.

Structured data contains only visible verified facts. Do not add Person, Organization, Review, Rating, AggregateRating, awards, popularity, or testing data without evidence.

Preserve CSP, HSTS at production, referrer policy, permissions policy, frame protection, `nosniff`, no remote visual runtime, no heavy animation, no unnecessary framework hydration, reduced motion, and static rendering.

## 15. Verification contract

Required before release:

- Formatting, lint, Astro type checking, unit tests, production build.
- Content, image, CMS-config, SEO, external-link, and production checks.
- Draft/review/archived exclusion fixtures across routes, sitemap, RSS, related guides, and social generation.
- CMS-shaped draft build and Markdown/image/reference round-trip fixtures.
- One H1, landmarks, heading order, IDs, skip link, keyboard, visible contextual focus, 44px controls, axe, 200% zoom, 320px reflow, no color-only state, reduced motion, figures, tables, links, and overflow.
- Functional responsive coverage from 320 through 1920px.
- Reviewed production screenshots at 390, 768, 1024, 1440, and 1920px for the required route/state matrix.
- Windows and Linux visual baseline review after intentional redesign.
- Desktop and mobile Lighthouse, with performance 90+, accessibility/best-practices/SEO 95+.
- No console/page errors, broken media, failed local resources, or unexpected third-party requests.
- Exact deployed Git SHA, production shell parity, security headers, canonical alias, route/asset smoke, no ads.txt, no CMS route, and monetization-off evidence.

The component-level focus and meaningful-boundary contract is:

| Surface              | Default text/control treatment                    | Hover/current treatment               | Keyboard focus                        | Meaningful boundary                               |
| -------------------- | ------------------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| Dark masthead/footer | white or lavender on night/deep                   | underline plus weight; `aria-current` | 3px `--brand-focus-dark`, 3px offset  | `--brand-boundary` where a control edge is needed |
| Mobile menu control  | white text and explicit Menu/Close label          | background/tone change plus label     | 3px `--brand-focus-dark`, 3px offset  | 44px control with `--brand-boundary`              |
| Light body links     | `--brand-violet-dark`, always underlined in prose | thicker underline                     | 3px `--brand-focus-light`, 3px offset | not color-only                                    |
| Light buttons/cards  | ink or violet-dark on paper/mist                  | underline or border/position change   | 3px `--brand-focus-light`, 3px offset | `--brand-boundary`, never decorative rule token   |
| Violet actions       | white on solid violet                             | darker solid surface                  | 3px yellow, 3px offset                | violet-dark edge plus text label                  |
| Magenta signal       | ink on magenta                                    | structural underline/icon change      | 3px night, 3px offset                 | `--brand-boundary` when interactive               |

No component removes the browser-visible focus state without supplying the contextual state above. Contrast is re-measured by a deterministic unit-test artifact that records foreground, background, ratio, WCAG role, threshold, and pass/fail. Required baseline pairs include white/violet, white/night, lavender/night, muted-dark/surface-dark, ink/paper, muted-light/paper, violet-dark/paper, ink/magenta, and both focus colors on their contextual surfaces. White on magenta, white on the complete gradient, and yellow on paper are explicitly rejected for normal text.

The after-release screenshot matrix uses full-page captures at 390, 768, 1024, 1440, and 1920px for:

1. `/`;
2. `/articles/`;
3. `/categories/`;
4. `/categories/cybersecurity-data-protection/`;
5. `/articles/how-to-identify-business-tasks-for-automation/`;
6. `/articles/evaluate-saas-with-a-practical-checklist/`;
7. `/articles/respond-to-a-suspected-phishing-message/`;
8. `/articles/create-a-shared-file-and-folder-system/`;
9. `/articles/calculate-the-total-cost-of-business-software/`;
10. `/toolkit/`;
11. `/toolkit/technology-risk-register/`;
12. `/about/`;
13. `/publisher/`;
14. `/editorial-standards/`;
15. `/privacy/`;
16. `/advertising-disclosure/`;
17. `/contact/`;
18. an ordinary unknown route returning the styled 404.

Interaction captures add the keyboard-open menu at 390 and 768px and focused skip link at all five widths. The before matrix is a fresh representative snapshot of home, archive, one category, one article, Toolkit, about, editorial standards, and 404 at all five widths. The manifest marks the CMS draft and monetization-off checks as DOM/HTTP assertions rather than inventing screenshots of nonexistent public interfaces.

Before evidence is captured from the still-live rollback deployment before replacement and stored in `artifacts/site-audit/before/purple-signal-2026-08-25/`. After-local evidence is captured from the release candidate under `artifacts/site-audit/after/purple-signal-2026-08-25/local/`. The first production deployment’s committed screenshots use `artifacts/site-audit/after/purple-signal-2026-08-25/production/` and identify that deployment and release-candidate SHA exactly. Committing those images necessarily creates a later evidence-only SHA, so they must not be described as direct screenshot evidence of the later SHA.

After the evidence commit is pushed and redeployed, final-SHA production smoke plus the same full screenshot/manifest plan runs again into Git-ignored `artifacts/site-audit/runtime-verification/purple-signal-2026-08-25-final/`. That local final record directly identifies the final GitHub/Vercel SHA without creating a self-referential commit loop. The committed production record is classified as runtime-equivalent evidence only after confirming that the intervening commit changes solely Vercel-ignored evidence files and the final live shell/hash checks match. Every manifest records capture timestamp, phase, origin, expected Git SHA, deployment ID when available, route/status, viewport/state, filename, byte count, and SHA-256 digest. The top-level evidence README separates direct observations, runtime-equivalence inference, local results, and owner-only acceptance gates.

## 16. Rollback and release

Implementation uses reviewable Git commits. The prior production commit remains a direct rollback point. Generated output is never hand-edited. GitHub is pushed before Vercel production deployment. A production claim requires the exact deployment metadata and live checks, not a local build.

The release handoff clearly separates:

- Locally implemented and tested.
- Pushed to GitHub.
- Deployed and verified on Vercel.
- Owner/external actions still required.
- Unknown human/editorial/legal/account facts.

No code or design work guarantees AdSense approval; Google alone decides.

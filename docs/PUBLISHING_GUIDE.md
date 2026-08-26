# Publishing Guide

This guide is the operating procedure for the Astro publication. It does not apply to the separate Blogger theme.

## Current Pages CMS status

Pages CMS is **configured and locally tested** through the repository-root `.pages.yml`, lifecycle validators, a safe draft generator, and disposable draft/review/archived build fixtures.

The exact repository is `danielko7188-hue/everyday-tech-insight`, the release branch is `main`, and the owner editorial branch is `content/editorial`. The remote editorial branch and the current `main` protection were verified on GitHub on 2026-08-26. Selection of that branch inside hosted Pages CMS remains unverified.

Hosted Pages CMS access and hosted authorization—including hosted sign-in, GitHub App authorization, exact repository selection, hosted collaborator absence, exact GitHub App scope, Pages CMS branch selection, media upload, and a real save/commit round-trip—are **owner actions** and remain **unverified** because they have not been performed or observed in this work. The separately verified GitHub branch and protection settings are not evidence that an external CMS account is connected.

The reviewed YAML sets `create: true`, `rename: false`, and `delete: false`; these constrain the Pages CMS UI only and do not prevent direct Git operations. Direct Git can still rename, delete, or publish files, so pull-request and branch controls remain necessary.

Pages CMS is a Git-backed editor, not a native editorial approval engine. The repository lifecycle, branch protections, pull request, automated checks, human review, and owner acceptance provide the controls; the CMS must not be described as enforcing approvals it does not enforce.

This is a public GitHub repository. Every committed public branch, file, and managed-media byte is publicly visible, including non-`main` content branches and later-deleted files retained in history. “Owner-only” means intended write access, not privacy. Repository-tracked editorial records and managed media are non-deployed source, not confidential storage. Keep confidential owner, account, legal, review, and rights evidence outside Git; commit only a nonsecret evidence reference and truthful status.

`docs/editorial-operations.yml` is the source of truth for owner gates and the content-quality queue. Edit that strict structured record, then run `npm run generate:editorial` to regenerate the two finished Markdown documents. Review their diff and run `npm run check:editorial`; do not hand-edit generated records because the check requires an exact byte match.

A guide-level `clear` release gate requires a real source-check date, named and dated human review, `expertReviewNeeded` beginning `NO`, `mediaRights` beginning `CLEARED —`, and a concrete nonsecret release-evidence reference. Keep `YES` or `CONDITIONAL` expert needs and unresolved rights on a blocking or owner-action gate. Free-text words such as “complete” do not prove expert or rights review.

## One-time owner setup

1. Sign in to Pages CMS using the owner's authorized GitHub identity.
2. Review the GitHub App permission request before authorizing it. Grant the Pages CMS GitHub App access to the exact repository only: `danielko7188-hue/everyday-tech-insight`.
3. Do not invite Pages CMS collaborators. The intended owner-only write boundary depends on the owner's GitHub access and exact-repository App grant, neither of which this repository can prove.
4. Select the exact repository, then create or select the recommended `content/editorial` non-main content branch (`main` remains the release branch). Do not make routine editorial saves directly to `main`.
5. Reconfirm the live GitHub controls before release. As re-inspected on 2026-08-26 after foundation PR #2, `main` requires both app-bound checks—`Owner-only publishing gate` and `Full quality gate`—plus admin enforcement, linear history, and conversation resolution; force pushes and deletion are disabled, and no bypass actors are configured. Owner-authored PR #3 passed the trusted-base owner gate against immutable GitHub user ID `239253033` in [this check run](https://github.com/danielko7188-hue/everyday-tech-insight/actions/runs/33019254652/job/98345242404). Repository Actions permit GitHub-owned actions only, and every external fork contributor requires workflow approval. `content/editorial` permits direct CMS saves while enforcing admins, linear history, and no force pushes or deletion. Hosted settings can change. This solo-owner setup requires no second-person approval; record the owner's actual review rather than inventing a reviewer.
6. Make one reversible test edit on the content branch. Inspect the resulting GitHub commit, author identity, changed paths, diff, and any managed-media upload; then revert or close that test cleanly.
7. Keep confidential authorization evidence outside Git. Commit only a nonsecret evidence reference and truthful status after the owner observes the save/commit round-trip. Until then, keep the hosted status recorded as unverified.

## Create a guide

Use one of these two controlled paths on a non-`main` branch:

- In Pages CMS, choose the Articles collection and create a record. The CMS file-name rule derives the Markdown filename from the `slug` field.
- Locally, run `npm run new:article -- --slug a-safe-lowercase-slug --title "A factual working title"`. The generator creates a minimum draft and refuses collisions, traversal, or a published state.

A new guide begins as `draft`. The intended lifecycle is `draft -> review -> published -> archived`.

Pages CMS exposes `featured` as the homepage-opening control and includes it in the article list. Select up to three published guides. If more than three are selected, the reviewed curation order breaks ties first and publication or substantive-modification chronology breaks any remaining ties. Draft, review, and archived records never appear publicly even if the marker is set.

- `draft`: working content may be incomplete. It remains `noindex`, unfeatured, unverified, and nonroutable.
- `review`: the editorial structure, explanation fields, fit fields, at least one source record, and visual tuple are complete enough for review. It remains nonroutable.
- `published`: the complete software contract, at least two cited HTTPS source records, genuine dates, and media validation permit public routing. Published status controls routing only and does not prove source suitability, media rights, expert acceptance, owner acceptance, or human review.
- `archived`: the formerly complete record and Git history remain, but public routes, lists, feeds, sitemaps, related guides, and social images exclude it.

Before changing a new guide to `published`, add its matching quality record to `docs/editorial-operations.yml`, regenerate the derived editorial documents, and pass `npm run check:editorial`. The production build fails closed when a published slug has no quality record. A new guide also needs a new visual key registered in the content contract and `.pages.yml`, with its matching accessible SVG symbol implemented in `src/components/EditorialVisualSymbols.astro`; a CMS selection alone cannot create that symbol.

Do not skip directly to `published` to obtain a web preview. Pages CMS Markdown preview is the article-content preview for a review record. A Vercel preview validates the public shell and integration, but a review-status article remains nonroutable there by design.

## Keep slug and filename immutable

Treat the slug and filename as immutable after the first publication. They form the public URL and Git history. Correct titles and content without silently renaming the slug.

If a change to a published URL is unavoidable, handle it as a separately reviewed migration: establish the replacement, decide whether a close equivalent justifies a redirect, update every internal reference, run full QA, and obtain owner acceptance. A CMS rename by itself is not a migration plan.

## Write safely

Use Markdown headings, paragraphs, lists, links, tables, block quotes, code fences, and the existing documented components. In Pages CMS, use the rich-text editor for ordinary work. If source mode is necessary, use safe Markdown only; raw HTML is prohibited in article content. Never paste scripts, embedded trackers, iframes, event attributes, JavaScript URLs, credentials, tokens, or account identifiers.

Safe Markdown is required in source mode, and raw HTML remains prohibited.

## If sensitive data is committed

Stop publication work and do not add, copy, or discuss the sensitive value in another commit, issue, pull request, build log, or chat. Revoke or rotate the exposed credential first; deleting a file is not containment. Coordinate the response with the owner and the relevant repository, organization, service, or security administrator.

After containment, use GitHub's approved sensitive-data-removal process and `git-filter-repo` only under an administrator-reviewed incident plan. That plan must identify every affected branch, tag, fork or clone, pull-request reference, build artifact, and deployment. Invalidate affected Vercel previews or production deployments, caches, logs, and other copies as applicable, then verify the replacement credential and repository state without republishing the secret.

An ordinary Git revert does not erase a secret or remove it from Git history. History rewriting is an exceptional incident operation, not the normal rollback workflow; follow the approved GitHub process and coordinate required force-pushes and downstream cleanup with the owner and administrators.

Keep the promise fields distinct:

- `guidePromise` says what the guide enables.
- `deliverable` names the concrete record or decision the reader will produce.
- `whenToUse` states the decision moment.

The article body must substantively explain those promises without duplicating another guide. State limitations. Do not imply firsthand testing, credentials, ownership, legal review, or expert review without the corresponding evidence.

## Add sources and related guides

Every source record needs a factual title, HTTPS URL, publisher, and genuine access date. A review record can contain one source; a published guide requires at least two. Cite every frontmatter source URL in visible body prose where it supports a claim.

Classify source suitability through human editorial review. A government, standards, vendor, or other page is not made primary merely by labeling it so. Check what the page actually establishes, its scope, date, publisher role, and limitations.

Related guides must select existing article slugs. Keep the relationship useful and specific. A published guide may retain a reference to an existing archived record so an urgent one-field withdrawal can deploy; runtime filtering simply omits that relationship from the public page. Draft and review targets remain invalid, and missing, duplicate, or self-references still fail content QA.

## Use truthful dates

- `datePublished` records the real first public publication date. Do not predate it or use it on unfinished work.
- Omit `dateModified` at initial publication. Add it only on a later real calendar date after a substantive public change.
- `lastReviewed` advances only after a real review.
- `dateArchived` records the real archive action and cannot precede publication, modification, or review.
- Source `accessed` records when that source was genuinely checked; do not copy a convenient date across records.

No date may be impossible, earlier than the confirmed launch where prohibited, later than the current publication date, or advanced merely to make content look fresh.

## Manage hero and body images

Managed source media belongs under repository-tracked, non-deployed source path `src/content-assets/articles`. Those committed bytes are publicly visible in Git. The build validates and publishes only referenced approved files to public URLs under `/images/articles/`; there is no editable managed-media source collection inside `public/`.

Use lowercase raster filenames prefixed by the article slug, for example a slug followed by a descriptive suffix and `.webp`, `.png`, `.jpg`, or `.jpeg`. Keep the source file within the validated size and dimension limits. Do not use symlinks, hidden files, traversal, duplicate bytes, executable formats, SVG uploads, or unreferenced media.

Before a Pages CMS upload, inspect and strip EXIF metadata including GPS or other location data, device details, author fields, XMP, IPTC, and embedded comments. The uploaded raw bytes are committed to the public repository before CI runs. Image QA blocks detected metadata before deployment, but it cannot erase sensitive metadata from Git history after a commit.

Hero and body image filenames must be slug-prefixed. Hero image records must stay factual and complete:

- Informative media needs meaningful alt text that explains the information not already available nearby.
- A decorative hero uses empty alt text and an explicit decorative state.
- A caption explains context when needed; it is not a place for invented provenance.
- Credit names the real creator or source only when known and approved.
- License identifies the actual license or permission basis only when evidenced.
- Source URL points to the actual HTTPS source when applicable.
- Rights evidence must establish that the intended publication use is allowed. File validation does not prove rights.

For a hero, keep `heroImage`, `heroImageAlt`, `heroImageDecorative`, optional caption, credit, license, and source as one coherent tuple.

A body image is represented only by a Markdown image path and meaningful alt text, for example `![Decision workflow showing approval and review steps](/images/articles/example-guide-decision-flow.webp)`. Pages CMS does not provide body-image caption, credit, license, source, or rights fields. Do not imply that those fields exist: record the body image's actual provenance and publication-rights decision in the guide's `mediaRights` quality record in `docs/editorial-operations.yml`, with confidential evidence kept outside Git and only a nonsecret reference committed. If reader-facing context is needed, write accurate adjacent prose; it is not structured provenance metadata. Preview every informative image at narrow and wide widths before review.

## Review on a branch and pull request

1. Save editorial work only to the selected non-`main` branch.
2. Inspect every GitHub commit and diff. A CMS-generated commit is still a real source change.
3. Open a pull request into protected `main`.
4. Confirm the pull request was authored by the owner account, currently `danielko7188-hue`; then run the local checks below and require both `Owner-only publishing gate` and `Full quality gate`. Enforcement compares the pull-request author's immutable GitHub user ID `239253033`, not the renameable login. The owner-only check must run from the trusted base branch without checking out pull-request code or receiving token permissions.
5. Use the Vercel preview for published-content shell, responsive, accessibility, route, and integration review. Remember that draft and review articles intentionally have no public preview route.
6. Complete human source-suitability, editorial, expert-when-needed, privacy/legal, and media-rights review outside automation. Record real names and dates only after those actions occur.
7. Merge only the reviewed changes. A passing build does not supply owner acceptance or guarantee AdSense approval.

## Local checks

From a clean repository checkout with the supported Node.js version:

```text
npm ci
npm run setup:browsers
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run check:content
npm run check:editorial
npm run check:cms
npm run check:images
npm run check:cms-fixture
npm run check:seo
npm run check:links
npm run test:e2e
npm run test:visual
npm run lighthouse
```

`npm run check:cms-fixture` creates protected temporary draft, review, and archived records, builds the site, proves they do not leak, and cleans them up. It does not test a hosted Pages CMS account. Run `npm run qa` as the single release gate before a production claim.

## Publish to production

A production release is a separate, explicitly authorized live action:

1. Confirm the worktree is clean and the complete `npm run qa` gate passed for the exact candidate.
2. Record the candidate Git SHA.
3. Push GitHub `main` first and verify the remote `main` SHA matches locally.
4. Deploy that pushed source to Vercel production second.
5. Verify the canonical alias, exact deployed SHA where metadata exposes it, expected routes and assets, security headers, metadata, CMS-route absence, ads-off state, and no unexpected third-party requests.
6. Record what was observed separately from owner-only and unknown gates.

Do not call a local build, a preview deployment, or an unverified alias a production release.

## Archive, delete, and recover

Normal withdrawal is **archive, not delete**. Set a truthful `dateArchived`, preserve the complete Markdown record and Git history, and confirm the old public route receives the ordinary 404 unless a separately reviewed equivalent replacement justifies a redirect.

Do not delay an urgent archive or withdrawal merely to preserve a public guide count or category count. Current routes, feeds, sitemaps, related links, and social images follow `status: published`; the retained archived record preserves launch history without remaining public.

If an archived guide occupied a homepage curation slot, the homepage keeps the still-published configured guides in their sections and fills the open slot deterministically from the remaining published inventory without duplicate links. Counts and singular/plural labels follow the remaining published inventory. The featured Toolkit module selects the first Toolkit resource whose mapped guide remains published and disappears if none remain. Toolkit worksheets and detail pages stay public, but their contextual guide action is omitted whenever its mapped guide is not published; no surface links to an archived guide.

Permanent deletion is allowed only through a reviewed Git operation with a documented reason, rights or privacy basis where relevant, reference cleanup, full QA, and owner acceptance. Do not use the CMS delete action as an unreviewed shortcut.

For rollback, prefer `git revert` of the reviewed change, then rerun full QA, push the revert through GitHub, deploy the reverted source, and verify production. Do not rewrite shared history. Content recovery uses Git history; deployment recovery still requires a verified production release. Never modify, save, or publish the separate Blogger theme as part of this workflow.

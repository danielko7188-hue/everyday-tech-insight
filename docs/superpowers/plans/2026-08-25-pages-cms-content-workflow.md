# Pages CMS and Content Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an external Pages CMS editing layer and a lifecycle-safe Git/Markdown publishing workflow that lets incomplete drafts exist without leaking into the public publication or breaking Astro.

**Architecture:** Pages CMS edits `src/content/articles/*.md` and flat, slug-prefixed media under `public/images/articles/`. Astro remains static and validates every matched file with a status-aware Zod schema; repository QA enforces rules the CMS cannot express. Public consumers continue to select only `published` entries.

**Tech Stack:** Astro 7, TypeScript 6, Zod 4, Pages CMS YAML, Vitest, Node.js ESM, Sharp, Markdown/YAML frontmatter.

---

## File responsibility map

- `.pages.yml`: external editor configuration only; no credentials or public route.
- `src/utils/content-contract.ts`: authoritative lifecycle and metadata validation.
- `src/content.config.ts`: Astro collection loader using the authoritative schema.
- `scripts/qa-content.mjs`: cross-entry publication, relationship, body-safety, and content rules.
- `scripts/qa-images.mjs`: media root, filename, file, dimensions, byte-size, and path validation.
- `scripts/qa-cms.mjs`: `.pages.yml` syntax, field parity, operations, and fixture serialization contract.
- `scripts/new-article.mjs`: deterministic draft generator with no false dates.
- `src/content/article-template.md.example`: human-readable draft example.
- `src/data/authors.ts`: dormant verified-author data shape; renders no unapproved person.
- `docs/PUBLISHING_GUIDE.md`: nondeveloper operating guide and external owner steps.
- `docs/OWNER_INPUTS_REQUIRED.md`: private/owner-dependent facts that must not become placeholders.
- `docs/CONTENT_QUALITY_REVIEW_QUEUE.md`: evidence-bounded review of all 15 launch guides.
- `tests/unit/content-contract.test.ts`: lifecycle and field-level behavior.
- `tests/unit/content-portfolio.test.ts`: published portfolio and cross-entry contracts.
- `tests/unit/cms-config.test.ts`: Pages CMS/code parity and fixture behavior.
- `tests/unit/image-qa.test.ts`: media validator behavior.
- `tests/fixtures/content/`: isolated CMS-shaped lifecycle fixtures.
- `package.json`: focused scripts integrated into `npm run qa`.

### Task 1: Make the article schema lifecycle-aware

**Files:**

- Modify: `src/utils/content-contract.ts`
- Modify: `tests/unit/content-contract.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Add tests that require `ARTICLE_STATUSES` to equal `draft`, `review`, `published`, `archived`; accept a minimum draft with `title`, `slug`, `author`, and `status`; reject an incomplete published entry; require `dateArchived` only for archived entries; and reject future or incorrectly ordered dates. Body safety is tested in the Markdown/portfolio layer because Astro’s frontmatter schema receives metadata rather than the body.

```ts
const validDraft = {
  title: "Draft automation guide",
  slug: "draft-automation-guide",
  author: "Everyday Tech Insight",
  status: "draft",
};

expect(articleFrontmatterSchema.safeParse(validDraft).success).toBe(true);
expect(
  articleFrontmatterSchema.safeParse({
    ...validPublishedArticle,
    guidePromise: undefined,
  }).success,
).toBe(false);
expect(
  articleFrontmatterSchema.safeParse({
    ...validPublishedArticle,
    status: "archived",
    dateArchived: "2026-08-25",
  }).success,
).toBe(true);
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- --run tests/unit/content-contract.test.ts`  
Expected: FAIL because `archived` and the three explanation fields are not defined and a minimum draft is rejected.

- [ ] **Step 3: Implement shared, draft, review, published, and archived contracts**

Add these exact fields:

```ts
export const ARTICLE_STATUSES = ["draft", "review", "published", "archived"] as const;

guidePromise: requiredText(90, 180),
deliverable: requiredText(20, 150),
whenToUse: requiredText(40, 180),
dateArchived: publicationEraDateSchema.optional(),
heroImageCaption: requiredText(5, 300).optional(),
heroImageCredit: requiredText(2, 160).optional(),
heroImageSourceUrl: httpsUrlSchema.optional(),
heroImageLicense: requiredText(2, 160).optional(),
heroImageDecorative: z.boolean().optional(),
```

Normalize Pages CMS empty date and optional text strings to `undefined` with `z.preprocess`. Use a common strict object with optional publication-only fields and one `superRefine` that applies the exact lifecycle requirements. Draft entries default to unverified, not featured, no related guides, and `noindex: true`; they may omit category, content type, and summary so the title-only generator produces a build-safe draft. Published entries require the existing complete fit, 2+ HTTPS sources, guide fields, dates, visual, source-checked/tested state, and `noindex: false`. Archived entries require `dateArchived >= datePublished`, and draft/review entries cannot use a false `datePublished` default.

Add an authoritative `EDITORIAL_VISUAL_PAIRS` map and reject a valid key paired with the wrong type. Couple hero image, decorative state, and alt text: informative images require meaningful alt; decorative images require `heroImageAlt: ""`; hero-only metadata is rejected when no hero exists.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/unit/content-contract.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add src/utils/content-contract.ts tests/unit/content-contract.test.ts
git commit -m "feat(content): add lifecycle-aware article contracts"
```

### Task 2: Add the Pages CMS configuration and parity contract

**Files:**

- Create: `.pages.yml`
- Create: `scripts/qa-cms.mjs`
- Create: `tests/unit/cms-config.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing CMS configuration tests**

Parse `.pages.yml` with `js-yaml` and assert:

```ts
expect(config.content[0].path).toBe("src/content/articles");
expect(config.content[0].operations).toEqual({
  create: true,
  rename: false,
  delete: false,
});
expect(config.content[0].filename.template).toBe("{fields.slug}.md");
expect(config.settings.content.merge).toBe(true);
expect(config.settings.commit.identity).toBe("app");
expect(field("author").readonly).toBe(true);
expect(field("body").type).toBe("rich-text");
expect(field("status").options.values.map(({ name }) => name)).toEqual(
  ARTICLE_STATUSES,
);
```

Also compare category, content-type, verification, visual-type, and visual-key option values to their TypeScript constants.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --run tests/unit/cms-config.test.ts`  
Expected: FAIL because `.pages.yml` and the QA module do not exist.

- [ ] **Step 3: Create `.pages.yml`**

Use one media root:

```yaml
media:
  - name: article_images
    label: Article images
    input: public/images/articles
    output: /images/articles
    extensions: [webp, png, jpg, jpeg]
    categories: [image]
    rename: safe
```

Create the `articles` YAML-frontmatter collection with `subfolders: false`, the exact seven list columns, six search fields, five sort fields, default descending publication-date sort, slug filename template, create enabled, rename/delete disabled, and every schema field plus special `body`. Every date uses `default: ""` and `yyyy-MM-dd`. Related references store `{fields.slug}` and allow at most four. Rich text uses Markdown and the article media root. Author is defaulted to the publication byline and read-only.

- [ ] **Step 4: Implement `scripts/qa-cms.mjs`**

Export a pure `validateCmsConfig(config)` function plus CLI. Reject missing fields, option drift, enabled rename/delete, false date defaults, external media output, SVG/HTML extensions, missing merge mode, or non-app identity. The CLI prints `CMS QA PASS` only when the contract passes.

- [ ] **Step 5: Add scripts and run tests**

Add:

```json
"check:cms": "node scripts/qa-cms.mjs"
```

Run: `npm test -- --run tests/unit/cms-config.test.ts && npm run check:cms`  
Expected: all tests PASS and `CMS QA PASS`.

- [ ] **Step 6: Commit**

```text
git add .pages.yml scripts/qa-cms.mjs tests/unit/cms-config.test.ts package.json
git commit -m "feat(cms): configure Pages CMS editing"
```

### Task 3: Make portfolio and content QA status-aware

**Files:**

- Modify: `scripts/qa-content.mjs`
- Modify: `tests/unit/content-portfolio.test.ts`
- Modify: `tests/unit/qa-rules.test.ts`
- Create: `tests/fixtures/content/draft/minimum-draft.md`
- Create: `tests/fixtures/content/review/review-guide.md`
- Create: `tests/fixtures/content/archived/archived-guide.md`

- [ ] **Step 1: Write failing tests**

Require portfolio/category minimums, unique published visuals, sources, and relationships to count only `published` files. Require cross-entry relations from a published article to resolve only to another published slug. Require draft/review/archived fixtures to pass structural QA but be excluded from publication counts.

- [ ] **Step 2: Confirm the current failure**

Run: `npm test -- --run tests/unit/content-portfolio.test.ts tests/unit/qa-rules.test.ts`  
Expected: FAIL because current helpers assume every article file is published and content QA rejects nonpublished statuses.

- [ ] **Step 3: Parse frontmatter structurally and filter by status**

Replace regex-only status assumptions with a shared YAML parse in the tests and content QA. Preserve the exact 15-launch-guide assertions by keying them to the known published launch slugs, while allowing additional nonpublished files. Add body safety rejection for `<script>`, event-handler attributes, `javascript:`, `data:text/html`, iframe/object/embed, and remote image Markdown.

- [ ] **Step 4: Verify fixtures and public portfolio**

Run: `npm run check:content && npm test -- --run tests/unit/content-portfolio.test.ts tests/unit/qa-rules.test.ts`  
Expected: PASS; published count 15, category count 3 each, nonpublished fixtures excluded.

- [ ] **Step 5: Commit**

```text
git add scripts/qa-content.mjs tests/unit/content-portfolio.test.ts tests/unit/qa-rules.test.ts tests/fixtures/content
git commit -m "test(content): protect unpublished lifecycle states"
```

### Task 4: Add guide explanation metadata to all 15 published guides

**Files:**

- Modify: `src/content/articles/*.md` (all 15 launch guides)
- Modify: `tests/unit/content-portfolio.test.ts`

- [ ] **Step 1: Add failing portfolio assertions**

For every published article, assert 90–180 `guidePromise`, 20–150 `deliverable`, 40–180 `whenToUse`, uniqueness across the portfolio, and no generic `ultimate guide` wording. Assert each value contains key terms supported by its body or existing summary.

- [ ] **Step 2: Confirm failure**

Run: `npm test -- --run tests/unit/content-portfolio.test.ts`  
Expected: FAIL because the 15 files do not contain the fields.

- [ ] **Step 3: Add the exact body-supported values from the approved brief**

Add the 15 supplied guide promises, deliverables, and when-to-use statements without altering factual dates or claiming human/firsthand review. Preserve existing summaries and body content unless a phrase conflict requires a truthful correction.

- [ ] **Step 4: Verify content**

Run: `npm test -- --run tests/unit/content-contract.test.ts tests/unit/content-portfolio.test.ts && npm run check:content`  
Expected: PASS for all 15 published guides.

- [ ] **Step 5: Commit**

```text
git add src/content/articles tests/unit/content-portfolio.test.ts
git commit -m "feat(editorial): explain every guide outcome"
```

### Task 5: Add media QA and an empty managed media root

**Files:**

- Create: `public/images/articles/.gitkeep`
- Create: `scripts/qa-images.mjs`
- Create: `tests/unit/image-qa.test.ts`
- Create: `tests/fixtures/images/valid-guide-hero.png`
- Modify: `package.json`

- [ ] **Step 1: Write failing image-policy tests**

Test valid local PNG/WebP; missing file; traversal; remote URL; HTML/SVG/executable extension; missing slug prefix; duplicate basename; zero/oversized dimensions; file above the configured byte budget; informative missing alt; decorative nonempty alt.

- [ ] **Step 2: Confirm failure**

Run: `npm test -- --run tests/unit/image-qa.test.ts`  
Expected: FAIL because the validator is absent.

- [ ] **Step 3: Implement `qa-images.mjs`**

Use `sharp().metadata()` for raster dimensions. Restrict paths to `/images/articles/<article-slug>-<purpose>.(webp|png|jpg|jpeg)`, resolve with `path.relative` to prevent traversal, require file existence, reject duplicate case-folded filenames, cap width/height at 3200px and bytes at 1.5MB, and validate alt/decorative coupling from parsed frontmatter.

- [ ] **Step 4: Integrate the focused command**

Add:

```json
"check:images": "node scripts/qa-images.mjs"
```

Run: `npm test -- --run tests/unit/image-qa.test.ts && npm run check:images`  
Expected: PASS and `IMAGE QA PASS`.

- [ ] **Step 5: Commit**

```text
git add public/images/articles scripts/qa-images.mjs tests/unit/image-qa.test.ts tests/fixtures/images package.json
git commit -m "feat(media): validate article image safety"
```

### Task 6: Add the draft generator and article template

**Files:**

- Create: `scripts/new-article.mjs`
- Create: `src/content/article-template.md.example`
- Create: `tests/unit/new-article.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing generator tests**

Use a temporary directory to assert title-to-slug conversion, explicit `status: draft`, publication-name author, no publication/review dates, no source or experience claim, safe refusal to overwrite, and rejection of an empty/unsafe title.

- [ ] **Step 2: Confirm failure**

Run: `npm test -- --run tests/unit/new-article.test.ts`  
Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement a deterministic generator**

Support:

```text
npm run new:article -- --title "Article title" --category ai-automation --type guide
```

Generate YAML frontmatter with only draft-safe fields and a Markdown H2 starter structure. Never initialize `datePublished`, `dateModified`, `lastReviewed`, `dateArchived`, verification claims, sources, or hero credits.

- [ ] **Step 4: Add and run the command contract**

Add:

```json
"new:article": "node scripts/new-article.mjs"
```

Run: `npm test -- --run tests/unit/new-article.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add scripts/new-article.mjs src/content/article-template.md.example tests/unit/new-article.test.ts package.json
git commit -m "feat(content): generate safe article drafts"
```

### Task 7: Add author architecture and owner/content-review records

**Files:**

- Create: `src/data/authors.ts`
- Create: `tests/unit/authors.test.ts`
- Create: `docs/OWNER_INPUTS_REQUIRED.md`
- Create: `docs/CONTENT_QUALITY_REVIEW_QUEUE.md`

- [ ] **Step 1: Write the author-boundary test**

Assert the module exports the exact `VerifiedAuthor` contract, a typed empty approved-author list, a resolver that returns `undefined` for every current ID, and the publication byline separately, with no Person/Organization claims or placeholder values. Add invalid-record tests for nonperson kind, unsafe profile/photo paths, missing photo rights fields, non-HTTPS credential evidence, invalid same-as URLs, and a non-date owner verification value.

- [ ] **Step 2: Implement the dormant type**

```ts
export interface VerifiedAuthorRecord {
  id: string;
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
  ownerVerifiedAt: string;
}

export const verifiedAuthors: Readonly<Record<string, VerifiedAuthorRecord>> =
  {};

export function getVerifiedAuthor(id: string): VerifiedAuthorRecord | undefined;
```

- [ ] **Step 3: Record exact owner inputs**

Create the 18-item owner-input inventory from the design spec. State that it is not public content and that no missing value should be committed as a public placeholder.

- [ ] **Step 4: Complete the 15-row content-quality queue**

For every launch guide, record every exact design-spec field: slug, title, category, publication status, word count, reader, business need, promise, deliverable, when-to-use, source URLs/suitability/last-checked state, original method/visual/Toolkit contribution, claim and repetition risks, evidence limits, media rights, automation review, human editorial review, expert-review need, recommendation, owner action, reviewer/date, and release gate. Give an evidence-bounded keep/revise/archive recommendation without inventing human, rights, firsthand, product-testing, or expert-review completion.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run tests/unit/authors.test.ts && npm run format:check`  
Expected: PASS.

```text
git add src/data/authors.ts tests/unit/authors.test.ts docs/OWNER_INPUTS_REQUIRED.md docs/CONTENT_QUALITY_REVIEW_QUEUE.md
git commit -m "docs(editorial): record identity and review gates"
```

### Task 8: Write the publishing guide and integrate full QA

**Files:**

- Create: `docs/PUBLISHING_GUIDE.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `tests/unit/qa-rules.test.ts`

- [ ] **Step 1: Write documentation-contract tests**

Require the guide to cover sign-in, repository selection, create, draft, review, publish, archive, permanent deletion, hero and body images, alt/caption/credit, sources, related guides, truthful dates, Vercel previews, GitHub commits, rollback, and local validation. Require an explicit statement that GitHub App installation and hosted CMS validation are owner actions.

- [ ] **Step 2: Confirm failure**

Run: `npm test -- --run tests/unit/qa-rules.test.ts`  
Expected: FAIL because the guide is absent.

- [ ] **Step 3: Write the plain-language guide and README routing**

Describe Pages CMS status as `configured and locally tested`, not externally authorized. Explain archive-not-delete, slug immutability, flat slug-prefixed media, safe source mode, preview-first publication, and Git revert/recovery without claiming a native CMS approval engine.

- [ ] **Step 4: Integrate focused checks into `qa`**

Place `check:cms` and `check:images` after the production build/content check and before E2E:

```json
"qa": "npm run format:check && npm run lint && npm run typecheck && npm run test -- --run && npm run build && npm run check:content && npm run check:cms && npm run check:images && npm run check:cms-fixture && npm run check:seo && npm run check:links && npm run test:e2e && npm run lighthouse"
```

- [ ] **Step 5: Verify and commit**

Run: `npm run format:check && npm test -- --run tests/unit/qa-rules.test.ts && npm run check:cms && npm run check:images`  
Expected: PASS.

```text
git add docs/PUBLISHING_GUIDE.md README.md package.json tests/unit/qa-rules.test.ts
git commit -m "docs(cms): document the publishing workflow"
```

### Task 9: Prove CMS-shaped nonpublished content does not leak or break the build

**Files:**

- Modify: `tests/unit/cms-config.test.ts`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `scripts/qa-build.mjs`
- Create: `scripts/check-cms-fixture.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add parameterized temporary-fixture integration tests**

Exercise a reusable fixture runner once each with a minimum draft, structurally complete review entry, and complete archived entry. For each case it writes a collision-protected direct-child fixture, runs Astro sync/typecheck/build in a guarded `try/finally`, asserts success, and always removes the fixture. Built article routes, homepage, archive, category pages, publisher page, HTML/XML sitemaps, RSS, related-guide output, and social inventory must not contain the fixture’s title or slug. Tests also inject a failure and assert cleanup plus preservation of any pre-existing file bytes.

- [ ] **Step 2: Run and confirm failure before final exclusions**

Run: `npm test -- --run tests/unit/cms-config.test.ts`  
Expected: FAIL until every loader/generator and QA surface is status-aware.

- [ ] **Step 3: Fix each public consumer rather than weakening the test**

Audit article routes, homepage, categories, archive, publisher page, HTML/XML sitemap, RSS, related guides, social generation, and built-output QA. Keep exact `status === "published"` filters at the earliest data-selection point.

Expose the reusable parameterized integration as `npm run check:cms-fixture`. The command runs all three lifecycle cases and is added to `npm run qa` after the normal build/content checks and before E2E.

- [ ] **Step 4: Run the integration and focused public tests**

Run: `npm test -- --run tests/unit/cms-config.test.ts && npm run check:cms-fixture && npm run build && npm run check:seo && npm run check:content`  
Expected: PASS with 15 published guide routes and zero draft/review/archived output.

- [ ] **Step 5: Commit**

```text
git add tests/unit/cms-config.test.ts tests/e2e/public-routes.spec.ts scripts/qa-build.mjs scripts/check-cms-fixture.mjs package.json src
git commit -m "test(cms): prove lifecycle-safe static builds"
```

## Plan self-review

- Spec coverage: CMS configuration, status workflow, archive-not-delete, all requested fields, images, template/generator, author boundary, owner inputs, review queue, public exclusion, documentation, and owner authorization boundary are mapped to tasks.
- Placeholder scan: no `TBD`, `TODO`, deferred implementation step, or unscoped error-handling instruction remains.
- Type consistency: `guidePromise`, `deliverable`, `whenToUse`, hero metadata, `dateArchived`, and the four lifecycle values use the same names across schema, CMS, fixtures, tests, and docs.

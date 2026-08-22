# Editorial Balance V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current exhaustive catalog into a balanced issue front page, bring category and article content above the fold, and preserve every factual, accessibility, privacy, SEO, and static-rendering boundary.

**Architecture:** Keep Astro static generation and the existing content collection. Add one pure homepage allocator for globally unique placements, simplify the rendered story system to lead/support/index treatments, and make interior-page density changes at existing component boundaries. Use native HTML disclosures and a build-time rehype table wrapper; add no client JavaScript.

**Tech Stack:** Astro 7, TypeScript 6, Vitest, Playwright, axe-core, CSS, Vercel.

---

## File map

- `src/data/editorial.ts`: validates curated slugs and allocates each published article to one homepage group.
- `src/pages/index.astro`: renders the issue-front-page composition and compact topic directory.
- `src/components/ArticleCard.astro`: renders lead, supporting, and compact-index story treatments with an explicit visual override.
- `src/components/TrustModule.astro`: renders the early publication-evidence ribbon.
- `src/pages/categories/[slug].astro`: combines category orientation and lead guide while using one category visual.
- `src/layouts/ArticleLayout.astro`: renders the compact article header, factual evidence strip, and faster reading start.
- `src/components/ArticleEvidence.astro`: presents source count, review date, standards, and corrections without entity claims.
- `src/components/FitSummary.astro`: uses a desktop fit grid and a native mobile disclosure.
- `src/components/Breadcrumbs.astro`: supports visually compact current-page crumbs without changing JSON-LD.
- `src/components/Header.astro`, `src/components/Footer.astro`, `src/styles/global.css`: responsive chrome, layout, typography, and page rhythm.
- `src/utils/rehype-wrap-tables.mjs`, `astro.config.mjs`: add focusable, labelled horizontal table regions at build time.
- `tests/unit/editorial.test.ts`: allocator contracts.
- `tests/e2e/public-routes.spec.ts`, `tests/e2e/responsive.spec.ts`, `tests/e2e/accessibility.spec.ts`: rendered hierarchy, geometry, semantics, and accessibility.

### Task 1: Allocate one unique homepage placement per article

**Files:**
- Modify: `src/data/editorial.ts`
- Modify: `tests/unit/editorial.test.ts`

- [ ] **Step 1: Write failing allocator tests**

Add tests that flatten every allocated section and prove stable order, global uniqueness, fallback filling, and complete remainder coverage:

```ts
import {
  allocateHomepageEdition,
  homepageCuration,
  type HomepageCurationConfig,
} from "../../src/data/editorial";

it("allocates every published article at most once", () => {
  const extras = Array.from({ length: 6 }, (_, index) => ({
    data: { slug: `extra-${index + 1}`, status: "published" as const },
  }));
  const edition = allocateHomepageEdition([
    ...publishedArticles,
    ...extras,
  ]);
  const assigned = [
    ...edition.lead,
    ...edition.features,
    ...edition.briefing,
    ...edition.startHere,
    ...edition.moreGuides,
  ].map((article) => article.data.slug);

  expect(assigned).toHaveLength(15);
  expect(new Set(assigned).size).toBe(assigned.length);
});

it("fills a short configured section without reusing a slug", () => {
  const curation = {
    ...homepageCuration,
    features: [],
  } satisfies HomepageCurationConfig;
  const extras = Array.from({ length: 8 }, (_, index) => ({
    data: { slug: `fallback-${index + 1}`, status: "published" as const },
  }));
  const edition = allocateHomepageEdition(
    [...publishedArticles, ...extras],
    curation,
  );

  expect(edition.features).toHaveLength(2);
  expect(edition.features[0]!.data.slug).toBe(homepageCuration.features[0]);
});
```

- [ ] **Step 2: Run the unit test and confirm RED**

Run: `npm test -- --run tests/unit/editorial.test.ts`

Expected: FAIL because `allocateHomepageEdition` is not exported.

- [ ] **Step 3: Implement the allocator**

Add the following after `resolveHomepageCuration`:

```ts
export const homepageSectionSizes = {
  lead: 1,
  features: 2,
  briefing: 3,
  startHere: 3,
} as const satisfies Record<HomepageCurationSection, number>;

export interface HomepageEdition<T> {
  lead: T[];
  features: T[];
  briefing: T[];
  startHere: T[];
  moreGuides: T[];
}

export function allocateHomepageEdition<T extends CuratableArticle>(
  articles: readonly T[],
  curation: HomepageCurationConfig = homepageCuration,
): HomepageEdition<T> {
  const configured = resolveHomepageCuration(articles, curation);
  const published = articles.filter(
    (article) => article.data.status === "published",
  );
  const assigned = new Set<string>();
  const edition: HomepageEdition<T> = {
    lead: [],
    features: [],
    briefing: [],
    startHere: [],
    moreGuides: [],
  };

  for (const section of homepageCurationSections) {
    const target = edition[section];
    for (const article of configured[section]) {
      if (!assigned.has(article.data.slug)) {
        target.push(article);
        assigned.add(article.data.slug);
      }
    }
    for (const article of published) {
      if (target.length >= homepageSectionSizes[section]) break;
      if (!assigned.has(article.data.slug)) {
        target.push(article);
        assigned.add(article.data.slug);
      }
    }
  }

  edition.moreGuides = published.filter(
    (article) => !assigned.has(article.data.slug),
  );
  return edition;
}
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `npm test -- --run tests/unit/editorial.test.ts`

Expected: all editorial unit tests pass.

- [ ] **Step 5: Commit**

```text
git add src/data/editorial.ts tests/unit/editorial.test.ts
git commit -m "feat: allocate a unique homepage edition"
```

### Task 2: Recompose the homepage as an issue front page

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/components/ArticleCard.astro`
- Modify: `src/components/TrustModule.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: Replace the old homepage expectations with failing V2 contracts**

In `public-routes.spec.ts`, assert exactly fifteen homepage article-link occurrences and destinations, five compact topic rows with no article links, and early trust routes:

```ts
test("home is a de-duplicated issue front page", async ({ page }) => {
  await page.goto("/");
  const articleLinks = page.locator('main a[href^="/articles/"]');
  const hrefs = await articleLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );

  expect(hrefs).toHaveLength(15);
  expect(new Set(hrefs).size).toBe(15);
  await expect(page.locator(".front-page__lead .article-card--lead")).toHaveCount(1);
  await expect(page.locator(".front-page__support .article-card--feature")).toHaveCount(2);
  await expect(page.locator(".topic-directory--compact li")).toHaveCount(5);
  await expect(
    page.locator('.topic-directory--compact a[href^="/articles/"]'),
  ).toHaveCount(0);
  await expect(page.locator(".publication-evidence")).toContainText(
    /source-led|corrections/i,
  );
});
```

In `responsive.spec.ts`, add a geometry test at 390×844 and 1440×900:

```ts
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`homepage lead headline is visible at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const box = await page.locator(".front-page__lead .article-card__title").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.locator("main").evaluate((main) => main.scrollHeight)).toBeLessThan(
      viewport.width === 390 ? 11_000 : 7_000,
    );
  });
}
```

- [ ] **Step 2: Run the focused browser tests and confirm RED**

Run: `npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts --grep "issue front page|lead headline"`

Expected: FAIL because the old shelves still duplicate every article and the new selectors do not exist.

- [ ] **Step 3: Update the article-card visual contract**

Add `showVisual?: boolean`, defaulting to art for `lead` and `standard` only. Supporting `feature` cards become typography-led:

```ts
interface Props {
  article: CollectionEntry<"articles">;
  variant?: ArticleCardVariant;
  headingLevel?: 2 | 3;
  showSummary?: boolean;
  showVisual?: boolean;
}

const {
  article,
  variant = "standard",
  headingLevel = 2,
  showSummary: showSummaryOverride,
  showVisual: showVisualOverride,
} = Astro.props;
const showVisual =
  showVisualOverride ?? (variant === "lead" || variant === "standard");
```

- [ ] **Step 4: Replace homepage selection and markup**

Use `allocateHomepageEdition(publishedArticles)` and render this order:

```astro
<header class="home-opening">
  <div class="home-opening__promise">
    <p class="eyebrow">Independent practical guidance</p>
    <h1>Practical business technology, explained clearly</h1>
    <p class="lead-summary">
      Source-backed guidance for small-business technology decisions, without product hype.
    </p>
  </div>
  <section class="front-page" aria-labelledby="front-page-heading">
    <h2 id="front-page-heading" class="visually-hidden">Current issue</h2>
    <div class="front-page__lead">
      {leadArticle && <ArticleCard article={leadArticle} variant="lead" headingLevel={3} />}
    </div>
    <div class="front-page__support">
      {featureArticles.map((article) => (
        <ArticleCard article={article} variant="feature" headingLevel={3} />
      ))}
    </div>
  </section>
</header>

<TrustModule />

<section class="home-section latest-briefing" aria-labelledby="latest-briefing-heading">
  <SectionHeading eyebrow="Latest" title="Latest briefing" id="latest-briefing-heading" />
  <ol class="latest-briefing__list">
    {briefingArticles.map((article) => (
      <li><ArticleCard article={article} variant="list" headingLevel={3} showSummary /></li>
    ))}
  </ol>
</section>

<section class="home-section start-here" aria-labelledby="start-here-heading">
  <SectionHeading eyebrow="Practical foundations" title="Start here" id="start-here-heading" />
  <ol class="start-here__list">
    {startHereArticles.map((article) => (
      <li><ArticleCard article={article} variant="list" headingLevel={3} showSummary /></li>
    ))}
  </ol>
</section>

<section class="home-section topic-directory topic-directory--compact" aria-labelledby="topics-heading">
  <SectionHeading eyebrow="Five decision areas" title="Browse by topic" id="topics-heading" />
  <ol>
    {categories.map((category) => (
      <li style={`--category-accent: ${category.accent};`}>
        <a href={`/categories/${category.slug}/`}>
          <span>{category.name}</span>
          <span>{topicCounts.get(category.slug)} guides</span>
        </a>
        <p>{category.description}</p>
      </li>
    ))}
  </ol>
</section>

<section class="home-section more-guides" aria-labelledby="more-guides-heading">
  <SectionHeading eyebrow="Complete issue" title="More guides" id="more-guides-heading" />
  <ol>
    {moreGuides.map((article) => (
      <li><ArticleCard article={article} variant="list" headingLevel={3} /></li>
    ))}
  </ol>
</section>
```

Remove both inert `AdSlot` placements, `topicArticles`, five oversized topic shelves, and the redundant latest-articles module.

- [ ] **Step 5: Condense the trust module and homepage CSS**

Keep the existing truthful links while changing `.trust-module` into an early `.publication-evidence` ribbon with four short items: source-led guidance, corrections, commercial status, and publication-byline boundary. Replace obsolete topic-shelf CSS with 12-column opening composition and compact topic rows. Preserve all focus/visited-link states.

Use this layout basis and retain the existing tokens:

```css
.home-opening {
  padding-block: var(--space-5) var(--space-8);
  border-block-end: 1px solid var(--color-rule);
}

.home-opening__promise {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-2);
  margin-block-end: var(--space-6);
}

.home-opening__promise h1 {
  max-inline-size: 18ch;
  font-size: clamp(2.5rem, 2rem + 2vw, 4.5rem);
}

.front-page,
.front-page__support,
.topic-directory--compact ol,
.more-guides ol,
.start-here__list {
  display: grid;
  gap: var(--space-6);
}

.publication-evidence {
  padding-block: var(--space-6);
  border-block: 1px solid var(--color-rule);
}

.topic-directory--compact li {
  padding-block: var(--space-5);
  border-block-start: var(--space-1) solid var(--category-accent);
}

.topic-directory--compact li > a {
  display: flex;
  min-block-size: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 650;
}

@media (min-width: 67.5rem) {
  .front-page {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    align-items: start;
  }

  .front-page__lead {
    grid-column: span 8;
  }

  .front-page__support {
    grid-column: span 4;
  }

  .topic-directory--compact ol {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
```

- [ ] **Step 6: Run focused tests and inspect screenshots**

Run:

```text
npm run format
npm test -- --run tests/unit/editorial.test.ts
npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts --grep "home|homepage"
```

Expected: all focused tests pass; homepage height is below both caps and each article destination appears once.

- [ ] **Step 7: Commit**

```text
git add src/pages/index.astro src/components/ArticleCard.astro src/components/TrustModule.astro src/styles/global.css tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts
git commit -m "feat: rebalance the editorial front page"
```

### Task 3: Put category guidance in the opening viewport

**Files:**
- Modify: `src/pages/categories/[slug].astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: Write failing single-art and geometry tests**

```ts
test("category uses one visual anchor and three distinct guide links", async ({ page }) => {
  await page.goto("/categories/ai-automation/");
  await expect(page.locator("main [data-editorial-visual]")).toHaveCount(1);
  const hrefs = await page
    .locator('main a[href^="/articles/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toHaveLength(3);
  expect(new Set(hrefs).size).toBe(3);
});

test("category lead begins in the opening viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/categories/ai-automation/");
  const box = await page.locator(".category-hero__lead .article-card__title").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(820);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts --grep "category uses|category lead"`

Expected: FAIL with four visuals and no `.category-hero__lead`.

- [ ] **Step 3: Move the lead guide into the category hero**

Render copy, a typography-led lead card, and one page-level visual in logical source order:

```astro
<header class="category-hero" data-category={category.slug} style={`--category-accent: ${category.accent};`}>
  <div class="category-hero__copy">
    <p class="eyebrow">Business technology topic</p>
    <h1>{category.name}</h1>
    <p class="page-deck">{category.description}</p>
    <p>{categoryPurposes[category.slug]}</p>
  </div>
  <div class="category-hero__lead">
    {leadArticle && (
      <ArticleCard article={leadArticle} variant="lead" headingLevel={2} showVisual={false} />
    )}
  </div>
  <div class="category-hero__visual" data-editorial-visual>
    <EditorialVisual category={category.slug} slug={`${category.slug}-category`} ratio="wide" />
  </div>
</header>
```

Render the two remaining guides as ordered `feature` cards with `showVisual={false}`. Preserve the empty and `remainingArticles` branches for future growth.

- [ ] **Step 4: Tighten category CSS**

At mobile, order copy → lead → visual and keep the lead headline above 820px. At 48rem+, use six columns; at 67.5rem+, place copy in columns 1–5, visual in 6–12, and lead across a compact second row. Remove old category lead-art assumptions.

```css
.category-hero__lead {
  min-inline-size: 0;
  padding-block: var(--space-5);
  border-block: 1px solid var(--color-rule);
}

.category-hero__visual {
  order: 3;
}

@media (min-width: 48rem) {
  .category-hero {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .category-hero__copy,
  .category-hero__lead {
    grid-column: span 3;
  }

  .category-hero__visual {
    grid-column: 1 / -1;
  }
}

@media (min-width: 67.5rem) {
  .category-hero {
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }

  .category-hero__copy {
    grid-column: 1 / span 5;
  }

  .category-hero__visual {
    grid-column: 6 / -1;
    grid-row: 1;
  }

  .category-hero__lead {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 5: Run focused tests and commit**

Run: `npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts --grep "category"`

Expected: all category tests pass at every required width.

```text
git add src/pages/categories/[slug].astro src/styles/global.css tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts
git commit -m "feat: bring category guidance above the fold"
```

### Task 4: Compress the article preamble and surface evidence

**Files:**
- Create: `src/components/ArticleEvidence.astro`
- Modify: `src/components/FitSummary.astro`
- Modify: `src/components/Breadcrumbs.astro`
- Modify: `src/layouts/ArticleLayout.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Write failing article evidence and mobile-density tests**

```ts
test("article surfaces its evidence boundary near the headline", async ({ page }) => {
  await page.goto(`/articles/${articleSlug}/`);
  const evidence = page.getByRole("region", { name: "Article evidence" });
  await expect(evidence).toContainText(/3 primary sources/i);
  await expect(evidence.getByRole("link", { name: /editorial standards/i })).toHaveAttribute(
    "href",
    "/editorial-standards/",
  );
  await expect(evidence.getByRole("link", { name: /corrections/i })).toHaveAttribute(
    "href",
    "/corrections/",
  );
});

test("mobile article reaches the reading body quickly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/articles/${articleSlug}/`);
  await expect(page.locator(".article-hero__visual")).toBeHidden();
  const fit = page.locator("details.fit-summary--mobile");
  await expect(fit).not.toHaveAttribute("open", "");
  const firstParagraph = await page.locator(".article-body > p").first().boundingBox();
  expect(firstParagraph).not.toBeNull();
  expect(firstParagraph!.y).toBeLessThanOrEqual(1_477);
});
```

Add a line-count comparison using `Range#getClientRects()` at 1440 and 1920 and assert `lines1920 <= lines1440`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts --grep "evidence boundary|reaches the reading|headline wrapping"`

Expected: FAIL because evidence and mobile disclosure do not exist.

- [ ] **Step 3: Create the factual evidence component**

```astro
---
interface Props {
  sourceCount: number;
  reviewedLabel: string;
  reviewedDate: string;
}
const { sourceCount, reviewedLabel, reviewedDate } = Astro.props;
---

<aside class="article-evidence" aria-label="Article evidence">
  <p><strong>{sourceCount} primary sources</strong></p>
  <p>Reviewed <time datetime={reviewedDate}>{reviewedLabel}</time></p>
  <p><a href="/editorial-standards/">Editorial standards</a></p>
  <p><a href="/corrections/">Corrections</a></p>
</aside>
```

- [ ] **Step 4: Render desktop and mobile fit treatments**

Keep the same four `<dt>/<dd>` values in both treatments. Use `.fit-summary--desktop` as a section and `.fit-summary--mobile` as a closed native `<details>` with a 44px summary. CSS must expose only one version per breakpoint, so hidden duplicate content is absent from the accessibility tree.

```astro
---
const fields = [
  ["Business problem", businessProblem],
  ["Technology focus", technologyFocus],
  ["Intended reader", intendedAudience],
  ["Practical outcome", readerOutcome],
] as const;
---

<section class="fit-summary fit-summary--desktop" aria-labelledby="fit-heading-desktop">
  <h2 id="fit-heading-desktop">Business technology fit</h2>
  <dl>
    {fields.map(([term, value]) => <div><dt>{term}</dt><dd>{value}</dd></div>)}
  </dl>
</section>

<details class="fit-summary fit-summary--mobile">
  <summary>Business technology fit</summary>
  <dl>
    {fields.map(([term, value]) => <div><dt>{term}</dt><dd>{value}</dd></div>)}
  </dl>
</details>
```

- [ ] **Step 5: Compact breadcrumbs and article header**

Add `compactCurrent?: boolean` to `Breadcrumbs`, apply `breadcrumbs--compact-current`, and pass it from `ArticleLayout`. Insert `ArticleEvidence` after the hero. Cap the article H1 at `4.25rem`, widen wide-screen copy to eight columns, hide decorative hero art below 48rem, and reduce hero/FitSummary margins.

```astro
<Breadcrumbs
  compactCurrent
  items={[
    { name: "Home", href: "/" },
    { name: "Categories", href: "/categories/" },
    { name: category.name, href: `/categories/${category.slug}/` },
    { name: data.title, href: articlePath },
  ]}
/>

<ArticleEvidence
  sourceCount={data.sourceList.length}
  reviewedDate={data.lastReviewed}
  reviewedLabel={formatDate(data.lastReviewed)}
/>
```

```css
.fit-summary--mobile {
  display: block;
}

.fit-summary--desktop,
.article-hero__visual {
  display: none;
}

@media (max-width: 47.99rem) {
  .breadcrumbs--compact-current li:last-child,
  .breadcrumbs--compact-current li:nth-last-child(2)::after {
    display: none;
  }
}

@media (min-width: 48rem) {
  .fit-summary--mobile {
    display: none;
  }

  .fit-summary--desktop,
  .article-hero__visual {
    display: block;
  }
}

@media (min-width: 67.5rem) {
  .article-hero__copy {
    grid-column: span 8;
  }

  .article-hero__visual {
    grid-column: 9 / -1;
  }

  .article-hero h1 {
    max-inline-size: 18ch;
    font-size: clamp(2.5rem, 1.9rem + 2.2vw, 4.25rem);
  }
}
```

- [ ] **Step 6: Run article, accessibility, and responsive tests**

Run:

```text
npm run format
npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts tests/e2e/accessibility.spec.ts --grep "article|fit|breadcrumb|headline"
```

Expected: all focused tests pass; the desktop TOC remains sticky and the mobile controls remain keyboard accessible.

- [ ] **Step 7: Commit**

```text
git add src/components/ArticleEvidence.astro src/components/FitSummary.astro src/components/Breadcrumbs.astro src/layouts/ArticleLayout.astro src/styles/global.css tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts tests/e2e/accessibility.spec.ts
git commit -m "feat: create a faster article reading start"
```

### Task 5: Rebalance shared responsive chrome and tables

**Files:**
- Create: `src/utils/rehype-wrap-tables.mjs`
- Modify: `astro.config.mjs`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Write failing responsive contracts**

Assert native menu visibility at 768/899, desktop topics at 900/1024, two footer columns at 390, centered trust content, and a focusable table wrapper with computed font size at least 16px:

```ts
test("shared chrome uses balanced responsive breakpoints", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await expect(page.locator(".site-header__mobile-menu")).toBeVisible();
  await expect(page.locator(".site-header__topics")).toBeHidden();

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.locator(".site-header__mobile-menu")).toBeHidden();
  await expect(page.locator(".site-header__topics")).toBeVisible();
});

test("mobile tables remain readable and keyboard reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/articles/${articleSlug}/`);
  const region = page.locator("[data-horizontal-scroll]").first();
  await expect(region).toHaveAttribute("tabindex", "0");
  expect(await region.locator("table").evaluate((table) => parseFloat(getComputedStyle(table).fontSize))).toBeGreaterThanOrEqual(16);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx playwright test tests/e2e/responsive.spec.ts tests/e2e/accessibility.spec.ts --grep "shared chrome|mobile tables"`

Expected: FAIL at the 768px header and missing table wrapper.

- [ ] **Step 3: Add the build-time table wrapper**

Create a dependency-free rehype transformer:

```js
const walk = (node) => {
  if (!node || !Array.isArray(node.children)) return;
  node.children = node.children.map((child) => {
    if (child?.type === "element" && child.tagName === "table") {
      return {
        type: "element",
        tagName: "div",
        properties: {
          className: ["table-scroll"],
          dataHorizontalScroll: "",
          tabIndex: 0,
          role: "region",
          ariaLabel: "Scrollable comparison table",
        },
        children: [child],
      };
    }
    walk(child);
    return child;
  });
};

export default function rehypeWrapTables() {
  return (tree) => walk(tree);
}
```

Import it in `astro.config.mjs` and register it under `markdown.rehypePlugins`.

- [ ] **Step 4: Update shared responsive CSS**

- Move only header visibility/topic-rail rules from the 48rem query to `@media (min-width: 56.25rem)`.
- Let an open native mobile menu occupy a new full-width grid row with a static opaque navigation panel.
- Set base `.site-footer__groups` to two equal columns while preserving existing desktop grids.
- Center `.trust-content` with `margin-inline: auto`.
- Give prominent section/topic actions a 44px minimum block size.
- Style `.table-scroll` with `overflow-x: auto`, focus-visible outline, and `-webkit-overflow-scrolling: touch`; set its table to `min-inline-size: 40rem`, `table-layout: auto`, and `font-size: 1rem`. Remove the 13px mobile override.

Implement the shared rules as follows, while moving the existing header-only declarations intact into the 56.25rem query:

```css
.site-header__mobile-menu[open] {
  grid-column: 1 / -1;
}

.site-header__mobile-menu[open] summary {
  margin-inline-start: auto;
}

.site-header__mobile-menu nav {
  position: static;
  inline-size: 100%;
  margin-block-start: var(--space-3);
  background: var(--color-paper);
}

.site-footer__groups {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.trust-content {
  margin-inline: auto;
}

.section-heading__link {
  display: inline-flex;
  min-block-size: 2.75rem;
  align-items: center;
}

.table-scroll {
  max-inline-size: 100%;
  margin-block: var(--space-8);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table-scroll:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
}

.table-scroll table {
  min-inline-size: 40rem;
  margin-block: 0;
  table-layout: auto;
  font-size: 1rem;
}

@media (min-width: 56.25rem) {
  .site-header__mobile-menu {
    display: none;
  }

  .site-header__utility,
  .site-header__topics {
    display: block;
  }
}
```

- [ ] **Step 5: Run focused tests and commit**

Run:

```text
npm run format
npm run typecheck
npx playwright test tests/e2e/responsive.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/public-routes.spec.ts --grep "shared chrome|mobile tables|trust pages"
```

Expected: all tests pass and no viewport gains document-level horizontal overflow.

```text
git add astro.config.mjs src/utils/rehype-wrap-tables.mjs src/styles/global.css tests/e2e/public-routes.spec.ts tests/e2e/responsive.spec.ts tests/e2e/accessibility.spec.ts
git commit -m "feat: rebalance responsive publication chrome"
```

### Task 6: Verify visually, update the design baseline, and release

**Files:**
- Modify: `DESIGN.md`
- Create: `docs/EDITORIAL_BALANCE_V2_REPORT.md`

- [ ] **Step 1: Update the design-system contract**

Replace the obsolete homepage/category composition paragraphs in `DESIGN.md` with the approved Issue Front Page rules: one lead visual, unique homepage destinations, compact topic directory, category visual once, early evidence, mobile fit disclosure, tablet menu through 899px, two-column mobile footer, and readable table regions.

- [ ] **Step 2: Run the complete release gate**

Run: `npm run qa`

Expected:

- formatting and lint pass;
- Astro check reports 0 errors, warnings, and hints;
- all unit and Playwright tests pass;
- 31 static pages build;
- content, SEO, and external links pass without FAIL or UNVERIFIED;
- representative Lighthouse pages pass configured thresholds.

- [ ] **Step 3: Capture and inspect final screenshots**

Capture full-page and first-viewport images for home, AI category, sample article, and editorial standards at 390×844, 768×1024, 1440×900, and 1920×1080. Record before/after page heights, first-content positions, duplicate counts, art counts, overflow, console errors, and font failures in `docs/EDITORIAL_BALANCE_V2_REPORT.md`.

- [ ] **Step 4: Run an independent code and rendered-design review**

Require no Critical or Important code findings and no High visual findings. Fix verified findings atomically, rerun the affected tests, and update the report with evidence.

- [ ] **Step 5: Commit documentation**

```text
git add DESIGN.md docs/EDITORIAL_BALANCE_V2_REPORT.md
git commit -m "docs: record editorial balance v2 evidence"
```

- [ ] **Step 6: Merge, push GitHub first, and deploy Vercel**

```text
git switch main
git merge --ff-only feat/editorial-balance-v2
git push origin main
git ls-remote origin refs/heads/main
npx vercel@latest deploy --prod --yes
```

Confirm the GitHub remote SHA equals local `main` before the Vercel command.

- [ ] **Step 7: Verify production**

Confirm the canonical alias returns 200 for home, category, article, editorial standards, privacy, RSS, and sitemap; an unknown route returns 404; security headers and local fonts are present; no executable scripts, tracking, ads, or publisher identifiers appear; and production screenshots match the approved implementation.

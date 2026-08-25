# Deployment guide

Date reviewed: 2026-08-25

## Authorized production sequence

This release uses GitHub first and Vercel second. Do not deploy local unpushed code as the production record.

1. Complete the human review checklist or record every unchecked gate honestly.
2. From a clean checkout, run `npm ci`, `npm run setup:browsers`, and `npm run qa`. On a fresh Linux CI/workstation that needs Chromium libraries, use `npm run setup:browsers:linux` for the browser step.
3. Confirm no parent Blogger files, secrets, account identifiers, or generated output are tracked.
4. Merge the verified branch to `main` and rerun the complete QA command on `main`.
5. Push `main` to the public GitHub repository and confirm the remote commit SHA equals local `HEAD`.
6. Import or link that GitHub repository in Vercel with Astro as the framework, `npm run build` as the build command, and `dist` as the output directory. Do not add a browser-install or full-QA step to the Vercel production build; browser setup belongs in the verified local/CI release gate.
7. Create the production deployment from the pushed `main` commit.
8. Verify the production URL, representative routes, real 404, canonical tags, robots, sitemap index, RSS, security headers, and deployment logs.

The static build accepts one optional public variable: `PUBLIC_SITE_URL`. It is
not a secret. Leave it undefined to use the verified
`https://everyday-tech-insight.vercel.app/` fallback, or set it to the final
HTTPS origin for a verified custom domain. Any supplied value with credentials,
a path, query, fragment, or non-HTTPS scheme fails the build. Vercel preview
hostname variables are deliberately ignored so previews cannot silently become
canonicals. Copy `.env.example` only when a local canonical override is needed;
do not create placeholder secrets.

## Vercel CLI reference

Use an authenticated current Vercel CLI only after the GitHub push:

```text
npx vercel@latest link --yes --project everyday-tech-insight
npx vercel@latest git connect https://github.com/danielko7188-hue/everyday-tech-insight
$expectedSha = (git rev-parse HEAD).Trim()
$deploymentUrl = npx vercel@latest deploy --prod --yes --meta "githubCommitSha=$expectedSha"
npx vercel@latest inspect $deploymentUrl --json | Set-Content -LiteralPath .vercel\deployment-metadata.json -Encoding utf8NoBOM
npm run check:production -- --origin https://everyday-tech-insight.vercel.app --expected-sha $expectedSha --deployment-metadata .vercel\deployment-metadata.json
```

The explicit metadata value is taken from the already-pushed local `HEAD`; the production verifier requires Vercel to report that same full SHA together with `READY`, production target, deployment ID, and canonical alias evidence. A missing or conflicting SHA fails closed. The ignored `.vercel/deployment-metadata.json` file is runtime evidence and is not committed.

CLI syntax can change. Check `npx vercel@latest --help` before a live action. The ignored `.vercel/` folder stores local project linkage and must not be committed.

## Canonical hostname and custom domain

The single canonical source of truth is the validated resolver in
`site.config.mjs`. `PUBLIC_SITE_URL` overrides its verified Vercel fallback.
Canonical, sitemap, RSS, robots, structured-data, Open Graph, and Twitter URLs
therefore share one origin. After deployment:

1. Confirm Vercel assigned that exact production hostname.
2. If a verified production or custom hostname should become canonical, set
   `PUBLIC_SITE_URL` for the Vercel Production environment only. Do not set it
   to a preview deployment URL.
3. Rerun `npm run qa`, commit, push, redeploy, and recheck the live metadata.

For a future custom domain, add and verify the domain in Vercel, configure the required DNS records at the registrar, choose one canonical hostname, redirect alternatives, then set the production variable and complete the full release cycle. Do not switch canonicals before the domain resolves over HTTPS.

`npm run build` first regenerates the fixed local social-preview portfolio: one
default image, five category images, fifteen article images, and the Apple touch
icon. Sharp is pinned directly, generation uses bundled inputs only, and the
built-output gate rejects missing or extra social files. Commit the generated
`public/social/*.png` and `public/apple-touch-icon.png` files with their source
changes; never replace them with remote image URLs.

## Search Console

Search Console setup is a separate owner action after the canonical production site is stable:

1. Add the final domain or URL-prefix property using an owner-controlled Google account.
2. Complete the ownership method Google provides; do not put verification secrets into article content.
3. Submit the production `sitemap-index.xml` URL.
4. Inspect representative pages and wait for Google's crawl/indexing evidence rather than claiming indexing immediately.

No Search Console property or submission is created by this repository.

## AdSense, consent, and ads.txt

AdSense is disabled. Before a future application or ad integration, the owner must independently complete legal publisher identity, policy, privacy, content-rights, and human editorial review; determine whether a consent-management platform is required for the actual audience and ad configuration; and obtain a genuine publisher ID from the real account.

Only after those facts exist should code add the exact authorized ad integration. Create `ads.txt` only from the genuine account-provided record. Never use a sample or placeholder publisher ID. Run full QA after changing the privacy or script model. Google alone decides eligibility and approval.

## Content release workflow

1. Draft or revise Markdown under `src/content/articles/`.
2. Verify every factual claim against the cited primary source.
3. Keep unfinished entries out of published status.
4. Update source access and review evidence only when the work actually occurred. Dates may advance from the confirmed 2026-08-21 launch through the current `America/Los_Angeles` date; `dateModified` must be later than publication and requires a substantive change.
5. Run automated QA, then complete human editorial/accessibility/privacy/legal review.
6. Use a review branch, merge, and let the connected production branch deploy only the approved commit.

## Backup and rollback

- Treat the Git repository as the source-of-truth backup. Keep at least one owner-controlled clone or archive outside the deployment provider.
- Generated `dist` and Vercel deployment output are reproducible artifacts, not the only backup.
- Before a major content or platform change, record the current production commit and deployment URL.
- Preferred source rollback: run `git revert` for the faulty commit without rewriting shared history, rerun QA, push the revert, and deploy that exact pushed SHA.
- Emergency hosting rollback: use Vercel's dashboard or current `vercel rollback` command to reassign production to an eligible earlier deployment, then reconcile Git immediately so the next push does not reintroduce the fault.
- After any rollback, verify public routes and note that restored deployments may use older environment configuration.

## Replit import and preview

Replit is not the authorized production target for this release. The included `.replit` configuration installs with `npm ci`, runs Astro on `0.0.0.0:3000`, and maps local port 3000 to external port 80 for the development preview.

For an explicitly authorized Replit Static Deployment, choose Static in the Publishing pane, set the build command to `npm ci && npm run build`, and set the public directory to `dist`. Confirm the same canonical-host rule before publishing; a second public hostname must not silently become a conflicting indexable copy.

Current primary references: [Astro on Vercel](https://docs.astro.build/en/guides/deploy/vercel/), [Vercel Git deployments](https://vercel.com/docs/git), [Vercel environment variables](https://vercel.com/docs/environment-variables), [Vercel rollback](https://vercel.com/docs/instant-rollback), [Replit app configuration](https://docs.replit.com/features/project-setup/configuration), and [Replit publishing](https://docs.replit.com/features/publishing/deployment-types).

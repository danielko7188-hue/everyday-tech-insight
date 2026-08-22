# Deployment guide

Date recorded: 2026-08-21

## Authorized production sequence

This release uses GitHub first and Vercel second. Do not deploy local unpushed code as the production record.

1. Complete the human review checklist or record every unchecked gate honestly.
2. From a clean checkout, run `npm ci` and `npm run qa`.
3. Confirm no parent Blogger files, secrets, account identifiers, or generated output are tracked.
4. Merge the verified branch to `main` and rerun the complete QA command on `main`.
5. Push `main` to the public GitHub repository and confirm the remote commit SHA equals local `HEAD`.
6. Import or link that GitHub repository in Vercel with Astro as the framework, `npm run build` as the build command, and `dist` as the output directory.
7. Create the production deployment from the pushed `main` commit.
8. Verify the production URL, representative routes, real 404, canonical tags, robots, sitemap index, RSS, security headers, and deployment logs.

The repository currently needs no runtime environment variables. Do not create placeholder secrets. If a future feature needs one, add it in the appropriate Vercel environment, keep secret values out of Git, and redeploy because environment changes do not alter older deployments.

## Vercel CLI reference

Use an authenticated current Vercel CLI only after the GitHub push:

```text
npx vercel@latest link --yes --project everyday-tech-insight
npx vercel@latest git connect https://github.com/danielko7188-hue/everyday-tech-insight
npx vercel@latest deploy --prod --yes
```

CLI syntax can change. Check `npx vercel@latest --help` before a live action. The ignored `.vercel/` folder stores local project linkage and must not be committed.

## Canonical hostname and custom domain

The code currently expects `https://everyday-tech-insight.vercel.app/`. After deployment:

1. Confirm Vercel assigned that exact production hostname.
2. If it differs, update `src/data/site.ts`, `astro.config.mjs`, and `public/robots.txt` together.
3. Rerun `npm run qa`, commit, push, redeploy, and recheck the live metadata.

For a future custom domain, add and verify the domain in Vercel, configure the required DNS records at the registrar, choose one canonical hostname, redirect alternatives, then make the same three-file canonical update and full release cycle. Do not switch canonicals before the domain resolves over HTTPS.

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
4. Update source access and review evidence only when the work actually occurred.
5. Run automated QA, then complete human editorial/accessibility/privacy/legal review.
6. Use a review branch, merge, and let the connected production branch deploy only the approved commit.

## Backup and rollback

- Treat the Git repository as the source-of-truth backup. Keep at least one owner-controlled clone or archive outside the deployment provider.
- Generated `dist` and Vercel deployment output are reproducible artifacts, not the only backup.
- Before a major content or platform change, record the current production commit and deployment URL.
- Preferred source rollback: revert the faulty commit without rewriting shared history, rerun QA, and push the revert.
- Emergency hosting rollback: use Vercel's dashboard or current `vercel rollback` command to reassign production to an eligible earlier deployment, then reconcile Git immediately so the next push does not reintroduce the fault.
- After any rollback, verify public routes and note that restored deployments may use older environment configuration.

## Replit import and preview

Replit is not the authorized production target for this release. The included `.replit` configuration installs with `npm ci`, runs Astro on `0.0.0.0:3000`, and maps local port 3000 to external port 80 for the development preview.

For an explicitly authorized Replit Static Deployment, choose Static in the Publishing pane, set the build command to `npm ci && npm run build`, and set the public directory to `dist`. Confirm the same canonical-host rule before publishing; a second public hostname must not silently become a conflicting indexable copy.

Current primary references: [Astro on Vercel](https://docs.astro.build/en/guides/deploy/vercel/), [Vercel Git deployments](https://vercel.com/docs/git), [Vercel environment variables](https://vercel.com/docs/environment-variables), [Vercel rollback](https://vercel.com/docs/instant-rollback), [Replit app configuration](https://docs.replit.com/features/project-setup/configuration), and [Replit publishing](https://docs.replit.com/features/publishing/deployment-types).

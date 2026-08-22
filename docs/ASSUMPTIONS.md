# Assumptions and evidence boundaries

Date recorded: 2026-08-21

## Confirmed project decisions

- The build is an isolated Astro static site. It does not include or publish the parent Blogger workspace.
- The five categories are AI and automation, business software, cybersecurity and data protection, digital operations, and technology strategy.
- The intended audience is small-business decision makers.
- The public byline is `Everyday Tech Insight` and is described as a publication name only.
- GitHub Issues is the public contact and corrections path.
- Advertising, analytics, affiliate, sponsorship, consent-management, and tracking integrations are disabled.
- Vercel is the authorized production target for this release. Replit support is limited to import, development preview, and documented static-build compatibility.
- `site.config.mjs` is the single canonical-origin source consumed by Astro, runtime metadata, generated robots, and release QA.

## Assumptions to verify during deployment

- `https://everyday-tech-insight.vercel.app/` is the expected production canonical. It is not confirmed until Vercel assigns the hostname and production checks pass.
- The GitHub repository remains public so visitors can open contact and correction issues without receiving a dead link. Repository visibility and issue settings must be checked after the push.
- The generated output remains fully static and requires no runtime environment variables.

If Vercel assigns a different production hostname, stop and update the one canonical `url` value in `site.config.mjs`, rerun full QA, commit, push, and redeploy before treating the deployment as production.

## Deliberately unknown or unclaimed

- No owner, publisher legal entity, editor, employee, team, credential, address, jurisdiction, or business registration is asserted.
- No article claims first-hand testing unless a future evidence record supports it. The launch portfolio uses `source-checked` verification.
- No legal review, privacy-law determination, accessibility certification, or professional advice claim is made.
- No permission or license conclusion is asserted for material beyond the repository's original text and factual citations. A human must review content rights.
- No traffic, ranking, revenue, click-through, conversion, or AdSense outcome is predicted.
- No AdSense account fact, publisher ID, approval, or application is asserted.

## Privacy boundary

The static site is designed without forms, accounts, comments, cookies, local storage, analytics, advertising, or client-side application code. Visitors who choose the GitHub issue link leave the site and become subject to GitHub's own terms and privacy practices. Hosting and network providers may still process ordinary request data; the public privacy page states this limited boundary without pretending to know account-level retention settings.

Any future analytics, advertising, embedded media, form, newsletter, comment system, personalization, or consent tool changes the privacy model and requires a fresh privacy and consent review before implementation.

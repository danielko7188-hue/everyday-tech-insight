# Privacy and Consent Review

**Review date:** 2026-08-25

**Scope:** Source code and locally built release candidate, informed by inspection of the currently live Vercel-hosted baseline

**Legal review:** Not performed
**Consent-management platform:** Not configured

## Confirmed current implementation

The site’s own code currently has:

- no advertising or AdSense code;
- no dormant verification/live advertising mode or unused ad-slot component;
- no publisher identifier or `ads.txt` record;
- no analytics provider;
- no tag manager;
- no consent-management platform;
- no contact form, account, login, newsletter, comments, ecommerce, or payment flow;
- no embedded video, map, social widget, remote font, or third-party image;
- no site-authored cookies;
- no site-authored local-storage or session-storage use; and
- no client-side JavaScript required for primary content.

The public privacy page accurately states this narrow code boundary. It does not claim that no network or platform data exists.

## Platform processing disclosed

The production host is Vercel. Its current Privacy Notice states that service operation can involve request, IP-derived location, device, usage, log, diagnostic, performance, and related service data. The public privacy page links to Vercel’s notice and distinguishes platform practices from scripts authored by this site.

Contact and correction routes lead to a public GitHub Issues page. The public site warns visitors that issue content and account identity may be public and tells them not to post private, credential, payment, account, or security-sensitive information. The privacy page links to GitHub’s General Privacy Statement.

## Current consent decision

No cosmetic cookie banner was added. With no site-authored optional advertising, analytics, embed, form, or storage script to control, a banner would imply functionality and legal completeness that do not exist.

This decision is a description of current implementation, not a legal conclusion for every visitor or jurisdiction. Vercel, GitHub, browser behavior, network intermediaries, and future features can create additional processing questions.

## Required review before adding a feature

Before enabling ads, analytics, a tag manager, embeds, a form, comments, a newsletter, personalization, browser storage, or any other third-party script:

- [ ] Inventory every data flow, recipient, purpose, field, identifier, retention period, and transfer.
- [ ] Identify the owner/controller and relevant processor or independent-controller roles.
- [ ] Review current contracts, terms, subprocessors, security, deletion, and incident obligations.
- [ ] Determine which privacy notices, disclosures, legal bases, user rights, or age restrictions apply.
- [ ] Determine whether consent is required for relevant visitors before optional scripts load.
- [ ] If consent is required, configure a real consent-management platform that blocks optional scripts before consent and supports withdrawal or preference changes.
- [ ] Test consent denial, acceptance, partial choices, withdrawal, script blocking, and persistence in representative browsers.
- [ ] Update the public Privacy page and Advertising disclosure before the feature becomes active.
- [ ] Repeat accessibility, security, performance, content-security-policy, and external-link review.
- [ ] Obtain qualified legal/privacy review appropriate to the owner, visitors, jurisdictions, and services.

## Required review before advertising

- [ ] Supply a genuine AdSense account and publisher identifier through an approved private process.
- [ ] Recheck current Google AdSense eligibility, program, privacy, consent, and site-ownership requirements.
- [ ] Decide whether and where ads may appear without undermining reading or navigation.
- [ ] Configure required consent controls for relevant visitors; do not equate a banner with compliance.
- [ ] Implement only the exact owner-authorized verification or advertising path as a separately reviewed release; do not activate it by adding one flag or identifier.
- [ ] Add only genuine account code and a valid `ads.txt` record when supplied and required by that reviewed implementation.
- [ ] Update the Advertising disclosure and Privacy page to match the exact active code and providers.
- [ ] Verify production behavior before requesting review.

## Owner facts still missing

No private owner identity, legal entity, postal address, contact email, jurisdiction, target visitor geography, age policy, data-protection contact, or retention authority was supplied for publication. Those facts cannot be inferred from the repository or GitHub username.

The current public byline is the publication name only. The public issue tracker is the only contact route. The owner must decide whether that is sufficient and lawful for the actual operation.

## Residual limitations

- Code inspection cannot prove the final host injects no feature outside the tracked deployment configuration.
- A live production network and storage inspection remains necessary after deployment.
- Platform privacy notices and settings can change after this review date.
- This record does not provide legal advice or establish compliance with any privacy, cookie, communications, advertising, employment, or consumer-protection law.
- Consent requirements depend on the actual owner, visitors, jurisdictions, features, providers, purposes, and data flows.

**Gate:** Privacy wording is factually aligned with the current static implementation, but privacy and consent review is not complete for every jurisdiction and must be repeated before any monetization or tracking is enabled.

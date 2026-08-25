# AdSense Readiness Audit — 2026-08-25

## Verdict

The site is being improved toward publication maturity, but the current release gate is **open and not complete**. The repository does not claim that the site is ready to apply, that an AdSense account or site review exists, or that Google will approve it. Google alone decides AdSense eligibility and approval.

The safest current implementation is monetization mode `off`: no publisher ID, account-verification value, ad request, display unit, affiliate link, analytics, tracking, consent-management platform (CMP), or `ads.txt` file is enabled. `/ads.txt` is required to remain absent and return 404 while this mode is active.

## Evidence classification

### Locally verified

- The Git-backed article lifecycle is `draft -> review -> published -> archived`; only `published` records may enter public routes, navigation, feeds, sitemaps, related guides, or generated social images.
- Pages CMS configuration and repository validation exist, while no public `/admin/`, `/keystatic/`, or CMS runtime is added to the site.
- The structured editorial source contains 18 owner gates and a 15-guide content-quality queue. Every current owner gate and guide-specific human release gate remains unresolved rather than being presented as complete.
- Managed article media is validated before publication and only referenced media from published guides is emitted. This technical validation does not establish authorship, license, attribution sufficiency, or publication rights.
- The public-repository safety model is explicit: committed source and editorial records are publicly visible, and confidential owner, account, legal, review, or rights evidence must stay outside Git.
- The advertising disclosure and privacy language describe the disabled implementation. The final release candidate still requires a fresh complete `npm run qa` result before deployment.

### Observed in production

- Canonical target: `https://everyday-tech-insight.vercel.app/`.
- The previous production deployment remains the rollback baseline until the new GitHub-first release is pushed, deployed, and directly verified.
- No result from a local build, screenshot baseline, or source-code test is treated as proof of the new production deployment. Exact live routes, headers, assets, request behavior, canonical metadata, deployment identity, and Git SHA must be recorded after deployment.

### Owner action

- Resolve the 18 owner gates in `docs/editorial-operations.yml` with genuine, nonsecret evidence references and accountable reviewers.
- Complete the 15-guide content-quality queue, including source-recency, substantive editorial, expert-when-needed, and media-rights review.
- Confirm the real owner/publisher identity, age eligibility, contact route, controlled production domain, intended audience and jurisdictions, privacy/legal duties, and public byline decision.
- Complete hosted Pages CMS GitHub App authorization, repository selection, and one reversible save/commit round-trip on a non-`main` branch.
- If monetization is later authorized, supply the genuine account-derived publisher and site-verification values through an approved private process. Do not use examples.
- Decide the actual advertising model, permitted placements, visitor regions, and whether a Google-certified CMP is required. Obtain qualified privacy/legal review for the real facts and data flows.
- Authorize any AdSense application or review request explicitly. Repository work does not authorize an account action.

### Unknown

- Hosted Pages CMS authentication, repository access, field rendering, save behavior, and Markdown round-trip.
- AdSense account state, publisher ID, site status, ownership-verification method, and Google review status.
- Whether the publication operator is eligible, the final identity/contact disclosures are sufficient, or the canonical domain is controlled by that operator.
- Human editorial acceptance, source-recency confirmation, subject-matter review, accessibility review on representative assistive technology, legal/privacy review, and media rights.
- Actual audience geography and therefore the final consent/CMP obligations.

## Current Google-policy fit

Google's current eligibility guidance says applicants need their own high-quality, original content, policy compliance, access to the site's HTML source, and an eligible adult account holder. The repository improves content structure, navigation, source transparency, and technical ownership of the code, but automation cannot prove originality, audience value, age, identity, or policy acceptance. See [Eligibility requirements for AdSense](https://support.google.com/adsense/answer/9724?hl=en) and [Google Publisher Policies](https://support.google.com/adsense/answer/10502938?hl=en).

Google provides site-connection methods using account-specific code, a meta tag, or an account-generated `ads.txt` record. Those values must come from the real account; this repository intentionally contains none. See [Connect your site to AdSense](https://support.google.com/adsense/answer/7584263?hl=en), [Find your publisher ID](https://support.google.com/adsense/answer/105516?hl=en), and [Ads.txt FAQs](https://support.google.com/adsense/answer/9785052?hl=en).

For relevant ad traffic in the EEA, the UK, or Switzerland, Google documents certified-CMP requirements and consent obligations. The actual decision depends on the future ad configuration, visitors, jurisdictions, and legal review. No cosmetic consent banner is added while optional advertising, analytics, and storage code remain disabled. See [Google consent-management requirements](https://support.google.com/adsense/answer/13554020?hl=en) and [Set up and manage your CMP](https://support.google.com/adsense/answer/7670013?hl=en).

## Engineering controls before any future monetization

1. Keep the current integration exact and off-only: `{ mode: "off" }` is the sole accepted monetization configuration.
2. Reject every provider, publisher/account value, verification method, display unit, placement, CMP value, `ads.txt` value, and unknown extra field.
3. Do not add a verification state until the genuine owner-authorized artifact is available and its exact deployed output can be tested without loading advertising.
4. Do not add a live state until provider initialization, route eligibility, account-side settings, production CSP, authorized `ads.txt`, and the applicable consent/CMP behavior are implemented and tested together from genuine owner evidence.
5. Any future change must derive Privacy and Advertising disclosure copy from the complete validated integration state, run the full local gate, deploy the exact pushed commit, and receive direct production verification.

## Release boundary

Automated publication and deployment work may complete while owner/external gates remain open, provided those gates stay visible and monetization remains `off`. This audit can support a future owner decision; it is not legal advice, account evidence, an AdSense application, or an approval prediction.

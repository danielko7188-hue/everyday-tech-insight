# Owner Inputs Required

This is repository-tracked, non-deployed source in a public GitHub repository. Every committed file and branch is publicly visible. Commit only the nonsecret status and reference fields defined here. Confidential identity, account, legal, authorization, and rights evidence must remain outside Git in an owner-approved system.

Unresolved gates use `OWNER ACTION REQUIRED` or `UNKNOWN`; neither is an error in the ads-off static build. A `VERIFIED` transition is valid only with a nonsecret evidence reference, the real verifier, and the real verification date. A public claim that depends on an unresolved gate must remain absent.

## Gate 01: Legal owner or publisher identity

- `status`: UNKNOWN
- `reason`: The repository does not contain owner-approved evidence naming a legal owner, publisher, or operating entity.
- `accepted evidence`: A nonsecret evidence reference to confidential owner material held outside Git, supported by an appropriate identity or entity record and an explicit public-disclosure decision.
- `public effect`: No legal-person, company, publisher-entity, copyright-owner, Person, or Organization claim may be added.
- `next action`: The owner must supply and approve the exact identity evidence before any dependent public wording or structured data is changed.

## Gate 02: Approved public publisher wording

- `status`: OWNER ACTION REQUIRED
- `reason`: A verified identity and a separate decision about the wording safe to publish are both absent.
- `accepted evidence`: Owner-approved final wording that states the publication relationship accurately and identifies which verified facts may appear publicly.
- `public effect`: `Everyday Tech Insight` remains only a publication-name byline and must not be described as a person, company, or legal organization.
- `next action`: Approve public wording only after Gate 01 evidence exists; review every page and metadata consumer before release.

## Gate 03: Durable public contact email or contact method

- `status`: OWNER ACTION REQUIRED
- `reason`: The site currently routes contact and corrections to the public repository issue tracker; no durable owner-verified contact address has been supplied.
- `accepted evidence`: An owner-controlled contact method, proof that the owner can receive it, and approval to display the exact method publicly.
- `public effect`: The existing issue-based route remains; no email address, postal address, or response-time promise may be invented.
- `next action`: Supply and test the approved method, then update contact, privacy, publisher, correction, and structured metadata surfaces consistently.

## Gate 04: Custom-domain decision and ownership proof

- `status`: UNKNOWN
- `reason`: The canonical currently uses the verified Vercel hostname; the repository contains no owner decision or proof for a custom domain.
- `accepted evidence`: A named domain decision plus registrar or DNS control evidence and a completed HTTPS, redirect, canonical, and ownership verification check.
- `public effect`: The Vercel canonical remains authoritative; no custom domain or ownership statement may be published.
- `next action`: The owner must choose and prove a domain before canonical, deployment, Search Console, or advertising-site settings change.

## Gate 05: Named-author identity, if any

- `status`: UNKNOWN
- `reason`: No owner-approved named person is present in the verified-author registry.
- `accepted evidence`: A real person's explicit participation, owner confirmation of identity, consent to publication, and an approved public author identifier.
- `public effect`: Articles continue to use the publication-name byline; no author page or Person structured data is created.
- `next action`: Supply identity and consent evidence only if a named-author model is desired, then satisfy Gates 06 and 07 before rendering it.

## Gate 06: Author role, biography, and credential evidence

- `status`: UNKNOWN
- `reason`: No named author is approved and no role, biography, or credential has owner-verified public evidence.
- `accepted evidence`: Exact owner-approved role and biography wording plus an HTTPS evidence record for every credential that will be stated.
- `public effect`: No expertise, employment, education, certification, or experience claim may appear in a byline, biography, or schema.
- `next action`: Validate each field through the strict author record and publish only facts supported on the matching author page.

## Gate 07: Author-photo file, alt text, credit, and rights basis

- `status`: UNKNOWN
- `reason`: No author photo or complete publication-rights tuple has been supplied.
- `accepted evidence`: The approved image file, factual alt text, credit, source where applicable, and written rights basis that permits the intended public use.
- `public effect`: No author portrait, placeholder avatar, credit, or rights statement is rendered.
- `next action`: Supply the complete tuple and pass file, accessibility, and rights review before adding a photo to a verified author record.

## Gate 08: Firsthand-use or testing evidence for any claim that implies it

- `status`: UNKNOWN
- `reason`: Repository content intentionally avoids claiming hands-on product testing, but no independent owner record establishes firsthand use for any future claim.
- `accepted evidence`: A dated test plan, exact product and version or service scope, test environment, observations, limitations, artifacts, and identified reviewer.
- `public effect`: No page may claim that the publication used, tested, benchmarked, reviewed, or experienced a product firsthand.
- `next action`: Remove any experience-implying claim or attach the complete evidence record and obtain human review before publication.

## Gate 09: Human editorial review of all 15 guides

- `status`: OWNER ACTION REQUIRED
- `reason`: Automated checks cannot prove clarity, usefulness, originality, factual nuance, or editorial acceptance; no identified human review record exists for the 15-guide launch set.
- `accepted evidence`: A per-guide review record naming the real reviewer, review date, findings, corrections, acceptance decision, and release scope.
- `public effect`: The quality queue remains `OWNER REVIEW REQUIRED`; automated success must not be presented as human editorial approval.
- `next action`: Review every queue record against its article and sources, resolve findings, and record the real reviewer and date without backdating.

## Gate 10: Expert review for security, legal, privacy, financial, or other consequential claims where needed

- `status`: OWNER ACTION REQUIRED
- `reason`: Security, privacy, legal, financial, identity, recovery, and other consequential guidance may require competence beyond general editorial review.
- `accepted evidence`: A scoped review by a qualified person, with identity, relevant competence, date, claims reviewed, findings, limitations, and disposition.
- `public effect`: No expert-reviewed, legally sufficient, compliant, secure, or financially definitive claim may be added without that evidence.
- `next action`: Use the guide-specific queue risks to route consequential passages to an appropriate expert before any dependent release claim.

## Gate 11: Image and worksheet rights review

- `status`: OWNER ACTION REQUIRED
- `reason`: File validation and repository history do not establish copyright ownership, license scope, attribution sufficiency, or worksheet-content rights.
- `accepted evidence`: A per-asset inventory linking origin, creator or licensor, license or authorization, required attribution, permitted uses, and reviewer decision.
- `public effect`: Media rights remain unresolved; no public rights-complete or original-asset claim may be made from automation alone.
- `next action`: Review every editorial visual, uploaded image, social image input, and Toolkit worksheet before final owner acceptance.

## Gate 12: Privacy/legal review for the actual operating jurisdiction and data practices

- `status`: OWNER ACTION REQUIRED
- `reason`: The repository cannot determine the operator's jurisdiction, legal obligations, actual off-site handling, or future service configuration.
- `accepted evidence`: Counsel or other authorized reviewer analysis tied to the actual operator, jurisdictions, data flows, vendors, retention, contact method, and release configuration.
- `public effect`: Current pages describe the observable ads-off static state and must not be called legally complete or universally compliant.
- `next action`: Review privacy, terms, contact, corrections, disclosures, CMS operations, and any future advertising or consent behavior against actual facts.

## Gate 13: Pages CMS GitHub App authorization and repository selection

- `status`: OWNER ACTION REQUIRED
- `reason`: Pages CMS is configured and locally tested, but hosted sign-in, the hosted collaborator list, GitHub App authorization, exact GitHub App scope, repository access, and a real save round-trip are unverified.
- `accepted evidence`: Owner-observed GitHub authorization, an empty hosted collaborator list, exact-repository GitHub App scope, exact repository and branch selection, and a reversible test edit whose commit is inspected.
- `public effect`: No hosted-CMS-ready, connected, authorized, or save-tested claim may be published.
- `next action`: The owner must review the hosted collaborator list and installed App scope, retain only exact-repository access, select the content branch, perform the controlled round-trip, and revoke excess access if found.

## Gate 14: Protected main branch and pull-request review rules

- `status`: OWNER ACTION REQUIRED
- `reason`: A live GitHub API inspection after foundation pull request 2 on 2026-08-26 confirmed protected `main` with required pull requests, both strict app-bound checks (`Owner-only publishing gate` and `Full quality gate`), admin enforcement, no bypass actors, linear history, conversation resolution, and force-push and deletion disabled. Owner-authored activation pull request 3 passed the trusted-base owner gate against immutable GitHub user ID `239253033` in check run `33019254652`; an owner-authenticated review of installed GitHub Apps and hosted CMS access remains external.
- `accepted evidence`: Dated GitHub API records showing protected branches, both required app-bound checks, the sole CODEOWNER, repository access, Actions policy, bypass policy, and owner-only check run `https://github.com/danielko7188-hue/everyday-tech-insight/actions/runs/33019254652/job/98345242404`, plus an owner-authenticated installed-App and hosted-CMS access review.
- `public effect`: Protected `main` rejects non-owner pull requests and requires both `Owner-only publishing gate` and `Full quality gate` before merge; `content/editorial` retains direct CMS saves under admin, linear-history, no-force-push, and no-delete controls. Hosted CMS authorization remains a separate Gate 13 unknown.
- `next action`: Preserve both required checks and the immutable owner-ID test; then have the owner verify that the hosted Pages CMS collaborator list is empty and each installed App is limited to the exact repository, retaining only nonsecret dated evidence.

## Gate 15: AdSense account/site status and exact owner-provided publisher values

- `status`: UNKNOWN
- `reason`: No authenticated AdSense account state, site state, approved publisher identifier, or authorization to enable advertising exists in the repository.
- `accepted evidence`: Owner-observed account and site status plus the exact platform-issued values, accompanied by explicit approval for their intended public use.
- `public effect`: Monetization remains off with no publisher identifier, ad code, ad request, slot, blank ad gap, or approval claim.
- `next action`: Keep advertising disabled unless the owner supplies exact values and separately authorizes a fully implemented and reviewed verification or live release.

## Gate 16: Approved verification method and exact value

- `status`: UNKNOWN
- `reason`: No AdSense site-verification method or exact owner-provided value has been selected or supplied.
- `accepted evidence`: The platform-presented verification method and exact value, copied by the owner from the authenticated account and approved for insertion.
- `public effect`: No verification meta tag, script, file, or `ads.txt` value is emitted.
- `next action`: Choose one supported method only after Gate 15 is evidenced, implement that exact method in a separate fail-closed release, and verify the deployed response.

## Gate 17: Authorized ads.txt line and certified CMP decision where applicable

- `status`: UNKNOWN
- `reason`: No platform-authorized `ads.txt` line has been supplied to the repository, and applicability or selection of a certified consent-management platform cannot be determined from the static repository.
- `accepted evidence`: The exact account-issued `ads.txt` line plus a documented jurisdiction and consent assessment identifying whether a certified CMP is required and, if so, the approved configuration.
- `public effect`: `/ads.txt` remains absent and no advertising CMP, consent banner, tracking request, or vendor claim is added.
- `next action`: Obtain the exact values and qualified applicability decision before a separate end-to-end live advertising implementation is considered.

## Gate 18: Final owner acceptance of content, disclosures, placements, and production release

- `status`: OWNER ACTION REQUIRED
- `reason`: Software verification cannot substitute for the owner's acceptance of editorial content, identity boundaries, legal disclosures, asset rights, advertising placements, and the exact production candidate.
- `accepted evidence`: A dated acceptance naming the reviewed Git commit and deployment, resolved or accepted findings, approved public disclosures, permitted placements, and release decision.
- `public effect`: No final owner-approved, legally accepted, editorially certified, or AdSense-ready claim may be made before this gate is evidenced.
- `next action`: Review the complete candidate and all preceding gates, record the actual decision, then authorize only the specific live actions that decision permits.

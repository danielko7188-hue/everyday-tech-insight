# Content Quality Review Queue

This is repository-tracked, non-deployed source for the 15-guide launch subset and every currently published guide. Every committed file and branch is publicly visible. Confidential review or rights evidence must remain outside Git; commit only a nonsecret evidence reference and truthful status. Repository-derived fields are validated against article source by automation. Editorial judgments remain bounded risk notes, not proof of originality, rights, firsthand use, expertise, human acceptance, legal sufficiency, or Google approval.

An empty `sourceLastChecked` renders as `UNKNOWN`; `reviewedBy` and `reviewedAt` stay empty until a real review supplies evidence. A guide stays `OWNER REVIEW REQUIRED` until a completed review records its real reviewer and date. Every `releaseGate` includes one of the four documented statuses plus a guide-specific rationale and nonsecret evidence reference.

## Guide 01: `back-up-business-files-with-the-3-2-1-method`

- `slug`: back-up-business-files-with-the-3-2-1-method
- `title`: How to back up business files with the 3‑2‑1 method
- `category`: cybersecurity-data-protection
- `publicationStatus`: published
- `wordCount`: 1157
- `reader`: Small-business owners and administrators responsible for recovering shared files, SaaS exports, device data, and operational records after loss or attack.
- `businessNeed`: A business may believe files are protected because they sync to the cloud, yet have no independent copy, tested restoration, or recovery priority.
- `guidePromise`: Separate live data from independent backup copies and prove that representative files can be restored before an incident.
- `deliverable`: Backup inventory, 3-2-1 plan, and documented restore-test log.
- `whenToUse`: Use when cloud sync is being treated as backup or when recovery has never been tested.
- `sourceUrls`: https://www.cisa.gov/sites/default/files/publications/data_backup_options.pdf | https://csrc.nist.gov/pubs/sp/800/184/final | https://www.cisa.gov/stopransomware/ransomware-guide
- `sourceSuitability`: Official government backup guidance and a NIST recovery framework support copy separation and recovery planning; their scope does not prove that one topology or retention schedule fits every business.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Inventory recoverable records, distinguish live data from copies, map the 3-2-1 topology, set recovery order, and document a representative restore test.
- `originalVisual`: backup-topology / three-two-one-topology — separates live data, independent copies, media diversity, offsite placement, and restore validation.
- `toolkitContribution`: Backup restore-test log at /toolkit/backup-restore-test-log/ converts one recovery request into a validation, gap, corrective-action, and retest record.
- `claimRisks`: Readers could treat 3-2-1 as universally sufficient even when ransomware isolation, SaaS export coverage, encryption, retention, or recovery objectives require additional controls.
- `repetitionRisks`: Backup inventory and evidence-log language overlaps the risk-register and SaaS-exit guides; this article must remain centered on recoverability rather than generic governance.
- `evidenceLimits`: Cited guidance supports principles, not the reader's actual restore success, media independence, recovery time, data completeness, or provider behavior.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the three-two-one-topology tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1157 reader-visible Markdown prose words, three HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove substance, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: YES — a backup or security practitioner should review recovery, ransomware-isolation, encryption, retention, and restore-test claims for the intended operating environment.
- `recommendation`: KEEP WITH REVISION IF NEEDED — retain the recovery-focused method, but revise any wording a human or expert finds overbroad before relying on it operationally.
- `ownerAction`: Run one scoped editorial and recovery-practitioner review, confirm every source still supports the cited passage, and document whether the visual and worksheet may be published.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 02: `calculate-the-total-cost-of-business-software`

- `slug`: calculate-the-total-cost-of-business-software
- `title`: How to calculate the total cost of business software
- `category`: technology-strategy
- `publicationStatus`: published
- `wordCount`: 1314
- `reader`: Small-business decision makers comparing software options or deciding whether to renew, replace, consolidate, build, or keep a current process.
- `businessNeed`: Subscription price can look affordable while implementation, internal labor, required add-ons, administration, change, downtime, and exit remain uncounted.
- `guidePromise`: Compare software using the full cost of implementation, labor, operation, change, and exit—not subscription price alone.
- `deliverable`: Transparent total-cost range and assumptions register.
- `whenToUse`: Use when comparing, renewing, consolidating, replacing, building, or retaining business software.
- `sourceUrls`: https://digital.gov/guides/pra/estimate-burden | https://csrc.nist.gov/pubs/sp/800/146/final
- `sourceSuitability`: Official government burden-estimation guidance and NIST cloud guidance support labor and lifecycle scope; neither source proves a vendor price, tax treatment, forecast, or business-specific total.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Establish a common time horizon, record visible and hidden cost layers, separate expected cost from contingent exit exposure, and compare ranges with an assumptions register.
- `originalVisual`: cost-stack / software-cost-stack — separates license, implementation, labor, operations, change, and contingent exit exposure.
- `toolkitContribution`: No mapped Toolkit worksheet; the guide's cost range and assumptions register remain a described working record.
- `claimRisks`: Cost categories may appear financially complete despite omitted taxes, financing, opportunity cost, contract escalation, downtime probability, regional labor rates, or accounting treatment.
- `repetitionRisks`: Assumption-register language overlaps pilot and SaaS-evaluation guidance; this guide must preserve its defined horizon and quantified cost focus.
- `evidenceLimits`: The sources justify considering burden and cloud lifecycle factors but provide no measured cost inputs for a reader's product, staff, implementation, or exit.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the software-cost-stack tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1314 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove financial accuracy, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: CONDITIONAL — a finance, procurement, tax, or accounting reviewer is needed before using the method for consequential budgeting, reporting, or contract decisions.
- `recommendation`: KEEP AS A PLANNING FRAMEWORK — retain the range-based comparison, but do not present it as an accounting, tax, or investment calculation without qualified review.
- `ownerAction`: Verify every cost-category claim against the body, obtain finance review for intended high-value use, and confirm the cost-stack visual's publication rights.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 03: `create-a-shared-file-and-folder-system`

- `slug`: create-a-shared-file-and-folder-system
- `title`: How to create a shared file and folder system
- `category`: digital-operations
- `publicationStatus`: published
- `wordCount`: 1022
- `reader`: Small-business teams replacing informal personal storage with a shared system that other authorized people can understand and maintain.
- `businessNeed`: Teams lose time and control when important files are spread across personal drives, duplicate folders, inboxes, and names that do not reveal ownership or status.
- `guidePromise`: Organize shared files by durable business function, consistent naming, ownership, permissions, and lifecycle.
- `deliverable`: Shared-folder map, naming convention, and file-governance rules.
- `whenToUse`: Use when important files are scattered across personal drives, inboxes, duplicate folders, or inconsistent names.
- `sourceUrls`: https://www.archives.gov/records-mgmt/bulletins/2015/2015-04-appendix-b.html | https://www.archives.gov/records-mgmt/scheduling/file-plan-template
- `sourceSuitability`: Official government records guidance supplies naming and file-plan concepts within a federal scope; the article appropriately must not convert those concepts into private retention or disposal law.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Bound one business area, inventory information types and authoritative copies, design a shallow function-based map, define naming and permissions, migrate under control, and assign maintenance.
- `originalVisual`: information-architecture / shared-file-architecture — shows durable functions, active work, archive, naming, permissions, migration, and ownership.
- `toolkitContribution`: No mapped Toolkit worksheet; the folder map, naming convention, and governance rules remain records the reader creates from the guide.
- `claimRisks`: Records-management examples could be mistaken for legally valid retention, deletion, privacy, or access rules across jurisdictions and industries.
- `repetitionRisks`: Ownership, access, and lifecycle language overlaps onboarding and SaaS-portability content; this guide must remain specific to shared information architecture.
- `evidenceLimits`: Federal naming and file-plan sources do not establish the reader's legal retention duties, access model, collaboration-platform behavior, or successful migration.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the shared-file-architecture tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1022 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove legal fit, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: CONDITIONAL — privacy, records, legal, or information-governance review is needed when regulated, contractual, tax, employment, health, or customer records are in scope.
- `recommendation`: KEEP WITH JURISDICTIONAL LIMITS — retain the operating method while strengthening any passage that could be read as a retention or disposal mandate.
- `ownerAction`: Review the proposed hierarchy and lifecycle language with the actual record owner, identify regulated data, and verify the shared-file visual's rights basis.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 04: `create-a-simple-technology-risk-register`

- `slug`: create-a-simple-technology-risk-register
- `title`: How to create a simple technology risk register
- `category`: technology-strategy
- `publicationStatus`: published
- `wordCount`: 1142
- `reader`: Small-business owners and technology decision makers who need a lightweight governance record rather than a complex enterprise risk platform.
- `businessNeed`: Technology concerns remain vague or all appear urgent when a business has no shared record of events, consequences, evidence, ownership, and treatment.
- `guidePromise`: Turn vague technology concerns into prioritized event-to-consequence risks with evidence, ownership, treatment, and review.
- `deliverable`: Prioritized technology risk register with owners and treatment actions.
- `whenToUse`: Use when technology concerns are scattered, appear equally urgent, or lack ownership and review dates.
- `sourceUrls`: https://csrc.nist.gov/pubs/ir/8286/r1/final | https://www.nist.gov/cyberframework
- `sourceSuitability`: Official government risk integration and cybersecurity framework guidance supports event, consequence, evidence, ownership, treatment, and review scope; it does not prescribe this simplified scoring method.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Translate concerns into event-to-consequence statements, record evidence and existing controls, use bounded likelihood and impact ranges, choose treatment, assign authority, and review.
- `originalVisual`: risk-matrix / technology-risk-matrix — connects likelihood and impact positioning to evidence, ownership, treatment, and a review date.
- `toolkitContribution`: Technology risk register at /toolkit/technology-risk-register/ supplies the dated event-to-consequence record described by the guide.
- `claimRisks`: A simple matrix can create false precision, hide correlated risks, or imply that a color or ordinal score determines legal, financial, safety, or security acceptance.
- `repetitionRisks`: Evidence, owner, review-date, and treatment language recurs across multiple guides; this one must retain a specific event-to-consequence risk record.
- `evidenceLimits`: NIST frameworks support risk-governance concepts but do not validate the article's likelihood ranges, business impact estimates, risk appetite, or treatment decision.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the technology-risk-matrix tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1142 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove risk accuracy, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: CONDITIONAL — security, privacy, finance, safety, legal, or operations expertise is needed for consequential risks and acceptance decisions.
- `recommendation`: KEEP WITH ANTI-PRECISION GUARDRAILS — retain the lightweight register but revise any scoring language that a reviewer finds more certain than the evidence.
- `ownerAction`: Have the accountable business and relevant domain owners review risk wording, escalation thresholds, and the matrix visual before operational use.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 05: `crm-vs-project-management-software`

- `slug`: crm-vs-project-management-software
- `title`: CRM vs. project‑management software: choose by work object
- `category`: business-software
- `publicationStatus`: published
- `wordCount`: 992
- `reader`: Small-business leaders deciding whether the next system should organize customer relationships, time-bounded delivery work, or a controlled connection between both.
- `businessNeed`: Small teams can buy overlapping software because sales relationships and delivery work both contain tasks, notes, owners, dates, and reports.
- `guidePromise`: Choose software by whether the durable record is the customer relationship or the coordinated delivery of project work.
- `deliverable`: System-category decision and documented CRM-to-project handoff.
- `whenToUse`: Use when sales, customer, and delivery tools appear to offer overlapping tasks, notes, owners, and reports.
- `sourceUrls`: https://www.salesforce.com/crm/what-is-crm/ | https://www.atlassian.com/work-management/project-management | https://www.cisa.gov/resources-tools/resources/choosing-secure-and-verifiable-technologies
- `sourceSuitability`: Vendor definitions explain each product category's intended scope, while official government procurement guidance supplies a control-oriented evaluation lens; vendor pages are not neutral comparative evidence.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Name the durable work object, map relationship and delivery lifecycles, assign an authoritative record for shared fields, define the handoff, and test representative scenarios before purchase.
- `originalVisual`: comparison / work-object-comparison — contrasts customer-relationship and project-delivery lifecycles with a controlled handoff.
- `toolkitContribution`: No mapped Toolkit worksheet; the category decision and handoff record are described outputs without a downloadable template.
- `claimRisks`: The work-object distinction may oversimplify products that span both categories, vary by plan, rely on integrations, or implement records differently from vendor definitions.
- `repetitionRisks`: Requirement, scenario, source-of-truth, and exit checks overlap the SaaS evaluation guide; this article must remain a category-selection decision.
- `evidenceLimits`: Vendor definitions cannot establish impartial category boundaries or current product capabilities, and CISA guidance does not evaluate any named CRM or project product.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the work-object-comparison tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 992 reader-visible Markdown prose words, three HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove vendor fit, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: CONDITIONAL — architecture, security, privacy, sales-operations, or delivery-operations review is needed when integrations or sensitive records drive the choice.
- `recommendation`: KEEP AS A CATEGORY SCREEN — retain the work-object heuristic, but require product-specific evidence before any purchasing conclusion.
- `ownerAction`: Review the comparison for vendor neutrality and current terminology, then confirm the handoff visual's rights and the intended reader's real record boundaries.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 06: `document-a-repetitive-workflow-before-automating`

- `slug`: document-a-repetitive-workflow-before-automating
- `title`: Document a repetitive workflow before automating it
- `category`: digital-operations
- `publicationStatus`: published
- `wordCount`: 1013
- `reader`: Small-business process owners preparing to improve or automate a recurring administrative, service, finance, sales, or operations workflow.
- `businessNeed`: Automating an undocumented process can make unclear decisions, duplicate work, hidden exceptions, and weak controls happen faster and less visibly.
- `guidePromise`: Map the real workflow, including decisions and exceptions, before choosing what should be improved or automated.
- `deliverable`: Verified current-state workflow map and automation-requirements packet.
- `whenToUse`: Use before purchasing workflow software or automating a recurring administrative or operational process.
- `sourceUrls`: https://www.epa.gov/sustainability/lean-environment-toolkit-appendix | https://www.epa.gov/e3/e3-value-stream-mapping-how-guide
- `sourceSuitability`: Official government lean and value-stream guidance supports process-mapping scope, observation, flow, and waste analysis; its environmental and production context requires careful adaptation to office work.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Observe one bounded workflow, map actors and handoffs, distinguish rules from judgment, record exceptions and rework, validate the current state with participants, and define requirements before automation.
- `originalVisual`: process-lane / workflow-exception-lane — represents information handoffs, a decision, an exception, and a rework loop across lanes.
- `toolkitContribution`: No mapped Toolkit worksheet; the verified workflow map and requirements packet remain guide-produced records.
- `claimRisks`: Process mapping can be mistaken for permission to automate sensitive decisions or for evidence that a workflow is stable, lawful, secure, or worth automating.
- `repetitionRisks`: This method overlaps the automation-candidate guide, but must stay focused on current-state truth and exception discovery before candidate scoring.
- `evidenceLimits`: EPA mapping guidance supports method concepts but does not validate the reader's observed steps, exception frequency, control requirements, or automation boundary.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the workflow-exception-lane tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1013 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove process truth, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: CONDITIONAL — the actual process owner and specialists for privacy, finance, HR, safety, security, or regulation must review sensitive workflow boundaries.
- `recommendation`: KEEP AS A DISCOVERY METHOD — retain the current-state emphasis and revise only after participants or specialists identify missing decisions, exceptions, or controls.
- `ownerAction`: Validate the method with a real process owner, review consequential decision points, and confirm rights for the workflow-lane visual.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 07: `evaluate-ai-output-quality-in-a-small-team-pilot`

- `slug`: evaluate-ai-output-quality-in-a-small-team-pilot
- `title`: How to evaluate AI output quality in a small-team pilot
- `category`: ai-automation
- `publicationStatus`: published
- `wordCount`: 1160
- `reader`: Small-business teams evaluating a bounded AI drafting, classification, extraction, or summarization use before operational rollout.
- `businessNeed`: A small team can mistake a few impressive AI examples for dependable performance because it has no defined cases, rubric, baseline, or stop rule.
- `guidePromise`: Test AI output against representative cases, a defined rubric, a baseline, and the real time required for human correction.
- `deliverable`: AI pilot scorecard with a go, revise, or stop recommendation.
- `whenToUse`: Use before expanding an AI drafting, extraction, classification, or summarization pilot into normal operations.
- `sourceUrls`: https://airc.nist.gov/airmf-resources/playbook/measure/ | https://airc.nist.gov/airmf-resources/playbook/manage/
- `sourceSuitability`: Official government AI risk framework guidance supports measurement, monitoring, response, and governance scope; it does not validate this rubric, sample, product, model, or result.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Define the task and baseline, freeze representative cases, score explicit criteria and harmful errors, measure correction effort, document exceptions, and apply a predeclared stop rule.
- `originalVisual`: comparison / ai-quality-scorecard — compares baseline and AI-assisted output across review criteria, harmful errors, correction effort, and stop conditions.
- `toolkitContribution`: No mapped Toolkit worksheet; the scorecard and recommendation are described records without a downloadable template.
- `claimRisks`: A small or unrepresentative sample can hide rare harmful errors, model drift, subgroup effects, confidentiality exposure, reviewer disagreement, or changing product behavior.
- `repetitionRisks`: Pilot controls overlap the 30-day pilot and automation-candidate guides; this article must remain specific to output-quality measurement and correction effort.
- `evidenceLimits`: NIST guidance supports evaluation discipline but supplies no evidence that a model, prompt, dataset, rubric, baseline, or observed score is adequate for the reader's use.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the ai-quality-scorecard tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1160 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove AI performance, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: YES — an AI evaluation and use-case domain expert should review sampling, rubric validity, harmful-error treatment, privacy, and the decision threshold.
- `recommendation`: KEEP WITH MEASUREMENT CAVEATS — retain the baseline-and-correction method while refusing any generalized quality claim not supported by a real, reviewed pilot.
- `ownerAction`: Have a domain expert inspect the proposed cases and rubric, verify source interpretation, and review the scorecard visual's rights before operational use.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 08: `evaluate-saas-with-a-practical-checklist`

- `slug`: evaluate-saas-with-a-practical-checklist
- `title`: How to evaluate SaaS with a practical checklist
- `category`: business-software
- `publicationStatus`: published
- `wordCount`: 1085
- `reader`: Small-business owners and operations leaders comparing a SaaS purchase that will hold important work or business data.
- `businessNeed`: A polished software demonstration can hide workflow gaps, weak controls, administrative burden, plan restrictions, and a costly exit path.
- `guidePromise`: Turn business requirements into test scenarios and verify workflow, security, data, administration, and exit claims before buying.
- `deliverable`: SaaS evidence sheet and documented buy, revise, or reject decision.
- `whenToUse`: Use during a trial, vendor demonstration, renewal review, or replacement decision for important business software.
- `sourceUrls`: https://www.cisa.gov/resources-tools/resources/choosing-secure-and-verifiable-technologies | https://www.cisa.gov/resources-tools/resources/assisting-small-and-medium-sized-businesses-assess-vendors-and-suppliers-fact-sheet | https://www.cisa.gov/sites/default/files/2024-08/SecureByDemandGuide_080624_508c.pdf
- `sourceSuitability`: Official government procurement and secure-product guidance supports evidence, supplier, control, and acquisition scope; it does not evaluate a specific SaaS plan, configuration, contract, or demonstration.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Convert outcomes and requirements into test scenarios, record evidence by exact plan and configuration, inspect administration and data controls, test exit, classify findings, and make a bounded decision.
- `originalVisual`: checklist / saas-evidence-checklist — organizes outcome, access, data, workflow, integrations, operating cost, and exit evidence.
- `toolkitContribution`: SaaS evaluation evidence sheet at /toolkit/saas-evaluation-evidence-sheet/ provides the plan-, configuration-, scenario-, and evidence-specific record described by the guide.
- `claimRisks`: Checklist completion can be mistaken for security assurance or contract acceptance when evidence is vendor-controlled, plan-specific, time-sensitive, incomplete, or not tested in the intended configuration.
- `repetitionRisks`: Data exit overlaps the lock-in guide and cost overlaps total-cost guidance; this article must stay a cross-functional acquisition evidence gate.
- `evidenceLimits`: CISA guidance supports buyer diligence but does not prove any vendor claim, service level, privacy term, control operation, integration, support quality, or portability result.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the saas-evidence-checklist tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1085 reader-visible Markdown prose words, three HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove vendor assurance, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: YES — security, privacy, legal, procurement, data, and operations specialists should review consequential evidence and contract-dependent claims.
- `recommendation`: KEEP AS A DUE-DILIGENCE SHELL — retain the evidence-first sequence, but never convert checklist completion into a product endorsement or assurance conclusion.
- `ownerAction`: Review the sheet with the actual buyer and relevant specialists, test a real plan and configuration, and clear visual and worksheet rights before use.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 09: `how-to-identify-business-tasks-for-automation`

- `slug`: how-to-identify-business-tasks-for-automation
- `title`: How to identify business tasks for automation
- `category`: ai-automation
- `publicationStatus`: published
- `wordCount`: 1597
- `reader`: Small-business decision makers selecting a first or next workflow to automate without a dedicated automation team.
- `businessNeed`: Small businesses can waste time automating visible annoyances before defining the task, exceptions, risks, or result that matters.
- `guidePromise`: Inventory recurring work, screen repeatability and risk, and select one bounded automation candidate with a human-owned fallback.
- `deliverable`: Ranked automation-candidate shortlist and one-page pilot brief.
- `whenToUse`: Use before comparing automation products or connecting AI tools to an existing business workflow.
- `sourceUrls`: https://airc.nist.gov/airmf-resources/airmf/5-sec-core/ | https://airc.nist.gov/airmf-resources/playbook/manage/ | https://www.nist.gov/itl/smallbusinesscyber/nist-cybersecurity-framework-0
- `sourceSuitability`: Official government AI and cybersecurity framework guidance supports risk, control, oversight, and fallback scope; it does not rank the reader's tasks or establish automation feasibility or return.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Inventory recurring tasks, reject unstable or high-consequence candidates, score repeatability and exception burden, identify data and controls, retain a human fallback, and draft one bounded pilot brief.
- `originalVisual`: decision-tree / automation-candidate-screen — filters unstable and high-risk work before a bounded, reversible pilot.
- `toolkitContribution`: Automation candidate screen at /toolkit/automation-candidate-screen/ records the proceed, revise, or reject decision for one bounded candidate.
- `claimRisks`: A qualitative screen may hide labor transfer, accessibility impact, worker surveillance, biased decisions, integration fragility, or total cost while implying objective ranking.
- `repetitionRisks`: Workflow mapping and pilot controls recur elsewhere; this guide must remain the portfolio-level candidate screen that precedes detailed mapping and testing.
- `evidenceLimits`: NIST frameworks support oversight principles but offer no measured task frequency, error rate, exception rate, feasibility, benefit, product performance, or workforce impact for the reader.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the automation-candidate-screen tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1597 reader-visible Markdown prose words, three HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove automation value, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: CONDITIONAL — process, security, privacy, accessibility, labor, or domain expertise is needed when a candidate affects people, sensitive data, money, rights, or critical operations.
- `recommendation`: KEEP AS A PRE-PILOT FILTER — retain the reject-first discipline while requiring real workflow evidence before ranking or selecting a candidate.
- `ownerAction`: Validate the screen against real task data and affected participants, review consequential candidates with specialists, and clear the decision-tree and worksheet rights.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 10: `onboard-employees-and-contractors-to-business-technology`

- `slug`: onboard-employees-and-contractors-to-business-technology
- `title`: How to onboard employees and contractors to business technology
- `category`: digital-operations
- `publicationStatus`: published
- `wordCount`: 1060
- `reader`: Small-business managers and administrators who provision technology for employees, contractors, temporary workers, or service providers.
- `businessNeed`: Rushed onboarding can create shared accounts, excessive access, unmanaged devices, undocumented exceptions, and no reliable way to remove access later.
- `guidePromise`: Provision role-based accounts, devices, access, and training while preserving the records needed for later changes or departure.
- `deliverable`: Technology onboarding checklist and approved-access record.
- `whenToUse`: Use before an employee, contractor, temporary worker, or service provider receives business-system access.
- `sourceUrls`: https://www.ftc.gov/business-guidance/resources/start-security-guide-business | https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
- `sourceSuitability`: Official government business-security guidance and a NIST control catalog support least privilege, account, device, training, and review scope; they do not define employment law or one universal onboarding process.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Begin with an approved role request, verify identity and engagement, provision named accounts and managed devices, grant minimum access, train, test first-day readiness, and preserve an offboarding-ready record.
- `originalVisual`: checklist / access-onboarding-checklist — moves from approved role through identity, device, access, training, readiness, and review.
- `toolkitContribution`: No mapped Toolkit worksheet; the onboarding checklist and approved-access record remain described outputs.
- `claimRisks`: Security guidance may be mistaken for complete HR, worker-classification, privacy, accessibility, device-ownership, labor, background-check, or contractual compliance.
- `repetitionRisks`: Account ownership and access review overlap MFA and shared-file guidance; this article must stay centered on the end-to-end joiner record.
- `evidenceLimits`: FTC and NIST materials support control principles but do not prove actual identity, role approval, device posture, completed training, access correctness, or employment compliance.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the access-onboarding-checklist tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1060 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove access correctness, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: YES — security, privacy, HR, accessibility, legal, and contracting review is needed where onboarding affects worker rights, regulated data, or managed devices.
- `recommendation`: KEEP AS A CONTROL CHECKLIST — retain the role-to-record sequence, but route employment, privacy, and legal decisions outside the article.
- `ownerAction`: Review the checklist with security and the actual people-process owner, test it against one role without real provisioning, and clear the visual's rights.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 11: `respond-to-a-suspected-phishing-message`

- `slug`: respond-to-a-suspected-phishing-message
- `title`: How to respond to a suspected phishing message
- `category`: cybersecurity-data-protection
- `publicationStatus`: published
- `wordCount`: 1092
- `reader`: Small-business employees, owners, and administrators who need an immediate, plain-language response to a suspicious email, text, call, or login page.
- `businessNeed`: Employees may act on urgency, verify through attacker-controlled contact details, or hide a mistake when the business lacks a clear phishing response route.
- `guidePromise`: Verify a suspicious request through a known channel and escalate containment based on clicks, credentials, payments, or exposed data.
- `deliverable`: Phishing response checklist and initial incident record.
- `whenToUse`: Use immediately after a suspicious email, text, call, attachment, login page, or payment request is received.
- `sourceUrls`: https://www.ftc.gov/business-guidance/small-businesses/cybersecurity | https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business
- `sourceSuitability`: Official government small-business cybersecurity and data-protection guidance supports verification, reporting, containment, and information-protection scope; it is not incident-specific response advice.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Pause interaction, preserve the message, verify through a known channel, report through the business route, classify exposure, contain proportionately, document initial facts, and escalate based on impact.
- `originalVisual`: workflow / phishing-response-workflow — branches from suspicion to reporting, known-channel verification, exposure classification, containment, and escalation.
- `toolkitContribution`: No mapped Toolkit worksheet; the immediate checklist and initial incident record are contained in the guide.
- `claimRisks`: General containment steps could destroy evidence, interrupt operations, delay mandatory notice, or be unsafe during active compromise if read as a substitute for an incident responder.
- `repetitionRisks`: Verification and access-control language overlaps MFA guidance; this article must remain a time-sensitive message-to-incident triage flow.
- `evidenceLimits`: FTC guidance supports protective principles but cannot determine whether a message is malicious, what was exposed, whether containment succeeded, or which legal and contractual notices apply.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the phishing-response-workflow tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1092 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove incident outcomes, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: YES — a security incident responder and, when data, money, people, or notice duties are implicated, legal, privacy, finance, or insurance specialists should review actions.
- `recommendation`: KEEP WITH INCIDENT ESCALATION EMPHASIS — retain the calm first-response flow while making every consequential action subordinate to the actual incident owner and specialist advice.
- `ownerAction`: Conduct a tabletop editorial review without using real incident data, confirm escalation language, and verify rights for the response-workflow visual.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 12: `roll-out-mfa-across-a-small-business`

- `slug`: roll-out-mfa-across-a-small-business
- `title`: How to roll out MFA across a small business
- `category`: cybersecurity-data-protection
- `publicationStatus`: published
- `wordCount`: 1008
- `reader`: Small-business owners and administrators improving sign-in security across email, file storage, finance, remote access, and other important services.
- `businessNeed`: A business can enable MFA unevenly, leave privileged accounts exposed, or create unsafe recovery shortcuts when enrollment is rushed.
- `guidePromise`: Prioritize critical accounts, protect recovery paths, stage enrollment, and verify that MFA is actually enforced.
- `deliverable`: Prioritized MFA rollout, recovery procedure, and coverage record.
- `whenToUse`: Use when introducing MFA, correcting uneven enrollment, or reviewing privileged and recovery-account protection.
- `sourceUrls`: https://www.cisa.gov/audiences/small-and-medium-businesses/secure-your-business/require-multifactor-authentication | https://csrc.nist.gov/pubs/sp/800/63/b/4/final
- `sourceSuitability`: Official government MFA guidance and NIST authentication guidance support prioritization, authenticator, recovery, and enforcement scope; provider-specific support and threat exposure still require verification.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Inventory critical accounts, secure administrators and recovery paths first, select supported authenticators, stage enrollment, document recovery, test access, verify enforcement, and track exceptions.
- `originalVisual`: security-boundary / mfa-rollout-boundary — prioritizes control-plane accounts and recovery paths before staged user enrollment and enforcement verification.
- `toolkitContribution`: No mapped Toolkit worksheet; the rollout, recovery procedure, and coverage record are guide-produced records.
- `claimRisks`: MFA can be portrayed as uniformly strong even though authenticator type, enrollment, recovery, session controls, phishing resistance, bypass paths, and provider implementation materially change protection.
- `repetitionRisks`: Account inventory and recovery controls overlap onboarding and phishing response; this guide must remain a staged authentication-control rollout.
- `evidenceLimits`: CISA and NIST support MFA principles but do not prove the reader's providers support desired methods, that every account is enrolled, or that recovery and enforcement work.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the mfa-rollout-boundary tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1008 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove MFA enforcement, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: YES — an identity and access specialist should review authenticator choices, privileged accounts, recovery, break-glass access, provider limits, and enforcement evidence.
- `recommendation`: KEEP WITH AUTHENTICATOR NUANCE — retain the staged rollout while revising any statement that treats all MFA or recovery methods as equivalent.
- `ownerAction`: Review the sequence against the actual provider inventory, perform a controlled recovery test with authorized accounts, and clear the boundary visual's rights.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 13: `run-a-30-day-business-technology-pilot`

- `slug`: run-a-30-day-business-technology-pilot
- `title`: How to run a 30‑day business technology pilot
- `category`: technology-strategy
- `publicationStatus`: published
- `wordCount`: 1036
- `reader`: Small-business decision makers evaluating a SaaS, automation, collaboration, security, or operations tool before a broader commitment.
- `businessNeed`: A trial can become an informal rollout when scope, users, data, measures, permissions, support, stop conditions, and ownership are left undefined.
- `guidePromise`: Run a controlled four-week technology test without allowing a trial to become production by default.
- `deliverable`: Pilot charter, evidence log, and documented go, revise, or stop decision.
- `whenToUse`: Use before a broader commitment to SaaS, automation, collaboration, security, or operational technology.
- `sourceUrls`: https://www.cisa.gov/sites/default/files/2024-07/PDM24050%20Software%20Acquisition%20Guide%20for%20Government%20Enterprise%20ConsumersV2_508c.pdf | https://www.cisa.gov/resources-tools/resources/choosing-secure-and-verifiable-technologies
- `sourceSuitability`: Official government acquisition and secure-technology guidance supports requirements, evidence, control, and supplier-evaluation scope; its government-enterprise context does not validate a 30-day duration or a specific pilot.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Write a charter and baseline, constrain users and data, sequence configuration and representative cases across four weeks, record support and exceptions, test export and fallback, reconcile evidence, and decide explicitly.
- `originalVisual`: timeline / thirty-day-pilot-timeline — sequences baseline, configuration, normal work, exceptions, export, reconciliation, and a final decision.
- `toolkitContribution`: No mapped Toolkit worksheet; the charter, evidence log, and decision record remain described outputs.
- `claimRisks`: Thirty days may be too short or unnecessarily long, and a controlled pilot may miss seasonality, scale, rare failures, accessibility issues, vendor change, migration effort, or long-term support burden.
- `repetitionRisks`: Evidence logs and stop rules overlap AI evaluation and SaaS selection; this guide must remain the general time-bounded experiment wrapper.
- `evidenceLimits`: CISA guidance supports acquisition discipline but provides no evidence that four weeks, the proposed sample, measures, participants, data, or decision threshold are adequate.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the thirty-day-pilot-timeline tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1036 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove pilot validity, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: CONDITIONAL — procurement, security, privacy, accessibility, data, finance, and use-case experts should review a consequential pilot's scope and evidence.
- `recommendation`: KEEP AS A CONTROLLED-TRIAL TEMPLATE — retain the no-default-production rule while treating duration, sample, and decision criteria as context-dependent.
- `ownerAction`: Review the timeline with the real sponsor and affected users, verify measures and stop conditions, and confirm rights for the pilot visual.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 14: `test-data-export-and-integrations-before-saas-lock-in`

- `slug`: test-data-export-and-integrations-before-saas-lock-in
- `title`: Test data export and integrations before SaaS lock-in
- `category`: business-software
- `publicationStatus`: published
- `wordCount`: 1113
- `reader`: Small-business owners and technical operators evaluating a new SaaS service or reducing dependence on an existing one.
- `businessNeed`: A business can discover too late that its SaaS data is incomplete outside the product, difficult to migrate, or tied to fragile integrations.
- `guidePromise`: Export representative data and test critical integrations before dependence grows and migration becomes expensive.
- `deliverable`: Portability test record, dependency map, and exit-effort estimate.
- `whenToUse`: Use before selecting, renewing, or deeply integrating a SaaS product that will hold important business records.
- `sourceUrls`: https://csrc.nist.gov/pubs/sp/800/146/final | https://www.nist.gov/itl/cloud/upload/nist_sp-500-291_version-2_2013_june18_final.pdf
- `sourceSuitability`: Official government cloud guidance and a standards roadmap support portability, interoperability, data, and dependency scope; the older roadmap does not prove a current vendor export or integration capability.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Define critical records and authoritative systems, export representative data and attachments, validate completeness and meaning, trace integrations and credentials, estimate migration effort, and maintain an exit runbook.
- `originalVisual`: data-flow / saas-exit-data-flow — traces records, files, identity, and integrations through export, interpretation, dependency, and exit.
- `toolkitContribution`: No mapped Toolkit worksheet; the portability record, dependency map, estimate, and runbook are described outputs.
- `claimRisks`: A successful sample export may imply broad portability while omitting hidden objects, metadata, permissions, histories, attachments, API limits, identity dependencies, deletion duties, or destination import behavior.
- `repetitionRisks`: Exit checks overlap SaaS evaluation and total-cost guidance; this article must stay focused on technically exercising data and integration dependence.
- `evidenceLimits`: NIST cloud materials establish interoperability concerns but do not test a current service, export format, API, integration, contract, migration tool, or deletion process.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the saas-exit-data-flow tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1113 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove portability, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: YES — data architecture, security, privacy, legal, integration, and records specialists should review critical exports, credentials, dependencies, deletion, and migration evidence.
- `recommendation`: KEEP WITH SAMPLE-TO-SCOPE DISCIPLINE — retain the hands-on portability method but never generalize one representative export beyond the records and integrations tested.
- `ownerAction`: Have a technical owner inspect the test design without exposing private data, review dated source relevance, and verify rights for the data-flow visual.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

## Guide 15: `write-a-practical-ai-acceptable-use-policy`

- `slug`: write-a-practical-ai-acceptable-use-policy
- `title`: How to write a practical AI acceptable‑use policy
- `category`: ai-automation
- `publicationStatus`: published
- `wordCount`: 1126
- `reader`: Small-business owners and operations leaders creating a first internal AI policy without a dedicated AI governance department.
- `businessNeed`: Employees may use generative AI before the business has defined approved data, review duties, prohibited decisions, or incident reporting.
- `guidePromise`: Define which AI tools, data, and use cases are allowed, restricted, or prohibited before employees begin using them.
- `deliverable`: Short AI acceptable-use policy draft with approval and reporting duties.
- `whenToUse`: Use when employees are already experimenting with AI or before the business authorizes broader AI use.
- `sourceUrls`: https://airc.nist.gov/airmf-resources/playbook/govern/ | https://www.nist.gov/itl/ai-risk-management-framework/ai-risk-management-framework-resources
- `sourceSuitability`: Official government AI governance framework guidance supports policy, role, risk, review, and reporting scope; it is not legal advice or a complete policy for a particular employer or jurisdiction.
- `sourceLastChecked`: UNKNOWN
- `originalMethod`: Define scope and terms, classify tools, data, and uses, set approvals and prohibited decisions, specify human review by consequence, address records and intellectual property, create incident reporting, and assign policy ownership.
- `originalVisual`: governance / ai-use-governance — separates allowed, restricted, and prohibited uses around approved tools, data boundaries, human review, and reporting.
- `toolkitContribution`: No mapped Toolkit worksheet; the short policy draft and approval and reporting duties are guide-produced records.
- `claimRisks`: A general template may be mistaken for legally complete employment, privacy, intellectual-property, records, discrimination, sector, contracting, or cross-border AI policy.
- `repetitionRisks`: Data limits, human review, stop authority, and evidence recur in AI evaluation and automation guidance; this article must remain an internal governance document.
- `evidenceLimits`: NIST resources support governance concepts but do not determine applicable law, contract terms, approved tools, data classification, worker duties, enforcement, or policy effectiveness.
- `mediaRights`: OWNER RIGHTS REVIEW REQUIRED — automation validates the ai-use-governance tuple but does not establish authorship, license, or publication rights.
- `automationReview`: Repository-observable checks cover published schema, 1126 reader-visible Markdown prose words, two HTTPS source records, cited URLs, visual shape, and route eligibility; this does not prove policy sufficiency, rights, or human acceptance.
- `humanEditorialReview`: OWNER REVIEW REQUIRED
- `expertReviewNeeded`: YES — AI governance, privacy, security, employment, intellectual-property, records, accessibility, and sector specialists should review policy terms applicable to the operator.
- `recommendation`: KEEP ONLY AS A DRAFTING FRAMEWORK — retain the practical structure while stating clearly that qualified review and owner approval are required before adoption.
- `ownerAction`: Route the draft through the actual policy owner and relevant specialists, verify each source interpretation, and clear the governance visual's publication rights.
- `reviewedBy`:
- `reviewedAt`:
- `releaseGate`: owner-action — Human editorial, expert-when-needed, source-recency, and media-rights evidence remain unresolved for this guide. Evidence: docs/OWNER_INPUTS_REQUIRED.md Gates 09–11 and this guide's ownerAction field.

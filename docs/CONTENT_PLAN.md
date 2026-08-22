# Initial Content Plan

**Publication:** Everyday Tech Insight

**Planning date:** 2026-08-21

**Launch target:** 15 source-checked articles, three in each of five categories
**Human review:** Not yet claimed; see `HUMAN_REVIEW_CHECKLIST.md`

The working slate was established in the approved design and implementation plan before bulk drafting. This file is the durable expanded planning record finalized with the source-checked portfolio. It does not claim that a human owner reviewed the plan or the resulting articles.

## Portfolio decisions

- All entries are evergreen implementation, decision, comparison, checklist, or framework content. There is no news content and no dependency on short-lived pricing.
- The initial 15 candidate topics were retained because each answered a distinct reader question and passed the five-part Business Technology Fit Test.
- “How to Pilot an AI Tool” was narrowed to evaluating AI output quality. The separate strategy article owns the general 30-day technology-pilot question, avoiding search-intent duplication.
- No owner columns were created because no genuine owner notes, biography, or personal experience were supplied.
- Every public source is an official government page, official standards publication page, or first-party vendor category definition. Vendor pages are used only to define CRM and project-management categories, not to substantiate comparative performance.
- All entries use the genuine launch date `2026-08-21`, omit `dateModified`, and use `source-checked` rather than `tested`.

## AI & Automation

### 1. How to identify business tasks for automation

- **Primary reader question / search intent:** Which recurring business tasks are suitable for automation, and how should a first candidate be selected? Informational and decision-support intent.
- **Business problem / technology focus:** Teams automate visible annoyances without a stable task boundary. The article covers rule-based, transformation, and AI-assisted workflows with review and rollback.
- **Audience / outcome:** Small-business decision makers; produce a ranked candidate list and a one-page pilot brief.
- **Format / category:** Framework; AI & Automation.
- **Site fit and additional value:** Connects operational pain to a risk-aware technology decision. Separates value from suitability and adds a veto for consequential, sensitive, irreversible, or untestable work.
- **Sources:** NIST AI RMF Core, NIST AI RMF Playbook Manage, and NIST CSF 2.0 small-business resources. No secondary source is required.
- **Time sensitivity / verification:** Low-to-medium. Recheck NIST framework status and links during material updates. Source-checked; final owner review required.
- **Overlap boundary:** Selects the task. It does not replace the detailed process-mapping guide or the AI-output evaluation guide.
- **Internal links / status:** AI output evaluation and workflow documentation; `published`.

### 2. How to write a practical AI acceptable-use policy

- **Primary reader question / search intent:** What should a small-team AI use policy allow, restrict, prohibit, and assign? Implementation intent.
- **Business problem / technology focus:** Staff may use generative AI without approved tools, data limits, review duties, or reporting. The technology focus is governance of generative AI services and integrations.
- **Audience / outcome:** Owners and operations leaders; draft a usable policy plus an approved-tool register.
- **Format / category:** Framework; AI & Automation.
- **Site fit and additional value:** Turns broad responsible-use language into decisions employees can make before entering data or releasing output.
- **Sources:** NIST AI RMF Playbook Govern and NIST AI RMF resources, including the Generative AI Profile. No secondary source is required.
- **Time sensitivity / verification:** Medium because AI tools and NIST materials can change. Recheck tool terms separately before adoption. Source-checked; legal, privacy, security, and owner review required.
- **Overlap boundary:** Governs use. It does not score output quality or select an automation candidate.
- **Internal links / status:** AI output evaluation and automation-candidate selection; `published`.

### 3. How to evaluate AI output quality in a small-team pilot

- **Primary reader question / search intent:** How can a small team test whether AI output is dependable for one business task? Evaluation intent.
- **Business problem / technology focus:** A few impressive examples can be mistaken for repeatable performance. The article covers representative cases, rubrics, baselines, critical failures, and review labor.
- **Audience / outcome:** Teams piloting AI drafting, classification, extraction, or summarization; create an evaluation set and go, revise, or stop record.
- **Format / category:** Guide; AI & Automation.
- **Site fit and additional value:** Makes evaluation evidence legible to a non-specialist without claiming a tiny pilot proves general reliability.
- **Sources:** NIST AI RMF Playbook Measure and Manage. No secondary source is required.
- **Time sensitivity / verification:** Medium. Recheck NIST framework status and re-run evaluation after material system changes. Source-checked methodology; no product was tested.
- **Overlap boundary:** Measures one AI workflow. The 30-day strategy article owns the general pilot calendar and procurement decision.
- **Internal links / status:** AI policy and automation-candidate selection; `published`.

## Business Software & SaaS

### 4. CRM vs. project-management software: choose by work object

- **Primary reader question / search intent:** Does the business need a CRM, a project-management system, or a controlled handoff between them? Comparison intent.
- **Business problem / technology focus:** Both categories expose tasks, owners, dates, files, and reports. The comparison uses the durable work object and system-of-record boundary.
- **Audience / outcome:** Small-business leaders; map the lifecycle and avoid maintaining the same record in two systems.
- **Format / category:** Comparison; Business Software & SaaS.
- **Site fit and additional value:** Replaces generic feature comparison with a work-object and handoff decision.
- **Sources:** Salesforce first-party CRM definition, Atlassian first-party project-management definition, and CISA secure-technology procurement guidance. Vendor sources define categories only.
- **Time sensitivity / verification:** Medium for vendor wording and plan behavior, low for the decision model. Source-checked; current product features and pricing remain unverified.
- **Overlap boundary:** Chooses the category and record boundary. It does not perform full SaaS due diligence or an exit rehearsal.
- **Internal links / status:** SaaS evaluation and portability test; `published`.

### 5. How to evaluate SaaS with a practical checklist

- **Primary reader question / search intent:** What should a small business verify before purchasing important SaaS? Commercial investigation and checklist intent.
- **Business problem / technology focus:** Demonstrations can hide workflow, security, administrative, plan, and exit gaps. The article uses scenario tests and evidence labels.
- **Audience / outcome:** Owners and operations leaders; create gated requirements and a defensible buy, revise, or reject record.
- **Format / category:** Checklist; Business Software & SaaS.
- **Site fit and additional value:** Integrates workflow, administration, security, accessibility, cost, and exit rather than treating procurement as a feature score.
- **Sources:** CISA Choosing Secure and Verifiable Technologies, CISA SMB vendor-assessment guidance, and CISA Secure by Demand Guide. No secondary source is required.
- **Time sensitivity / verification:** Medium. Provider plan, contract, data, security, and accessibility evidence must be checked for the actual purchase. Source-checked; no SaaS service was tested.
- **Overlap boundary:** Owns full acquisition due diligence. The portability article drills into export and integrations; the TCO article owns cost modeling.
- **Internal links / status:** CRM comparison and portability test; `published`.

### 6. Test data export and integrations before SaaS lock-in

- **Primary reader question / search intent:** Can the business retrieve usable data and keep critical workflows operating if it changes SaaS providers? Evaluation intent.
- **Business problem / technology focus:** An export button can omit relationships, attachments, history, or configuration. The article covers portability, APIs, reconciliation, failure, and exit runbooks.
- **Audience / outcome:** Owners and technical operators; run a representative exit rehearsal and estimate migration work.
- **Format / category:** Guide; Business Software & SaaS.
- **Site fit and additional value:** Converts vendor-lock-in concern into a concrete export, interpretation, integration-failure, and contract test.
- **Sources:** NIST SP 800-146 and NIST SP 500-291. No secondary source is required.
- **Time sensitivity / verification:** Medium because APIs, plans, terms, and formats change. Source-checked; an actual provider export must be tested before a purchase or renewal decision.
- **Overlap boundary:** Owns portability evidence. It does not replace the broad SaaS checklist or full cost model.
- **Internal links / status:** SaaS evaluation and total-cost model; `published`.

## Cybersecurity & Data Protection

### 7. How to roll out MFA across a small business

- **Primary reader question / search intent:** How should a small business prioritize, enroll, recover, and verify MFA? Implementation intent.
- **Business problem / technology focus:** Uneven enrollment can leave administrators and recovery paths exposed. The article covers phishing-resistant methods, staged rollout, and coverage evidence.
- **Audience / outcome:** Owners and administrators; create a prioritized rollout and verified exception list.
- **Format / category:** Guide; Cybersecurity & Data Protection.
- **Site fit and additional value:** Treats MFA as an account and recovery program, not a settings screenshot.
- **Sources:** CISA small-business MFA guidance and NIST SP 800-63B-4. No secondary source is required.
- **Time sensitivity / verification:** Medium because authentication guidance and service support change. Source-checked; no assurance-level claim is made.
- **Overlap boundary:** Preventive identity control. The onboarding article owns provisioning workflow; the phishing article owns incident response.
- **Internal links / status:** Backup implementation and phishing response; `published`.

### 8. How to back up business files with the 3-2-1 method

- **Primary reader question / search intent:** How can a small business implement and prove a recoverable 3-2-1 backup plan? Implementation intent.
- **Business problem / technology focus:** Sync can be mistaken for backup. The article covers independent copies, protected access, recovery objectives, and restore testing.
- **Audience / outcome:** Owners and administrators; create a backup inventory and documented representative restore.
- **Format / category:** Guide; Cybersecurity & Data Protection.
- **Site fit and additional value:** Makes recovery evidence and shared-failure analysis central rather than repeating the numeric rule alone.
- **Sources:** CISA Data Backup Options and NIST SP 800-184. No secondary source is required.
- **Time sensitivity / verification:** Low-to-medium. Recheck source status and test the selected backup system. Source-checked; no restoration was performed for this publication.
- **Overlap boundary:** Owns resilient copies and recovery. The file-system article owns organization and the risk register owns governance prioritization.
- **Internal links / status:** MFA rollout and shared file system; `published`.

### 9. How to respond to a suspected phishing message

- **Primary reader question / search intent:** What should an employee or owner do immediately after receiving, clicking, or responding to a suspicious message? Incident-response intent.
- **Business problem / technology focus:** Urgency and attacker-controlled verification routes lead to preventable harm. The article covers independent checks, containment, evidence, and escalation.
- **Audience / outcome:** Employees, owners, and administrators; follow a proportionate first-response path.
- **Format / category:** Guide; Cybersecurity & Data Protection.
- **Site fit and additional value:** Branches actions by exposure level instead of offering recognition tips alone.
- **Sources:** FTC Cybersecurity for Small Business and FTC Protecting Personal Information. No secondary source is required.
- **Time sensitivity / verification:** Medium because reporting routes and service recovery steps can change. Source-checked; incident-specific professional help may be required.
- **Overlap boundary:** Owns first response after suspicion or exposure. The MFA and backup guides own preventative and recovery controls.
- **Internal links / status:** MFA rollout and backup implementation; `published`.

## Digital Operations & Productivity

### 10. How to create a shared file and folder system

- **Primary reader question / search intent:** How should a team organize shared files so another authorized person can find and maintain them? Implementation intent.
- **Business problem / technology focus:** Files are fragmented across people and ambiguous names. The article covers a file plan, hierarchy, naming, permissions, migration, and maintenance.
- **Audience / outcome:** Small teams moving from informal storage; create a shallow shared structure and governance record.
- **Format / category:** Guide; Digital Operations & Productivity.
- **Site fit and additional value:** Connects information architecture with access, lifecycle, migration, and ownership.
- **Sources:** National Archives naming guidance and file-plan template. Their federal context is disclosed; no private-sector retention rule is inferred.
- **Time sensitivity / verification:** Low. Storage-platform behavior and legal retention require separate current verification. Source-checked.
- **Overlap boundary:** Owns file organization. The backup guide owns recovery and onboarding owns user access.
- **Internal links / status:** Technology onboarding and backup implementation; `published`.

### 11. How to onboard employees and contractors to business technology

- **Primary reader question / search intent:** What technology access, devices, training, and evidence should be ready for a new worker? Checklist intent.
- **Business problem / technology focus:** Rushed provisioning creates shared accounts, excessive access, and offboarding gaps. The article covers role templates, least privilege, devices, training, and review.
- **Audience / outcome:** Managers and administrators; produce a repeatable onboarding and future offboarding record.
- **Format / category:** Checklist; Digital Operations & Productivity.
- **Site fit and additional value:** Treats onboarding as a recoverable identity and operations process, not an application list.
- **Sources:** FTC Start with Security and NIST SP 800-53 Rev. 5. No formal control-compliance claim is made.
- **Time sensitivity / verification:** Medium because systems, contracts, and legal duties change. Source-checked; HR, legal, privacy, accessibility, and security review may be required.
- **Overlap boundary:** Owns provisioning and readiness. MFA covers authentication rollout and the file-system guide covers information architecture.
- **Internal links / status:** Shared file system and MFA rollout; `published`.

### 12. Document a repetitive workflow before automating it

- **Primary reader question / search intent:** How should a process owner map current work before selecting automation? Implementation and planning intent.
- **Business problem / technology focus:** Automation can encode an idealized process while hiding exceptions. The article covers observation, decisions, information flow, controls, and test-case creation.
- **Audience / outcome:** Process owners; create an accepted current-state map and automation requirements packet.
- **Format / category:** Framework; Digital Operations & Productivity.
- **Site fit and additional value:** Connects process discipline to later technology selection and exposes unresolved judgment as a blocker.
- **Sources:** EPA Lean and Environment Toolkit Appendix A and EPA E3 Value Stream Mapping How-to Guide. Their Lean/environmental context is disclosed.
- **Time sensitivity / verification:** Low. The actual workflow must be re-observed when operations change. Source-checked.
- **Overlap boundary:** Documents the current process. The AI automation article chooses candidates and the strategy pilot tests a selected tool.
- **Internal links / status:** Automation-candidate selection and 30-day pilot; `published`.

## Technology Decisions & Strategy

### 13. How to calculate the total cost of business software

- **Primary reader question / search intent:** What costs beyond subscription price belong in a software comparison? Commercial investigation and decision intent.
- **Business problem / technology focus:** Implementation, labor, add-ons, change, risk, and exit are often excluded. The article covers a transparent scenario-based cost range.
- **Audience / outcome:** Decision makers; produce traceable year-one, run-rate, and full-period cost ranges.
- **Format / category:** Framework; Technology Decisions & Strategy.
- **Site fit and additional value:** Separates cash, loaded internal labor, assumptions, and exit instead of presenting a false single-number forecast.
- **Sources:** Digital.gov Estimate Burden and NIST SP 800-146. No secondary source is required.
- **Time sensitivity / verification:** Medium because quotes, contracts, labor, and plans change. Source-checked framework; all real pricing must be rechecked.
- **Overlap boundary:** Owns economics. The SaaS checklist owns due diligence and the portability article owns exit evidence.
- **Internal links / status:** SaaS evaluation and portability test; `published`.

### 14. How to run a 30-day business technology pilot

- **Primary reader question / search intent:** How can a small business time-box a new technology evaluation without drifting into production? Implementation intent.
- **Business problem / technology focus:** Trials lack scope, measures, controls, and an end decision. The article provides a week-by-week controlled pilot.
- **Audience / outcome:** Decision makers evaluating SaaS, automation, collaboration, security, or operations tools; produce a go, revise, or stop packet.
- **Format / category:** Guide; Technology Decisions & Strategy.
- **Site fit and additional value:** Integrates business baseline, secure procurement, exception testing, export, cost, and closure.
- **Sources:** CISA Software Acquisition Guide and CISA Choosing Secure and Verifiable Technologies. No secondary source is required.
- **Time sensitivity / verification:** Medium. Candidate evidence must be current and the pilot must actually run. Source-checked methodology; no pilot outcome is claimed.
- **Overlap boundary:** Owns the general four-week pilot. AI output evaluation owns AI-specific cases and rubrics.
- **Internal links / status:** Total-cost model and workflow documentation; `published`.

### 15. How to create a simple technology risk register

- **Primary reader question / search intent:** How can a small business record and prioritize technology risk without an enterprise platform? Framework intent.
- **Business problem / technology focus:** Vague concerns or uniform red ratings do not support decisions. The article covers risk statements, evidence, owners, responses, and review.
- **Audience / outcome:** Owners and technology decision makers; maintain a small register that changes action.
- **Format / category:** Framework; Technology Decisions & Strategy.
- **Site fit and additional value:** Connects technology conditions to business objectives and keeps uncertainty visible.
- **Sources:** NIST IR 8286 Rev. 1 and NIST Cybersecurity Framework. No secondary source is required.
- **Time sensitivity / verification:** Medium because NIST materials and business conditions evolve. Source-checked; formal assessment may require a specialist.
- **Overlap boundary:** Owns portfolio governance. Other guides supply treatment evidence but do not replace the register.
- **Internal links / status:** Total-cost model and 30-day pilot; `published`.

## Duplication review result

The final slate has one clear owner for each reader question: candidate selection, AI use policy, AI output evaluation, system-category choice, SaaS due diligence, portability, MFA, backup, phishing response, file organization, workforce onboarding, workflow mapping, total cost, general pilot execution, and risk governance. Cross-links connect adjacent decisions; they are not artificial article splits.

All 15 entries remain subject to the unchecked human-review gate. Publication status here means they pass the automated source-checked content contract, not that an owner, lawyer, security specialist, accountant, accessibility specialist, or domain expert has approved them.

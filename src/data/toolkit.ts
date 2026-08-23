export const TOOLKIT_RESOURCE_IDS = [
  "automation-candidate-screen",
  "saas-evaluation-evidence-sheet",
  "technology-risk-register",
  "backup-restore-test-log",
] as const;

export type ToolkitResourceId = (typeof TOOLKIT_RESOURCE_IDS)[number];

export interface ToolkitFieldDefinition {
  name: string;
  guidance: string;
}

export interface ToolkitResource {
  id: ToolkitResourceId;
  title: string;
  outcome: string;
  purpose: string;
  intendedAudience: string;
  whenToUse: readonly string[];
  whenNotToUse: readonly string[];
  limitation: string;
  dataNotice: string;
  detailHref: `/toolkit/${ToolkitResourceId}/`;
  articleSlug: string;
  guideHref: `/articles/${string}/`;
  guideLabel: string;
  downloadHref: `/toolkit/${string}.csv`;
  downloadLabel: string;
  csvHeaders: readonly string[];
  fields: readonly ToolkitFieldDefinition[];
}

const dataNotice =
  "Never put passwords, tokens, recovery keys, authentication secrets, or raw confidential data in this worksheet. Record only the minimum necessary reference, custodian, approved storage location, or access procedure, and protect completed copies under the referenced data's access, retention, and secure disposal rules.";

export const toolkitResources = [
  {
    id: "automation-candidate-screen",
    title: "Automation candidate screen",
    outcome:
      "A documented proceed, revise, or reject decision for one bounded automation candidate.",
    purpose:
      "Compare repeatability, exception burden, failure impact, review needs, and fallback readiness before selecting a task for a pilot.",
    intendedAudience:
      "Small-team process owners and decision makers choosing a first bounded workflow to examine for automation.",
    whenToUse: [
      "Before choosing a task for an automation pilot.",
      "When a team can describe the current process with representative frequency, effort, exception, and consequence evidence.",
    ],
    whenNotToUse: [
      "When the current workflow is undocumented or still changing too quickly to describe consistently.",
      "As approval to automate a high-consequence decision or as proof that a proposed control works.",
    ],
    limitation:
      "This blank editorial template does not complete the assessment, validate supplied evidence, approve a tool, or prove that automation is safe or worthwhile.",
    dataNotice,
    detailHref: "/toolkit/automation-candidate-screen/",
    articleSlug: "how-to-identify-business-tasks-for-automation",
    guideHref: "/articles/how-to-identify-business-tasks-for-automation/",
    guideLabel: "Read the automation-candidate guide",
    downloadHref: "/toolkit/automation-candidate-screen.csv",
    downloadLabel: "Download automation screen CSV",
    csvHeaders: [
      "Task",
      "Process owner",
      "Monthly frequency",
      "Active minutes per run",
      "Input stability",
      "Rule stability",
      "Exception and rework evidence",
      "Failure consequence",
      "Sensitive data and access boundary",
      "Human review point",
      "Manual fallback",
      "Pilot decision",
      "Evidence owner",
      "Review date",
    ],
    fields: [
      {
        name: "Task and process owner",
        guidance:
          "Name one bounded unit of work and the person accountable for the current process.",
      },
      {
        name: "Frequency and active time",
        guidance:
          "Record observed volume and hands-on time using a representative period.",
      },
      {
        name: "Input and rule stability",
        guidance:
          "Describe whether inputs are structured and rules remain consistent across normal cases.",
      },
      {
        name: "Exceptions and rework",
        guidance:
          "Count common exceptions, corrections, escalations, and cases that require judgment.",
      },
      {
        name: "Failure consequence",
        guidance:
          "State what can happen if the task is delayed, wrong, duplicated, exposed, or silently skipped.",
      },
      {
        name: "Data and access boundary",
        guidance:
          "Identify sensitive inputs, approved systems, permissions, retention, and prohibited data.",
      },
      {
        name: "Human review and fallback",
        guidance:
          "Name the review point and a usable manual path if the automated step fails.",
      },
      {
        name: "Pilot decision",
        guidance:
          "Record proceed, revise, or reject with the evidence and owner for the next action.",
      },
    ],
  },
  {
    id: "saas-evaluation-evidence-sheet",
    title: "SaaS evaluation evidence sheet",
    outcome:
      "A reviewable evidence record for the exact plan, configuration, and scenarios evaluated.",
    purpose:
      "Turn requirements into test scenarios and retain what was observed on the plan the business would actually purchase.",
    intendedAudience:
      "Small-business evaluators, process owners, and decision makers comparing a SaaS product against defined requirements.",
    whenToUse: [
      "Before a purchase, renewal, migration, or material expansion of a SaaS product.",
      "When the team can check representative scenarios on the relevant plan, role, configuration, integration, and data scope.",
    ],
    whenNotToUse: [
      "When a marketing page or demonstration is the only available evidence for the required configuration.",
      "As a product certification, a guarantee of future behavior, or a substitute for qualified review where consequences require it.",
    ],
    limitation:
      "This blank editorial template records scoped evidence; it does not independently verify vendor claims, predict future service behavior, or make the purchase decision.",
    dataNotice,
    detailHref: "/toolkit/saas-evaluation-evidence-sheet/",
    articleSlug: "evaluate-saas-with-a-practical-checklist",
    guideHref: "/articles/evaluate-saas-with-a-practical-checklist/",
    guideLabel: "Read the SaaS evaluation guide",
    downloadHref: "/toolkit/saas-evaluation-evidence-sheet.csv",
    downloadLabel: "Download SaaS evidence CSV",
    csvHeaders: [
      "Requirement",
      "Priority",
      "Test scenario",
      "Acceptance condition",
      "Purchased plan",
      "Configuration and role",
      "Observed evidence",
      "Result",
      "Limitation",
      "Implementation effort",
      "Exit impact",
      "Follow-up owner",
      "Due date",
    ],
    fields: [
      {
        name: "Requirement and priority",
        guidance:
          "Write one business requirement and classify it as a gate, must-have, or useful option.",
      },
      {
        name: "Test scenario",
        guidance:
          "Describe a representative action and the result that would count as acceptable.",
      },
      {
        name: "Purchased plan and configuration",
        guidance:
          "Record the exact plan, role, settings, integration, and data scope used for the check.",
      },
      {
        name: "Observed evidence",
        guidance:
          "Link or describe the output, export, log, permission screen, timing, or other reviewable evidence.",
      },
      {
        name: "Result and limitation",
        guidance:
          "Record pass, partial, fail, or unverified and explain the boundary of the observation.",
      },
      {
        name: "Implementation effort",
        guidance:
          "Capture setup, migration, training, administration, support, and recurring review work.",
      },
      {
        name: "Exit impact",
        guidance:
          "Record export format, completeness, dependencies, retention, and the likely effort to leave.",
      },
      {
        name: "Owner and follow-up",
        guidance:
          "Assign unresolved evidence, a due date, and the person who can accept or reject the result.",
      },
    ],
  },
  {
    id: "technology-risk-register",
    title: "Technology risk register",
    outcome:
      "A dated risk record connecting a specific event and consequence to evidence, response, owner, and review.",
    purpose:
      "Connect a technology condition to a business consequence, accountable response, and dated evidence review.",
    intendedAudience:
      "Small-business owners, managers, and process owners who maintain and review technology risk decisions.",
    whenToUse: [
      "When a technology event or condition could affect a named business process, asset, service, or obligation.",
      "During a periodic review of safeguards, open actions, evidence, uncertainty, and accountable ownership.",
    ],
    whenNotToUse: [
      "For one-word risk topics that do not identify an event and business consequence.",
      "As a substitute for incident response, legal advice, security assessment, or a scale defined for the actual business context.",
    ],
    limitation:
      "This blank editorial template does not determine likelihood or impact, validate safeguards, replace specialist review, or prove that recorded treatment is effective.",
    dataNotice,
    detailHref: "/toolkit/technology-risk-register/",
    articleSlug: "create-a-simple-technology-risk-register",
    guideHref: "/articles/create-a-simple-technology-risk-register/",
    guideLabel: "Read the technology-risk guide",
    downloadHref: "/toolkit/technology-risk-register.csv",
    downloadLabel: "Download technology risk CSV",
    csvHeaders: [
      "Risk event",
      "Business consequence",
      "Affected process or asset",
      "Existing safeguards",
      "Likelihood rating",
      "Likelihood basis",
      "Impact rating",
      "Impact basis",
      "Evidence and uncertainty",
      "Response",
      "Target state",
      "Owner",
      "Due date",
      "Review outcome",
      "Next review date",
    ],
    fields: [
      {
        name: "Risk event and consequence",
        guidance:
          "Write a specific event-to-business-impact statement rather than a one-word topic.",
      },
      {
        name: "Affected process or asset",
        guidance:
          "Name the workflow, information, system, customer service, or obligation at risk.",
      },
      {
        name: "Existing safeguards",
        guidance:
          "List controls that are actually in place and the evidence that they operate.",
      },
      {
        name: "Likelihood and impact",
        guidance:
          "Use the business's defined scales and record the basis for each rating.",
      },
      {
        name: "Evidence and uncertainty",
        guidance:
          "Link observations, incidents, tests, contracts, logs, or gaps; do not hide unknowns.",
      },
      {
        name: "Response and target state",
        guidance:
          "Choose avoid, reduce, transfer, accept, or investigate and describe the intended change.",
      },
      {
        name: "Owner and due date",
        guidance:
          "Assign one accountable owner and a date appropriate to the consequence and workload.",
      },
      {
        name: "Review outcome",
        guidance:
          "Record movement, residual concern, accepted evidence, next review date, and escalation need.",
      },
    ],
  },
  {
    id: "backup-restore-test-log",
    title: "Backup restore-test log",
    outcome:
      "A scoped restore-test record from recovery request through validation, gaps, corrective action, and retest.",
    purpose:
      "Record a controlled restoration from request through validation so a green backup job is not mistaken for proven recovery.",
    intendedAudience:
      "Small-team staff and accountable owners planning, conducting, reviewing, or following up a controlled backup restoration test.",
    whenToUse: [
      "During a planned restoration test using a defined data set, recovery point, backup copy, and controlled destination.",
      "When documenting timing, active effort, validation, missing items, dependencies, corrective action, and retest ownership.",
    ],
    whenNotToUse: [
      "When the restore destination could overwrite or expose live business data.",
      "As proof of broad recovery readiness beyond the scoped test or as a place to store passwords, tokens, or recovery keys.",
    ],
    limitation:
      "This blank editorial log records a scoped test; it does not perform a restore, verify untested systems or scenarios, certify recovery, or guarantee a future result.",
    dataNotice,
    detailHref: "/toolkit/backup-restore-test-log/",
    articleSlug: "back-up-business-files-with-the-3-2-1-method",
    guideHref: "/articles/back-up-business-files-with-the-3-2-1-method/",
    guideLabel: "Read the backup and restore guide",
    downloadHref: "/toolkit/backup-restore-test-log.csv",
    downloadLabel: "Download restore-test log CSV",
    csvHeaders: [
      "Protected data",
      "Recovery point",
      "Backup copy",
      "Failure scenario",
      "Restore destination",
      "Request time",
      "Start time",
      "Completion time",
      "Active effort",
      "Validation method",
      "Result",
      "Missing items and errors",
      "Recovery dependencies",
      "Corrective action",
      "Owner",
      "Retest date",
    ],
    fields: [
      {
        name: "Protected data and recovery point",
        guidance:
          "Name the scoped data set, authoritative source, backup copy, and point selected for recovery.",
      },
      {
        name: "Failure scenario",
        guidance:
          "State whether the test covers deletion, corruption, ransomware, account loss, outage, or another event.",
      },
      {
        name: "Restore destination",
        guidance:
          "Use a controlled location that will not overwrite or expose live business data.",
      },
      {
        name: "Request, start, and completion",
        guidance:
          "Record timestamps and active effort without presenting an untested objective as a result.",
      },
      {
        name: "Validation method",
        guidance:
          "Open required files and compare selected counts, values, hashes, permissions, or application behavior.",
      },
      {
        name: "Result and missing items",
        guidance:
          "Record pass, partial, or fail plus errors, omissions, inaccessible keys, and help required.",
      },
      {
        name: "Recovery dependencies",
        guidance:
          "Note accounts, applications, configuration, network, licenses, instructions, and the custodian and separate secure location for required keys. Never record key material.",
      },
      {
        name: "Owner and corrective action",
        guidance:
          "Assign remediation, evidence, due date, retest date, and the person accountable for closure.",
      },
    ],
  },
] as const satisfies readonly ToolkitResource[];

export const toolkitResourcesById = new Map<ToolkitResourceId, ToolkitResource>(
  toolkitResources.map((resource) => [resource.id, resource]),
);

export function getToolkitResourceForArticle(
  articleSlug: string,
): ToolkitResource | undefined {
  return toolkitResources.find(
    (resource) => resource.articleSlug === articleSlug,
  );
}

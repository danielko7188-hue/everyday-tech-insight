---
title: "How to write a practical AI acceptable-use policy"
description: "A small-business template for deciding which AI uses are allowed, restricted, or prohibited and who reviews exceptions before work begins."
slug: "write-a-practical-ai-acceptable-use-policy"
category: "ai-automation"
author: "Everyday Tech Insight"
status: "published"
contentType: "framework"
businessProblem: "Employees may use generative AI before the business has defined approved data, review duties, prohibited decisions, or incident reporting."
technologyFocus: "Generative AI services governed through use-case boundaries, data rules, human review, access controls, documentation, and incident response."
intendedAudience: "Small-business owners and operations leaders creating a first internal AI policy without a dedicated AI governance department."
readerOutcome: "Draft a short acceptable-use policy that separates allowed, restricted, and prohibited work and assigns approval, review, and reporting duties."
verificationStatus: "source-checked"
datePublished: "2026-08-21"
lastReviewed: "2026-08-21"
featured: false
summary: "Define approved tools and data first, classify use cases by consequence, require review before external action, and give staff a clear incident route."
visual:
  type: "governance"
  key: "ai-use-governance"
  alt: "A governance map separating allowed, restricted, and prohibited AI uses around approved tools and data."
  caption: "Set tool and data boundaries, match review to consequence, and provide a clear reporting route."
  decorative: false
sourceList:
  - title: "NIST AI RMF Playbook: Govern"
    url: "https://airc.nist.gov/airmf-resources/playbook/govern/"
    publisher: "National Institute of Standards and Technology"
    accessed: "2026-08-21"
  - title: "AI Risk Management Framework Resources"
    url: "https://www.nist.gov/itl/ai-risk-management-framework/ai-risk-management-framework-resources"
    publisher: "National Institute of Standards and Technology"
    accessed: "2026-08-21"
relatedArticles:
  - "evaluate-ai-output-quality-in-a-small-team-pilot"
  - "how-to-identify-business-tasks-for-automation"
noindex: false
---

An AI acceptable-use policy should help a person make a decision before information enters a tool or its output reaches another person. A policy that only says “use AI responsibly” leaves the important questions unanswered: which services are approved, what data may be entered, what work requires review, and who can stop an unsafe use.

The [NIST AI RMF Playbook Govern guidance](https://airc.nist.gov/airmf-resources/playbook/govern/) describes voluntary actions for policies, roles, accountability, training, legal review, and risk documentation. NIST also warns that its Playbook is not a checklist to follow in full. The [NIST AI RMF resources page](https://www.nist.gov/itl/ai-risk-management-framework/ai-risk-management-framework-resources) links the framework and its Generative AI Profile, which addresses risks that generative systems can introduce or intensify. The policy structure below is an editorial adaptation for a small business, not a NIST-issued template and not legal advice.

## Start with scope and an owner

Name the policy owner and the people it covers. Include employees, contractors, temporary workers, and anyone else who uses a business account or business information. State whether the policy covers public AI chat services, AI features inside existing software, browser extensions, meeting assistants, coding tools, and automated agents. A tool does not fall outside the policy merely because AI is hidden inside another product.

Write a narrow purpose statement. For example: the policy exists to let staff use approved AI assistance while protecting customer information, confidential business material, intellectual property, account security, and the accuracy of work sent outside the business.

The owner does not need to approve every prompt. The owner maintains the approved-tool list, coordinates exceptions, records incidents, and arranges a review when the business changes its uses or vendors. Assign a backup owner so the process does not depend on one unavailable person.

## Define approved tools and data boundaries

Create a short register for each approved service:

- business owner and administrator;
- approved account or subscription type;
- enabled features and integrations;
- permitted business uses;
- data categories that may and may not be entered;
- retention, training, or sharing settings that have been reviewed;
- required authentication and access controls;
- contract, privacy, and security materials checked; and
- next review date and exit procedure.

Do not assume that a consumer account and a business account have the same controls. Record what the business actually configured and what the applicable terms say. If a staff member cannot tell which account is active, the safe action is to stop before entering business data.

Define data using examples staff recognize. Prohibited input might include passwords, authentication codes, payment-card data, protected health information, government identifiers, unreleased financial results, private customer files, legal advice, trade secrets, or source code that the business lacks permission to share. Restricted data may require an approved enterprise account, a contract review, redaction, or written authorization. Public material and synthetic examples may be allowed for specified low-risk uses.

## Classify uses by consequence

A three-level model is easier to apply than a long list of tools.

**Allowed uses** are bounded, reversible, and reviewed before they matter. Examples may include brainstorming headings from nonconfidential facts, reformatting text already approved for public use, or drafting an internal agenda that a person checks.

**Restricted uses** need named approval, stronger controls, or specialist review. Examples include processing customer material, generating code for a production system, summarizing contracts, creating externally published claims, or connecting an AI agent to email, storage, finance, or customer records.

**Prohibited uses** are outside the business’s risk tolerance. Examples may include making final employment, credit, medical, legal, safety, or payment decisions; impersonating a real person; hiding AI use where disclosure is required; bypassing security controls; or automatically publishing an output that can create a commitment.

Classify the use, not the marketing label on the product. The same service might be allowed for a public-data outline and prohibited for a consequential decision.

## Require review that matches the risk

“Human in the loop” is incomplete unless the policy says what the person must check and what authority that person has. For a draft, review may cover factual accuracy, completeness, tone, confidentiality, copyright, and whether the output follows the original instruction. For code, review also needs testing, security analysis, dependency checks, and a controlled release path. For a customer message, the reviewer must be able to withhold it.

State that AI output is not evidence by itself. Important facts should be checked against an authoritative source. Citations supplied by a model should be opened and verified. Calculations should be recomputed. A reviewer should not approve work they lack the competence or time to assess.

Set a stricter rule for external actions. An AI service should not send messages, change records, approve payments, delete files, or alter production systems merely because it generated a plausible next step. Define the human approval point, account permissions, logging, and rollback path before enabling those capabilities.

## Add documentation, training, and reporting

Require a lightweight record for restricted uses: purpose, tool, data category, owner, reviewer, expected output, known limitations, and decision. Keep only what the business needs, and protect the record according to its contents.

Training should use the policy’s actual decisions. Staff need to know how to find the approved-tool list, recognize restricted information, verify an account, escalate an uncertain case, and report an incident. Include contractors before granting access. Refresh training when a tool, feature, or data practice changes.

Give staff a no-blame reporting route for accidental sensitive-data entry, incorrect external output, unexpected tool behavior, account compromise, or a previously unknown integration. The first actions should be clear: stop the workflow, preserve relevant evidence without spreading sensitive data, notify the named owner, and follow the business’s security or privacy response procedure.

## Use this minimum policy outline

1. Purpose and people covered
2. Definitions and systems covered
3. Approved tools and account requirements
4. Permitted, restricted, and prohibited data
5. Allowed, restricted, and prohibited uses
6. Required human review and external-action controls
7. Documentation and record retention
8. Security, privacy, intellectual-property, and legal escalation
9. Incident reporting and stop authority
10. Training, exceptions, enforcement, and review cadence

Attach the approved-tool register and a one-page decision flow. Keep fast-changing product details in the register rather than embedding them throughout the policy.

## Limits and review triggers

This framework does not determine which laws, contracts, professional duties, insurance terms, or sector rules apply to a particular business. It is not a substitute for qualified legal, privacy, security, employment, or industry advice. A policy also does not prove that a vendor is safe or an output is accurate.

Review the policy when the business adopts a new tool, enables an agent or integration, changes the data it processes, enters a new jurisdiction or regulated activity, experiences an incident, or learns that a vendor changed material terms. The practical result should be a policy employees can use at the moment of decision, backed by an owner who can say yes, no, or not yet.

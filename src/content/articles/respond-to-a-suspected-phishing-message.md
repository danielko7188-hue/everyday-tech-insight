---
title: "How to respond to a suspected phishing message"
description: "A calm response playbook for verifying suspicious requests, limiting damage after a click or disclosure, preserving evidence, and escalating business risk."
slug: "respond-to-a-suspected-phishing-message"
category: "cybersecurity-data-protection"
author: "Everyday Tech Insight"
status: "published"
contentType: "guide"
guidePromise: "Verify a suspicious request through a known channel and escalate containment based on clicks, credentials, payments, or exposed data."
deliverable: "Phishing response checklist and initial incident record."
whenToUse: "Use immediately after a suspicious email, text, call, attachment, login page, or payment request is received."
businessProblem: "Employees may act on urgency, verify through attacker-controlled contact details, or hide a mistake when the business lacks a clear phishing response route."
technologyFocus: "Phishing defense through independent verification, reporting, account containment, device isolation, evidence preservation, and incident escalation."
intendedAudience: "Small-business employees, owners, and administrators who need an immediate, plain-language response to a suspicious email, text, call, or login page."
readerOutcome: "Pause the request, verify it through a known channel, report it safely, and take proportionate containment steps if information or access was exposed."
verificationStatus: "source-checked"
datePublished: "2026-08-21"
lastReviewed: "2026-08-21"
featured: false
summary: "Do not use the message to verify itself, report it through a known channel, and treat clicks, credentials, payments, or malware as escalating incident conditions."
visual:
  type: "workflow"
  key: "phishing-response-workflow"
  alt: "A branching response workflow from a suspected message to reporting, containment, and proportionate escalation."
  caption: "Verify through a known channel and escalate based on clicks, credentials, payments, malware, or disclosed data."
  decorative: false
sourceList:
  - title: "Cybersecurity for Small Business"
    url: "https://www.ftc.gov/business-guidance/small-businesses/cybersecurity"
    publisher: "Federal Trade Commission"
    accessed: "2026-08-21"
  - title: "Protecting Personal Information: A Guide for Business"
    url: "https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business"
    publisher: "Federal Trade Commission"
    accessed: "2026-08-21"
relatedArticles:
  - "roll-out-mfa-across-a-small-business"
  - "back-up-business-files-with-the-3-2-1-method"
noindex: false
---

The safest first response to a suspicious message is to pause. Do not click, reply, call a number in the message, open an attachment, approve a sign-in, or continue a payment. A legitimate request can survive independent verification; an attacker benefits from urgency and from controlling the verification channel.

The FTC’s [Cybersecurity for Small Business](https://www.ftc.gov/business-guidance/small-businesses/cybersecurity) guidance describes common phishing signs, independent verification, employee reporting, and steps to limit damage. Its [Protecting Personal Information guide](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business) recommends independently verifying requests for sensitive information rather than using contact details supplied in the message. The playbook below organizes those principles for immediate business use; it is not a substitute for a qualified incident responder, insurer, lawyer, bank, or law-enforcement direction.

## If no one clicked or disclosed information

Leave the message intact and use the organization’s reporting function or designated security contact. A screenshot can help discussion, but forwarding may strip technical details or spread an attachment, so follow the business’s procedure.

Verify through a known channel. Open the vendor or service from a saved bookmark or type its known address. Call a number already held in trusted records. Contact the colleague using a separate established method. Do not reply to the suspicious thread or use its phone number, QR code, or link.

Check the business process, not only the message appearance. A familiar logo, accurate signature, or real invoice number does not prove authenticity. Ask whether the request follows normal approval rules. Payment changes, password requests, gift cards, confidential files, urgent secrecy, unusual login prompts, and bypassing another reviewer deserve additional verification.

After reporting, use the email service’s supported phishing-report function if instructed. Warn potentially targeted colleagues without forwarding harmful content. Let the security owner decide whether to block a sender, domain, link, attachment, or similar campaign.

## If someone clicked but entered nothing

Stop interacting with the page or file. Do not try to investigate by clicking further. Report what happened, including the device, account, time, message, link or attachment type, and anything observed. Do not delete the evidence unless the response owner instructs it.

If an attachment ran, software installed, an unexpected prompt appeared, or the device behaves abnormally, disconnect it from the network when doing so will not create a safety or operational hazard. Use a known clean device or phone to contact the responsible person. Avoid turning the device back on, running random cleanup utilities, or continuing work until the response owner assesses it.

A click does not always mean compromise, and no visible symptom does not prove safety. The appropriate response depends on what executed, browser and device state, account sessions, and available logs.

## If credentials or an MFA approval were exposed

Contact the designated security or account administrator immediately through a known channel. From a trusted device, follow the organization’s procedure to reset the affected credential, revoke active sessions, remove unknown recovery methods or authenticators, and review recent account activity.

Change a reused password everywhere it was used, beginning with accounts that can reset others. Do not send the old or new password to a colleague. If an unexpected MFA prompt was approved, report that fact explicitly; the attacker may already have the password and a session.

Inspect high-impact actions: inbox forwarding rules, delegated access, sent messages, recovery contacts, new applications, administrator changes, cloud-file sharing, payment details, and API tokens. Preserve relevant logs and messages according to the response plan.

Notify affected service providers or customers only through an approved incident process. An improvised warning can expose more information, conflict with legal duties, or itself resemble phishing.

## If money or financial details were involved

Contact the bank, payment provider, card issuer, or payroll provider immediately using a trusted number. Ask for the relevant fraud or recall process. Speed can matter, but follow the financial institution’s instructions and preserve transaction details.

Notify the business owner, finance lead, insurer, legal adviser, and law enforcement as required by the organization’s plan and circumstances. Do not make a second payment because a follow-up message claims the first failed. Independently verify every change to payee, account, routing, payroll, or refund information.

If the attacker impersonated a real vendor or executive, contact that person separately. Determine whether only the message was spoofed or whether an account or ongoing thread may be compromised.

## If business or personal data was disclosed

Identify what was sent, whose information it contains, when it was disclosed, the destination, and whether access can be revoked. Preserve the original record and access logs without copying sensitive material more widely.

Escalate promptly to the people responsible for privacy, legal, security, insurance, and customer obligations. Notification requirements vary by data, contract, location, sector, and facts. A generic web article cannot decide whom the business must notify or on what schedule.

Contain related access: revoke public links, rotate exposed secrets, remove unauthorized application access, and restrict affected accounts under the incident owner’s direction. Do not assume deleting a sent message retrieves every copy.

## Preserve a useful incident record

Capture facts rather than conclusions:

- reporter and contact method;
- time received, opened, clicked, disclosed, or approved;
- sender address, display name, phone number, domain, and subject;
- affected account, device, data, or transaction;
- actions taken and by whom;
- relevant message headers, logs, files, and screenshots;
- independent verification result; and
- unresolved questions and next owner.

Store the record in the approved incident location with limited access. Do not paste credentials, live tokens, or unnecessary personal data into a ticket or public channel.

## Improve the process after containment

Review how the message reached the user and why the action seemed plausible. Improve the system rather than blaming the reporter. Possible changes include a clear report button, independent payment verification, multifactor authentication, limited permissions, email authentication controls, safer attachment handling, vendor-contact records, and training built around the actual event.

Test the reporting route. Employees should know whom to contact when email itself is unavailable. Track time to report, time to contain, affected accounts, and corrective actions. Avoid vanity measures based only on whether someone clicked a simulation; rapid reporting and resilient controls also matter.

## Limits and emergency escalation

This playbook does not prove a device or account is clean. It is not a substitute for forensic analysis, legal advice, regulatory assessment, insurance requirements, or provider-specific recovery. If critical systems, sensitive data, privileged accounts, money, safety, or continuing attacker activity may be involved, obtain qualified help promptly.

The business goal is to make the correct first action easy: pause, verify independently, report without fear, and escalate based on what actually happened. A well-rehearsed route limits damage more reliably than asking each employee to investigate alone.

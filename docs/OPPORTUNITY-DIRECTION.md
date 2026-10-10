# Rcentz Opportunities - direction and delivery plan

Updated: 10 October 2026 (Africa/Lagos).
Status: OA-00 completed on 10 October 2026; implementation review OA-01 is next.

## Purpose

Opportunities is an internal Rcentz business development tool. Its primary goal is to help Rcentz find customers, paid projects, freelance work, contracts and recurring service agreements. It also supports Dennis's personal employment search.

Rcentz Systems is a personal productivity and professional project workspace, expanding into controlled team and organization management. It is built around Rcentz's operations. Similar work for another business should be a distinct implementation suited to that business.

## Working principles

- Improve the existing finder and preserve its useful work, records and decisions.
- Keep company opportunities and personal employment separate in ownership, permissions and reporting.
- Record who is pursuing each opportunity: Rcentz or an individual.
- Treat remote work as a location arrangement. The agreement determines whether it is employment, independent contracting or a company service.
- Keep discovery and pursuit private to administrators and explicitly authorized members. Current owner restrictions remain until wider permissions are implemented and tested.
- Personal records remain private by default, including from other administrators.
- Rcentz API owns shared business rules, storage, validation and final permission checks. Systems provides the workspace and checks its own signed-in user.
- Preserve source checks, duplicate prevention, collection limits, waiting periods, decision history and record ownership.
- Applications, proposals and contact messages require human review and an explicit sending instruction.

## Services and capability knowledge

Use existing service, technology, portfolio and project records before introducing new records.

| Information | Meaning | Use |
| --- | --- | --- |
| Core service | A focused service Rcentz offers | Carefully selected public presentation and private matching |
| Solution plan | A business problem and the kind of system we could build | Private qualification; selected public explanations where useful |
| Capability | Skills, tools, availability and delivery limits | Private assessment of whether we can deliver |
| Evidence | Real work and the contribution made | Honest qualification and proposals |
| Search terms | Different phrases buyers use for the same need | Private discovery |

An offered service, a proposed solution and completed work are different records of fact. Do not present an unbuilt solution as completed work or claim capabilities without supporting evidence.

Begin with one focused capability, such as custom business application development, subject to evidence and capacity review. Describe the business problems, expected work, exclusions, suitable industries, supported agreement types, search terms and linked proof. The initial catalogue is deliberately small.

The public Systems homepage already presents the service business. This direction does not call for another Services page or a marketplace of provider listings. Keep public wording professional and focused; keep wider research vocabulary private. Metadata helps describe an offer but does not guarantee search ranking.

## Opportunity review

Support customer leads, freelance projects, project contracts, recurring service agreements, independent contracting and personal employment.

Assess the original source, current availability, eligibility from Nigeria, fit, evidence, budget, delivery capacity, timing and the likely next step. Unknown information remains unknown. A published page or contact address does not prove that a buyer is legitimate.

Business opportunities receive the primary search focus. Priority reflects the quality and value of the specific opportunity, supported by evidence; opportunity type alone must not determine rank. Display a reason, missing information, deadline and next action. Keep business priority separate from urgency and source confidence.

A prospective business with a possible need is a research lead, not a confirmed buyer request. Do not convert an employee vacancy into a client lead simply because it mentions a contract.

## Pursuit and delivery

The intended workflow is discovery, review, qualification, pursuit, negotiation and an outcome. Pursuit may involve a proposal, bid, application or reviewed contact message.

When commercial work is won, an authorized user can create or link the appropriate client, agreement and existing project through Rcentz API. Preserve the original opportunity and history. Repeating the handover must not create duplicate clients or projects.

Not every outcome becomes a project. A recurring service agreement may need ongoing service management. Personal employment remains a personal record and is excluded from company revenue and client reporting.

## Milestones

These identifiers belong to this upgrade and do not renumber earlier Rcentz milestones.

| ID | Priority | Milestone | Current state | Completion evidence |
| --- | --- | --- | --- | --- |
| OA-00 | First | Align documents and milestones | Completed - 10 October 2026 | Updated documents agree; installed changes reviewed and pushed; exact pushed files checked |
| OA-01 | First | Review and stabilize the existing finder | Pending | Current API and Systems agree; record reads and edits, collection, failed sources and unauthorized access checked; baseline recorded |
| OA-02 | First | Define one focused company capability | Pending | Existing service and proof reused; private company profile can be created, edited and read through API and Systems; personal profile stays separate |
| OA-03 | First | Make commercial discovery useful | Pending | Limited supported sources yield clearly classified buyer requests and leads; reasons and gaps visible; employment still works; ownership and saved decisions preserved |
| OA-04 | First | Manage pursuit | Pending | Authorized users record stages, notes, proposal/application drafts and outcomes; human review enforced; history survives refresh |
| OA-05 | Next | Hand won work to delivery | Pending | Commercial win links or creates the right records once; existing project management used; personal employment cannot enter company reporting |
| OA-06 | Alongside relevant work | Correct interface and printing | Pending; issues reported by user | Existing theme, borders, rings, type, spacing and canvas reused; redundant elements corrected; mobile, desktop, light/dark and print inspected |
| OA-07 | Launch gate | Verify the first usable release | Pending | Real discovery-to-review-to-pursuit flow tested; permissions checked; deployment checked; source and outcome measures recorded; no blocking issue |
| TW-01 | Following usable Opportunities release | Teams, authorities and workspace management | Planned | Separate plan for teams, members, groups, leads and controlled workspace access; opportunity permissions extend only after tests |

Do not wait for every future feature before making a small secure acquisition workflow usable. Fix issues that obstruct the current milestone while working on it. Meeting, messaging, project, topic, note and task relationships remain part of the wider workspace plan.

## Our delivery method

1. Engineer prepares a small documented update and installation package.
2. Dennis installs it locally.
3. We inspect the changes and the affected screens.
4. We commit and push the inspected update.
5. We test the exact pushed version and deployed behavior where relevant.
6. We record the evidence and mark only the verified milestone complete.

Run relevant local checks before pushing as well. Preparation, installation, push and successful tests are separate states. Record the exact commit, test results, unresolved issues and whether a database change is required.

This package changes documentation only. It requires no database change, dependency installation or application build. Later features must declare their database requirements and preserve existing data.

## Source review on 10 October 2026

Reviewed repository snapshots:

- Systems: `1e69408b5c80e2910fd10a1f9ec3654b6bfaf6a1`.
- API: `589efe23b7e63244f3ce34e56155eb78ed1f75c7`.

Systems has opportunity list, detail, contacts and settings routes, workspace components and a guarded API client. API has opportunity storage migrations, collection and research code, priority assessment, retention, a scheduled route and a private Systems route.

The existing opportunity corrections release describes buyer-request research, separation of buyer demand from hiring, contact evidence and preservation of saved decisions. These are useful foundations to inspect and extend, rather than rebuild.

The main documents' earlier claim that the finder was not implemented is outdated. Source presence and earlier release notes do not prove current live behavior. No new application, database, browser or production test has been performed for this documentation update.

## Change control

This document governs the current Opportunities direction. Master Blueprint owns the wider product vision; Architecture owns responsibilities; Milestones owns progress; Systems Status owns the current handoff.

When scope changes, update all affected documents before implementing it. Historical release notes and older whole-Rcentz milestones remain evidence of earlier work, rather than instructions to override this plan.

## OA-00 completion record

Installed by Dennis, content reviewed, whitespace corrections checked, and both repositories pushed. Exact GitHub files were independently read and matched against the reviewed package. The shared direction document matches in both repositories.

- Systems evidence: `ad744d976ea475acdfba40b38a51378d44d60722` (six documentation files).
- API evidence: `377c1bc4cd297b43c3f071516dda3cc275468b9b` (shared direction document).
- Documentation checks: passed. No application build or database change required.
- Application, browser and deployment behavior: not tested under OA-00; belongs to OA-01 and later launch checks.

These commits establish the verified documentation checkpoint. This completion record is a follow-up documentation change. OA-01 through OA-07 remain pending.

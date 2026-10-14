# Rcentz Systems and API — wiring audit and completion order

Reviewed: 14 October 2026 (Africa/Lagos).
API source: `0aa80a3` — commercial intelligence and client discovery foundation.
Systems source: `c65b3ca` — client acquisition and commercial capabilities workspace.

This is a source and local-check audit. It does not claim that every flow was independently exercised against the production database, live provider accounts or authenticated browser sessions. Existing user-reported live checks remain separate evidence.

## Main finding

The customer delivery workspace is substantially connected. Commercial acquisition is a foundation rather than a complete discovery-to-delivery workflow. Several new routes render successfully but still describe future work. Neither a successful build nor a working page establishes that the whole management flow is complete.

The earlier Rcentz-Company-Capabilities-20261014-R1 installer was based on older commits and is superseded by the current commercial implementation. Do not apply its competing models to the current source. Extend the current profile, capability, problem, solution and prospect records.

## Connected work and remaining limits

| Area | Connected in current source | Remaining work |
| --- | --- | --- |
| Accounts and access | Active-account checks, admin/customer guards, private opportunity owner guard, signed per-app API requests, replay protection and dedicated commercial scopes | Check actual deployed identities/scopes. Current opportunity workspace additionally requires SUPER_ADMIN; this is not a team permission system. |
| Public services and catalogue | Services use the shared API; API exposes services, categories, portfolio and products | Verify live content, links and page behaviour against the exact deployed version. |
| Requests and onboarding | Signed-in briefs, persisted request data, file access and staff review; conversion creates a private planning project once | Recheck live uploads and one complete customer-to-admin conversion. Requested budget remains separate from agreed commercial price. |
| Project delivery | Existing project creation/editing, milestones, customer views, private files, preview images and progress | Live provider checks and unfinished UI/print issues must be recorded separately. Task overview is present; a broader personal/team task workspace is not established by that overview. |
| Billing and communication | Invoice creation/lifecycle, customer billing reads, participant-scoped conversation routes and notification history | Exercise invoice review/revision and message/read behaviour. Payment records do not alone prove a connected automatic payment provider. |
| Company knowledge | Company profile, capability and solution editing; business problems, solution groups and links; API-backed matching suggestions | Capability buyer-phrase JSON has no corresponding capability edit field/operation. Evidence is displayed as a count; evidence management/approval is not enabled. READY saves are blocked until evidence review exists. Stale-edit protection and bounded/validated commercial responses need further hardening. |
| Source management and intake | Company-scoped registry, source validation/approval and manual preview/save; canonical source references and duplicate rejection | Saving from temporary discovery requires manual intake; registry approval does not start a collector. Need broader supported sources and robust persisted matching. |
| Commercial discovery | Read-only UK Contracts Finder preview with software relevance checks and problem/solution suggestions | Only one government procurement provider is wired into this preview. Ordinary website, landing-page, ecommerce, blog/community and indexed business lead discovery are not connected here. |
| Saved commercial prospects | Separate ClientProspect storage and owner-scoped list API; intake saves NEW records | Client Acquisition page displays counts rather than the returned prospect records. No connected prospect detail/review UI, note editing or state-transition operation was found. |
| Commercial pursuit | Storage has state and notes fields | No working pursuit/history, reviewed proposal/contact draft workflow or outcome management was found. No automatic sending should be introduced. |
| Won-work handover | Existing customer/project management can be reused | No prospect-to-client/project handover or project relation exists in the inspected commercial prospect flow. Prevent duplicate handovers; personal employment must remain excluded. |
| Career & Freelance | Working personal collector, profile, decisions and response validator remain under the legacy routes | New career and career/settings pages are placeholders. Old action redirects and pagination still target the Opportunities root, now a different workspace. Reconnect this flow without mixing commercial data. |
| Daily hunt | Protected scheduled route calls the existing personal collector | It does not call a commercial collector. Client acquisition settings reject discoveryEnabled=true. Commercial automation is therefore not complete. |
| Teams, memberships and meetings | Broader vision exists in documents; project/conversation foundations can be reused | No dedicated team/member/group/meeting routes were found. These require their own permissions and workflow implementation. |

## Shared API boundary

Public service reads and opportunity/company operations use rcentz-api. Numerous existing Systems server modules still access Prisma directly for project requests, project management, invoices and conversations. This is an existing hybrid architecture, not evidence of unauthorised access by itself. It is not the completed target in which the shared API owns all business logic and Systems retains its interface and local account checks.

Move those responsibilities in reviewed slices. Rewriting all of them during an urgent release would expand both scope and risk. Keep this architectural work visible rather than silently declaring it finished.

## Verification during this audit

Both current application production builds passed using placeholder local settings. No live database mutation, migration, source collection, message or deployment was performed.

Commercial registry, intake and matching checks passed: 15 registry-policy cases, 14 intake-policy cases and 10 pure matching cases. They perform no live IO and do not establish full API/database flow coverage.

Personal-profile refresh/shared response, career review, demand classification and collection/retention safeguards passed local checks. Existing Systems private-image and image-editing checks passed with controlled records/provider mocks; the signed API transport check passed.

Three verification scripts were stale after the latest feature merge:

- API check-application-authority.mjs could not load the route's newly imported commercial handlers. The prepared repair adds handler stubs and exercises all 19 commercial operation scopes through the actual route and actual identity gate. Personal scopes cannot authorise them; the verified owner is dispatched rather than supplied owner fields. This does not test every handler's persistence logic.
- Systems check-admin-release.mjs recognised only the older guard names. The prepared repair recognises the new commercial guard, tests its SUPER_ADMIN/owner restrictions, and checks the private parent layout only for placeholder pages performing no data IO. This does not relax production authorisation.

- Systems check-opportunity-settings.mjs still loaded the old settings route, now a redirect. The prepared repair tests the existing legacy settings page and the compatibility redirect separately. It records rather than repairs the current navigation gap: the career settings destination is still a placeholder.

All three repaired checks passed locally. They are not installed or pushed by this audit. Remaining commercial response, save-concurrency, evidence-approval and live discovery checks are still needed.

## Completion order for a usable first release

1. Record this current baseline and restore repeatable release checks. Keep each unresolved item visible in milestones.
2. Connect saved commercial prospects: list, detail, source evidence, matching explanations, notes and controlled review stages. Retain timestamps/history and reject stale edits. A saved record must be usable after refresh.
3. Broaden commercial discovery using the existing supported public-search provider and reviewed sources. Include plain buyer language for landing pages, business websites, online stores and application improvements. Keep business websites/directories as research leads unless an actual request is evidenced. No dedicated Google Maps access or private-group scraping is assumed.
4. Make company capabilities usable for qualification: editable buyer language, evidence links and an explicit reviewed readiness process. Preserve the distinction between a proposed solution and completed proof. Connect persisted match explanations without inventing confidence or budgets.
5. Reconnect Career & Freelance to the existing personal functionality with correct navigation, profile ownership and return paths. Keep its records separate.
6. Add commercial pursuit and a limited won-work handover to authorised existing client/project records. Handover must be repeatable without duplicates; do not create a fictional agreement or customer identity automatically.
7. Only after collection controls are in place, enable the commercial collector and schedule. Keep per-source limits, failed-source behaviour, cooldown, deduplication and decision/history preservation. A registry enabled flag alone is not a working collector.
8. Inspect desktop/mobile, light/dark, relevant printing, account boundaries and the exact deployed discovery → save → review → pursuit → handover flow. Recheck the established customer delivery flow. Record unresolved limitations and close only passed checks.

## What “complete today” should mean

Target a usable, verified first acquisition release alongside the existing delivery workspace. Prioritise a functioning small flow rather than claiming completion because more pages exist. Whether all of the above fits today depends on the implementation and live test results; no same-day guarantee is established by this audit.

Full team/organisation management, meetings/video, broader integrations and moving every existing business operation into the shared API remain separate work. They cannot honestly be included in same-day closure without implementation and evidence. If blockers remain, release the verified slice and record what is pending.

The immediate next implementation is the saved-prospect review pipeline. The earlier installer remains superseded. Production changes should be small, inspected and verified against the exact pushed/deployed source; do not reset migrations or rerun global seeds to make the checklist appear complete.

# Commercial acquisition release — 14 October 2026

Status: implementation and controlled checks passed; installation, exact deployed version and live acceptance pending. This is not a completion claim.

## Purpose and completion boundary

Rcentz actively searches for opportunities and potential customers in Nigeria and internationally. Commercial acquisition supports landing pages, launch/business websites, online stores and business applications. Public buyer requests and possible business needs are different records of evidence. The initial search uses publicly indexed English-language content; it cannot promise every opportunity or every country/language is covered. Editable company knowledge and preferences extend search wording.

This release connects discovery, saved leads, source evidence, capability suggestions, human qualification, notes/draft proposals, progress and outcome history. Automatic messaging and commercial-to-delivery record creation are separate changes; marking a lead won does not create a client, contract or project. OA-05 delivery handover and team permissions are not closed by this release. The existing personal hunt remains separate in legacy routes; the placeholder Career migration is not declared complete.

## Changes

- Replace the single UK procurement preview as the acquisition interface's discovery engine with worldwide public web search using the API's existing Brave Search connection.
- Every run includes Nigerian website requests, global website requests, online stores, business applications, public discussions/blogs and Nigerian business research. Two further searches rotate through international research, public proposals, company capabilities and saved preferences.
- Request searches use the provider's last-month freshness filter; business research uses last-year freshness. The original page's current availability and dates still need checking.
- Search excerpts can identify possible requests, not verified buyers. Directory/company listings remain research leads until intent is confirmed. No private-account access, Google Maps scraping or automatic contact.
- Save no more than 25 new leads per run, admitting results across search territories. Canonical URLs prevent duplicates across web searches; repeats update last-seen time without replacing decisions, notes or evidence.
- Use the existing API profile, ClientProspect, capability-match and audit records. No new tables, migrations, dependencies or seed required.
- Show saved leads, progress filtering, bounded pagination, original evidence links, match explanations, review notes and bounded history. Draft proposal text can be kept in notes; nothing is sent.
- Qualifying, pursuing and winning require an explicit human check of source, buyer intent, eligibility and delivery capacity, with an assessment note. Conflicting simultaneous edits are rejected.
- Connect the existing authenticated daily schedule to commercial discovery independently of personal enablement. Commercial daily discovery is initially off until the owner explicitly enables it in preferences.
- Manual and scheduled commercial runs share a 20-hour waiting period. Concurrent requests reserve one run. Failed runs retry after 30 minutes; interrupted run reservations expire after 10 minutes. Failed sources never remove earlier leads. The hosting schedule may run within its permitted hour window.
- Keep existing signed, owner-scoped permissions and dedicated commercial read/write scopes. No wider admin/team permission is introduced.

## Configuration

Use the existing OPPORTUNITY_SEARCH_API_KEY in the API deployment. Do not paste its value in chat or store it in Git. Existing RCENTZ_SYSTEMS_API_SECRET, RCENTZ_API_URL, OPPORTUNITY_OWNER_ID, company manager assignment, commercial identity scopes and CRON_SECRET remain required. No new variable name is added.

The discovery page distinguishes a missing search connection from an empty successful result. Run records show each query territory, failures, fetched results, new saves, existing saves and skips. All-failed source batches preserve earlier leads and record failure. Partial batches save their usable results and report partial status. Saving preferences does not immediately call a provider; the collection button and authenticated schedule do.

Preferences add rotating query focus rather than guaranteeing strict region/industry exclusion. An empty region list is worldwide. Nigeria/global core searches remain present. Minimum score measures subject relevance, not buyer legitimacy or win probability. Published-budget settings are applied to source excerpts; no budget stays unknown.

## Verification performed here

Controlled tests: international/Nigeria/small-business query coverage, request/research separation, source URL bounds, hiring/tutorial exclusion, preferences, missing configuration, disabled schedule, concurrent run admission, 25-new limit, canonical repeats, preservation of decisions/notes, failed-source preservation/backoff, owner-scoped detail/list, pagination clamp, qualification gate, stale-edit rejection, repeated-save history, commercial operation scopes, scheduled authentication/dispatch, Systems response bounds, action authorization and correct operation wiring.

API and Systems production builds and TypeScript passed with placeholder local configuration. No production database, authenticated browser, live search key, scheduled deployment invocation or contact message was tested here. Earlier core checks remain separate evidence.

## Live acceptance — exact pushed versions

1. Install and run Verify-Acquisition.ps1. Inspect the listed files; preserve unrelated migration/recovery changes.
2. Commit only the package files in each repository, push using each repository's actual remote/branch, and confirm both Git-triggered deployments are ready. Record both full commit IDs.
3. As the authorized company owner, open Client Acquisition. Confirm the search connection is configured and the company profile is assigned correctly. If missing, configure the existing API search variable and redeploy before collecting. Never share its value.
4. Click Collect opportunities once. Confirm a SUCCESS or PARTIAL commercial run with Nigeria, international and small-business query territories. Inspect original source links and the saved lead list. Zero new leads may be a genuine source result, but a missing search connection or all-failed run is not a pass. For full usable-flow acceptance, review at least one saved real lead, using approved manual intake if necessary; do not fabricate buyer facts.
5. Review a request and a research lead where available; confirm the latter does not claim buyer intent. Confirm missing budget, location and eligibility remain unknown. Inspect a relevant capability reason; an absent match must not be invented.
6. Save notes in Review, refresh, and confirm persistence/history. Advance only after checking real source/intent/eligibility/capacity. Repeat an unchanged save; it must not add an extra history event. Open a second tab, edit in the first, and ensure the stale tab cannot overwrite the change. Inspect filters and pagination.
7. Click collection again within the waiting period; it must not start another provider batch or duplicate records. Confirm notes and stages remain unchanged. Check personal saved records separately for preservation.
8. Confirm guest/customer/unauthorized-owner access cannot read these leads. Inspect mobile/desktop, light/dark and print readability.
9. Enable daily commercial discovery if wanted. Use the hosting authenticated schedule test to verify invocation (it may report cooldown after the manual run), then observe the next eligible daily run and source history. Record invocation, status and time; an enablement checkbox alone is not daily execution evidence.
10. Close the acquisition milestone only after its checks pass. Record unresolved issues and the separate delivery-handover/Career/team boundaries. Use the completion evidence template below.

## Completion evidence

- API pushed/deployed commit:
- Systems pushed/deployed commit:
- Local verification:
- Real collection run/status/date:
- Source territories and real lead reviewed:
- Notes/history/repeated-save/stale-edit checks:
- Duplicate/cooldown check:
- Personal-record preservation:
- Guest/customer/owner isolation:
- Screen and print checks:
- Authenticated schedule invocation and next eligible automatic run:
- Remaining issue, or none within this acquisition boundary:
- Acquisition completion decision/date:

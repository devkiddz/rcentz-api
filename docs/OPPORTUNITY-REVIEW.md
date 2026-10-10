# Opportunities review and first correction

Updated: 10 October 2026. OA-01 is in progress.

Reviewed Systems commit: `4c10bc3b5b30b0ef185fe57d5595122ced1c8fda`.
Reviewed API commit: `e7d1dae7579aa20c38f9e7e67ae44729f3312a0c`.

## Findings

| Area | Source and local check findings | Remaining work |
| --- | --- | --- |
| Access | Systems checks the signed-in admin and finder owner before requesting API data. API verifies the app request, central owner, active admin, permissions, request age and replay protection. Existing checks pass. | Verify the actual configured accounts and deployed connection. Team access remains restricted until separately implemented. |
| Records | API owns the profile, opportunities, source runs and decision events. List, detail, contacts, settings and retention response checks pass in Systems. | Exercise real saved records and ownership in the installed application. |
| Discovery | Employment feeds and configured company boards exist. Web research includes buyer requests, RFPs and supplier requests. Duplicate checks, source failures, collection limits and decision preservation pass local tests. | Confirm configured sources and recent useful results. Company discovery still depends on the personal profile. |
| Qualification | Original source evidence, risk checks, location wording and priority explanations exist. Buyer requests are distinguished from hiring. | Introduce separate company capabilities under OA-02 and evaluate commercial suitability under OA-03. |
| Pursuit | Notes and saved states exist, including CONTRACT_WON. | Separate proposal, contact and negotiation progress from personal application stages under OA-04. No automatic sending. |
| Delivery | Existing project management is available. | No opportunity-to-client/project handover was found in the inspected finder route and actions. Implement and test it under OA-05. |
| Interface | Opportunity list, details, contacts and settings exist. Shared styles override collapsed workspace width. | Printing and redundant UI remain reported issues awaiting browser inspection. Preserve existing theme and layout rules. |

## Reproduced defect

After changing a personal profile, Refresh priorities could leave old matched skills, scores and assessment text when the priority label and opportunity type stayed unchanged.

A new test reproduced this: changing the profile from TypeScript to React left the stored assessment unchanged, even though the recalculated skill match differed.

## Correction

Refresh now recalculates fit and evidence priority using the current profile and stored source evidence. It saves updated scores and assessment details even when the priority label remains the same. The corrected opportunity classification is used for the fit calculation.

The update preserves notes, saved states, decision events and additional assessment fields. It does not make external requests or change the saved source research. Records with no research remain supported. Timestamp-only differences do not cause repeated writes. The existing owner and last-update checks prevent applying a refresh over a concurrent edit.

Changes belong to Rcentz API. Systems uses the existing response without a screen redesign.

No database migration, new dependency or new credential is required.

## Verification completed here

- Eight API checks passed: application authority, career review, buyer demand/priority, analytics, collection, pagination, refresh and retention.
- Five Systems checks passed: API connection, contacts, detail, retention and settings.
- The regression failed before the fix and passed after it.
- The actual Systems response validator accepted the refreshed API assessment.
- Both applications passed TypeScript and production builds.
- Lint passed for changed code and checks; Git whitespace check passed.

Builds used temporary local connection settings without accessing production data. The tests use controlled records and mocks. No real database writes, live source collection, deployed authentication or visual browser test was performed here. Do not treat these results as production closure.

## Installation and acceptance

1. Install the reviewed package in both repositories and run Verify-Finder.ps1.
2. Inspect the changes, then commit and push. Deploy API first if testing the hosted workspace.
3. In the finder, note an existing opportunity's status and notes. Change a profile skill, save, and click Refresh priorities.
4. Confirm the matched skills and score update where relevant, including when the priority label stays unchanged. Open its detail and check the explanation.
5. Confirm the saved status and notes survive, with no fabricated decision events. Restore the profile and refresh again.
6. Check a non-owner account cannot read or update the finder. Inspect source health and the latest run without bypassing the collection waiting period.
7. Record the exact pushed commits and actual results before closing OA-01.

Company capability work remains OA-02. This correction stabilizes the existing personal-profile workflow before extending it.

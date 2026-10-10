# Opportunity description correction — OA-01

Updated: 10 October 2026 (Africa/Lagos).
Status: prepared and locally checked; installation, push and workspace verification pending.

## Reported problem

Some source descriptions showed formatting such as `&lt;h2&gt;Who we are&lt;/h2&gt;` instead of readable words. This is encoded website formatting rather than a broken UTF-8 file.

## Correction

Use one bounded plain-text cleaner for new source descriptions and API list/detail responses. Decode common named and valid numeric characters, including up to three encoding layers; remove tags, comments and script/style contents; retain literal comparisons and international characters. Unknown named codes remain visible rather than being guessed.

Already saved descriptions are cleaned when read. Their stored source text, notes, decisions, evidence and history are preserved. New collection uses the same cleaner before its existing assessment. Existing stored scores are not recalculated by this display correction. Detail review uses the cleaned description. Source HTML is never rendered or executed.

## Local evidence

Encoded and double-encoded descriptions, numeric characters, international text, literal comparisons, hidden source contents and text limits passed. The actual detail route returned clean, bounded text without changing decisions. Existing finder safeguards and profile-refresh checks passed, including acceptance by the Systems response validator. Changed-file lint, TypeScript and API production build passed using placeholder local configuration. No live database test was performed.

## Workspace acceptance

Install, run Verify-Text.ps1, inspect and push the changed files. Check the exact pushed API deployment or restart the local API used by Systems. Open the existing Stripe list cards and their detail pages: readable description, no formatting codes, original source link working, saved notes and decisions preserved. Check a normal description too.

Resume the saved-profile refresh check separately. OA-01 remains open until its outstanding workspace checks pass. This update needs no migration, dependency installation or database cleanup. Nothing is sent to employers or prospects.

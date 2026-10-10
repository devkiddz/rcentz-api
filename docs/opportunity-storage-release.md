# Storage preview and finder controls R1

API adds owner-scoped signed retention read operation. It reports the actual deployment flag, checked time, cutoff, shared limits, total/untouched/eligible counts and optionally up to six oldest eligible records. Repeatable-read snapshot; no write/delete calls. Shared 90-day retention predicate protects notes, event history, non-NEW statuses, quarantine and recently seen or updated records. Missing profile is an explicit empty snapshot. Counts are not a deletion guarantee: eligibility may change later.

Configure hunt displays status and Preview cleanup / Refresh preview. GET preview never starts discovery or enables deletion. If API is unavailable, storage status says unavailable and profile controls remain usable. API must deploy first. Enabling retention remains a separate explicit API environment operation after reviewing the preview; no new toggle or manual delete is introduced.

Finder buttons use the existing shared Button primitives, variants and theme tokens, with consistent rounded shape, 40px height, spacing, focus/disabled behavior and submit loading spinner. Includes save, collect, filter, navigation, pagination, source and reference actions. No global button or theme changes.

## Release sequence

1. Install and verify source with Install-Storage.ps1. Backup/conflict guard included. No migration required; no environment update, commit, push or deployment is performed by installation.
2. Run Checkpoint-Storage.ps1 -Preview to inspect repository/file scope. Then run Checkpoint-Storage.ps1 to commit and push the verified release: API origin HEAD:main first, Systems systems HEAD:main second. It refuses unrelated staged files, verifies expected remotes and source hashes, checks remote ancestry and never force-pushes. If push fails, local commit remains; inspect output rather than resetting. A verification stamp is required from successful installation.
3. Deploy API first, then Systems, from their respective linked folders using vercel --prod. No database migration. Existing retention flag is unchanged.
4. Open Configure hunt, inspect Storage & retention, Preview cleanup, and verify preview repeats without deleting records or changing totals solely due to viewing. Confirm saved profile/references remain and button focus/loading states. Share the preview before enabling retention.

Checks passed: both production builds, TypeScript, lint, authority/owner scope, existing finder and analytics/pagination/bridge/detail/admin/settings checks, shared read-only retention snapshot rules and response-contract bounds. Installer fixtures cover integrity, restore, idempotency and conflict rejection. Browser visual verification and live database queries were not performed here. Current Git bases: API 8cd1e73; Systems 9c1b683.

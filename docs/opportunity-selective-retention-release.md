# Selective opportunity discovery and retention

Install over the Global Finder + pagination + Cards R4 releases. No schema or migration change is included.

## New-save admission

The API admits at most 25 new records per collection run, with at most two stretch roles, and stops new saves when the owner has 500 untouched NEW records (no notes or decision events). Reviewed records are outside this ceiling. Existing matching records can still refresh. Processing remains bounded at 180 and enrichment at eight trails. New-save room is reserved across sources before filling by priority, so a large employment feed cannot crowd project territory out.

Employment needs at least two recorded matching skills and a score of 45; contracts/projects need at least one and a score of 20. Stretch roles need a score of 30. An explicit experience requirement more than two years above the profile, or a stated weekly workload above its configured maximum, prevents a new save. Weekly hour ranges use their upper end. Senior titles are stretch signals, not automatic rejection. Unknown workload, authorization, qualifications and employer legitimacy remain unknown. Sparse or weak posts can be skipped; these are deterministic evidence rules, not a guarantee of full career fit. The profile controls skills, years, roles and workload; this update does not rewrite it.

Fresh saved leads are not bulk-deleted or relabelled by this installer. Matching records receive the updated assessment on their next collection. Statuses and notes remain preserved.

## Retention is off until enabled

The installer never runs deletion. OPPORTUNITY_RETENTION_ENABLED defaults to off and must be exactly true to activate cleanup in the API. Eligibility requires the authorized profile, NEW status, empty notes, no decision events, not quarantined, and BOTH lastSeenAt and updatedAt older than 90 days. This also protects recently saved blank NEW decisions. Shortlisted, applied, archived, rejected and other acted-on states remain stored. No event history is deleted.

At most 100 eligible records are removed per successful/partial collection, inside the collection transaction. The deletion query rechecks all eligibility predicates and selected IDs. All-failed or throwing discovery does not run cleanup. Recent collection notes report actual admissions and cleanup counts. Source absence is not treated as closure.

This bounds the untouched queue, not total database bytes. Protected opportunities, decision events, notifications and run histories continue to accumulate intentionally. A full database byte quota would need its own reviewed policy.

## Read-only preview

From Desktop\Rcentz-Recovery\rcentz-api, set the existing owner ID privately, then run:

```powershell
$env:OPPORTUNITY_OWNER_ID = '7CMWkHMpJrvqmi9n0Kb4NYmhQy1iyKQj'
node --env-file-if-exists=.env --env-file-if-exists=.env.local `
    --import tsx scripts/preview-opportunity-retention.ts
```

The script checks an active administrator and prints only policy/counts. It never deletes, even if passed an apply argument.

After reviewing preview counts, enabling OPPORTUNITY_RETENTION_ENABLED=true in the API production environment and redeploying API activates future scheduled cleanup. Add it with `vercel env add OPPORTUNITY_RETENTION_ENABLED production`, enter true, and deploy API. Do not enable it in Systems. Omit this setting to keep preview-only retention. New-save admission and caps do not require that setting.

## Release

Installer backups and source-hash guards are included. No environment values, SQL, commits, pushes or deployments are executed automatically. Deploy API first, Systems second. No migration. Before considering activation complete, verify the read-only preview, a collection run and its source/run counts in your authenticated workspace. Existing daily scheduling and 20-hour cooldown remain unchanged.

Validation covers workload ranges, explicit experience gaps, new-save and stretch caps, owner-scoped cleanup predicates, notes/history/quarantine protections, skipped cleanup after failed discovery, source fairness, transaction failure preservation, authority, pagination and analytics. Both production builds and TypeScript checks are required before release.

# Reviewed commercial-lead archival — 16 October 2026

The policy-v3 audit scanned 13 records. Ten specified seller/editorial/in-house recruitment mismatches are eligible for this reviewed batch. The Freelancer request has a budget discrepancy and remains available; the WordPress/WooCommerce request needs source and capability checks; the older FreelanceProgramming request lacks sufficient evidence for rejection and is preserved.

`pnpm exec tsx scripts/archive-reviewed-commercial-leads-20261016.ts` performs a read-only preview. It requires the assigned company manager to be an active administrator, checks the exact ten IDs and titles within that company/owner scope, and refuses changed stages, nonempty notes, review metadata, prior history or records now passing admission. It never scans broadly for automatic rejection.

After reviewing the preview, the same command with `--apply` archives that exact batch in one serializable transaction and records quality-archive history. Source text, notes, matches and all records remain stored. Concurrent updates abort and roll back the entire batch. A repeated successful invocation adds no history. No record is deleted, and the other three candidates are outside the allowlist.

The normal lead list now excludes ARCHIVED unless the explicit Archived filter is selected; the UI calls the default Active stages. Installation and verification never execute the live archival command. They change source files only, run controlled checks and build. No migration, seed, dependency, provider call, messages or schedule changes are included.

Validation: controlled tests cover preview/no writes, exact scope, active manager, changed or reviewed records, concurrent conflict rollback, evidence/notes preservation, idempotence and the default/explicit archived filters. Both production builds and TypeScript must pass before release. Existing source-date, technology-fit, card polish and discovery-quality acceptance remain separate open checks.

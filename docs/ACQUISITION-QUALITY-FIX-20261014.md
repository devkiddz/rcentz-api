# Acquisition quality correction — 14 October 2026

Trigger: a DesignRush seller directory was admitted as a possible buyer request, and an agency pricing range of $40K-$100K was displayed as $40. Neither is acceptable buyer evidence.

Changes: reject seller directories, agency rankings, generic instructional content and seller pitches; require buyer-authored demand wording or a procurement title with submission context; keep first-person business research distinct from purchase requests. Exclude major seller directories from search wording. Preserve budget currency/suffix/range and require budget context; research leads have no inferred buyer budget. Store admission-policy version and the supporting intent excerpt with new candidates.

This is conservative excerpt classification, not original-page verification or a claim of full source coverage. Potential buyers whose excerpts lack sufficient context may be missed. Live result quality still needs evaluation against actual sources. No new migration, provider key, dependency, outreach or schedule change.

Existing records are preserved. Run `pnpm exec tsx scripts/audit-commercial-lead-quality.ts` locally for an owner-scoped read-only report of at most 100 newest PUBLIC_WEB records. It identifies likely invalid admissions and budgets needing review; it never deletes, archives, updates or collects. Reviewed records and notes must be preserved when deciding subsequent cleanup. A patch does not automatically fix old saved labels or budgets, and existing cooldown remains in effect.

Validation: regression test covers the reported directory failure, agency rankings, seller marketing, generic advice, genuine buyer statements and procurement requests; budget K/M and currency ranges; existing controlled collection, concurrency, ownership, history, scope and cron tests. TypeScript, ESLint and a production build run with placeholder configuration; no live provider or production database used.

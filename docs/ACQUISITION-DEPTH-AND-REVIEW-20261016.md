# Acquisition depth and review — 16 October 2026

## Discovery

- Eight existing query territories remain: Nigeria and worldwide request signals, communities, research and rotating catalogue/preferences queries.
- Breadth-first pagination fetches up to three pages of ten results per territory. Maximum 24 Brave requests / 240 raw result slots per run, compared with eight requests / 64 slots previously. Overlap, duplicates and rejected results reduce usable candidates.
- A subsequent page requires the provider's `query.more_results_available` flag. Exhausted, malformed or failed territories stop independently. Partial pages remain usable and visible as PARTIAL.
- Fetching has a 120-second budget, checked before each request; an in-flight provider request retains its existing 12-second timeout. Processing checks a 240-second run budget between candidates. These are cooperative limits, not hard cancellation of in-flight network/database work.
- Round-robin admission, canonical URL deduplication, 25-new-save maximum, shared 20-hour waiting period, policy v3 primary-excerpt admission, review preservation and all-failed-source backoff remain intact.
- Personal search retains its page-zero defaults. The API remains the collection and data authority.
- Provider use can reach three times as many requests per run. No paid provider plan or account settings are changed by installation.

## Review workspace

- Lead review separates source evidence and commercial fit from the decision form; preserves full saved excerpts behind a bounded scrolling panel and retains source cautions.
- Stage controls, four qualification checks, notes, pending/saved feedback and review history use existing authorization/actions. Advancing still requires all checks and meaningful notes, enforced by the action and API.
- Shared acquisition navigation now appears on review, discovery, preferences, manual intake and source management. Discovery shows per-source page counts; legacy runs remain supported.
- Source registry copy distinguishes manual intake/feed readiness from the separate live web hunt. Source preferences explicitly describe query influence rather than domain restrictions.

## Validation and release

Controlled pagination and collection regressions, authority/admin checks, TypeScript, production builds and fixture-backed light/dark mobile/desktop review rendering passed locally. Hydrated form interactions were exercised with a stub action and no network/data writes. Live searches, production scheduling and live save/conflict acceptance must still be checked after both deployments are Ready. Deploy Systems before running a paginated API collection, so PARTIAL source histories have a compatible reader.

No migration, seed, archival, live collection, bid, purchase, message, commit or deployment is performed by the installer or verifier.

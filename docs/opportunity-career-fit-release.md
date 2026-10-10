# Grounded career review

## Scope

API owns a bounded deterministic requirement checker. The existing opportunity detail layout shows the current-profile recommendation, source excerpts, priority wording, contribution evidence, missing evidence and next steps. Queue cards, ranking, collection limits, decision history and retention remain unchanged.

The signed read-scoped detail route selects the job through its authenticated owner and reads the related profile in the same query. Profile internals are removed from the response. The review is computed on read, including for existing jobs; it is not stored as another report, and does not change a status, notes or an application event. No migration or new API key.

## Meaning

PURSUE requires recorded personal contributions for at least two recognized capabilities, explicit requirements, and no detected hard conflict or unproven required capability. It still needs eligibility, employer and full-scope checks. STRETCH flags identified experience/responsibility/evidence gaps. SKIP prioritizes a stated workload conflict, a large explicit experience gap or multiple explicit capability gaps. CLARIFY is used when evidence is inadequate, mixed wording is ambiguous or only a discovery snippet is available. QUARANTINE takes precedence over fit.

SUPPORTED means capability tags and an implementation statement in the recorded personal contribution match; it is owner-recorded, never independently verified. CLAIMED means skill/profile tags without a contribution example. GAP means missing recorded evidence, not inability. UNKNOWN means the requirement or qualification cannot be established. Preferred qualifications never become invented mandatory blockers. Alternative technology wording is treated cautiously.

## Limits

This is not an LLM, repository audit or full career certification. It checks recognized phrases in at most 16,000 stored description characters and 160 fragments, displaying up to 20 requirements. It can miss unrecognized wording or misunderstand source formatting. Links are not fetched. Explicit source excerpts, coverage and uncertain requirements remain visible. Review the original vacancy and discuss interpretation before committing. The discovery score still reflects prior collection overlap; it is separate from the current-profile recommendation.

## Release

Install to both explicit repository roots. Preview/run Checkpoint-Career-Fit.ps1, then deploy API followed by Systems. No environment updates or database migration.

Open an existing saved opportunity. Inspect Career fit & blunt unknowns, then edit a contribution in Configure hunt, save it and reopen the opportunity. The current review should reflect the saved contribution while the status and notes remain unchanged. No outreach or application is sent.

Verification covers contributor claims versus tags, required/preferred/alternative wording, negation and future work, years and workload ranges, qualification uncertainty, snippet caution, owner/read-scope boundaries, current-profile refresh, source-text escaping, bounded contracts and legacy fallback. Existing collection, retention, analytics, pagination and admin checks remain required.

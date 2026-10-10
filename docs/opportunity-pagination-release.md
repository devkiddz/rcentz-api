# Six-item opportunity pagination

The workspace requests contract version 3. Each page reads at most six opportunities from rcentz-api, scoped to the authorized owner and current queue, opportunity type and decision. Counts and rows share a repeatable-read transaction. Pages are ordered by fit score descending, publication date descending and unique ID ascending. Previous/Next preserve filters; applying filters starts at page one. Empty and out-of-range pages are handled safely. The API retains its legacy response for older clients while the deployments are updated.

Install into both existing repositories. No schema change, migration, environment change, automatic commit or deployment is included. Deploy API first, then Systems. Check six cards, matching totals, Previous/Next, filtered pages and an empty queue after deployment.

Pagination reduces transferred records and page rendering. It does not delete stored opportunities or reduce their lifetime accumulation. Retention and collection eligibility remain separate decisions.

Verification: TypeScript, lint, production builds, authority/bridge checks, collector and analytics regressions, and pagination tests for owner isolation, ranked ordering, six-row limits, filtered totals, empty pages and clamped page numbers.

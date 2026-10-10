# Global opportunity research release

This release extends the deployed private finder. rcentz-api owns collection, research, profiles, decisions, history and analytics. Systems authenticates locally, verifies the configured owner, signs fixed-route requests and renders the review workspace using existing cards, form controls, layout, typography and theme tokens.

## What is implemented

- Daily discovery through Remotive, Jobicy, Arbeitnow, Hacker News jobs, configured Greenhouse and Lever boards, and Brave web search. Defaults include Vercel, Stripe and Cloudflare Greenhouse boards; their availability is reported independently.
- Global employment, contract and project/tender searches. Target roles and regional search wording rotate daily; Nigeria is an eligibility context, not a search restriction. Search results are research leads, not authenticated vacancies.
- Public recruitment/business email extraction with original page URL and observation time. Employer association and deliverability remain unverified. Never generates guessed addresses or sends messages.
- Employer contact searches and bounded public-page research, including JobPosting structured data. Robots restrictions, HTTPS, public IPv4 DNS pinning, private-network rejection, redirect rejection, content/byte limits and timeouts protect the API. Robots failures cause the page to be skipped. IPv6-only sites are skipped in this release.
- Evidence-based fit dimensions: skills, seniority/experience, role direction, geography, relocation wording, career-context overlap, compensation and stated workload boundaries. It is deterministic analysis, not an LLM career assessment. The full portfolio, qualifications and personal vision need the owner's written context and review; absence is shown as unknown.
- Payment-to-work, fake-check, sensitive-credential, exceptional-income and urgent private-message signals. Flagged records enter quarantine. No badge certifies a recruiter or company as legitimate. Quarantine is conservative and can contain false positives.
- Canonical URL deduplication, owner isolation, preserved notes and decisions, archive/filter controls, timestamped decision events, source health, pipeline totals, daily discovery/application chart and a recorded-application response cohort.

## Operating bounds and failure behavior

Each run processes at most 180 ranked candidates, reserves territory for every source, and researches at most eight unseen/stale public-page trails. Feed parsers and requests have limits; this is broad discovery, not exhaustive internet coverage. Pages are rechecked when their recorded research is over seven days old or was unsuccessful. Ranking does not establish eligibility, deadline validity or competence. Absence from a later feed never proves closure.

An advisory-lock lease and persisted run provide a 20-hour cooldown, including failed runs. Sources run independently; partial search/source failures appear in source history. Existing records survive failure. Persistence uses a transaction; a failed write does not partially change decisions. A process killed by hosting can leave a RUNNING record until the next daily window; there is no durable mid-run resume. The next scheduled run can collect again after the cooldown.

API and Systems collection functions allow 300 seconds with Fluid Compute. Manual transport allows 295 seconds; long work can finish in the API after a browser disconnect. Cron remains the preferred automatic path. Provider calls are serialized within the collector process at approximately one per second. The owner/cooldown keeps simultaneous collectors out; multiple unrelated instances are not a provider-wide rate limiter.

History starts now. Existing APPLIED rows do not become invented application events. Response rate = unique opportunities with a recorded response/interview/offer/won event AND a recorded APPLIED event in the last 30 days, divided by unique opportunities with a recorded APPLIED event in that window. Unrecorded and older outcomes are excluded. Daily application bars count transition events. Rates are suppressed when the 5,000-event history limit is reached; other truncated totals are labelled bounded. Contacts and discovery history are bounded to 5,000 rows; source history to 1,000 runs.

## Activate in the correct order

1. Run the installer against both existing local repositories. It backs up source and verifies source/builds. It does not migrate, deploy, commit or push.
2. From rcentz-api, inspect `prisma/migrations/20261009130000_opportunity_research_history/migration.sql`. It only adds profile/research columns, two history tables, indexes and their foreign keys. Apply using the existing private database environment:

   ```powershell
   node --env-file-if-exists=.env --env-file-if-exists=.env.local node_modules/prisma/build/index.js migrate deploy
   ```

   No database reset, db push, historical checksum edits or resolve-as-applied. The previously missing original capability-profile migration is still a separate history-recovery issue; this package does not fabricate it.
3. In rcentz-api production, add `OPPORTUNITY_SEARCH_API_KEY` privately using the Brave Search dashboard credential. Select a provider plan whose terms permit your intended results storage; confirm its quota/budget. No key is bundled. Approximately 4–6 discovery requests plus up to eight company searches per enabled daily run; optional provider retries are not automatic. A missing key is shown as NOT_CONFIGURED and feeds still collect.
4. Optional API production environment: `OPPORTUNITY_GREENHOUSE_BOARDS` comma-separated board slugs (maximum six); `OPPORTUNITY_LEVER_BOARDS` comma-separated slugs (maximum four). These are board identifiers, never arbitrary fetch URLs.
5. Keep existing `OPPORTUNITY_OWNER_ID`, `RCENTZ_SYSTEMS_API_SECRET`, `CRON_SECRET`, database and auth variables. Systems keeps `RCENTZ_API_URL=https://api.rcentz.cc` and its existing owner/signing secret. Never set the search key in Systems or a NEXT_PUBLIC variable.
6. Deploy API after migration, then Systems. Version-1 clients continue to receive only Remotive listings during this ordering; version-2 clients request the broader contract.
7. Sign in with the current Rcentz Super Admin owner. Open `/admin/opportunities`, record substantiated career evidence and priorities, enable daily collection/research, then collect or wait for cron. The configured owner identity remains unchanged.
8. Verify source-health rows, missing-key warnings, protected access, quarantine, public contact evidence, a saved decision and history. Cron is 07:00 UTC / 08:00 Lagos daily; Hobby scheduling can occur within the scheduled hour. Results update in this workspace. No email/push delivery is connected, and the API notification is not automatically bridged into the Systems notification store.

For Vercel CLI 58.9.2, run interactive `vercel env add OPPORTUNITY_SEARCH_API_KEY production` inside rcentz-api and paste the credential privately. If already present, use `vercel env update ...`. Environment changes require redeployment. Do not pipe a value into an update confirmation prompt.

## Verification performed

Both production builds, TypeScript, changed-source lint, signed authority/replay/ownership checks, malformed-feed and deduplication checks, private-network and robots tests, risk quarantine, workload boundaries, concurrent cooldown, transaction rollback, decision idempotency and analytics cohort tests pass. The additive migration was executed against isolated embedded PostgreSQL and preserved legacy decisions/notes and canonical uniqueness. Public endpoints for Jobicy, Arbeitnow, Stripe Greenhouse and Hacker News returned valid current responses from the verification environment.

The actual workspace server-rendered with a test fixture. A browser binary download was blocked in this environment, so full visual browser, keyboard and live signed database-flow checks are still required after deployment. No production database, credentials or deployment was accessed by these tests. Real Brave discovery/contact delivery cannot be verified until the production key is configured.

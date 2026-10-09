# Shared API rollout — 9 October 2026

## Authority
Rcentz API owns domain models, persistence, business rules and the final authorization decision. Each product owns its browser session, presentation and server-side integration. Browser cookies remain scoped to the product. No email-based identity merging, no shared admin cookie, no browser-held integration secret.

The first explicit identity binding is ApplicationIdentity(applicationId, subject) → existing API User. ApplicationIdentity is disabled by default. API checks enabled binding, active central user, central role, application scope and finder owner on every request. Systems independently checks its own active administrator and local finder owner. The two owner IDs may differ; the identity binding joins them.

## Five stages and current status
1. Checkpoint: source bases recorded below; installer backs up every overwritten/removed file and reports current git state. The Windows working tree may contain newer polishing; conflicting files stop installation before copying. Runtime data backup remains an operator responsibility before database deployment.
2. Identity boundary: implemented for the private finder. A signed server request binds application, subject, method, route, timestamp, random nonce and exact body. API rejects tampering, stale requests and used nonces; unique database nonce keys protect concurrent replay. Each future product needs its own key and scopes. This is a server trust delegation: compromise of the Systems integration secret can impersonate its linked subjects, so the key belongs only in server environments.
3. Finder: collection, matching, decisions, profiles, history, database models and cron now reside in API. Systems uses a typed, validated API response and existing UI primitives. Ready for staging activation; no live database migration or deployment was performed by this package.
4. Existing workflows: inventory and cutover order below. **Not yet migrated**. Gate: the identity binding and finder must pass staging browser → API → database verification before moving working workflows. Do not remove Systems DATABASE_URL or its auth tables; existing private flows still depend on them.
5. Reusable integration: documented contract and pure API signing verifier are in place. Expansion to other applications and a complete domain endpoint set remain future implementation. Rcentz Core will use central user IDs and explicit application links; the finder does not implement Core or aggregate customer activity.

## Recorded source checkpoints
- Systems main: 8c59abf4c78af98f607324f1f4d2fe44b945bb54.
- API main: c634b0e6ec3b1f535296342a306647174c229354.
- Systems locally installed finder R2 must be corrected before deployment; its migration was never authorized as the final architecture.
- Preserve API's extra product-domain schema. The new API migration only creates five new tables, indexes and foreign keys; it does not replace existing domain models.

## Existing workflow cutover order
| Order | Area | Current Systems entry points | Required parity before switch |
| --- | --- | --- | --- |
| 1 | Notifications and header feed | features/admin/server/dashboard, overview/get-overview-notifications.ts | Same owner, unread counts, mark read semantics; reconcile central/local IDs |
| 2 | Requests and briefs | features/admin/server/requests, app/api/project-briefs | Customer ownership, submitted-only staff access, idempotent review/conversion, private reference downloads |
| 3 | Projects, tasks, progress and chat | features/admin/server/projects, app/api/projects, app/api/conversations | Membership, assignment, milestone ordering, transaction parity, file ownership |
| 4 | Invoices, payments, subscriptions and finance | features/admin/server/invoices, overview/get-finance-overview.ts | Approval, totals, taxes, balances, money precision, lifecycle and transaction parity |
| 5 | Remaining public/localized content, support and analytics | server/localization, public server modules, activity and analytics routes | Public contracts, content locale parity, app-scoped event ownership and retention |

For each area: compare API and Systems implementations, define minimal DTOs and per-operation scopes, test owner/admin/customer denial, establish explicit existing-record identity mapping, reconcile counts and representative records read-only, migrate one write path with idempotency, verify UI, then remove only that obsolete Systems domain access. Never dual-write independently or silently fall back to local mutations after API failure. Separate authentication persistence is retained until a separately verified auth migration exists.

## Staging activation
1. Check git diffs and backup both projects and the database. Install coordinated source patch. If Windows has unpushed edits in an affected file, installer stops; merge deliberately.
2. In API configure DATABASE_URL and DIRECT_URL privately. Apply only reviewed pending migrations with Prisma migrate deploy. Never run reset/db push to bypass migration history.
3. API and Systems each receive the same cryptographically random RCENTZ_SYSTEMS_API_SECRET (at least 32 characters); distinct keys for future applications. Systems receives RCENTZ_API_URL (HTTPS API origin) and OPPORTUNITY_OWNER_ID (local subject ID). API receives OPPORTUNITY_OWNER_ID (central user ID), SYSTEMS_SUBJECT_ID (same local subject ID) and CRON_SECRET (separate random secret).
4. API operator runs `node --env-file=.env.local --import tsx scripts/link-systems-identity.ts` to preview the existing identity binding. Then run the same command with `--apply` to activate. No new user is silently created or matched by email; existing conflicting bindings cannot be reassigned by this command. If no central owner exists, provision one through the established account process first.
5. Deploy API first. Test health and an unsigned internal request (must return 401). Deploy Systems, sign in as the linked owner, open /admin/opportunities, save profile and enable collection, collect once, save a decision and reload. Confirm API rows and run history persist. A different active administrator must have no private finder access. A disabled central user/link must deny even an active local session.
6. Validate replay rejection with automated checks and scheduled collection with the correct cron secret. API cron checks around 08:00 Lagos; the first manual run starts the 20-hour cooldown. Profile is disabled until saved/enabled. Review collection history in the finder; API notification records are not yet wired into the Systems local notification feed.
7. Record evidence before stage 4. No production credentials, live cross-application identity or DB reconciliation were available during source validation.

## Finder release limits
This is the first source (Remotive public software-development feed), not a global company/email search engine. Assessments are keyword evidence, not hiring predictions. Worldwide wording is not work eligibility. Listings are delayed by the source and employer closure is not independently verified. Missing listings are retained as unconfirmed. No application, outreach, proposal or SOW is sent. Contract/business sources, alerts outside the dashboard and reviewed drafts are subsequent features.

## Reusable application integration contract
POST a bounded JSON operation server-to-server with headers x-rcentz-app, x-rcentz-subject, x-rcentz-issued-at (milliseconds), x-rcentz-nonce (UUID), x-rcentz-signature (HMAC SHA256 hex). Sign canonical JSON array ["rcentz-api:v1", "POST", fixed route, applicationId, subject, issuedAt, nonce, exact body]. API resolves the per-app credential, verifies signature/freshness, resolves central identity, authorizes resource and operation, then consumes nonce before business logic. Never accept client-supplied role/owner/customer IDs as authority. Response is the existing API success/error envelope with no secret or Prisma internals. Requests and responses are no-store; redirects are refused. Sessions and keys remain server-side and application-specific.

## Rollback
Source installer retains before-files and a manifest; it does not migrate, deploy, commit or push. Roll back source with its restore command before changing application traffic. New API tables are additive; do not drop populated tables during rollback. If the earlier Systems finder migration has already been applied, stop and reconcile migration history/rows first; this package assumes it was not applied. Revoking the binding/key immediately closes finder access. Existing admin workflows continue their current authority during this staged rollout.

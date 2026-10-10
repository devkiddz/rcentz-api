# Career evidence release R1

Record up to six HTTPS project references, skills used and your personal contribution in Career profile & boundaries. Existing profile references default to an empty array. These are owner-recorded references, not independently verified credentials; this release does not fetch or inspect their contents. No evidence is fabricated or prefilled.

Future collection assessments explain which references overlap listing-matched skills and which matched skills have no recorded example. Numeric scoring, experience/workload boundaries, quarantine, six-row pagination, 25-new/two-stretch budgets and retention settings remain unchanged. Missing evidence does not establish lack of ability. Previously saved assessments are updated only when collected and assessed again; saving the profile does not retroactively rescore all records.

## Activation order

The installer verifies source only and never runs SQL, deploys, commits or pushes. A single additive API migration adds OpportunityProfile.projectEvidence JSONB with an empty-array default. Inspect prisma/migrations/20261009210000_opportunity_project_evidence/migration.sql before applying. Use your API environment privately; do not paste secrets.

From rcentz-api, inspect migration status:

```powershell
node --env-file-if-exists=.env --env-file-if-exists=.env.local node_modules/prisma/build/index.js migrate status
```

Your known missing historical capability-profile migration must not be fabricated, reset, deleted or marked applied to silence history warnings. This release does not repair that historical record. Stop if new/unexpected drift or failed migrations appear. Once reviewed, apply pending migration(s) with migrate deploy using the same node environment flags, deploy API first, then Systems. Do not deploy the new API before the column exists.

After deployment, enter two to four accurate project references with your own contribution and skill names matching the career profile, then save. Next collection follows the existing schedule and cooldown. Inspect an opportunity's evidence and unknowns on its detail page. References are private under the existing owner-scoped signed bridge. Older clients that omit projectEvidence preserve existing references; removing all entries in the new editor clears them intentionally.

Production builds, TypeScript, lint and existing authority/finder/pagination/analytics/bridge/detail/admin checks passed. New tests cover URL and count limits, required contribution, evidence gaps, unchanged scoring/workload concerns, reject-before-write, owner scoping, explicit-field sanitization and preservation for older clients. No production browser visual verification or live database migration was performed. Form controls reuse existing shared Input, Textarea and Button theme controls.

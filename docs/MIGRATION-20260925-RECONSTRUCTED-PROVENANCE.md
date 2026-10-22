# Historical migration staging — R1

## Scope
Add the reconstructed SQL under the missing migration directory in the **local** `rcentz-api` repository, and a documented provenance report. No database access, Prisma deploy, Git commit, Git push, environment edits, deletion or overwrite.

- Missing migration: `20260925195138_add_rcentz_product_capability_profile`
- Production recorded SHA-256: `2d0c6e6087ef4e16b8269a0272ddc2910d2487d56eac133adfe7a9a384ab35ad`
- Reconstructed SHA-256: `725014921554ba4610b617698ab391bbb872e6dad894adb88ad25b2a4727a028`
- Original SQL lost. **These checksums differ.** Staging does not repair the production historical checksum.

## Verified in isolation
Manual SQL replay; snapshot comparison (45 columns, 25 indexes, 4 foreign keys, 4 enums); Prisma 20 historical migration replay; Prisma OA-02 migration as 21st. Neon `rcentz_prisma_rehearsal` confirmed 21 applied, 0 incomplete, 4 OA-02 tables.

## Release gate
Before production: backup/snapshot; production drift assessment; independently review SQL and add constraints; decide formally whether historical checksum mismatch is tolerable or requires other supported Prisma remediation; inspect `git diff`, test builds and migration status; deploy only through the standard change-management path.

**Do not represent reconstructed SQL as the original or alter `_prisma_migrations` by hand.**

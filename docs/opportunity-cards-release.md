# Opportunity cards and private detail pages

This update follows the six-item pagination release. Cards show company, role, source excerpt, location, compensation, work arrangement, fit evidence, matched skills, the main concern or risk flag, decision status, source, contact count and last-seen date. Clicking the card opens a unique title-and-ID slug page. Original source links open separately. Cards use the existing shared Card, Badge and Button components and theme tokens. The mobile layout stacks; the wider detail layout separates the evidence and decision panel.

The private detail page shows recorded career evidence, unknowns, risk evidence, public contact provenance, research trail and the stored source excerpt. Notes and decisions are edited there. Returning to the queue preserves its filters and page. Renamed titles redirect to the canonical slug for the same identifier; unavailable records show a recovery link. Existing six-item paging and ranking remain in place.

The Systems page authorizes before requesting data. The signed API detail operation requires opportunities:read, queries by both record identifier and authorized owner, validates identifiers and returns no-store responses. Description content is rendered as text, never raw HTML. Missing records return a null detail that Systems handles as not found. This release adds no public job route and sends no applications or messages.

No schema changes, migrations or environment changes are needed. Install into both existing repositories, then deploy API first and Systems second. The installer checks expected source hashes before copying, saves a reversible source backup and runs verification. It does not commit, push, deploy or modify database records. Unexpected local edits stop installation before copying.

Verification: both production builds, TypeScript, lint, authority and bridge checks, slug and return-navigation checks, six-row pagination regression, collector/analytics regressions, and real Next server rendering with six cards and a detail fixture. Render checks confirm source links, risk briefs, decision fields and escaped untrusted descriptions. No authenticated live browser session or visual screenshot comparison was available.

After deployment: open a card on page two with filters applied, verify its details, save a decision, return to the same queue, and confirm updated state. Check mobile and desktop layouts in your usual browser. Fit scores are evidence summaries, not hiring probabilities; public contacts and scam checks do not certify an employer.

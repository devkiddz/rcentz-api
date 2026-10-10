# Source quality and opportunity detail cleanup

## Problem and behavior

A jobs-results page was stored as one opportunity. Search snippets mixed employer requirements and produced a high keyword-overlap score that could look like career fit. Preferred Qualifications also reset to mandatory scope, and an unrelated or could merge an entire capability sentence.

A shared URL/title classifier now distinguishes recognized results pages, discovery snippets and vacancy text. Results pages and snippets return CLARIFY (or QUARANTINE) with zero inferred requirements. The UI suppresses their stored numeric score, even on legacy records. Results-page candidates have zero admission score, so future collections do not save them as vacancies. Existing records, notes and history are retained; this release does not re-rank or delete legacy data.

Two existing employment searches target Greenhouse and Lever individual vacancy territory. Remaining broad, contract, project and sponsorship searches remain. Query counts and collection budgets are unchanged. Duplicate identical snippets are removed. Robots restrictions are still respected; no blocked-page fetch bypass is introduced.

Preferred qualification headings retain preferred scope. Generic qualification headings remain uncertain unless wording establishes obligation. Alternative groups join only adjacent capability names connected by or/slash; an or elsewhere does not merge React and TypeScript into a false combined proof.

## Interface

The detail page leads with the source identity, one career recommendation, a concise contribution/gap summary and next steps. Requirement evidence, earlier collection context and source text start collapsed. Source verification starts expanded only for quarantined entries. The decision form and existing card geometry/theme remain. Legacy double punctuation is cleaned for display. Public contact and authority uncertainty remains accessible without repeated warnings throughout the visible brief.

## Release and validation

No migration, new key or environment change. Install and verify both projects, preview/run Checkpoint-Quality.ps1, deploy API then Systems. Reopen the reported ZipRecruiter results page: it should identify a jobs-results page, show no 100/100 or vacancy-specific requirements, and direct attention to an individual vacancy. Its saved status and notes must remain unchanged.

Tests cover the reported URL/title pattern, an individual ZipRecruiter URL, preferred heading scope, unrelated alternatives, zero admission score for results pages, suppressed scores in existing cards and details, collapsed support sections, current-profile review, safe source-text rendering and all existing access/finder/retention checks. The classifier and language parser are heuristics: unfamiliar results-page formats can still be missed and every discovery lead remains unverified.

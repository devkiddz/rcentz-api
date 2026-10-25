import { projectCodeFromSlug } from './scoped-commit';
import { reviewGithubPullRequest, type Get, type PrAttributionResult } from './github-pr-review';

export type RegisteredSource = {
  projectId: string;
  projectSlug: string;
  repository: string;
  branch: string;
};
export type HistoricalCommit = {
  sourceProjectId: string;
  sourceRepository: string;
  sourceBranch: string;
  sha: string;
  existingMilestoneId: string | null;
  issue: string | null;
};
export type AttributionCandidate = {
  projectId: string;
  projectCode: string;
  sourceRepository: string;
  sourceBranch: string;
  mergeSha: string;
  prNumber: number;
  milestoneKey: string | null;
  disposition: 'REVIEW_REQUIRED' | 'BLOCKED' | 'UNMATCHED';
  reason: string;
  evidence: PrAttributionResult | null;
  requiresApproval: true;
};

/**
 * PM-03C2: construct an evidence-only human review candidate.
 * Callers MUST supply RegisteredSource from an authorized DB source and
 * HistoricalCommit from the same DB. No database writes occur here.
 *
 * A PR number is only a lookup hint, never an authorization to modify history.
 * Historical linked commits cannot be reassigned by this workflow.
 */
export async function buildAttributionCandidate(
  source: RegisteredSource,
  historical: HistoricalCommit,
  prNumber: number,
  get?: Get,
  token?: string
): Promise<AttributionCandidate> {
  const projectCode = projectCodeFromSlug(source.projectSlug);
  const base = {
    projectId: source.projectId, projectCode,
    sourceRepository: source.repository, sourceBranch: source.branch,
    mergeSha: historical.sha, prNumber, milestoneKey: null,
    evidence: null, requiresApproval: true as const
  };
  if (source.projectId !== historical.sourceProjectId ||
      source.repository.toLowerCase() !== historical.sourceRepository.toLowerCase() ||
      source.branch !== historical.sourceBranch) {
    return { ...base, disposition: 'BLOCKED', reason: 'HISTORICAL_SOURCE_MISMATCH' };
  }
  if (historical.existingMilestoneId) {
    return { ...base, disposition: 'BLOCKED', reason: 'HISTORICAL_COMMIT_ALREADY_LINKED' };
  }
  if (!/^[a-f0-9]{40}$/.test(historical.sha)) {
    return { ...base, disposition: 'BLOCKED', reason: 'INVALID_HISTORICAL_SHA' };
  }
  const evidence = await reviewGithubPullRequest({
    repository: source.repository,
    branch: source.branch,
    projectCode,
    prNumber,
    mergeSha: historical.sha
  }, get, token);
  if (!evidence.verifiedMerge || evidence.classification !== 'REVIEW_REQUIRED' || !evidence.milestoneKey) {
    return { ...base, evidence, disposition: evidence.classification === 'NO_MARKER' ? 'UNMATCHED' : 'BLOCKED',
      reason: evidence.reason };
  }
  return { ...base, evidence, milestoneKey: evidence.milestoneKey,
    disposition: 'REVIEW_REQUIRED', reason: 'PR_EVIDENCE_REQUIRES_APPROVAL' };
}

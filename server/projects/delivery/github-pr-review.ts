import { object, string, providerGet } from './http';
import { reviewMergeEvidence, type MergeReview } from './merge-evidence';

export type PrAttributionInput = {
  repository: string;
  branch: string;
  projectCode: string;
  prNumber: number;
  mergeSha: string;
};
export type PrAttributionResult = MergeReview & {
  prNumber: number;
  verifiedMerge: boolean;
};
export type Get = (url: URL, token: string | undefined) => Promise<unknown>;

const sha = /^[a-f0-9]{40}$/;
const repo = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const result = (input: PrAttributionInput, classification: MergeReview['classification'], reason: string): PrAttributionResult => ({
  prNumber: input.prNumber, verifiedMerge: false, classification, reason, milestoneKey: null, markers: []
});

/**
 * PM-03B: fetches and validates the exact GitHub pull request, merge commit,
 * and complete bounded PR commit list. READ ONLY.
 * The source repository, branch, project code and expected SHA must come from
 * trusted DeliverySource/Project context, never PR body or title.
 */
export async function reviewGithubPullRequest(
  input: PrAttributionInput,
  get: Get = providerGet,
  token: string | undefined = process.env.RCENTZ_DELIVERY_GITHUB_TOKEN
): Promise<PrAttributionResult> {
  if (!repo.test(input.repository) || input.repository.includes('..') ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,120}$/.test(input.branch) || input.branch.includes('..') ||
      !/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/.test(input.projectCode) ||
      !Number.isSafeInteger(input.prNumber) || input.prNumber < 1 || !sha.test(input.mergeSha))
    return result(input, 'INVALID_INPUT', 'INVALID_SOURCE_CONTEXT');

  const base = `https://api.github.com/repos/${input.repository}`;
  const url = (path: string) => new URL(`${base}/${path}`);
  // URLs are formed exclusively from strictly validated source fields.
  const pr = object(await get(url(`pulls/${input.prNumber}`), token));
  const baseInfo = object(pr.base);
  const baseRepo = object(baseInfo.repo);
  if (pr.number !== input.prNumber ||
      typeof baseRepo.full_name !== 'string' ||
      baseRepo.full_name.toLowerCase() !== input.repository.toLowerCase() ||
      baseInfo.ref !== input.branch ||
      pr.merged !== true ||
      pr.state !== 'closed' ||
      pr.merge_commit_sha !== input.mergeSha)
    return result(input, 'AMBIGUOUS', 'PR_MERGE_OR_SOURCE_MISMATCH');

  // GitHub REST pull commit listing is bounded to one page. Reject instead of
  // reporting a partial set as definitive evidence.
  if (typeof pr.commits !== 'number' || !Number.isSafeInteger(pr.commits) || pr.commits < 1 || pr.commits > 100)
    return result(input, 'AMBIGUOUS', 'PR_COMMIT_COUNT_UNSUPPORTED');

  const merge = object(await get(url(`commits/${input.mergeSha}`), token));
  if (merge.sha !== input.mergeSha || !Array.isArray(merge.parents) || merge.parents.length < 2)
    return result(input, 'AMBIGUOUS', 'NOT_A_TWO_PARENT_MERGE');
  const parents = merge.parents.map(p => string(object(p).sha));
  if (!parents.every(p => sha.test(p)))
    return result(input, 'INVALID_INPUT', 'INVALID_MERGE_PARENTS');

  const commitsUrl = url(`pulls/${input.prNumber}/commits?per_page=100&page=1`);
  const raw = await get(commitsUrl, token);
  if (!Array.isArray(raw) || raw.length !== pr.commits)
    return result(input, 'AMBIGUOUS', 'INCOMPLETE_PR_COMMITS');

  const commits = raw.map(item => {
    const c = object(item);
    return { sha: string(c.sha), message: string(object(c.commit).message) };
  });

  // For a standard 2-parent merge, the second parent is the merged PR head.
  // Rebase/squash and alternative histories need a different verification path.
  const head = object(pr.head);
  if (head.sha !== parents[1] || !commits.some(c => c.sha === head.sha))
    return result(input, 'AMBIGUOUS', 'PR_HEAD_NOT_MERGE_PARENT');

  const review = reviewMergeEvidence({
    mergeSha: input.mergeSha,
    mergeParents: parents,
    projectCode: input.projectCode,
    featureCommits: commits
  });
  return { ...review, prNumber: input.prNumber, verifiedMerge: true,
    reason: review.classification === 'REVIEW_REQUIRED' ? 'VERIFIED_PR_REQUIRES_HUMAN_REVIEW' : review.reason };
}

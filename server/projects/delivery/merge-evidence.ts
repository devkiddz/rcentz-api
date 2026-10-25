import { markerForProject, projectMarker, type ProjectMarker } from './project-marker';

/**
 * PM-03A: evidence-only merge review. No writes or implicit state transitions.
 * Caller must independently verify the PR belongs to this merge and source.
 */
export type MergeEvidence = {
  mergeSha: string;
  mergeParents: readonly string[];
  projectCode: string;
  featureCommits: readonly { sha: string; message: string }[];
};
export type MergeReview = {
  classification: 'REVIEW_REQUIRED' | 'AMBIGUOUS' | 'NO_MARKER' | 'INVALID_INPUT';
  reason: string;
  milestoneKey: string | null;
  markers: readonly { sha: string; operation: ProjectMarker['operation']; title: string; description: string | null }[];
};
const shaPattern = /^[a-f0-9]{40}$/;
const no = (classification: MergeReview['classification'], reason: string): MergeReview =>
  ({ classification, reason, milestoneKey: null, markers: [] });

export function reviewMergeEvidence(input: MergeEvidence): MergeReview {
  if (
    !shaPattern.test(input.mergeSha) ||
    input.mergeParents.length < 2 ||
    !input.mergeParents.every(p => shaPattern.test(p)) ||
    !/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/.test(input.projectCode) ||
    input.featureCommits.length > 100
  ) return no('INVALID_INPUT', 'INVALID_MERGE_CONTEXT');

  const seen = new Set<string>();
  const matched: { sha: string; operation: ProjectMarker['operation']; title: string; description: string | null; key: string }[] = [];
  let foreign = false;
  try {
    for (const item of input.featureCommits) {
      if (!shaPattern.test(item.sha) || seen.has(item.sha) || item.message.length > 16000) {
        return no('INVALID_INPUT', 'INVALID_FEATURE_COMMIT');
      }
      seen.add(item.sha);
      const parsed = projectMarker(item.message);
      if (!parsed) continue;
      if (parsed.projectCode !== input.projectCode) { foreign = true; continue; }
      // Defense-in-depth on source-project binding.
      const bound = markerForProject(item.message, input.projectCode)!;
      matched.push({
        sha: item.sha, key: bound.milestoneKey, operation: bound.operation,
        title: bound.title, description: bound.description
      });
    }
  } catch {
    return no('AMBIGUOUS', 'INVALID_MARKER_EVIDENCE');
  }
  if (foreign) return no('AMBIGUOUS', 'CROSS_PROJECT_MARKER');
  if (!matched.length) return no('NO_MARKER', 'NO_PROJECT_MARKERS_FOUND');
  const keys = new Set(matched.map(m => m.key));
  if (keys.size !== 1) return no('AMBIGUOUS', 'MULTIPLE_MILESTONE_KEYS');
  return {
    classification: 'REVIEW_REQUIRED',
    reason: 'UNVERIFIED_PR_ASSOCIATION',
    milestoneKey: matched[0].key,
    markers: matched.map(({ key: _key, ...rest }) => rest)
  };
}

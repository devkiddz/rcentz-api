/** Pure milestone accountability policy. No database writes or authorization decisions. */
export type CriterionState = {
  id: string;
  required: boolean;
  verified: boolean;
  revision: number;
};
export type ReviewState = {
  decision: string;
  criteriaRevision: number;
};
export type MilestoneState = {
  id: string;
  status: string;
  criteria: readonly CriterionState[];
  reviews: readonly ReviewState[];
  delivery?: { phase: string } | null;
};
export type Progress = { measured: boolean; percent: number | null };

export function criteriaRevision(criteria: readonly CriterionState[]): number {
  return criteria.reduce((highest, item) => Math.max(highest, item.revision), 0);
}

export function milestoneCriteriaProgress(criteria: readonly CriterionState[]): Progress {
  const required = criteria.filter(item => item.required);
  if (required.length === 0) return { measured: false, percent: null };
  const verified = required.filter(item => item.verified).length;
  return { measured: true, percent: Math.floor((verified * 100) / required.length) };
}

export function isMilestoneApproved(milestone: MilestoneState): boolean {
  if (milestone.status === 'CANCELLED') return false;
  const progress = milestoneCriteriaProgress(milestone.criteria);
  if (!progress.measured || progress.percent !== 100) return false;
  const latestReview = milestone.reviews.at(-1);
  return latestReview?.decision === 'APPROVED' &&
    latestReview.criteriaRevision === criteriaRevision(milestone.criteria);
}

export function projectCalculatedProgress(milestones: readonly MilestoneState[]): Progress {
  const governed = milestones.filter(m => m.status !== 'CANCELLED' && m.delivery?.phase !== 'CANCELLED');
  if (governed.length === 0) return { measured: false, percent: null };
  const approved = governed.filter(m => m.delivery ? m.delivery.phase === 'COMPLETE' : isMilestoneApproved(m)).length;
  return { measured: true, percent: Math.floor((approved * 100) / governed.length) };
}

export function canApproveMilestone(milestone: MilestoneState): boolean {
  if (milestone.status === 'CANCELLED') return false;
  const progress = milestoneCriteriaProgress(milestone.criteria);
  return progress.measured && progress.percent === 100;
}

export function validateProgressOverride(input: { percent: number; reason: string }): string | null {
  if (!Number.isInteger(input.percent) || input.percent < 0 || input.percent > 100) {
    return 'Override percent must be an integer between 0 and 100.';
  }
  if (input.reason.trim().length < 10 || input.reason.trim().length > 1000) {
    return 'Override reason must be between 10 and 1000 characters.';
  }
  return null;
}

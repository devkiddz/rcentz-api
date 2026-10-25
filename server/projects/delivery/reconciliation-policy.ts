import type { AttributionCandidate } from './attribution-candidate';

export type ReconciliationDecision = 'APPROVE' | 'REJECT';
export type ReconciliationOutcome = {
  permitted: boolean;
  code: string;
  intent: 'LINK_ONLY' | 'REJECTION_ONLY' | 'NONE';
  /** Never authorizes completion or changes to original SHA/message. */
  affectsCompletion: false;
};

export type ReconciliationContext = {
  actorRole: string;
  actorStatus: string;
  decision: ReconciliationDecision;
  reason: string;
  candidate: AttributionCandidate;
  expectedProjectId: string;
  commitStillUnlinked: boolean;
  targetMilestone: {
    id: string;
    projectId: string;
    deliverySourceId: string | null;
    deliveryKey: string | null;
  } | null;
  sourceId: string;
  priorDecision: 'NONE' | 'APPROVED' | 'REJECTED';
};

/**
 * Pure PM-04A policy. A positive result permits a future transactional
 * attempt only; transaction must recheck actor, source, target, evidence,
 * unique linkage and prior decisions under locks.
 */
export function reconcileDecisionPolicy(x: ReconciliationContext): ReconciliationOutcome {
  const deny = (code: string): ReconciliationOutcome =>
    ({ permitted: false, code, intent: 'NONE', affectsCompletion: false });

  if (x.actorRole !== 'SUPER_ADMIN' || x.actorStatus !== 'ACTIVE')
    return deny('REVIEWER_NOT_AUTHORIZED');
  if (x.reason.trim().length < 15 || x.reason.trim().length > 1000)
    return deny('INVALID_REVIEW_REASON');
  if (x.priorDecision !== 'NONE') return deny('PRIOR_DECISION_EXISTS');
  if (!x.expectedProjectId || x.candidate.projectId !== x.expectedProjectId)
    return deny('PROJECT_ID_MISMATCH');
  if (!x.commitStillUnlinked) return deny('COMMIT_ALREADY_LINKED');
  if (x.decision === 'REJECT')
    return { permitted: true, code: 'REJECTION_REQUIRES_AUDIT', intent: 'REJECTION_ONLY', affectsCompletion: false };

  const candidate = x.candidate;
  if (candidate.disposition !== 'REVIEW_REQUIRED' || !candidate.requiresApproval ||
      !candidate.milestoneKey || !candidate.evidence?.verifiedMerge ||
      candidate.evidence.classification !== 'REVIEW_REQUIRED' ||
      candidate.evidence.milestoneKey !== candidate.milestoneKey ||
      candidate.evidence.prNumber !== candidate.prNumber)
    return deny('EVIDENCE_NOT_APPROVABLE');

  if (!x.targetMilestone || x.targetMilestone.projectId !== x.expectedProjectId)
    return deny('TARGET_PROJECT_MISMATCH');
  if (x.targetMilestone.deliverySourceId !== x.sourceId ||
      x.targetMilestone.deliveryKey !== candidate.milestoneKey)
    return deny('TARGET_DELIVERY_MISMATCH');

  return { permitted: true, code: 'APPROVAL_REQUIRES_TRANSACTION', intent: 'LINK_ONLY', affectsCompletion: false };
}

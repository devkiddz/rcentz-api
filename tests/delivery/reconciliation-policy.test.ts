import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileDecisionPolicy, type ReconciliationContext } from '../../server/projects/delivery/reconciliation-policy';

const base: ReconciliationContext = {
  actorRole: 'SUPER_ADMIN', actorStatus: 'ACTIVE', decision: 'APPROVE',
  reason: 'The PR and project marker have been verified independently.',
  expectedProjectId: 'project-1', sourceId: 'source-1', commitStillUnlinked: true, priorDecision: 'NONE',
  targetMilestone: { id: 'milestone-1', projectId: 'project-1', deliverySourceId: 'source-1', deliveryKey: 'PMC-01' },
  candidate: {
    projectId: 'project-1', projectCode: 'RCENTZ-SYSTEMS',
    sourceRepository: 'devkiddz/rcentz-systems', sourceBranch: 'main',
    mergeSha: 'a'.repeat(40), prNumber: 5, milestoneKey: 'PMC-01',
    disposition: 'REVIEW_REQUIRED', reason: 'PR_EVIDENCE_REQUIRES_APPROVAL', requiresApproval: true,
    evidence: {prNumber: 5, verifiedMerge: true, classification: 'REVIEW_REQUIRED',
      reason: 'VERIFIED_PR_REQUIRES_HUMAN_REVIEW', milestoneKey: 'PMC-01',
      markers: [{sha: 'b'.repeat(40), operation: 'start', title: 'Console implementation', description: 'Add tracking'}]}
  }
};
test('approval permits link intent only, not completion', () => {
  const r = reconcileDecisionPolicy(base);
  assert.equal(r.permitted, true); assert.equal(r.intent, 'LINK_ONLY'); assert.equal(r.affectsCompletion, false);
});
test('review requires active super admin', () => {
  for (const x of [{actorRole:'ADMIN'}, {actorStatus:'SUSPENDED'}])
    assert.equal(reconcileDecisionPolicy({...base,...x}).code, 'REVIEWER_NOT_AUTHORIZED');
});
test('reject decision authorizes audit intent only', () => {
  const r=reconcileDecisionPolicy({...base,decision:'REJECT',targetMilestone:null});
  assert.equal(r.permitted,true); assert.equal(r.intent,'REJECTION_ONLY');
});
test('history cannot be reassigned or reviewed twice', () => {
  assert.equal(reconcileDecisionPolicy({...base,commitStillUnlinked:false}).code,'COMMIT_ALREADY_LINKED');
  assert.equal(reconcileDecisionPolicy({...base,priorDecision:'APPROVED'}).code,'PRIOR_DECISION_EXISTS');
});
test('wrong project, source or key blocks approval', () => {
  assert.equal(reconcileDecisionPolicy({...base,expectedProjectId:'another'}).code,'PROJECT_ID_MISMATCH');
  assert.equal(reconcileDecisionPolicy({...base,targetMilestone:{...base.targetMilestone!,deliveryKey:'OTHER-01'}}).code,'TARGET_DELIVERY_MISMATCH');
});
test('unverified evidence cannot approve', () => {
  assert.equal(reconcileDecisionPolicy({...base,candidate:{...base.candidate,evidence:{...base.candidate.evidence!,verifiedMerge:false}}}).code,'EVIDENCE_NOT_APPROVABLE');
});
test('reasons require substantive justification', () => {
  assert.equal(reconcileDecisionPolicy({...base,reason:'ok'}).code,'INVALID_REVIEW_REASON');
});

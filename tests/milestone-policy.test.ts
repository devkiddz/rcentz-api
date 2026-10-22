import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  milestoneCriteriaProgress, isMilestoneApproved, projectCalculatedProgress,
  canApproveMilestone, validateProgressOverride
} from '../server/projects/governance/milestone-policy';
const criterion = (id: string, verified: boolean, revision = 1) => ({ id, verified, revision, required: true });
const milestone = (criteria: ReturnType<typeof criterion>[], reviews: {decision:string;criteriaRevision:number}[] = []) =>
  ({ id: 'm1', status: 'COMPLETED', criteria, reviews });
test('empty criteria are unmeasured, never automatically approved', () => {
  assert.deepEqual(milestoneCriteriaProgress([]), { measured: false, percent: null });
  assert.equal(isMilestoneApproved(milestone([], [{ decision: 'APPROVED', criteriaRevision: 0 }])), false);
});
test('only required criteria count', () => {
  assert.deepEqual(milestoneCriteriaProgress([criterion('a', true), { ...criterion('b', false), required: false }]), { measured: true, percent: 100 });
});
test('all verified without approval is not approved', () => {
  assert.equal(canApproveMilestone(milestone([criterion('a', true)])), true);
  assert.equal(isMilestoneApproved(milestone([criterion('a', true)])), false);
});
test('review revision must match current criteria revision', () => {
  assert.equal(isMilestoneApproved(milestone([criterion('a', true, 2)], [{ decision: 'APPROVED', criteriaRevision: 1 }])), false);
  assert.equal(isMilestoneApproved(milestone([criterion('a', true, 2)], [{ decision: 'APPROVED', criteriaRevision: 2 }])), true);
});
test('latest rejection revokes earlier approval', () => {
  assert.equal(isMilestoneApproved(milestone([criterion('a', true)], [{decision:'APPROVED',criteriaRevision:1},{decision:'REJECTED',criteriaRevision:1}])), false);
});
test('project progress retains unmeasured milestones in denominator', () => {
  const a = milestone([criterion('a', true)], [{decision:'APPROVED',criteriaRevision:1}]);
  const b = milestone([criterion('b', false)]);
  assert.deepEqual(projectCalculatedProgress([a,b,milestone([])]), { measured: true, percent: 33 });
  assert.deepEqual(projectCalculatedProgress([milestone([])]), { measured: true, percent: 0 });
});
test('override requires bounded percentage and reason', () => {
  assert.ok(validateProgressOverride({ percent: 101, reason: 'Valid justification' }));
  assert.ok(validateProgressOverride({ percent: 20, reason: 'short' }));
  assert.equal(validateProgressOverride({ percent: 20, reason: 'Reviewed schedule and approved exception' }), null);
});

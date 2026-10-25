import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttributionCandidate } from '../server/projects/delivery/attribution-candidate';
import { reconcileDecisionPolicy } from '../server/projects/delivery/reconciliation-policy';
import type { Get } from '../server/projects/delivery/github-pr-review';

const SHA = (n: number) => n.toString(16).padStart(40, '0');
const source = { projectId: 'pm04b4-project', projectSlug: 'rcentz-systems', repository: 'devkiddz/rcentz-systems', branch: 'main' };
const historical = {sourceProjectId: source.projectId, sourceRepository: source.repository, sourceBranch: source.branch,
  sha: SHA(90), existingMilestoneId: null, issue: 'NO_ACTIVE_MILESTONE'};
const marker = 'milestone(MS-RCENTZ-SYSTEMS/PMC-01): Verified feature implementation';
const goodGet: Get = async (url) => {
  if (url.pathname.endsWith('/pulls/5')) return {
    number: 5, merged: true, state: 'closed', merge_commit_sha: SHA(90), commits: 1,
    base: { ref: 'main', repo: { full_name: source.repository } }, head: { sha: SHA(89) }
  };
  if (url.pathname.endsWith('/commits/' + SHA(90))) return {
    sha: SHA(90), parents: [{ sha: SHA(88) }, { sha: SHA(89) }]
  };
  if (url.pathname.endsWith('/pulls/5/commits')) return [{ sha: SHA(89), commit: { message: marker } }];
  throw new Error('UNEXPECTED_GITHUB_REQUEST:' + url.pathname);
};

const candidate = () => buildAttributionCandidate(source, historical, 5, goodGet, 'test-token');

test('verified two-parent merge produces a review-only attribution candidate', async () => {
  const c = await candidate();
  assert.equal(c.disposition, 'REVIEW_REQUIRED');
  assert.equal(c.evidence?.verifiedMerge, true);
  assert.equal(c.milestoneKey, 'PMC-01');
  assert.equal(c.requiresApproval, true);
});

test('human approval policy permits LINK_ONLY, never completion', async () => {
  const c = await candidate();
  const r = reconcileDecisionPolicy({actorRole:'SUPER_ADMIN',actorStatus:'ACTIVE',decision:'APPROVE',
    reason:'Independently reviewed the verified merge evidence.', candidate:c,
    expectedProjectId:source.projectId,commitStillUnlinked:true,sourceId:'pm04b4-source',priorDecision:'NONE',
    targetMilestone:{id:'pm04b4-milestone',projectId:source.projectId,deliverySourceId:'pm04b4-source',deliveryKey:'PMC-01'}});
  assert.equal(r.permitted, true); assert.equal(r.intent, 'LINK_ONLY'); assert.equal(r.affectsCompletion, false);
});

test('wrong target key cannot receive a verified commit', async () => {
  const c=await candidate();
  const r = reconcileDecisionPolicy({actorRole:'SUPER_ADMIN',actorStatus:'ACTIVE',decision:'APPROVE',
    reason:'Independently reviewed the verified merge evidence.', candidate:c,
    expectedProjectId:source.projectId,commitStillUnlinked:true,sourceId:'pm04b4-source',priorDecision:'NONE',
    targetMilestone:{id:'pm04b4-milestone',projectId:source.projectId,deliverySourceId:'pm04b4-source',deliveryKey:'WRONG-01'}});
  assert.equal(r.permitted,false); assert.equal(r.code,'TARGET_DELIVERY_MISMATCH');
});

test('mismatched PR merge SHA blocks approval', async () => {
  const altered: Get=async(url, token)=>{
    if(url.pathname.endsWith('/pulls/5')) return {...(await goodGet(url,token) as object),merge_commit_sha:SHA(91)};
    return goodGet(url,token);
  };
  const c=await buildAttributionCandidate(source,historical,5,altered,'test-token');
  assert.equal(c.disposition,'BLOCKED');assert.equal(c.evidence?.verifiedMerge,false);
});

test('unlinked history cannot be approved twice', async () => {
  const c=await candidate();
  const r=reconcileDecisionPolicy({actorRole:'SUPER_ADMIN',actorStatus:'ACTIVE',decision:'APPROVE',
    reason:'Independently reviewed the verified merge evidence.',candidate:c,
    expectedProjectId:source.projectId,commitStillUnlinked:true,sourceId:'pm04b4-source',priorDecision:'APPROVED',
    targetMilestone:{id:'pm04b4-milestone',projectId:source.projectId,deliverySourceId:'pm04b4-source',deliveryKey:'PMC-01'}});
  assert.equal(r.permitted,false);assert.equal(r.code,'PRIOR_DECISION_EXISTS');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewGithubPullRequest, type Get } from '../../server/projects/delivery/github-pr-review';

const s = (n: number) => n.toString(16).padStart(40, '0');
const input = { repository: 'devkiddz/rcentz-api', branch: 'main', projectCode: 'RCENTZ-API', prNumber: 5, mergeSha: s(9) };
const pr = { number: 5, merged: true, state: 'closed', merge_commit_sha: s(9), commits: 2,
  base: { ref: 'main', repo: { full_name: 'devkiddz/rcentz-api' } }, head: { sha: s(8) } };
const merge = { sha:s(9), parents:[{sha:s(7)},{sha:s(8)}] };
const commits = [{sha:s(6),commit:{message:'milestone(MS-RCENTZ-API/PMC-01): Delivery engine\n\nDescription: Evidence reader'}},
  {sha:s(8),commit:{message:'feat: provider integration'}}];
const fake = (overrides: {pr?:unknown;merge?:unknown;commits?:unknown}={}):Get => async (url)=>{
  if(url.pathname.endsWith('/pulls/5')) return overrides.pr ?? pr;
  if(url.pathname.endsWith('/commits/'+s(9))) return overrides.merge ?? merge;
  if(url.pathname.endsWith('/pulls/5/commits')) return overrides.commits ?? commits;
  throw Error('UNEXPECTED_REQUEST');
};
test('verified merged PR gives review-only attribution',async()=>{
 const x=await reviewGithubPullRequest(input,fake(),'test');
 assert.equal(x.verifiedMerge,true);assert.equal(x.classification,'REVIEW_REQUIRED');
 assert.equal(x.milestoneKey,'PMC-01');assert.equal(x.reason,'VERIFIED_PR_REQUIRES_HUMAN_REVIEW');
});
test('wrong repository, branch or SHA never verified',async()=>{
 for(const changed of [
  {...pr,base:{...pr.base,ref:'release'}},
  {...pr,base:{...pr.base,repo:{full_name:'other/repo'}}},
  {...pr,merge_commit_sha:s(10)}
 ]) {
  const x=await reviewGithubPullRequest(input,fake({pr:changed}),'test');
  assert.equal(x.verifiedMerge,false);
 }
});
test('unmerged and squash PR rejected',async()=>{
 assert.equal((await reviewGithubPullRequest(input,fake({pr:{...pr,merged:false}}),'test')).verifiedMerge,false);
 assert.equal((await reviewGithubPullRequest(input,fake({merge:{...merge,parents:[{sha:s(7)}]}}),'test')).reason,'NOT_A_TWO_PARENT_MERGE');
});
test('incomplete list and head mismatch rejected',async()=>{
 assert.equal((await reviewGithubPullRequest(input,fake({commits:[commits[0]]}),'test')).reason,'INCOMPLETE_PR_COMMITS');
 assert.equal((await reviewGithubPullRequest(input,fake({pr:{...pr,head:{sha:s(77)}}}),'test')).reason,'PR_HEAD_NOT_MERGE_PARENT');
});
test('cross-project marker stays ambiguous even with valid PR',async()=>{
 const x=await reviewGithubPullRequest(input,fake({commits:[{...commits[0],commit:{message:'milestone(MS-WAFFI/PMC-01): Wrong project'}},commits[1]]}),'test');
 assert.equal(x.classification,'AMBIGUOUS');
});
test('invalid source context rejected before provider access',async()=>{
 const x=await reviewGithubPullRequest({...input,repository:'other/repo/evil'},async()=>{throw Error('called');},'test');
 assert.equal(x.classification,'INVALID_INPUT');assert.equal(x.verifiedMerge,false);
});

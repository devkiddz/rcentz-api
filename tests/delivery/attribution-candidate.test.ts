import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttributionCandidate } from '../../server/projects/delivery/attribution-candidate';
import type { Get } from '../../server/projects/delivery/github-pr-review';
const s=(x:number)=>x.toString(16).padStart(40,'0');
const source={projectId:'project-1',projectSlug:'rcentz-systems',repository:'devkiddz/rcentz-systems',branch:'main'};
const historical={sourceProjectId:'project-1',sourceRepository:source.repository,sourceBranch:'main',sha:s(9),existingMilestoneId:null,issue:'NO_ACTIVE_MILESTONE'};
const fake:Get=async url=>{
 if(url.pathname.endsWith('/pulls/5')) return {number:5,merged:true,state:'closed',merge_commit_sha:s(9),commits:1,
   base:{ref:'main',repo:{full_name:source.repository}},head:{sha:s(8)}};
 if(url.pathname.endsWith('/commits/'+s(9))) return {sha:s(9),parents:[{sha:s(7)},{sha:s(8)}]};
 if(url.pathname.endsWith('/pulls/5/commits')) return [{sha:s(8),commit:{message:'milestone(MS-RCENTZ-SYSTEMS/PMC-01): Console work'}}];
 throw Error('UNEXPECTED_GET');
};
test('verified PR creates an approval candidate, never an automatic association',async()=>{
 const r=await buildAttributionCandidate(source,historical,5,fake,'test');
 assert.equal(r.disposition,'REVIEW_REQUIRED');assert.equal(r.milestoneKey,'PMC-01');
 assert.equal(r.requiresApproval,true);assert.equal(r.evidence?.verifiedMerge,true);
});
test('cross-project historical commit is blocked without provider calls',async()=>{
 const r=await buildAttributionCandidate(source,{...historical,sourceProjectId:'other'},5,async()=>{throw Error('CALLED')},'test');
 assert.equal(r.reason,'HISTORICAL_SOURCE_MISMATCH');
});
test('already linked history is never reassigned',async()=>{
 const r=await buildAttributionCandidate(source,{...historical,existingMilestoneId:'milestone-1'},5,async()=>{throw Error('CALLED')},'test');
 assert.equal(r.reason,'HISTORICAL_COMMIT_ALREADY_LINKED');
});
test('PR mismatch does not become an eligible candidate',async()=>{
 const r=await buildAttributionCandidate(source,historical,6,async()=>({number:6,merged:false,state:'open',base:{ref:'main',repo:{full_name:source.repository}}}),'test');
 assert.equal(r.disposition,'BLOCKED');assert.equal(r.milestoneKey,null);
});
test('normal PR without marker stays unmatched',async()=>{
 const get:Get=async url=>url.pathname.endsWith('/pulls/5/commits')?
  [{sha:s(8),commit:{message:'feat: no milestone'}}]:fake(url,undefined);
 const r=await buildAttributionCandidate(source,historical,5,get,'test');
 assert.equal(r.disposition,'UNMATCHED');assert.equal(r.milestoneKey,null);
});
test('invalid history sha blocked without GitHub call',async()=>{
 const r=await buildAttributionCandidate(source,{...historical,sha:'invalid'},5,async()=>{throw Error('CALLED')},'test');
 assert.equal(r.reason,'INVALID_HISTORICAL_SHA');
});

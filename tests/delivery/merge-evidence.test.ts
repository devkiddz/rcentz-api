import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewMergeEvidence } from '../../server/projects/delivery/merge-evidence';
const s = (n: number) => n.toString(16).padStart(40, '0');
const base = {mergeSha:s(20),mergeParents:[s(18),s(19)],projectCode:'RCENTZ-SYSTEMS'};
const m = (n:number,message:string)=>({sha:s(n),message});
test('one project milestone produces review, never automatic attribution',()=>{
 const x=reviewMergeEvidence({...base,featureCommits:[m(1,'milestone(MS-RCENTZ-SYSTEMS/PMC-01): Project console\n\nDescription: Initial dashboard'),m(2,'feat: cards')]});
 assert.equal(x.classification,'REVIEW_REQUIRED');assert.equal(x.milestoneKey,'PMC-01');
 assert.equal(x.markers[0].description,'Initial dashboard');
});
test('project mismatch is ambiguous',()=>{
 assert.equal(reviewMergeEvidence({...base,featureCommits:[m(1,'milestone(MS-WAFFI/PMC-01): Other project')]}).reason,'CROSS_PROJECT_MARKER');
});
test('multiple milestones cannot be assigned by sequence',()=>{
 assert.equal(reviewMergeEvidence({...base,featureCommits:[m(1,'milestone(MS-RCENTZ-SYSTEMS/PMC-01): One milestone'),m(2,'milestone(MS-RCENTZ-SYSTEMS/PMC-02): Second milestone')]}).classification,'AMBIGUOUS');
});
test('merge message alone and no evidence remains unmatched',()=>{
 assert.equal(reviewMergeEvidence({...base,featureCommits:[]}).classification,'NO_MARKER');
});
test('duplicate SHA and non-merge context rejected',()=>{
 assert.equal(reviewMergeEvidence({...base,mergeParents:[s(19)],featureCommits:[]}).classification,'INVALID_INPUT');
 assert.equal(reviewMergeEvidence({...base,featureCommits:[m(1,'feat: a'),m(1,'feat: b')]}).classification,'INVALID_INPUT');
});
test('legacy and malformed scoped markers do not authorize automatic attribution',()=>{
 assert.equal(reviewMergeEvidence({...base,featureCommits:[m(1,'milestone(MS-PMC-01): Old marker')]}).classification,'NO_MARKER');
 assert.equal(reviewMergeEvidence({...base,featureCommits:[m(1,'milestone(MS-rcentz/PMC-01): Invalid')]}).classification,'AMBIGUOUS');
});

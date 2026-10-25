import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveScopedCommit, projectCodeFromSlug } from '../../server/projects/delivery/scoped-commit';
import { applyCommit } from '../../server/projects/delivery/policy';

const c = (message: string) => ({ sha:'a'.repeat(40), message, date:'2026-10-25T10:00:00Z', parents:['b'.repeat(40)] });
const empty = () => ({ activeKey:null, items:{} });
test('project slug establishes canonical project identity', () => {
  assert.equal(projectCodeFromSlug('rcentz-systems'),'RCENTZ-SYSTEMS');
  assert.throws(()=>projectCodeFromSlug('bad/slug'),/INVALID_PROJECT_SLUG/);
});
test('qualified MS flows through established reducer without changing policy', () => {
  const resolved=resolveScopedCommit(c('milestone(MS-RCENTZ-SYSTEMS/PMC-01): Project console\n\nDescription: Git tracking'), 'RCENTZ-SYSTEMS');
  assert.equal(resolved.issue,null);assert.equal(resolved.description,'Git tracking');
  const state=applyCommit(empty(),resolved.commit);
  assert.equal(state.key,'PMC-01');assert.equal(state.issue,null);
});
test('foreign project marker is held for review',()=>{
  const r=resolveScopedCommit(c('milestone(MS-WAFFI/PMC-01): Other project'),'RCENTZ-SYSTEMS');
  assert.equal(r.issue,'PROJECT_MARKER_MISMATCH');
});
test('malformed scoped marker cannot inherit active state',()=>{
  const r=resolveScopedCommit(c('milestone(MS-rcentz/PMC-01): Broken'),'RCENTZ-SYSTEMS');
  assert.equal(r.issue,'INVALID_PROJECT_MARKER');
});
test('legacy markers and normal messages are passed through unchanged',()=>{
  const old=c('milestone(MS-AUTH-01): Login system');
  assert.equal(resolveScopedCommit(old,'RCENTZ-SYSTEMS').commit,old);
  const ordinary=c('feat: normal message');
  assert.equal(resolveScopedCommit(ordinary,'RCENTZ-SYSTEMS').commit,ordinary);
});
test('qualified MSC and MSS use existing governance paths',()=>{
  assert.equal(resolveScopedCommit(c('milestone(MSC-RCENTZ-SYSTEMS/PMC-01): Complete console'),'RCENTZ-SYSTEMS').commit.message,
    'milestone(MSC-PMC-01): Complete console');
  assert.equal(resolveScopedCommit(c('milestone(MSS-RCENTZ-SYSTEMS/PMC-01): Seal console'),'RCENTZ-SYSTEMS').commit.message,
    'milestone(MSS-PMC-01): Seal console');
});

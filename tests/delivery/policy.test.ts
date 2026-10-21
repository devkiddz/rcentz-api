import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommit, marker, completionReady, firstParentBatch, type State, type Commit } from '../../server/projects/delivery/policy';
import { parseSources } from '../../server/projects/delivery/config';
import { projectCalculatedProgress, canApproveMilestone } from '../../server/projects/governance/milestone-policy';
import { validateEvidence } from '../../server/projects/governance/verification-evidence';
const sha = (n: number) => n.toString(16).padStart(40, '0');
const commit = (n: number, message: string): Commit => ({ sha: sha(n), message, date: '2026-10-21T10:00:00Z', parents: [sha(n - 1)] });
const empty = (): State => ({ activeKey: null, items: {} });
const opened = () => applyCommit(empty(), commit(1, 'milestone start AUTH-01: Account authentication')).state;

test('marker creates parent and subsequent commit inherits it', () => {
  const start = applyCommit(empty(), commit(1, 'milestone start AUTH-01: Account authentication'));
  assert.equal(start.key, 'AUTH-01'); assert.equal(start.state.items['AUTH-01'].title, 'Account authentication');
  assert.equal(applyCommit(start.state, commit(2, 'feat(auth): email login')).key, 'AUTH-01');
});
test('completion seals grouping but does not mark complete before provider checks', () => {
  const complete = applyCommit(opened(), commit(2, 'milestone complete AUTH-01: Account authentication'));
  assert.equal(complete.state.items['AUTH-01'].phase, 'AWAITING'); assert.equal(complete.state.activeKey, null);
  assert.equal(applyCommit(complete.state, commit(3, 'fix: follow-up')).issue, 'NO_ACTIVE_MILESTONE');
});
test('reopen clears old completion SHA and permits new children', () => {
  let state = applyCommit(opened(), commit(2, 'milestone complete AUTH-01: Account authentication')).state;
  state = applyCommit(state, commit(3, 'milestone reopen AUTH-01: Fix production failure')).state;
  assert.equal(state.items['AUTH-01'].completionSha, null);
  assert.equal(applyCommit(state, commit(4, 'fix(auth): session')).key, 'AUTH-01');
});
test('new milestone cannot silently steal an active stream', () => {
  const state = opened(), result = applyCommit(state, commit(2, 'milestone start BILL-01: Billing setup'));
  assert.equal(result.issue, 'ACTIVE_MILESTONE_EXISTS'); assert.deepEqual(result.state, state);
});
test('cancel closes parent without completion', () => {
  const result = applyCommit(opened(), commit(2, 'milestone cancel AUTH-01: Scope withdrawn'));
  assert.equal(result.state.items['AUTH-01'].phase, 'CANCELLED'); assert.equal(result.state.activeKey, null);
});
test('malformed, unknown and conflicting markers become visible unassigned commits', () => {
  assert.equal(applyCommit(opened(), commit(2, 'milestone complete UNKNOWN-01: Unknown feature')).issue, 'UNKNOWN_MILESTONE');
  assert.equal(applyCommit(opened(), commit(2, 'milestone start bad')).issue, 'INVALID_MARKER');
  assert.equal(applyCommit(opened(), commit(2, 'fix: example\n\nMilestone: AUTH-01\nMilestone: AUTH-01')).issue, 'AMBIGUOUS_MILESTONE');
});
test('explicit trailer resolves an open milestone and cannot append to a closed one', () => {
  assert.equal(applyCommit(opened(), commit(2, 'fix: login\n\nMilestone: AUTH-01')).key, 'AUTH-01');
  const state = applyCommit(opened(), commit(2, 'milestone complete AUTH-01: Account authentication')).state;
  assert.equal(applyCommit(state, commit(3, 'fix: login\n\nMilestone: AUTH-01')).issue, 'REOPEN_REQUIRED');
});
test('markers in body examples cannot open milestones', () => {
  assert.equal(marker('docs: instructions\n\nmilestone start AUTH-01: Account authentication'), null);
});
test('source streams remain isolated and reducer does not mutate input', () => {
  const initial = empty(); applyCommit(initial, commit(1, 'milestone start AUTH-01: Account authentication'));
  assert.deepEqual(initial, empty()); assert.equal(applyCommit(empty(), commit(2, 'fix: unrelated repo')).key, null);
});
test('first-parent sequence ignores feature-branch marker commits', () => {
  const a = commit(1, 'start'), side = commit(9, 'milestone start WRONG-01: Side branch'), merge = { ...commit(2, 'merge'), parents: [sha(1), sha(9)] };
  assert.deepEqual(firstParentBatch(sha(0), sha(2), [side, merge, a]).map(c => c.sha), [sha(1), sha(2)]);
});
test('same SHA is idempotent and history rewrite fails without advancing', () => {
  assert.deepEqual(firstParentBatch(sha(2), sha(2), []), []);
  assert.throws(() => firstParentBatch(sha(0), sha(3), [commit(3, 'missing ancestry')]), /HISTORY_GAP_OR_REWRITE/);
});
test('completion requires exact SHA, successful named check and READY deployment', () => {
  const evidence = { sha: sha(2), checks: [{ name: 'check:1:build', state: 'success' as const }], deployment: { id: 'dpl_1', state: 'READY', url: null }, observedAt: 'now' };
  assert.equal(completionReady(sha(2), ['check:1:build'], true, evidence), true);
  assert.equal(completionReady(sha(3), ['check:1:build'], true, evidence), false);
  assert.equal(completionReady(sha(2), ['check:2:build'], true, evidence), false);
  assert.equal(completionReady(sha(2), ['check:1:build'], true, { ...evidence, deployment: { ...evidence.deployment, state: 'ERROR' } }), false);
  assert.equal(completionReady(sha(2), [], false, evidence), false);
});
test('missing deployment and pending checks cannot complete', () => {
  const evidence = { sha: sha(2), checks: [{ name: 'status:build', state: 'pending' as const }], deployment: null, observedAt: 'now' };
  assert.equal(completionReady(sha(2), ['status:build'], false, evidence), false);
  assert.equal(completionReady(sha(2), [], true, evidence), false);
});
test('unfinished milestones stay in denominator, cancelled milestones do not', () => {
  const done = { id: 'a', status: 'COMPLETED', criteria: [], reviews: [], delivery: { phase: 'COMPLETE' } };
  const unfinished = { id: 'b', status: 'PLANNED', criteria: [], reviews: [] };
  assert.equal(projectCalculatedProgress([done, unfinished]).percent, 50);
  assert.equal(projectCalculatedProgress([done, { ...unfinished, status: 'CANCELLED' }]).percent, 100);
  assert.equal(projectCalculatedProgress([{ ...done, status: 'CANCELLED' }]).percent, null);
});
test('cancelled manual milestones cannot receive approval', () => {
  assert.equal(canApproveMilestone({ id: 'a', status: 'CANCELLED', criteria: [{ id: 'c', revision: 1, required: true, verified: true }], reviews: [] }), false);
});
test('empty evidence cannot verify criteria', () => {
  for (const value of [{}, [], null, { description: '   ' }, { description: 'short' }]) assert.throws(() => validateEvidence(value));
  assert.doesNotThrow(() => validateEvidence({ description: 'Reviewed login flow and expected results.' }));
});
const config = { id: 'systems', projectId: 'project1', repository: 'devkiddz/rcentz-systems', branch: 'main', baselineSha: sha(1), actorId: 'admin1', requiredChecks: [], vercelProjectId: 'prj_1', vercelTeamId: null };
test('source configuration requires mapping, baseline, gate and unique repository/branch', () => {
  assert.equal(parseSources(JSON.stringify([config])).length, 1);
  assert.throws(() => parseSources(JSON.stringify([{ ...config, vercelProjectId: null }])));
  assert.throws(() => parseSources(JSON.stringify([config, { ...config, id: 'other' }])));
  assert.throws(() => parseSources(JSON.stringify([{ ...config, baselineSha: 'main' }])));
});

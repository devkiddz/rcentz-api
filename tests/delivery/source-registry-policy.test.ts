import assert from 'node:assert/strict';
import test from 'node:test';
import { mayToggleSource, validRequiredChecks, validSourceProjectId } from '../../server/projects/delivery/source-registry-policy';
const baseline = 'a'.repeat(40);
const current = 'b'.repeat(40);
const record = { projectId: 'project_1', enabled: false, actorId: 'admin_1', baselineSha: baseline,
  cursorSha: current, configHash: 'valid-hash', leaseUntil: null };
test('required checks are bounded, trimmed, unique and nonempty', () => {
  assert.equal(validRequiredChecks([]), true);
  assert.equal(validRequiredChecks(['status:deployment']), true);
  assert.equal(validRequiredChecks(['status:deployment','status:deployment']), false);
  assert.equal(validRequiredChecks([' status:deployment']), false);
  assert.equal(validRequiredChecks(['']), false);
  assert.equal(validRequiredChecks(['x'.repeat(151)]), false);
  assert.equal(validRequiredChecks(Array.from({length:21}, (_, i) => `status:${i}`)), false);
  assert.equal(validRequiredChecks([123]), false);
});
test('project identity is required for source mutation', () => {
  assert.equal(validSourceProjectId('project_1'), true);
  assert.equal(mayToggleSource(record, 'other', 'disable'), false);
  assert.equal(mayToggleSource(record, 'other', 'enable'), false);
  assert.equal(mayToggleSource(null, 'project_1', 'enable'), false);
});
test('enable retains recorded cursor and refuses incomplete or leased sources', () => {
  assert.equal(mayToggleSource(record, 'project_1', 'enable'), true);
  assert.equal(mayToggleSource({...record, actorId:null}, 'project_1', 'enable'), false);
  assert.equal(mayToggleSource({...record, baselineSha:null}, 'project_1', 'enable'), false);
  assert.equal(mayToggleSource({...record, leaseUntil:new Date(Date.now()+60000)}, 'project_1', 'enable'), false);
  assert.equal(mayToggleSource(record, 'project_1', 'disable'), true);
  assert.equal(record.cursorSha, current);
});
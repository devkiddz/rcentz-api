import test from 'node:test';
import assert from 'node:assert/strict';
import { sealRequestDecision } from '../../server/projects/delivery/seal-policy';

test('MSS is never accepted for unknown, open or cancelled milestones', () => {
  assert.equal(sealRequestDecision(null, null), 'UNKNOWN');
  assert.equal(sealRequestDecision('OPEN', null), 'INCOMPLETE');
  assert.equal(sealRequestDecision('CANCELLED', 'a'.repeat(40)), 'INCOMPLETE');
});
test('MSC must exist and only verified completion can seal', () => {
  assert.equal(sealRequestDecision('AWAITING', null), 'INCOMPLETE');
  assert.equal(sealRequestDecision('AWAITING', 'a'.repeat(40)), 'WAIT');
  assert.equal(sealRequestDecision('COMPLETE', 'a'.repeat(40)), 'SEAL');
});

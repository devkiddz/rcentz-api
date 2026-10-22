import assert from 'node:assert/strict';
import test from 'node:test';
import { canPerformGovernanceOperation as can } from '../server/projects/governance/project-governance-authority-policy';
const ops = ['criterion:manage', 'criterion:verify', 'milestone:review', 'project:override'] as const;
const id = (role: string, assignmentRole: string | null, assignmentActive = true, status = 'ACTIVE') => ({ role, assignmentRole, assignmentActive, status });
test('super admin has global authority only while active', () => {
  for (const op of ops) { assert.equal(can(id('SUPER_ADMIN', null, false), op), true); assert.equal(can(id('SUPER_ADMIN', null, false, 'SUSPENDED'), op), false); }
});
test('ordinary admin without active assignment is denied', () => {
  for (const op of ops) { assert.equal(can(id('ADMIN', 'PROJECT_ADMIN', false), op), false); assert.equal(can(id('ADMIN', null), op), false); }
});
test('project-specific roles only grant their corresponding operation', () => {
  const pairs = [['PROJECT_MANAGER', 'criterion:manage'], ['PROJECT_VERIFIER', 'criterion:verify'], ['PROJECT_REVIEWER', 'milestone:review']] as const;
  for (const [role, allowed] of pairs) for (const op of ops) assert.equal(can(id('ADMIN', role), op), op === allowed);
});
test('explicit project admin assignment grants all governance operations', () => {
  for (const op of ops) assert.equal(can(id('ADMIN', 'PROJECT_ADMIN'), op), true);
});
test('unknown assignments, non-admins and inactive identities fail closed', () => {
  for (const op of ops) {
    assert.equal(can(id('ADMIN', 'MANAGER'), op), false);
    assert.equal(can(id('STAFF', 'PROJECT_ADMIN'), op), false);
    assert.equal(can(id('CLIENT', 'PROJECT_ADMIN'), op), false);
    assert.equal(can(id('ADMIN', 'PROJECT_ADMIN', true, 'DEACTIVATED'), op), false);
  }
});

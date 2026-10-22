import test from 'node:test';
import assert from 'node:assert/strict';
import { mayReadDelivery as can } from '../../server/projects/delivery/read-policy';
const client = { role: 'CLIENT', status: 'ACTIVE', userId: 'client1', clientId: 'client1', assignmentRole: null, assignmentActive: false, visibility: 'CLIENT' };
test('client reads only own visible milestone activity', () => {
  assert.equal(can(client), true);
  assert.equal(can({ ...client, clientId: 'other' }), false);
  assert.equal(can({ ...client, visibility: 'INTERNAL' }), false);
});
test('admin read needs active project assignment; super admin must be active', () => {
  const admin = { ...client, clientId: null, role: 'ADMIN' };
  assert.equal(can(admin), false);
  assert.equal(can({ ...admin, assignmentActive: true, assignmentRole: 'PROJECT_MANAGER' }), true);
  assert.equal(can({ ...admin, role: 'SUPER_ADMIN' }), true);
  assert.equal(can({ ...admin, role: 'SUPER_ADMIN', status: 'SUSPENDED' }), false);
});

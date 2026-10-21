import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('server/projects/governance/milestone-governance-service.ts', 'utf8');
const criteria = readFileSync('server/projects/governance/milestone-criterion-management.ts', 'utf8');

test('all five governance mutations derive trusted actor internally', () => {
  assert.equal((service.match(/const actor = await createGovernanceActor\(\)/g) ?? []).length, 3);
  assert.equal((criteria.match(/const actor = await createGovernanceActor\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(service, /input\.actor|actor: AuthorizedActor/);
  assert.doesNotMatch(criteria, /input\.actor/);
});

test('authorization occurs inside governance transactions', () => {
  assert.match(service, /await actor\.authorize\(tx, milestone\.projectId, 'criterion:verify'\)/);
  assert.match(service, /await actor\.authorize\(tx, milestone\.projectId, 'milestone:review'\)/);
  assert.match(service, /await actor\.authorize\(tx, input\.projectId, 'project:override'\)/);
  assert.match(criteria, /await actor\.authorize\(tx, rows\[0\]\.projectId, 'criterion:manage'\)/);
});

test('override audits and persists percentage in same transaction', () => {
  assert.match(service, /const audit = await tx\.projectProgressOverride\.create/);
  assert.match(service, /await tx\.project\.update\(\{ where: \{ id: input\.projectId \}, data: \{ progress: input\.percent \} \}\)/);
  assert.match(service, /return audit;/);
});

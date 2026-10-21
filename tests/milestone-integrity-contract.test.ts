import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const service = read('server/projects/governance/milestone-governance-service.ts');
const milestone = read('features/admin/server/projects/project-milestone-actions.ts');
const project = read('features/admin/server/projects/update-admin-project.ts');

test('governance writes are wrapped in serializable transactions', () => {
  assert.equal((service.match(/TransactionIsolationLevel\.Serializable/g) ?? []).length, 3);
});
test('governance service locks milestone before authorization and revision read', () => {
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /await lockMilestone\(tx, input\.milestoneId\)/);
  assert.match(service, /await actor\.authorize\(tx, milestone\.projectId, 'criterion:verify'\)/);
  assert.match(service, /await actor\.authorize\(tx, milestone\.projectId, 'milestone:review'\)/);
});
test('review rejects stale revisions and unverified approvals', () => {
  assert.match(service, /revision !== input\.expectedRevision/);
  assert.match(service, /!canApproveMilestone\(state\)/);
});
test('milestone legacy update checks governance under row lock', () => {
  assert.match(milestone, /SELECT "id", "status", "progress", "completedAt" FROM "ProjectMilestone"[\s\S]*?FOR UPDATE/);
  assert.match(milestone, /locked\[0\]\.progress !== data\.progress/);
  assert.match(milestone, /completedAt: locked\[0\]\.completedAt/);
});
test('project legacy update checks governance under row lock', () => {
  assert.match(project, /SELECT "id", "status", "progress"[\s\S]*?FROM "Project"[\s\S]*?FOR UPDATE/);
  assert.match(project, /projectMilestoneCriterion\.count/);
  assert.match(project, /locked\[0\]\.progress !== progress \|\| locked\[0\]\.status !== status/);
});
test('governance service is not exposed as an API route', () => {
  assert.doesNotMatch(service, /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE)\b/);
});

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const root = process.cwd();
const service = readFileSync(`${root}/server/projects/governance/milestone-governance-service.ts`, 'utf8');
const criteria = readFileSync(`${root}/server/projects/governance/milestone-criterion-management.ts`, 'utf8');
const legacy = readFileSync(`${root}/features/admin/server/projects/project-milestone-actions.ts`, 'utf8');
test('governance writers lock project before milestone', () => {
  for (const source of [service, criteria]) {
    const project = source.indexOf('FROM "Project" WHERE');
    const milestone = source.indexOf('FROM "ProjectMilestone" WHERE');
    assert.ok(project >= 0 && milestone > project);
  }
});
test('verification, review, create and update invoke projection', () => {
  assert.equal((service.match(/await persistGovernedProjectProgress\(/g) ?? []).length, 2);
  assert.equal((criteria.match(/await persistGovernedProjectProgress\(/g) ?? []).length, 2);
});
test('legacy milestone update locks parent and delete rejects governed records', () => {
  assert.match(legacy, /const parentLock = await tx\.\$queryRaw/);
  assert.match(legacy, /Governed milestones cannot be deleted through the legacy action/);
});

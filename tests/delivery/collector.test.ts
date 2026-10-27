import assert from 'node:assert/strict';
import test from 'node:test';
import { collectDeliverySources } from '../../server/projects/delivery/collector';
import type { SourceConfig } from '../../server/projects/delivery/config';

const source = (id: string): SourceConfig => ({
  id,
  projectId: `project-${id}`,
  repository: `devkiddz/${id}`,
  branch: 'main',
  baselineSha: 'a'.repeat(40),
  actorId: 'admin',
  requiredChecks: [],
  vercelProjectId: 'vercel-project',
  vercelTeamId: null
});

test('scheduled collection visits every enabled source and isolates failures', async () => {
  const visited: string[] = [];
  const result = await collectDeliverySources(
    [source('one'), source('two'), source('three')],
    null,
    async current => {
      visited.push(current.id);
      if (current.id === 'two') throw new Error('HISTORY_GAP_OR_REWRITE');
      return { sourceId: current.id, status: 'SYNCED', commits: 1 };
    }
  );

  assert.deepEqual(visited, ['one', 'two', 'three']);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.results[1].error, 'HISTORY_GAP_OR_REWRITE');
});

test('manual collection remains scoped to one requested source', async () => {
  const result = await collectDeliverySources(
    [source('one'), source('two')],
    'two',
    async current => ({ sourceId: current.id, status: 'SYNCED' })
  );
  assert.equal(result.mode, 'SINGLE');
  assert.deepEqual(result.results.map(item => item.sourceId), ['two']);
  await assert.rejects(
    collectDeliverySources([source('one')], 'missing', async current => ({ sourceId: current.id, status: 'SYNCED' })),
    /SOURCE_REQUIRED/
  );
});

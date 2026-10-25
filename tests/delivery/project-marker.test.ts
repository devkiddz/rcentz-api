import test from 'node:test';
import assert from 'node:assert/strict';
import { projectMarker, markerForProject } from '../../server/projects/delivery/project-marker';

test('project-scoped start with description', () => {
  assert.deepEqual(projectMarker(
    'milestone(MS-RCENTZ-SYSTEMS/PMC-01): Central project console\n\nDescription: Unify projects and Git activity.'
  ), {
    operation: 'start', projectCode: 'RCENTZ-SYSTEMS', milestoneKey: 'PMC-01',
    title: 'Central project console', description: 'Unify projects and Git activity.'
  });
});

test('completion and seal are descriptive, not verification', () => {
  assert.equal(projectMarker('milestone(MSC-RCENTZ-SYSTEMS/PMC-01): Console delivered')?.operation, 'complete');
  assert.equal(projectMarker('milestone(MSS-RCENTZ-SYSTEMS/PMC-01): Seal requested')?.operation, 'seal');
});

test('project boundary is explicit', () => {
  assert.throws(() => markerForProject('milestone(MS-WAFFI/AUTH-01): User login', 'RCENTZ-CORE'), /PROJECT_MARKER_MISMATCH/);
  assert.equal(markerForProject('milestone(MS-WAFFI/AUTH-01): User login', 'WAFFI')?.milestoneKey, 'AUTH-01');
});

test('legacy markers are left to existing policy', () => {
  assert.equal(projectMarker('milestone(MS-PMC-01): Old style marker'), null);
  assert.equal(projectMarker('milestone start AUTH-01: Account authentication'), null);
  assert.equal(projectMarker('feat: implement dashboard'), null);
});

test('bad descriptions and malformed qualified markers are rejected', () => {
  const base = 'milestone(MS-RCENTZ-SYSTEMS/PMC-01): Central project console';
  assert.throws(() => projectMarker(base + '\nDescription: one\nDescription: two'), /DUPLICATE_DESCRIPTION/);
  assert.throws(() => projectMarker(base + '\nDescription: ' + 'a'.repeat(161)), /INVALID_DESCRIPTION/);
  assert.throws(() => projectMarker('milestone(MS-rcentz/PMC-01): Wrong project code'), /INVALID_PROJECT_MARKER/);
});

test('markers are subject-only', () => {
  assert.equal(projectMarker('docs: example\n\nmilestone(MS-WAFFI/CAT-01): Catalog release'), null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readProjectActivityMarker } from '../../server/projects/delivery/activity-marker';

test('qualified MS markers are credited only to their registered project', () => {
  const message = 'milestone(MS-WAFFI-MARKET/CAT-01): Catalogue work';
  assert.deepEqual(readProjectActivityMarker(message, 'WAFFI-MARKET'), {
    kind: 'start',
    milestoneKey: 'CAT-01'
  });
  assert.equal(readProjectActivityMarker(message, 'RCENTZ-SYSTEMS'), null);
});

test('legacy markers remain isolated by their registered source stream', () => {
  assert.deepEqual(
    readProjectActivityMarker('milestone complete AUTH-01: Authentication', 'ANY-PROJECT'),
    { kind: 'complete', milestoneKey: 'AUTH-01' }
  );
});

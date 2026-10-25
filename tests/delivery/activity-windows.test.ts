import test from 'node:test';
import assert from 'node:assert/strict';
import { attributeActivityWindows } from '../../server/projects/delivery/activity-windows';
const c = (n: number, message: string) => ({ id: String(n), sha: n.toString(16).padStart(40, '0'), message, committedAt: '2026-10-24T12:00:00Z' });
test('old commits remain unassigned until an MS marker', () => {
  const result = attributeActivityWindows([c(1,'feat: legacy'),c(2,'milestone(MS-DASH-01): Dashboard workspace'),c(3,'feat(ui): changes')]);
  assert.deepEqual(result.map(r=>r.milestoneKey),[null,'DASH-01','DASH-01']);
});
test('MSC and MSS retain timeline grouping until a newer MS', () => {
  const result = attributeActivityWindows([
    c(1,'milestone(MS-DASH-01): Dashboard workspace'),c(2,'feat: controls'),
    c(3,'milestone(MSC-DASH-01): Dashboard done'),c(4,'fix: regression'),
    c(5,'milestone(MSS-DASH-01): Seal dashboard'),c(6,'chore: follow up'),
    c(7,'milestone(MS-OA-03): Client discovery'),c(8,'feat: sources'),
  ]);
  assert.deepEqual(result.map(r=>r.milestoneKey),['DASH-01','DASH-01','DASH-01','DASH-01','DASH-01','DASH-01','OA-03','OA-03']);
  assert.deepEqual(result.map(r=>r.kind).filter(k=>k!=='commit'),['milestone-start','milestone-complete','milestone-seal','milestone-start']);
});
test('ordinary candidate and version markers are events not new milestones',()=>{
  const result=attributeActivityWindows([c(1,'feat(dashboard): complete DASH-01'),c(2,'release: v0.4.0-rc.1')]);
  assert.equal(result[0].milestoneKey,null); assert.equal(result[0].candidateKey,'DASH-01');
  assert.equal(result[1].kind,'release');assert.equal(result[1].version,'v0.4.0-rc.1');assert.equal(result[1].milestoneKey,null);
});
test('invalid and unknown marker retains activity without opening window',()=>{
  const result=attributeActivityWindows([c(1,'milestone(MSC-FAKE-01): Unknown'),c(2,'milestone start bad'),c(3,'fix: normal')]);
  assert.equal(result[0].issue,'UNKNOWN_MILESTONE');assert.equal(result[1].issue,'INVALID_MARKER');assert.equal(result[2].milestoneKey,null);
});

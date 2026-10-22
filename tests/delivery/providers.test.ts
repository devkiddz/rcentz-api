import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validSignature, validBearer, boundedBytes, providerGet } from '../../server/projects/delivery/http';
import { readCommits, readEvidence, type Get } from '../../server/projects/delivery/providers';
import type { SourceConfig } from '../../server/projects/delivery/config';
const sha = (n: number) => n.toString(16).padStart(40, '0');
const source: SourceConfig = { id: 'systems', projectId: 'project1', repository: 'devkiddz/rcentz-systems', branch: 'main', baselineSha: sha(0), actorId: 'admin', requiredChecks: [], vercelProjectId: 'prj_test', vercelTeamId: 'team_test' };
test('GitHub signature verifies raw bytes and rejects altered payloads', () => {
  const body = Buffer.from('{"a":1}'), secret = 's'.repeat(32), signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(validSignature(body, signature, secret), true);
  assert.equal(validSignature(Buffer.from('{"a":2}'), signature, secret), false);
  assert.equal(validSignature(body, 'sha256=bad', secret), false);
  assert.equal(validSignature(body, signature, undefined), false);
});
test('scheduled sync authentication fails closed', () => {
  assert.equal(validBearer('Bearer ' + 's'.repeat(32), 's'.repeat(32)), true);
  assert.equal(validBearer('Bearer wrong', 's'.repeat(32)), false);
  assert.equal(validBearer(null, undefined), false);
});
test('streaming body limit is enforced without relying on content-length', async () => {
  await assert.rejects(boundedBytes(new Response('abcdef'), 5), /BODY_TOO_LARGE/);
  assert.equal((await boundedBytes(new Response('abc'), 5)).toString(), 'abc');
});
test('provider client rejects arbitrary destinations and missing credentials', async () => {
  await assert.rejects(providerGet(new URL('https://example.com'), 'token'), /INVALID_PROVIDER/);
  await assert.rejects(providerGet(new URL('https://api.github.com'), undefined), /CREDENTIAL/);
});
test('GitHub truncation or divergence never advances history', async () => {
  const get: Get = async url => url.pathname.includes('/branches/') ? { commit: { sha: sha(2) } } : { status: 'ahead', commits: [], total_commits: 251 };
  await assert.rejects(readCommits(source, sha(0), get), /HISTORY_GAP_OR_REWRITE/);
});
test('canonical GitHub history is reordered by ancestry', async () => {
  const commit = (n: number) => ({ sha: sha(n), parents: [{ sha: sha(n-1) }], commit: { message: `Commit ${n}`, committer: { date: '2026-10-21T10:00:00Z' } } });
  const get: Get = async url => url.pathname.includes('/branches/') ? { commit: { sha: sha(2) } } : { status: 'ahead', commits: [commit(2),commit(1)], total_commits: 2 };
  assert.deepEqual((await readCommits(source, sha(0), get)).map(c => c.sha), [sha(1),sha(2)]);
});
test('Vercel query is exact project, team, SHA and production; latest failure wins', async () => {
  const get: Get = async url => {
    assert.equal(url.hostname, 'api.vercel.com'); assert.equal(url.searchParams.get('sha'), sha(2));
    assert.equal(url.searchParams.get('target'), 'production'); assert.equal(url.searchParams.get('projectId'), 'prj_test');
    assert.equal(url.searchParams.get('teamId'), 'team_test');
    const d = { projectId: 'prj_test', target: 'production', meta: { githubCommitSha: sha(2) }, url: 'test.vercel.app' };
    return { deployments: [{ ...d, uid: 'old', state: 'READY', createdAt: 1 }, { ...d, uid: 'new', state: 'ERROR', createdAt: 2 }] };
  };
  assert.equal((await readEvidence(source, sha(2), get)).deployment?.state, 'ERROR');
});
test('unrelated, preview and wrong-SHA deployments cannot complete milestone', async () => {
  const d = { uid: 'dpl', projectId: 'prj_test', target: 'production', state: 'READY', meta: { githubCommitSha: sha(2) }, createdAt: 2 };
  const get: Get = async () => ({ deployments: [{ ...d, projectId: 'other' }, { ...d, target: 'preview' }, { ...d, meta: { githubCommitSha: sha(3) } }] });
  assert.equal((await readEvidence(source, sha(2), get)).deployment, null);
});
test('checks include app identity and newest retry overrides prior success', async () => {
  const get: Get = async () => ({ total_count: 2, check_runs: [
    { id: 1, app: { id: 5 }, head_sha: sha(2), name: 'build', status: 'completed', conclusion: 'success' },
    { id: 2, app: { id: 5 }, head_sha: sha(2), name: 'build', status: 'in_progress', conclusion: null },
  ] });
  const evidence = await readEvidence({ ...source, requiredChecks: ['check:5:build'], vercelProjectId: null }, sha(2), get);
  assert.deepEqual(evidence.checks, [{ name: 'check:5:build', state: 'pending' }]);
});

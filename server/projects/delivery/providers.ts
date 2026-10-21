import type { SourceConfig } from './config';
import { firstParentBatch, type Commit, type Check, type Evidence } from './policy';
import { object, string, providerGet } from './http';
export type Get = (url: URL, token: string | undefined) => Promise<unknown>;
const sha = (value: unknown) => { const s = string(value); if (!/^[a-f0-9]{40}$/.test(s)) throw new Error('INVALID_SHA'); return s; };
const github = (source: SourceConfig, path: string) => new URL(`https://api.github.com/repos/${source.repository}/${path}`);
export async function readCommits(source: SourceConfig, cursor: string, get: Get = providerGet): Promise<Commit[]> {
  const token = process.env.RCENTZ_DELIVERY_GITHUB_TOKEN;
  const branch = object(await get(github(source, `branches/${encodeURIComponent(source.branch)}`), token));
  const head = sha(object(branch.commit).sha);
  if (head === cursor) return [];
  const result = object(await get(github(source, `compare/${cursor}...${head}`), token));
  if (result.status !== 'ahead' || !Array.isArray(result.commits) || result.commits.length !== result.total_commits || result.commits.length > 250)
    throw new Error('HISTORY_GAP_OR_REWRITE');
  const commits = result.commits.map(raw => {
    const c = object(raw), detail = object(c.commit), author = object(detail.committer);
    const message = string(detail.message), date = string(author.date);
    if (message.length > 16000 || !Number.isFinite(Date.parse(date)) || !Array.isArray(c.parents)) throw new Error('INVALID_COMMIT');
    return { sha: sha(c.sha), message, date, parents: c.parents.map(p => sha(object(p).sha)) };
  });
  return firstParentBatch(cursor, head, commits).slice(0, 50);
}
export async function readEvidence(source: SourceConfig, commitSha: string, get: Get = providerGet): Promise<Evidence> {
  sha(commitSha);
  const token = process.env.RCENTZ_DELIVERY_GITHUB_TOKEN;
  const checks: Check[] = [];
  if (source.requiredChecks.some(c => c.startsWith('check:'))) {
    const latest = new Map<string, { id: number; check: Check }>();
    for (let page = 1; page <= 5; page++) {
      const result = object(await get(github(source, `commits/${commitSha}/check-runs?filter=latest&per_page=100&page=${page}`), token));
      if (!Array.isArray(result.check_runs) || typeof result.total_count !== 'number' || result.total_count > 500) throw new Error('CHECK_LIMIT');
      for (const raw of result.check_runs) {
        const c = object(raw), app = object(c.app);
        if (sha(c.head_sha) !== commitSha || typeof c.id !== 'number' || typeof app.id !== 'number') throw new Error('INVALID_CHECK');
        const name = `check:${app.id}:${string(c.name)}`;
        const state = c.status !== 'completed' ? 'pending' : c.conclusion === 'success' ? 'success' : 'failure';
        if (!latest.has(name) || latest.get(name)!.id < c.id) latest.set(name, { id: c.id, check: { name, state } });
      }
      if (page * 100 >= result.total_count) break;
    }
    checks.push(...[...latest.values()].map(x => x.check));
  }
  if (source.requiredChecks.some(c => c.startsWith('status:'))) {
    const result = object(await get(github(source, `commits/${commitSha}/status?per_page=100`), token));
    if (sha(result.sha) !== commitSha || !Array.isArray(result.statuses) || typeof result.total_count !== 'number' || result.total_count > 100) throw new Error('STATUS_LIMIT');
    for (const raw of result.statuses) {
      const c = object(raw);
      checks.push({ name: `status:${string(c.context)}`, state: c.state === 'success' ? 'success' : c.state === 'pending' ? 'pending' : 'failure' });
    }
  }
  let deployment: Evidence['deployment'] = null;
  if (source.vercelProjectId) {
    const url = new URL('https://api.vercel.com/v7/deployments');
    url.searchParams.set('projectId', source.vercelProjectId); url.searchParams.set('sha', commitSha);
    url.searchParams.set('target', 'production'); url.searchParams.set('limit', '20');
    if (source.vercelTeamId) url.searchParams.set('teamId', source.vercelTeamId);
    const result = object(await get(url, process.env.RCENTZ_DELIVERY_VERCEL_TOKEN));
    if (!Array.isArray(result.deployments)) throw new Error('INVALID_DEPLOYMENTS');
    const candidates = result.deployments.map(object).filter(d => {
      const meta = d.meta && typeof d.meta === 'object' ? object(d.meta) : {};
      const git = d.gitSource && typeof d.gitSource === 'object' ? object(d.gitSource) : {};
      return d.projectId === source.vercelProjectId && d.target === 'production' &&
        (meta.githubCommitSha === commitSha || git.sha === commitSha);
    }).sort((a, b) => Number(b.createdAt ?? b.created) - Number(a.createdAt ?? a.created));
    const d = candidates[0];
    if (d) {
      const host = typeof d.url === 'string' && /^[a-zA-Z0-9.-]+\.vercel\.app$/.test(d.url) ? `https://${d.url}` : null;
      deployment = { id: string(d.uid ?? d.id), state: string(d.state ?? d.readyState), url: host };
    }
  }
  return { sha: commitSha, checks, deployment, observedAt: new Date().toISOString() };
}

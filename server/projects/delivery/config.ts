import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
export type SourceConfig = {
  id: string; projectId: string; repository: string; branch: string; baselineSha: string;
  actorId: string; requiredChecks: string[]; vercelProjectId: string | null; vercelTeamId: string | null;
};
export function parseSources(raw: string): SourceConfig[] {
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.length || data.length > 20) throw new Error('INVALID_SOURCE_CONFIG');
  const ids = new Set<string>(), repos = new Set<string>();
  return data.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('INVALID_SOURCE_CONFIG');
    const s = entry as Record<string, unknown>;
    const id = (x: unknown) => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(x);
    if (!id(s.id) || !id(s.projectId) || !id(s.actorId) || typeof s.repository !== 'string' ||
        !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(s.repository) ||
        typeof s.branch !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,120}$/.test(s.branch) || s.branch.includes('..') ||
        typeof s.baselineSha !== 'string' || !/^[a-f0-9]{40}$/.test(s.baselineSha) ||
        !Array.isArray(s.requiredChecks) || s.requiredChecks.length > 20 ||
        !s.requiredChecks.every(x => typeof x === 'string' && x.trim() === x && x.length > 0 && x.length <= 150) ||
        (s.vercelProjectId !== null && !id(s.vercelProjectId)) || (s.vercelTeamId !== null && !id(s.vercelTeamId)))
      throw new Error('INVALID_SOURCE_CONFIG');
    const source = { id: s.id, projectId: s.projectId, actorId: s.actorId, repository: s.repository.toLowerCase(),
      branch: s.branch, baselineSha: s.baselineSha, requiredChecks: [...new Set(s.requiredChecks)].sort(),
      vercelProjectId: s.vercelProjectId, vercelTeamId: s.vercelTeamId } as SourceConfig;
    if (!source.requiredChecks.length && !source.vercelProjectId) throw new Error('COMPLETION_GATE_REQUIRED');
    const key = `${source.repository}:${source.branch}`;
    if (ids.has(source.id) || repos.has(key)) throw new Error('DUPLICATE_SOURCE_CONFIG');
    ids.add(source.id); repos.add(key); return source;
  });
}
export function deliveryEnabled(): boolean { return process.env.RCENTZ_DELIVERY_ENABLED === 'true'; }
export async function sources(): Promise<SourceConfig[]> {
  if (!deliveryEnabled()) throw new Error('DELIVERY_DISABLED');
  const rows = await prisma.deliverySource.findMany({ where: { enabled: true }, take: 501, orderBy: { id: 'asc' } });
  if (rows.length > 500) throw new Error('SOURCE_LIMIT');
  return rows.map(row => {
    if (!row.actorId || !row.baselineSha) throw new Error('SOURCE_INCOMPLETE');
    const candidate: SourceConfig = { id: row.id, projectId: row.projectId, repository: row.repository,
      branch: row.branch, baselineSha: row.baselineSha, actorId: row.actorId,
      requiredChecks: row.requiredChecks, vercelProjectId: row.vercelProjectId, vercelTeamId: row.vercelTeamId };
    const [validated] = parseSources(JSON.stringify([candidate]));
    if (configHash(validated) !== row.configHash) throw new Error('SOURCE_CONFIG_CHANGED');
    return validated;
  });
}
export function configHash(source: SourceConfig): string { return createHash('sha256').update(JSON.stringify(source)).digest('hex'); }
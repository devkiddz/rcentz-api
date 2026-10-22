import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { requireApplicationIdentity } from '@/server/api/auth/require-application-identity';
import { boundedBytes, object, providerGet } from '@/server/projects/delivery/http';
import { configHash, parseSources, type SourceConfig } from '@/server/projects/delivery/config';
import { validSourceProjectId, validRequiredChecks, mayToggleSource } from '@/server/projects/delivery/source-registry-policy';

export const runtime = 'nodejs';
const path = '/api/v1/internal/systems/delivery-sources';
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
const repo = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(v);
const branch = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,120}$/.test(v) && !v.includes('..');

export async function POST(request: Request) {
  let body: string, input: Record<string, unknown>;
  try { body = (await boundedBytes(request, 8000)).toString('utf8'); input = object(JSON.parse(body)); }
  catch { return apiError('INVALID_BODY', 'Invalid JSON request', 400); }
  try {
    const auth = await requireApplicationIdentity(request, body, 'projects:governance', path);
    if (!auth.ok) return auth.response;
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true, status: true } });
    if (user?.role !== 'SUPER_ADMIN' || user.status !== 'ACTIVE') return apiError('FORBIDDEN', 'Administrator required', 403);
    if (input.operation === 'list') {
      if (!id(input.projectId)) return apiError('INVALID_INPUT', 'Project ID required', 400);
      const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
      if (!project) return apiError('NOT_FOUND', 'Project not found', 404);
      const rows = await prisma.deliverySource.findMany({ where: { projectId: project.id }, select: { id: true, repository: true, branch: true, enabled: true, cursorSha: true, lastSyncedAt: true, lastError: true } });
      return apiSuccess(rows);
    }
    if (input.operation === 'disable' || input.operation === 'enable') {
      if (!id(input.sourceId) || !validSourceProjectId(input.projectId))
        return apiError('INVALID_INPUT', 'Project and source IDs required', 400);
      const source = await prisma.deliverySource.findFirst({ where: { id: input.sourceId, projectId: input.projectId },
        select: { id: true, projectId: true, enabled: true, actorId: true, baselineSha: true, configHash: true,
          cursorSha: true, leaseUntil: true, repository: true, branch: true, requiredChecks: true,
          vercelProjectId: true, vercelTeamId: true } });
      if (!source) return apiError('NOT_FOUND', 'Source not found', 404);
      const enabling = input.operation === 'enable';
      if (!mayToggleSource(source, input.projectId, enabling ? 'enable' : 'disable'))
        return apiError('SOURCE_NOT_READY', 'Source cannot be enabled while incomplete or synchronizing', 409);
      if (enabling) {
        const actor = await prisma.user.findUnique({ where: { id: source.actorId! }, select: { role: true, status: true } });
        if (actor?.role !== 'SUPER_ADMIN' || actor.status !== 'ACTIVE')
          return apiError('SOURCE_NOT_READY', 'Source actor is no longer authorized', 409);
        const [validated] = parseSources(JSON.stringify([{ id: source.id, projectId: source.projectId,
          repository: source.repository, branch: source.branch, baselineSha: source.baselineSha,
          actorId: source.actorId, requiredChecks: source.requiredChecks,
          vercelProjectId: source.vercelProjectId, vercelTeamId: source.vercelTeamId }]));
        if (configHash(validated) !== source.configHash)
          return apiError('SOURCE_CONFIG_CHANGED', 'Source configuration requires review', 409);
      }
      const changed = await prisma.deliverySource.updateMany({ where: {
        id: source.id, projectId: source.projectId, enabled: !enabling,
        ...(enabling ? { OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] } : {}),
      }, data: { enabled: enabling } });
      if (changed.count !== 1) {
        const current = await prisma.deliverySource.findUnique({ where: { id: source.id }, select: { enabled: true } });
        if (current?.enabled === enabling) return apiSuccess({ id: source.id, enabled: enabling, unchanged: true });
        return apiError('SOURCE_CONFLICT', 'Source state changed; refresh and retry', 409);
      }
      // Only the enabled flag changes; cursor, milestone and commit history stay intact.
      return apiSuccess({ id: source.id, enabled: enabling });
    }
    if (input.operation !== 'register' || !id(input.projectId) || !repo(input.repository) || !branch(input.branch) ||
        !validRequiredChecks(input.requiredChecks) ||
        !(input.vercelProjectId === null || id(input.vercelProjectId)) ||
        !(input.vercelTeamId === null || id(input.vercelTeamId))) return apiError('INVALID_INPUT', 'Invalid source', 400);
    const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
    if (!project) return apiError('NOT_FOUND', 'Project not found', 404);
    const repository = input.repository.toLowerCase();
    const url = new URL(`https://api.github.com/repos/${repository}/branches/${encodeURIComponent(input.branch)}`);
    const response = object(await providerGet(url, process.env.RCENTZ_DELIVERY_GITHUB_TOKEN));
    const head = object(response.commit).sha;
    if (typeof head !== 'string' || !/^[a-f0-9]{40}$/.test(head)) return apiError('GITHUB_INVALID', 'Invalid repository head', 422);
    const candidate: SourceConfig = { id: randomUUID(), projectId: input.projectId, repository,
      branch: input.branch, baselineSha: head, actorId: auth.userId,
      requiredChecks: input.requiredChecks as string[], vercelProjectId: input.vercelProjectId as string | null,
      vercelTeamId: input.vercelTeamId as string | null };
    const [source] = parseSources(JSON.stringify([candidate]));
    const created = await prisma.deliverySource.create({ data: { ...source, configHash: configHash(source),
      cursorSha: source.baselineSha, enabled: true } });
    return apiSuccess({ id: created.id, repository: created.repository, branch: created.branch, baselineSha: created.cursorSha });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
      return apiError('SOURCE_EXISTS', 'Repository branch already registered', 409);
    const msg = error instanceof Error ? error.message : '';
    if (['COMPLETION_GATE_REQUIRED','INVALID_SOURCE_CONFIG'].includes(msg)) return apiError('INVALID_SOURCE', 'Invalid source configuration', 400);
    return apiError('SOURCE_REGISTRATION_FAILED', 'Source request failed', 503);
  }
}
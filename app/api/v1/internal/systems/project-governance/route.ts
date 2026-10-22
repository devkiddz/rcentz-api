import { createAdminProjectMilestone, updateAdminProjectMilestone, deleteAdminProjectMilestone, type ProjectMilestoneMutationInput } from '@/features/admin/server/projects/project-milestone-actions';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requireApplicationIdentity } from '@/server/api/auth/require-application-identity';
import { withVerifiedGovernanceIdentity } from '@/server/projects/governance/governance-request-context';
import { createMilestoneCriterion, updateMilestoneCriterion } from '@/server/projects/governance/milestone-criterion-management';
import { verifyMilestoneCriterion, reviewMilestone, recordProjectProgressOverride } from '@/server/projects/governance/milestone-governance-service';

export const runtime = 'nodejs';
const path = '/api/v1/internal/systems/project-governance';
const scope = 'projects:governance';
const allowed = new Set(['criterion:create', 'criterion:update', 'criterion:verify', 'milestone:review', 'project:override', 'milestone:create', 'milestone:update', 'milestone:delete', 'governance:read', 'delivery:read', 'delivery:commits']);
function record(x: unknown): x is Record<string, unknown> { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function identifier(x: unknown): x is string { return typeof x === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(x); }
function criterion(x: unknown): x is {title:string;description?:string|null;required:boolean;sortOrder:number} {
  return record(x) && typeof x.title === 'string' && (x.description == null || typeof x.description === 'string') && typeof x.required === 'boolean' && Number.isInteger(x.sortOrder);
}
const milestoneFields = ['projectId','title','slug','description','purpose','expectedOutcome','status','priority','visibility','startedAt','dueDate','completionNotes'] as const;
function milestoneInput(x: unknown): x is ProjectMilestoneMutationInput {
  return record(x) && milestoneFields.every(k => { const value = x[k]; return typeof value === 'string' && value.length <= 4000; }) &&
    identifier(x.projectId) && typeof x.progress === 'number' && Number.isFinite(x.progress) &&
    typeof x.sortOrder === 'number' && Number.isInteger(x.sortOrder) && x.sortOrder >= 0 && x.sortOrder <= 1000000;
}
async function boundedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid request');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16000) { await reader.cancel(); throw new Error('Body too large'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export async function POST(request: Request) {
  let body: string; let input: unknown;
  try { body = await boundedBody(request); input = JSON.parse(body); }
  catch { return apiError('INVALID_BODY', 'A bounded JSON request is required', 400); }
  if (!record(input) || typeof input.operation !== 'string' || !allowed.has(input.operation))
    return apiError('INVALID_OPERATION', 'Unsupported governance operation', 400);
  const payload = input;
  try {
    const verified = await requireApplicationIdentity(request, body, scope, path);
    if (!verified.ok) return verified.response;
    return await withVerifiedGovernanceIdentity(verified.userId, async () => {
      try {
        let result: unknown;
        switch (payload.operation) {
          case 'delivery:read':
          case 'delivery:commits':
          case 'governance:read': {
            if (!identifier(payload.projectId)) return apiError('INVALID_INPUT', 'Invalid project identifier', 400);
            const projectId = payload.projectId;
            // A signed application identity alone cannot grant project access.
            const viewer = await prisma.user.findUnique({
              where: { id: verified.userId }, select: { id: true, role: true, status: true },
            });
            if (!viewer || viewer.status !== 'ACTIVE') return apiError('FORBIDDEN', 'Access denied', 403);
            if (viewer.role !== 'SUPER_ADMIN') {
              const assignment = await prisma.projectAssignment.findUnique({
                where: { projectId_userId: { projectId, userId: viewer.id } },
                select: { role: true, removedAt: true },
              });
              if (viewer.role !== 'ADMIN' || !assignment || assignment.removedAt !== null ||
                  !['PROJECT_MANAGER', 'PROJECT_VERIFIER', 'PROJECT_REVIEWER', 'PROJECT_ADMIN'].includes(assignment.role ?? ''))
                return apiError('FORBIDDEN', 'Access denied', 403);
            }
            if (payload.operation === 'delivery:read' || payload.operation === 'delivery:commits') {
              if (payload.cursor !== undefined && !identifier(payload.cursor)) return apiError('INVALID_CURSOR', 'Invalid cursor', 400);
              const cursor = payload.cursor as string | undefined;
              if (payload.operation === 'delivery:commits') {
                if (!identifier(payload.milestoneId)) return apiError('INVALID_INPUT', 'Milestone required', 400);
                const delivery = await prisma.deliveryMilestone.findFirst({ where: { milestoneId: payload.milestoneId, milestone: { projectId } } });
                if (!delivery) return apiError('NOT_FOUND', 'Milestone not found', 404);
                const commits = await prisma.deliveryCommit.findMany({
                  where: { deliveryMilestoneId: delivery.id, ...(cursor ? { id: { gt: cursor } } : {}) },
                  orderBy: { id: 'asc' }, take: 51,
                  select: { id: true, sha: true, message: true, committedAt: true },
                });
                result = { commits: commits.slice(0, 50), nextCursor: commits.length > 50 ? commits[49].id : null };
              } else {
                const milestones = await prisma.deliveryMilestone.findMany({
                  where: { milestone: { projectId }, ...(cursor ? { id: { gt: cursor } } : {}) },
                  orderBy: { id: 'asc' }, take: 51,
                  select: { id: true, milestoneId: true, key: true, phase: true, completionSha: true,
                    milestone: { select: { title: true, status: true, completedAt: true } },
                    source: { select: { repository: true, branch: true } },
                    _count: { select: { commits: true } },
                    observations: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { snapshot: true, createdAt: true } },
                  },
                });
                const sources = await prisma.deliverySource.findMany({ where: { projectId }, take: 20,
                  select: { id: true, repository: true, branch: true, lastSyncedAt: true, lastError: true,
                    _count: { select: { commits: { where: { deliveryMilestoneId: null } } } } } });
                result = { milestones: milestones.slice(0, 50), nextCursor: milestones.length > 50 ? milestones[49].id : null, sources };
              }
              break;
            }
            const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { id: true, progress: true, milestones: {
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 150,
                select: { id: true, title: true, status: true, criteria: {
                  orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                  select: { id: true, title: true, description: true, required: true,
                    verified: true, verifiedAt: true, revision: true, sortOrder: true },
                }, reviews: {
                  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 5,
                  select: { id: true, decision: true, reason: true, criteriaRevision: true, createdAt: true },
                } },
              } },
            });
            if (!project) return apiError('NOT_FOUND', 'Project not found', 404);
            result = project; break;
          }

          case 'milestone:create':
            if (!milestoneInput(payload.input)) return apiError('INVALID_INPUT', 'Invalid milestone request', 400);
            result = await createAdminProjectMilestone(payload.input); break;
          case 'milestone:update':
            if (!identifier(payload.milestoneId) || !milestoneInput(payload.input)) return apiError('INVALID_INPUT', 'Invalid milestone request', 400);
            result = await updateAdminProjectMilestone(payload.milestoneId, payload.input); break;
          case 'milestone:delete':
            if (!identifier(payload.projectId) || !identifier(payload.milestoneId)) return apiError('INVALID_INPUT', 'Invalid deletion request', 400);
            result = await deleteAdminProjectMilestone(payload.projectId, payload.milestoneId); break;
          case 'criterion:create':
            if (!identifier(payload.milestoneId) || !criterion(payload.criterion)) return apiError('INVALID_INPUT', 'Invalid criterion request', 400);
            result = await createMilestoneCriterion({ milestoneId: payload.milestoneId, criterion: payload.criterion }); break;
          case 'criterion:update':
            if (!identifier(payload.milestoneId) || !identifier(payload.criterionId) || !criterion(payload.criterion)) return apiError('INVALID_INPUT', 'Invalid criterion request', 400);
            result = await updateMilestoneCriterion({ milestoneId: payload.milestoneId, criterionId: payload.criterionId, criterion: payload.criterion }); break;
          case 'criterion:verify':
            if (!identifier(payload.milestoneId) || !identifier(payload.criterionId) || typeof payload.verified !== 'boolean') return apiError('INVALID_INPUT', 'Invalid verification request', 400);
            result = await verifyMilestoneCriterion({ milestoneId: payload.milestoneId, criterionId: payload.criterionId, verified: payload.verified, evidence: (record(payload.evidence) || Array.isArray(payload.evidence) ? payload.evidence as Prisma.InputJsonValue : null) }); break;
          case 'milestone:review':
            if (!identifier(payload.milestoneId) || (payload.decision !== 'APPROVED' && payload.decision !== 'REJECTED') || !Number.isInteger(payload.expectedRevision) || (payload.reason !== undefined && typeof payload.reason !== 'string')) return apiError('INVALID_INPUT', 'Invalid review request', 400);
            result = await reviewMilestone({ milestoneId: payload.milestoneId, decision: payload.decision, expectedRevision: payload.expectedRevision as number, reason: payload.reason as string | undefined }); break;
          case 'project:override':
            if (!identifier(payload.projectId) || typeof payload.percent !== 'number' || typeof payload.reason !== 'string') return apiError('INVALID_INPUT', 'Invalid override request', 400);
            result = await recordProjectProgressOverride({ projectId: payload.projectId, percent: payload.percent, reason: payload.reason }); break;
        }
        if (
          record(result) &&
          result.success === false
        ) {
          return apiError(
            'MILESTONE_REJECTED',
            'Milestone operation was rejected',
            409,
          );
        }

        return apiSuccess(result);
      } catch (error) {
        // Do not expose project membership, DB internals or identity state in error bodies.
        if (error instanceof Error && /Governance access denied|Authentication required/.test(error.message))
          return apiError('FORBIDDEN', 'Governance operation not permitted', 403);
        return apiError('GOVERNANCE_FAILED', 'Governance operation could not be completed', 409);
      }
    });
  } catch { return apiError('REQUEST_FAILED', 'Governance request could not be processed', 500); }
}

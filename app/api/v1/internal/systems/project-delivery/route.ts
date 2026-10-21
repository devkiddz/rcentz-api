import { prisma } from '@/lib/prisma';
import { requireApplicationIdentity } from '@/server/api/auth/require-application-identity';
import { boundedBytes, object } from '@/server/projects/delivery/http';
import { mayReadDelivery } from '@/server/projects/delivery/read-policy';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
export const runtime = 'nodejs';
const path = '/api/v1/internal/systems/project-delivery';
const id = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(x);
export async function POST(request: Request) {
  let body: string, input: Record<string, unknown>;
  try { body = (await boundedBytes(request, 4000)).toString('utf8'); input = object(JSON.parse(body)); }
  catch { return apiError('INVALID_BODY', 'Invalid request', 400); }
  if (!id(input.projectId) || !id(input.milestoneId) || (input.cursor !== undefined && !id(input.cursor))) return apiError('INVALID_INPUT', 'Invalid identifiers', 400);
  try {
    const identity = await requireApplicationIdentity(request, body, 'projects:delivery:read', path);
    if (!identity.ok) return identity.response;
    const user = await prisma.user.findUnique({ where: { id: identity.userId }, select: { id: true, status: true, role: true } });
    const milestone = await prisma.projectMilestone.findFirst({ where: { id: input.milestoneId, projectId: input.projectId },
      select: { id: true, visibility: true, project: { select: { clientId: true } }, delivery: { select: { id: true, phase: true, completionSha: true, source: { select: { repository: true, branch: true } } } } } });
    const assignment = await prisma.projectAssignment.findUnique({ where: { projectId_userId: { projectId: input.projectId, userId: identity.userId } }, select: { role: true, removedAt: true } });
    if (!user || !milestone || !mayReadDelivery({ ...user, userId: user.id, clientId: milestone.project.clientId,
      assignmentRole: assignment?.role ?? null, assignmentActive: Boolean(assignment && assignment.removedAt === null), visibility: milestone.visibility }))
      return apiError('FORBIDDEN', 'Delivery activity unavailable', 403);
    if (!milestone.delivery) return apiSuccess({ managed: false, phase: null, repository: null, branch: null, commits: [], nextCursor: null, evidence: null });
    const delivery = milestone.delivery;
    const [commits, latest] = await Promise.all([
      prisma.deliveryCommit.findMany({ where: { deliveryMilestoneId: delivery.id, ...(input.cursor ? { id: { gt: input.cursor as string } } : {}) },
        orderBy: { id: 'asc' }, take: 51, select: { id: true, sha: true, message: true, committedAt: true } }),
      prisma.deliveryObservation.findFirst({ where: { deliveryMilestoneId: delivery.id, commitSha: delivery.completionSha ?? '' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { snapshot: true } }),
    ]);
    return apiSuccess({ managed: true, phase: delivery.phase, repository: delivery.source.repository, branch: delivery.source.branch,
      commits: commits.slice(0, 50).map(c => ({ ...c, message: c.message.split(/\r?\n/, 1)[0] })),
      nextCursor: commits.length > 50 ? commits[49].id : null, evidence: latest?.snapshot ?? null });
  } catch { return apiError('READ_FAILED', 'Delivery activity unavailable', 503); }
}

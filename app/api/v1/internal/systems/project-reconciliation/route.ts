import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { requireApplicationIdentity } from '@/server/api/auth/require-application-identity';
import { boundedBytes, object } from '@/server/projects/delivery/http';
import { buildAttributionCandidate } from '@/server/projects/delivery/attribution-candidate';
import { persistReconciliationDecision } from '@/server/projects/delivery/reconciliation-persistence';

export const runtime = 'nodejs';
const signedPath = '/api/v1/internal/systems/project-reconciliation';
const validId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(v);
function prNumber(v: unknown): v is number { return typeof v === 'number' && Number.isSafeInteger(v) && v > 0; }

/** Server-to-server, signed Systems operation. Never accepts evidence from clients. */
export async function POST(request: Request) {
  let body: string;
  let input: Record<string, unknown>;
  try {
    body = (await boundedBytes(request, 4000)).toString('utf8');
    input = object(JSON.parse(body));
  } catch { return apiError('INVALID_BODY', 'Invalid bounded JSON request', 400); }
  if (input.operation !== 'review' && input.operation !== 'decide')
    return apiError('INVALID_OPERATION', 'Unknown reconciliation operation', 400);
  if (!validId(input.sourceId) || !validId(input.commitId) || !prNumber(input.prNumber))
    return apiError('INVALID_INPUT', 'Invalid source, commit, or PR number', 400);
  if (input.operation === 'decide' && (
    (input.decision !== 'APPROVE' && input.decision !== 'REJECT') ||
    typeof input.reason !== 'string' || input.reason.trim().length < 15 || input.reason.trim().length > 1000 ||
    (input.decision === 'APPROVE' && !validId(input.targetDeliveryMilestoneId)) ||
    (input.targetDeliveryMilestoneId !== undefined && input.targetDeliveryMilestoneId !== null && !validId(input.targetDeliveryMilestoneId))
  )) return apiError('INVALID_DECISION', 'Invalid reconciliation decision', 400);
  try {
    const scope = input.operation === 'review' ? 'projects:delivery:read' : 'projects:delivery:write';
    const auth = await requireApplicationIdentity(request, body, scope, signedPath);
    if (!auth.ok) return auth.response;
    const actor = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true, status: true } });
    if (actor?.role !== 'SUPER_ADMIN' || actor.status !== 'ACTIVE')
      return apiError('FORBIDDEN', 'Super administrator required', 403);
    const source = await prisma.deliverySource.findUnique({ where: { id: input.sourceId as string },
      include: { project: { select: { slug: true } } } });
    const commit = await prisma.deliveryCommit.findUnique({ where: { id: input.commitId as string } });
    if (!source || !commit || commit.sourceId !== source.id)
      return apiError('NOT_FOUND', 'Registered source or commit unavailable', 404);
    const candidate = await buildAttributionCandidate({
      projectId: source.projectId, projectSlug: source.project.slug,
      repository: source.repository, branch: source.branch
    }, {
      sourceProjectId: source.projectId,
      sourceRepository: source.repository, sourceBranch: source.branch,
      sha: commit.sha, existingMilestoneId: commit.deliveryMilestoneId, issue: commit.issue
    }, input.prNumber as number);
    if (input.operation === 'review') return apiSuccess({ candidate });
    const result = await persistReconciliationDecision({
      actorId: auth.userId, sourceId: source.id, commitId: commit.id,
      targetDeliveryMilestoneId: (input.targetDeliveryMilestoneId as string | null | undefined) ?? null,
      decision: input.decision as 'APPROVE' | 'REJECT', reason: input.reason as string,
      prNumber: input.prNumber as number
    });
    return apiSuccess(result);
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    const safe = new Set(['PRIOR_DECISION_EXISTS','COMMIT_ALREADY_LINKED','REVIEWER_NOT_AUTHORIZED','INVALID_RECONCILIATION_REQUEST','EVIDENCE_NOT_APPROVABLE','TARGET_DELIVERY_MISMATCH','TARGET_PROJECT_MISMATCH','COMMIT_SOURCE_OR_SHA_MISMATCH','CANDIDATE_SOURCE_MISMATCH']);
    if (safe.has(code)) return apiError(code, 'Reconciliation decision rejected', 409);
    return apiError('RECONCILIATION_UNAVAILABLE', 'Reconciliation could not be completed', 503);
  }
}

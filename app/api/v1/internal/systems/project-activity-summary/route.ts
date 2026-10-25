import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { requireApplicationIdentity } from '@/server/api/auth/require-application-identity';
import { boundedBytes, object } from '@/server/projects/delivery/http';

export const runtime = 'nodejs';

const endpoint = '/api/v1/internal/systems/project-activity-summary';
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

export async function POST(request: Request) {
  let body: string;
  let input: Record<string, unknown>;

  try {
    body = (await boundedBytes(request, 4000)).toString('utf8');
    input = object(JSON.parse(body));
  } catch {
    return apiError('INVALID_BODY', 'Invalid request', 400);
  }

  if (
    !Array.isArray(input.projectIds) ||
    input.projectIds.length < 1 ||
    input.projectIds.length > 20 ||
    !input.projectIds.every(validId) ||
    new Set(input.projectIds).size !== input.projectIds.length
  ) {
    return apiError('INVALID_INPUT', 'Invalid project selection', 400);
  }

  try {
    const auth = await requireApplicationIdentity(
      request, body, 'projects:governance', endpoint
    );

    if (!auth.ok) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: true, status: true }
    });

    if (user?.role !== 'SUPER_ADMIN' || user.status !== 'ACTIVE') {
      return apiError('FORBIDDEN', 'Administrator required', 403);
    }

    const ids = input.projectIds as string[];

    const projects = await prisma.project.findMany({
      where: { id: { in: ids } },
      select: { id: true }
    });

    const allowed = new Set(projects.map(project => project.id));

    const summaries = await Promise.all(ids.map(async projectId => {
      if (!allowed.has(projectId)) return null;

      const sources = await prisma.deliverySource.findMany({
        where: { projectId },
        take: 20,
        select: {
          id: true,
          repository: true,
          branch: true,
          enabled: true,
          lastSyncedAt: true,
          lastError: true
        }
      });

      if (!sources.length) {
        return {
          projectId,
          state: 'NO_SOURCE',
          latestCommit: null,
          latestMilestoneEvent: null
        };
      }

      const sourceIds = sources.map(source => source.id);

      const [commit, milestoneEvent] = await Promise.all([
        prisma.deliveryCommit.findFirst({
          where: { sourceId: { in: sourceIds } },
          orderBy: [
            { committedAt: 'desc' },
            { id: 'desc' }
          ],
          select: {
            sha: true,
            message: true,
            committedAt: true,
            source: {
              select: { repository: true, branch: true }
            }
          }
        }),

        prisma.deliveryCommit.findFirst({
          where: {
            sourceId: { in: sourceIds },
            OR: [
              { message: { startsWith: 'milestone(MS-' } },
              { message: { startsWith: 'milestone(MSC-' } },
              { message: { startsWith: 'milestone(MSS-' } }
            ]
          },
          orderBy: [
            { committedAt: 'desc' },
            { id: 'desc' }
          ],
          select: {
            sha: true,
            message: true,
            committedAt: true,
            source: {
              select: { repository: true, branch: true }
            }
          }
        })
      ]);

      const synchronized = sources.some(source => source.lastSyncedAt);
      const hasError = sources.some(source => Boolean(source.lastError));

      return {
        projectId,
        state: hasError
          ? 'SYNC_ERROR'
          : !synchronized
            ? 'AWAITING_SYNC'
            : 'RECORDED',
        latestCommit: commit && {
          sha: commit.sha,
          message: commit.message.split(/\r?\n/, 1)[0],
          committedAt: commit.committedAt,
          repository: commit.source.repository,
          branch: commit.source.branch
        },
        latestMilestoneEvent: milestoneEvent && {
          sha: milestoneEvent.sha,
          message: milestoneEvent.message.split(/\r?\n/, 1)[0],
          committedAt: milestoneEvent.committedAt,
          repository: milestoneEvent.source.repository,
          branch: milestoneEvent.source.branch
        }
      };
    }));

    return apiSuccess({
      projects: summaries.filter(summary => summary !== null)
    });
  } catch {
    return apiError(
      'ACTIVITY_UNAVAILABLE',
      'Project activity could not be loaded',
      503
    );
  }
}

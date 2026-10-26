import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { requireApplicationIdentity } from '@/server/api/auth/require-application-identity';
import { boundedBytes, object } from '@/server/projects/delivery/http';
import { marker, sealMarker } from '@/server/projects/delivery/policy';
import { projectMarker } from '@/server/projects/delivery/project-marker';

export const runtime = 'nodejs';

const endpoint = '/api/v1/internal/systems/project-activity-summary';

const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

type ActivityState =
  | 'NO_SOURCE'
  | 'SOURCE_LIMIT_EXCEEDED'
  | 'AWAITING_SYNC'
  | 'SYNC_ERROR'
  | 'SYNCED';

type ActivityMarker = {
  kind: 'start' | 'complete' | 'reopen' | 'cancel' | 'seal';
  milestoneKey: string;
};

function readMarker(message: string): ActivityMarker | null {
  // Merge commits often place a milestone subject in their message body.
  // Only standalone marker lines qualify; prose mentioning a marker does not.
  const lines = message.split(/\r?\n/);
  for (const line of lines) {
    const subject = line.trim();
    if (!/^milestone(?:\(|\s)/.test(subject)) continue;

    try {
      const qualified = projectMarker(subject);
      if (qualified) {
        return { kind: qualified.operation, milestoneKey: qualified.milestoneKey };
      }

      const seal = sealMarker(subject);
      if (seal) return { kind: 'seal', milestoneKey: seal.key };

      const signal = marker(subject);
      if (signal) {
        return { kind: signal.operation, milestoneKey: signal.key };
      }
    } catch {
      // Ignore malformed marker lines; other valid lines may still exist.
    }
  }
  return null;
}

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
      request,
      body,
      'projects:governance',
      endpoint
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

    const summaries = [];

    // Limit concurrent database operations.
    for (let offset = 0; offset < ids.length; offset += 4) {
      const batch = await Promise.all(
        ids.slice(offset, offset + 4).map(async projectId => {
          if (!allowed.has(projectId)) return null;

          const sources = await prisma.deliverySource.findMany({
            where: { projectId },
            take: 21,
            orderBy: { id: 'asc' },
            select: {
              id: true,
              lastSyncedAt: true,
              lastError: true
            }
          });

          if (sources.length > 20) {
            return {
              projectId,
              state: 'SOURCE_LIMIT_EXCEEDED' as ActivityState,
              verification: 'NOT_EVALUATED' as const,
              latestCommit: null,
              latestMilestoneEvent: null,
              milestoneEvents: []
            };
          }

          if (!sources.length) {
            return {
              projectId,
              state: 'NO_SOURCE' as ActivityState,
              verification: 'NOT_EVALUATED' as const,
              latestCommit: null,
              latestMilestoneEvent: null,
              milestoneEvents: []
            };
          }

          const sourceIds = sources.map(source => source.id);

          const [commit, candidates] = await Promise.all([
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
                  select: {
                    repository: true,
                    branch: true
                  }
                }
              }
            }),

            prisma.deliveryCommit.findMany({
              // Read recent recorded activity without assuming marker position.
              where: { sourceId: { in: sourceIds } },
              orderBy: [
                { committedAt: 'desc' },
                { id: 'desc' }
              ],
              take: 250,
              select: {
                sha: true,
                message: true,
                committedAt: true,
                source: {
                  select: {
                    repository: true,
                    branch: true
                  }
                }
              }
            })
          ]);

          // Retain recognized marker events (newest first) for matching to
          // the current milestone in Systems. Parsing does not verify delivery.
          const milestoneEvents = [] as Array<{
            sha: string;
            message: string;
            committedAt: Date;
            repository: string;
            branch: string;
            kind: ActivityMarker['kind'];
            milestoneKey: string;
            verification: 'NOT_EVALUATED';
          }>;

          for (const candidate of candidates) {
            const parsed = readMarker(candidate.message);
            if (!parsed) continue;

            milestoneEvents.push({
              sha: candidate.sha,
              // Keep the full message, including the Description: trailer.
              message: candidate.message,
              committedAt: candidate.committedAt,
              repository: candidate.source.repository,
              branch: candidate.source.branch,
              kind: parsed.kind,
              milestoneKey: parsed.milestoneKey,
              verification: 'NOT_EVALUATED'
            });
          }

          const latestMilestoneEvent = milestoneEvents[0] ?? null;

          const hasError = sources.some(
            source => Boolean(source.lastError)
          );

          const synchronized = sources.some(
            source => source.lastSyncedAt !== null
          );

          const state: ActivityState = hasError
            ? 'SYNC_ERROR'
            : synchronized
              ? 'SYNCED'
              : 'AWAITING_SYNC';

          return {
            projectId,
            state,
            verification: 'NOT_EVALUATED' as const,
            latestCommit: commit
              ? {
                  sha: commit.sha,
                  message: commit.message.split(/\r?\n/, 1)[0],
                  committedAt: commit.committedAt,
                  repository: commit.source.repository,
                  branch: commit.source.branch
                }
              : null,
            latestMilestoneEvent,
            milestoneEvents
          };
        })
      );

      summaries.push(...batch);
    }

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

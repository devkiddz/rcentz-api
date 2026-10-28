import 'server-only';

import { createHash } from 'node:crypto';

import { prisma } from '@/lib/prisma';

type AnalyticsIntake = {
  trackingKey: string;
  eventId: string;
  sessionKey: string;
  type: 'PAGE_VIEW' | 'CLICK';
  path: string;
  action?: string;
  referrerHost?: string;
  occurredAt?: string;
};

export class AnalyticsIntakeError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 429 = 400) {
    super(message);
  }
}

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function parse(raw: unknown): AnalyticsIntake {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new AnalyticsIntakeError('Invalid event.');
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some(key => !['trackingKey','eventId','sessionKey','type','path','action','referrerHost','occurredAt'].includes(key))) {
    throw new AnalyticsIntakeError('Unsupported event field.');
  }
  if (typeof value.trackingKey !== 'string' || value.trackingKey.length < 16 || value.trackingKey.length > 128 ||
      typeof value.eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.eventId) ||
      typeof value.sessionKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.sessionKey) ||
      !['PAGE_VIEW','CLICK'].includes(String(value.type)) ||
      typeof value.path !== 'string' || !/^\/[a-zA-Z0-9/_\[\]-]{0,511}$/.test(value.path) || /\d{5,}/.test(value.path)) {
    throw new AnalyticsIntakeError('Invalid event.');
  }
  if (value.action !== undefined && (typeof value.action !== 'string' || !/^[a-zA-Z0-9_-]{1,48}$/.test(value.action))) {
    throw new AnalyticsIntakeError('Invalid action.');
  }
  if (value.referrerHost !== undefined && (typeof value.referrerHost !== 'string' || !/^(direct|[a-z0-9][a-z0-9.-]{0,79})$/.test(value.referrerHost))) {
    throw new AnalyticsIntakeError('Invalid traffic source.');
  }
  if (value.occurredAt !== undefined && (typeof value.occurredAt !== 'string' || !Number.isFinite(Date.parse(value.occurredAt)) || Math.abs(Date.now() - Date.parse(value.occurredAt)) > 86_400_000)) {
    throw new AnalyticsIntakeError('Invalid event time.');
  }
  return value as AnalyticsIntake;
}

export async function collectAnalyticsIntelligence(raw: unknown, requestOrigin: string) {
  const payload = parse(raw);
  const origin = normalizeOrigin(requestOrigin);
  if (!origin) throw new AnalyticsIntakeError('Origin required.', 403);

  const config = await prisma.projectAnalyticsConfig.findUnique({
    where: { trackingKey: payload.trackingKey },
    select: { projectId: true, status: true, allowedOrigins: true }
  });
  if (!config) throw new AnalyticsIntakeError('Tracking configuration not found.', 404);
  if (config.status !== 'ACTIVE') throw new AnalyticsIntakeError('Collection is paused.', 403);
  const allowed = config.allowedOrigins.some(value => normalizeOrigin(value) === origin);
  if (!allowed) throw new AnalyticsIntakeError('Origin is not allowed.', 403);

  const digest = (value: string) => createHash('sha256').update(value).digest('hex');
  const sourceId = `analytics-${digest(config.projectId).slice(0, 32)}`;
  const session = digest(`${config.projectId}:${payload.sessionKey}`).slice(0, 64);
  const dimensions: Record<string, string> = {
    route: payload.path,
    session
  };
  if (payload.type === 'PAGE_VIEW') dimensions.source = payload.referrerHost ?? 'direct';
  if (payload.type === 'CLICK' && payload.action) dimensions.operation = payload.action;

  const since = new Date(Date.now() - 60_000);
  const [projectBurst, sessionRows] = await Promise.all([
    prisma.intelligenceEvent.count({ where: { projectId: config.projectId, kind: 'analytics', receivedAt: { gte: since } } }),
    prisma.$queryRaw<Array<{count:bigint}>>`
      SELECT COUNT(*) AS count FROM "IntelligenceEvent"
      WHERE "projectId" = ${config.projectId} AND kind = 'analytics'
        AND "receivedAt" >= ${since} AND dimensions->>'session' = ${session}
    `
  ]);
  if (projectBurst >= 1000 || Number(sessionRows[0]?.count ?? 0) >= 60) {
    throw new AnalyticsIntakeError('Too many events.', 429);
  }

  const result = await prisma.intelligenceEvent.createMany({
    data: [{
      sourceId,
      eventId: payload.eventId,
      projectId: config.projectId,
      occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
      kind: 'analytics',
      name: payload.type === 'PAGE_VIEW' ? 'page.view' : 'interaction.click',
      environment: 'production',
      measurements: {},
      dimensions
    }],
    skipDuplicates: true
  });
  return { accepted: true as const, duplicate: result.count === 0, projectId: config.projectId };
}

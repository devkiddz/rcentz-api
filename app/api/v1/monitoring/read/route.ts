import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function equal(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x,y); }
type Bucket = { hour: Date; requests: bigint; errors: bigint; functions: bigint; durationMs: bigint };
type MonitorOverview = {
  sourceCount: bigint;
  lastRecordedAt: Date | null;
};
export async function POST(request: Request) {
  const secret = process.env.RCENTZ_OBSERVABILITY_READ_TOKEN || '';
  if (secret.length < 32 || !equal(request.headers.get('x-rm01-read-token') || '', secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let data: Record<string, unknown>;
  try { const body = await request.text(); if (Buffer.byteLength(body) > 512) throw Error('size'); const parsed: unknown = JSON.parse(body); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('shape'); data = parsed as Record<string, unknown>; }
  catch { return Response.json({ error: 'Bad body' }, { status: 400 }); }
  const projectId = data.projectId;
  const hours = data.hours === 24 ? 24 : 6;
  if (typeof projectId !== 'string' || !/^[\w-]{1,128}$/.test(projectId)) return Response.json({ error: 'Invalid project' }, { status: 400 });
  try {
    const start = new Date(Date.now() - hours * 3600000);
    const [project, rows, overviewRows] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }),
      prisma.$queryRaw<Bucket[]>`
        SELECT date_trunc('hour', "recordedAt") AS hour,
          COALESCE(SUM("requests"),0)::bigint AS requests,
          COALESCE(SUM("errors"),0)::bigint AS errors,
          COALESCE(SUM("functions"),0)::bigint AS functions,
          COALESCE(SUM("durationMs"),0)::bigint AS "durationMs"
        FROM "RuntimeMonitorEvent" WHERE "projectId" = ${projectId} AND "recordedAt" >= ${start}
        GROUP BY 1 ORDER BY 1 ASC
      `,
      prisma.$queryRaw<MonitorOverview[]>`
        SELECT
          (SELECT COUNT(*) FROM "RuntimeMonitorSource" WHERE "projectId" = ${projectId} AND "enabled" = true)::bigint AS "sourceCount",
          (SELECT MAX("recordedAt") FROM "RuntimeMonitorEvent" WHERE "projectId" = ${projectId}) AS "lastRecordedAt"
      `
    ]);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    const buckets = rows.map(row => ({ hour: row.hour.toISOString(), requests: Number(row.requests), errors: Number(row.errors), functions: Number(row.functions), durationMs: Number(row.durationMs) }));
    const overview = overviewRows[0];
    const sourceCount = Number(overview?.sourceCount ?? 0);
    const state = buckets.length > 0 ? 'ACTIVE' : sourceCount > 0 ? 'AWAITING_DATA' : 'NOT_INSTRUMENTED';
    return Response.json({
      projectId,
      hours,
      scope: 'INSTRUMENTED_ROUTES',
      state,
      sourceCount,
      lastRecordedAt: overview?.lastRecordedAt?.toISOString() ?? null,
      buckets
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Monitor unavailable' }, { status: 503 }); }
}

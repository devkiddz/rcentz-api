import { authenticateMonitorSource } from '@/server/runtime-monitor/source-registry';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function integer(v: unknown, max: number): v is number { return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max; }
export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') || '0') > 2048) return Response.json({ error: 'Payload too large' }, { status: 413 });
  const sourceId = request.headers.get('x-rm01-source') || '';
  const secret = request.headers.get('x-rm01-token') || '';
  const source = await authenticateMonitorSource(sourceId, secret);
  if (!source) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let raw: string;
  try { raw = await request.text(); } catch { return Response.json({ error: 'Bad body' }, { status: 400 }); }
  if (Buffer.byteLength(raw) > 2048) return Response.json({ error: 'Payload too large' }, { status: 413 });
  let data: Record<string, unknown>;
  try { const value: unknown = JSON.parse(raw); if (!value || Array.isArray(value) || typeof value !== 'object') throw Error('body'); data = value as Record<string, unknown>; }
  catch { return Response.json({ error: 'Bad JSON' }, { status: 400 }); }
  const { batchId, route, timestamp, requests, errors, functions, durationMs } = data;
  if (typeof batchId !== 'string' || !/^[\w-]{12,80}$/.test(batchId) || typeof route !== 'string' || !/^\/[a-zA-Z0-9/_-]{0,119}$/.test(route) || typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp)) || Math.abs(Date.now() - Date.parse(timestamp)) > 300000 || !integer(requests,10000) || !integer(errors,10000) || errors > requests || !integer(functions,10000) || !integer(durationMs,100000000)) return Response.json({ error: 'Invalid measurement' }, { status: 400 });
  try {
    const project = await prisma.project.findUnique({ where: { id: source.projectId }, select: { id: true } });
    if (!project) return Response.json({ error: 'Source project unavailable' }, { status: 409 });
    const count = await prisma.$executeRaw`
      INSERT INTO "RuntimeMonitorEvent" ("batchId", "sourceId", "projectId", "routeLabel", "recordedAt", "requests", "errors", "functions", "durationMs")
      VALUES (${batchId}, ${source.id}, ${source.projectId}, ${route}, ${new Date(timestamp)}, ${requests}, ${errors}, ${functions}, ${durationMs})
      ON CONFLICT ("sourceId", "batchId") DO NOTHING
    `;
    return Response.json({ accepted: count === 1 }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Collector unavailable' }, { status: 503 }); }
}

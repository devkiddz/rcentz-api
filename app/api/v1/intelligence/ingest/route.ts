import { prisma } from '@/lib/prisma';
import { authenticateMonitorSource } from '@/server/runtime-monitor/source-registry';
import { decodeBatch } from '@/server/intelligence/contract';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const source = await authenticateMonitorSource(request.headers.get('x-rm01-source') || '', request.headers.get('x-rm01-token') || '');
  if (!source) return Response.json({error:'Unauthorized'},{status:401});
  let events;
  try {
    if (Number(request.headers.get('content-length') || 0) > 16384) throw Error('TOO_LARGE');
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 16384) throw Error('TOO_LARGE');
    events = decodeBatch(JSON.parse(raw));
  } catch {return Response.json({error:'Invalid intelligence batch'},{status:400});}
  try {
    const project = await prisma.project.findUnique({where:{id:source.projectId},select:{id:true}});
    if (!project) return Response.json({error:'Unknown project'},{status:409});
    // Unique source + event ID makes client retries idempotent.
    const result = await prisma.intelligenceEvent.createMany({
      data: events.map(event => ({
        sourceId: source.id, projectId: source.projectId, eventId: event.eventId,
        occurredAt: new Date(event.occurredAt), kind: event.kind, name: event.name,
        environment: event.environment, featureKey: event.featureKey ?? null,
        measurements: event.measurements ?? {}, dimensions: event.dimensions ?? {}
      })), skipDuplicates: true
    });
    return Response.json({accepted:result.count, duplicates:events.length-result.count}, {status:202,headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({error:'Intelligence storage unavailable'},{status:503}); }
}

import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function equal(a:string,b:string) {const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export async function POST(request:Request) {
  const secret=process.env.RCENTZ_OBSERVABILITY_READ_TOKEN || '';
  if(secret.length<32 || !equal(request.headers.get('x-rm01-read-token')||'',secret)) return Response.json({error:'Unauthorized'},{status:401});
  try {
    const raw=await request.text(); if(Buffer.byteLength(raw)>512) throw Error('BAD_REQUEST');
    const body:unknown=JSON.parse(raw);
    if(!body || typeof body!=='object' || Array.isArray(body)) throw Error('BAD_REQUEST');
    const {projectId, hours=24}=body as Record<string,unknown>;
    if(typeof projectId!=='string'||!/^[\w-]{1,128}$/.test(projectId)||![6,24,168].includes(Number(hours))) throw Error('BAD_REQUEST');
    const project=await prisma.project.findUnique({where:{id:projectId},select:{id:true}});
    if(!project) return Response.json({error:'Project not found'},{status:404});
    const since=new Date(Date.now()-Number(hours)*3600000);
    const [grouped,total,latest,analyticsRows]=await Promise.all([
      prisma.intelligenceEvent.groupBy({by:['kind','featureKey','name'],where:{projectId,occurredAt:{gte:since}},_count:{_all:true}}),
      prisma.intelligenceEvent.count({where:{projectId,occurredAt:{gte:since}}}),
      prisma.intelligenceEvent.findFirst({where:{projectId},orderBy:{occurredAt:'desc'},select:{occurredAt:true}}),
      prisma.$queryRaw<Array<{sessions:bigint;page_views:bigint;clicks:bigint;routes:bigint}>>`
        SELECT
          COUNT(DISTINCT dimensions->>'session') FILTER (WHERE kind = 'analytics') AS sessions,
          COUNT(*) FILTER (WHERE kind = 'analytics' AND name = 'page.view') AS page_views,
          COUNT(*) FILTER (WHERE kind = 'analytics' AND name = 'interaction.click') AS clicks,
          COUNT(DISTINCT dimensions->>'route') FILTER (WHERE kind = 'analytics') AS routes
        FROM "IntelligenceEvent"
        WHERE "projectId" = ${projectId} AND "occurredAt" >= ${since}
      `
    ]);
    const analytics=analyticsRows[0];
    return Response.json({projectId,hours,total,lastRecordedAt:latest?.occurredAt.toISOString()??null,
      groups:grouped.map(item=>({kind:item.kind,featureKey:item.featureKey,name:item.name,count:item._count._all})),
      analytics:{sessions:Number(analytics?.sessions??0),pageViews:Number(analytics?.page_views??0),clicks:Number(analytics?.clicks??0),routes:Number(analytics?.routes??0)}},
      {headers:{'Cache-Control':'private, no-store'}});
  } catch(e) {
    if(e instanceof Error && e.message==='BAD_REQUEST') return Response.json({error:'Bad request'},{status:400});
    return Response.json({error:'Intelligence unavailable'},{status:503});
  }
}

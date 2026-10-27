import { sources } from '@/server/projects/delivery/config';
import { synchronize } from '@/server/projects/delivery/engine';
import { collectDeliverySources } from '@/server/projects/delivery/collector';
import { validBearer } from '@/server/projects/delivery/http';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!validBearer(request.headers.get('authorization'), process.env.CRON_SECRET)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const all = await sources(), id = new URL(request.url).searchParams.get('source');
    const result = await collectDeliverySources(all, id, synchronize);
    return Response.json(result, {
      status: result.failed > 0 ? 207 : 200,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    const code = error instanceof Error && ['SOURCE_REQUIRED', 'SOURCE_LIMIT'].includes(error.message)
      ? error.message
      : 'SYNC_FAILED';
    return Response.json({ error: code }, { status: code === 'SOURCE_REQUIRED' ? 400 : 503 });
  }
}

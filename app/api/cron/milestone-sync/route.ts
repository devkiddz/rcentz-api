import { sources } from '@/server/projects/delivery/config';
import { synchronize } from '@/server/projects/delivery/engine';
import { validBearer } from '@/server/projects/delivery/http';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!validBearer(request.headers.get('authorization'), process.env.CRON_SECRET)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const all = sources(), id = new URL(request.url).searchParams.get('source');
    // One explicitly selected source per scheduled call keeps workload bounded.
    const source = all.find(s => s.id === id);
    if (!source) return Response.json({ error: 'SOURCE_REQUIRED' }, { status: 400 });
    return Response.json(await synchronize(source));
  } catch { return Response.json({ error: 'SYNC_FAILED' }, { status: 503 }); }
}

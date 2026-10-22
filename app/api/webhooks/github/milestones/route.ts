import { boundedBytes, object, validSignature } from '@/server/projects/delivery/http';
import { sources } from '@/server/projects/delivery/config';
import { synchronize } from '@/server/projects/delivery/engine';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  if (process.env.RCENTZ_DELIVERY_ENABLED !== 'true') return Response.json({ error: 'DISABLED' }, { status: 503 });
  let body: Buffer;
  try { body = await boundedBytes(request, 2_000_000); } catch { return Response.json({ error: 'INVALID_BODY' }, { status: 413 }); }
  if (!validSignature(body, request.headers.get('x-hub-signature-256'), process.env.RCENTZ_DELIVERY_GITHUB_WEBHOOK_SECRET)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (request.headers.get('x-github-event') === 'ping') return Response.json({ ok: true });
  if (request.headers.get('x-github-event') !== 'push') return Response.json({ ignored: true });
  try {
    const payload = object(JSON.parse(body.toString('utf8'))), repository = object(payload.repository);
    if (typeof repository.full_name !== 'string' || typeof payload.ref !== 'string') return Response.json({ error: 'INVALID_EVENT' }, { status: 400 });
    const source = (await sources()).find(s => s.repository === (repository.full_name as string).toLowerCase() && payload.ref === `refs/heads/${s.branch}`);
    if (!source) return Response.json({ ignored: true });
    // Never trust payload commits; fetch current canonical branch history. Replays are cursor-idempotent.
    return Response.json(await synchronize(source));
  } catch { return Response.json({ error: 'SYNC_FAILED', retry: 'Scheduled synchronization recovers missed deliveries.' }, { status: 503 }); }
}

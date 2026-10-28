import {
  AnalyticsIntakeError,
  collectAnalyticsIntelligence
} from '@/server/intelligence/collect-analytics-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function headers(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    Vary: 'Origin'
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin') ?? '';
  return new Response(null, { status: 204, headers: headers(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin') ?? '';
  try {
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
      return Response.json({ error: 'Send JSON.' }, { status: 415, headers: headers(origin) });
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096) return Response.json({ error: 'Event too large.' }, { status: 413, headers: headers(origin) });
    const result = await collectAnalyticsIntelligence(JSON.parse(raw), origin);
    return Response.json(result, { status: 202, headers: headers(origin) });
  } catch (error) {
    const status = error instanceof AnalyticsIntakeError ? error.status : error instanceof SyntaxError ? 400 : 503;
    const message = error instanceof AnalyticsIntakeError ? error.message : status === 400 ? 'Invalid JSON.' : 'Collection unavailable.';
    return Response.json({ error: message }, { status, headers: headers(origin) });
  }
}

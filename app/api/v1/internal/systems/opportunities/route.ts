import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { requireApplicationIdentity } from '@/server/api/auth/require-application-identity';
import { runCollection } from '@/server/opportunities/collector';
import { statuses } from '@/features/opportunities/lib/matching';
export const runtime = 'nodejs';
export const maxDuration = 60;
const operationScopes: Record<string, string> = { list: 'opportunities:read', profile: 'opportunities:write', decision: 'opportunities:write', collect: 'opportunities:collect' };
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
async function boundedBody(request: Request) {
  const reader = request.body?.getReader(); if (!reader) return '';
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 16000) { await reader.cancel(); throw new Error('BODY_LIMIT'); } chunks.push(value); }
  return Buffer.concat(chunks).toString('utf8');
}
async function handle(request: Request) {
  let body: string; let payload: unknown;
  try { body = await boundedBody(request); payload = JSON.parse(body); } catch { return apiError('INVALID_BODY', 'A bounded JSON request is required', 400); }
  if (!record(payload) || typeof payload.operation !== 'string' || !Object.hasOwn(operationScopes, payload.operation)) return apiError('INVALID_OPERATION', 'Unsupported operation', 400);
  try {
    const actor = await requireApplicationIdentity(request, body, operationScopes[payload.operation]);
    if (!actor.ok) return actor.response;
    const ownerId = actor.userId;
    if (payload.operation === 'profile') {
      const { skills, experienceYears, enabled } = payload;
      if (!Array.isArray(skills) || !skills.length || skills.length > 20 || skills.some(s => typeof s !== 'string' || !s.trim() || s.length > 50) || typeof experienceYears !== 'number' || !Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 50 || typeof enabled !== 'boolean') return apiError('INVALID_PROFILE', 'Invalid search profile', 400);
      const data = { skills: [...new Set((skills as string[]).map(s => s.trim()))], experienceYears, enabled };
      await prisma.opportunityProfile.upsert({ where: { ownerId }, create: { ownerId, ...data }, update: data });
      return apiSuccess({ saved: true });
    }
    if (payload.operation === 'decision') {
      if (typeof payload.id !== 'string' || payload.id.length > 160 || typeof payload.status !== 'string' || !(statuses as readonly string[]).includes(payload.status) || typeof payload.notes !== 'string' || payload.notes.length > 2000) return apiError('INVALID_DECISION', 'Invalid decision', 400);
      const changed = await prisma.opportunity.updateMany({ where: { id: payload.id, profile: { ownerId } }, data: { status: payload.status, notes: payload.notes.trim() } });
      return changed.count ? apiSuccess({ saved: true }) : apiError('NOT_FOUND', 'Opportunity not found', 404);
    }
    if (payload.operation === 'collect') return apiSuccess(await runCollection(ownerId));
    const profile = await prisma.opportunityProfile.findUnique({ where: { ownerId }, select: { id: true, skills: true, experienceYears: true, enabled: true } });
    const status = typeof payload.status === 'string' && (statuses as readonly string[]).includes(payload.status) ? payload.status : undefined;
    const jobs = profile ? await prisma.opportunity.findMany({ where: { profileId: profile.id, ...(status ? { status } : {}) }, orderBy: [{ score: 'desc' }, { publishedAt: 'desc' }], take: 100, select: { id: true, title: true, company: true, url: true, description: true, location: true, salary: true, jobType: true, publishedAt: true, lastSeenAt: true, sourceState: true, score: true, assessment: true, status: true, notes: true } }) : [];
    const runs = profile ? await prisma.opportunityRun.findMany({ where: { profileId: profile.id }, orderBy: { startedAt: 'desc' }, take: 5, select: { id: true, status: true, fetched: true, added: true, startedAt: true, message: true } }) : [];
    return apiSuccess({ profile: profile ? { skills: profile.skills, experienceYears: profile.experienceYears, enabled: profile.enabled } : null, jobs, runs });
  } catch { return apiError('SERVICE_UNAVAILABLE', 'Opportunity service unavailable', 503); }
}

export async function POST(request: Request) {
 const response = await handle(request);
 response.headers.set('Cache-Control', 'no-store');
 return response;
}

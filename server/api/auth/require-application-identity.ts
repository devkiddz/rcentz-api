import 'server-only';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/server/api/responses/api-response';
import { validApplicationSignature } from './application-signature';
export const opportunityPath = '/api/v1/internal/systems/opportunities';
export async function requireApplicationIdentity(request: Request, body: string, scope: string) {
  const claims = { applicationId: request.headers.get('x-rcentz-app') || '', subject: request.headers.get('x-rcentz-subject') || '', issuedAt: request.headers.get('x-rcentz-issued-at') || '', nonce: request.headers.get('x-rcentz-nonce') || '' };
  // Initial credential is deliberately limited to Systems. Other apps get separate keys/scopes later.
  if (claims.applicationId !== 'systems' || !validApplicationSignature(process.env.RCENTZ_SYSTEMS_API_SECRET, claims, opportunityPath, body, request.headers.get('x-rcentz-signature') || '')) return { ok: false as const, response: apiError('UNAUTHORIZED', 'Verified application identity required', 401) };
  const identity = await prisma.applicationIdentity.findUnique({ where: { applicationId_subject: { applicationId: claims.applicationId, subject: claims.subject } }, include: { user: { select: { id: true, status: true, role: true } } } });
  if (!identity?.enabled || identity.user.status !== 'ACTIVE' || !identity.scopes.includes(scope) || !['ADMIN', 'SUPER_ADMIN'].includes(identity.user.role) || identity.user.id !== process.env.OPPORTUNITY_OWNER_ID) return { ok: false as const, response: apiError('FORBIDDEN', 'This identity cannot access the private finder', 403) };
  try {
    await prisma.applicationRequestNonce.create({ data: { applicationId: claims.applicationId, nonce: claims.nonce, expiresAt: new Date(Number(claims.issuedAt) + 90000) } });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return { ok: false as const, response: apiError('REPLAY_REJECTED', 'Request was already used', 409) };
    throw error;
  }
  return { ok: true as const, userId: identity.user.id };
}

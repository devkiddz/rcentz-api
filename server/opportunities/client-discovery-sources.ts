import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { validateRegistrySource, type RegistrySource } from './client-discovery-registry';

type Input = Record<string, unknown>;
const keyValid = (x: unknown): x is string => typeof x === 'string' && /^[a-z0-9][a-z0-9-]{2,79}$/.test(x);
const idValid = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{10,160}$/.test(x);

export async function clientSourceRegistry(operation: string, input: Input, ownerId: string) {
  const profile = await prisma.companyOpportunityProfile.findUnique({ where: { key: 'rcentz-systems' }, select: { id: true, managerId: true } });
  if (!profile || profile.managerId !== ownerId) return apiError('FORBIDDEN', 'Commercial source registry not assigned to this owner', 403);
  const profileId = profile.id;
  if (operation === 'client:source-list') {
    const sources = await prisma.clientDiscoverySource.findMany({ where: { profileId }, orderBy: { createdAt: 'asc' }, take: 200 });
    return apiSuccess({ sources, collectionEnabled: false });
  }
  if (operation === 'client:source-save') {
    // A normal save cannot approve, suspend, or enable a source. Those require a separate explicit decision.
    if (!keyValid(input.key) || (input.id !== undefined && !idValid(input.id)))
      return apiError('INVALID_SOURCE', 'Invalid source identifier', 400);
    if (input.approval !== undefined || input.enabled !== undefined || input.profileId !== undefined)
      return apiError('INVALID_SOURCE', 'Approval, enabled state and ownership cannot be set by source-save', 400);
    const candidate: RegistrySource = {
      id: input.key, name: input.name as string, homepage: input.homepage as string,
      kind: input.kind as RegistrySource['kind'], lane: input.lane as RegistrySource['lane'],
      method: input.method as RegistrySource['method'], approval: 'DRAFT', enabled: false,
      permittedEndpoint: input.permittedEndpoint as string | null | undefined,
      cadenceMinutes: input.cadenceMinutes as number, maxItemsPerRun: input.maxItemsPerRun as number,
      notes: input.notes as string | undefined,
    };
    const checked = validateRegistrySource(candidate);
    if (!checked.ok) return apiError('INVALID_SOURCE', checked.reasons.join('; ').slice(0, 1000), 400);
    const s = checked.source;
    const data = { name: s.name.trim(), homepage: s.homepage, kind: s.kind, lane: s.lane, method: s.method,
      permittedEndpoint: s.permittedEndpoint ?? null, cadenceMinutes: s.cadenceMinutes,
      maxItemsPerRun: s.maxItemsPerRun, notes: s.notes ?? '' };
    if (input.id !== undefined) {
      const changed = await prisma.clientDiscoverySource.updateMany({
        where: { id: input.id, profileId, approval: 'DRAFT', enabled: false }, data,
      });
      return changed.count ? apiSuccess({ saved: true }) : apiError('CONFLICT', 'Only draft disabled sources can be edited; use the explicit approval operation', 409);
    }
    try {
      const source = await prisma.clientDiscoverySource.create({ data: { ...data, key: input.key, profileId, approval: 'DRAFT', enabled: false } });
      return apiSuccess({ id: source.id, approval: 'DRAFT', enabled: false }, 201);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return apiError('CONFLICT', 'Source key already exists', 409);
      throw error;
    }
  }
  if (operation === 'client:source-decision') {
    if (!idValid(input.id) || !['APPROVE', 'SUSPEND', 'DISABLE', 'ENABLE'].includes(String(input.decision)) ||
        input.confirm !== 'REVIEWED-COMMERCIAL-SOURCE')
      return apiError('INVALID_DECISION', 'Explicit review confirmation and a valid decision are required', 400);
    const source = await prisma.clientDiscoverySource.findFirst({ where: { id: input.id, profileId } });
    if (!source) return apiError('NOT_FOUND', 'Source not found', 404);
    const decision = input.decision as string;
    if (decision === 'ENABLE' && source.approval !== 'APPROVED') return apiError('CONFLICT', 'Approve source before enabling', 409);
    if (decision === 'APPROVE' && source.approval !== 'DRAFT') return apiError('CONFLICT', 'Only draft sources may be approved', 409);
    const proposed: RegistrySource = { id: source.key, name: source.name, homepage: source.homepage,
      kind: source.kind as RegistrySource['kind'], lane: source.lane as RegistrySource['lane'],
      method: source.method as RegistrySource['method'], approval: decision === 'SUSPEND' ? 'SUSPENDED' : decision === 'APPROVE' ? 'APPROVED' : source.approval as RegistrySource['approval'],
      enabled: decision === 'ENABLE' ? true : decision === 'DISABLE' || decision === 'SUSPEND' ? false : source.enabled,
      permittedEndpoint: source.permittedEndpoint, cadenceMinutes: source.cadenceMinutes, maxItemsPerRun: source.maxItemsPerRun, notes: source.notes,
    };
    const checked = validateRegistrySource(proposed);
    if (!checked.ok) return apiError('INVALID_SOURCE', checked.reasons.join('; ').slice(0, 1000), 400);
    const changed = await prisma.clientDiscoverySource.updateMany({ where: { id: source.id, profileId, approval: source.approval, enabled: source.enabled },
      data: { approval: proposed.approval, enabled: proposed.enabled } });
    return changed.count ? apiSuccess({ saved: true, approval: proposed.approval, enabled: proposed.enabled, collectionStarted: false })
      : apiError('CONFLICT', 'Source changed during review; refresh and retry', 409);
  }
  return apiError('INVALID_OPERATION', 'Unsupported client source registry operation', 400);
}

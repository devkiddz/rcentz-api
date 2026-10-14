import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';

type Data = Record<string, unknown>;
const isRecord = (v: unknown): v is Data => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, limit = 200) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= limit ? v.trim() : null;
const optionalText = (v: unknown, limit = 1000) => typeof v === 'string' && v.length <= limit ? v.trim() : null;
const key = (v: unknown) => typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 70 ? v : null;
const items = (v: unknown, limit = 12) => Array.isArray(v) && v.length <= limit && v.every(i => text(i, 160) !== null) ? [...new Set(v.map(i => String(i).trim()))] : null;
const statuses = ['DRAFT', 'READY', 'PAUSED', 'ARCHIVED'] as const;
const capabilityInclude = { solutions: { orderBy: { createdAt: 'asc' as const } }, evidence: { orderBy: { createdAt: 'asc' as const } } };

export async function companyCapabilities(operation: string, input: Data, ownerId: string) {
  // Initially private to the approved owner. Future team grants require a separate authorization design.
  const profile = await prisma.companyOpportunityProfile.findUnique({ where: { key: 'rcentz-systems' } });
  if (profile && profile.managerId !== ownerId) return apiError('FORBIDDEN', 'Company profile managed by another identity', 403);
  if (operation === 'company:list') {
    const capabilities = profile ? await prisma.companyCapability.findMany({ where: { profileId: profile.id }, include: capabilityInclude, orderBy: { createdAt: 'asc' }, take: 100 }) : [];
    const services = await prisma.service.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 100 });
    return apiSuccess({ profile, capabilities, services });
  }
  if (operation === 'company:profile') {
    const name = text(input.name, 120), operatingCountry = text(input.operatingCountry, 80), deliveryMode = text(input.deliveryMode, 120);
    const availabilityNote = optionalText(input.availabilityNote, 400);
    if (!name || !operatingCountry || !deliveryMode || availabilityNote === null) return apiError('INVALID_PROFILE', 'Invalid company profile', 400);
    if (input.weeklyHours !== null && input.weeklyHours !== undefined && (!Number.isInteger(input.weeklyHours) || Number(input.weeklyHours) < 0 || Number(input.weeklyHours) > 168)) return apiError('INVALID_CAPACITY', 'Invalid capacity', 400);
    if (input.concurrentCapacity !== null && input.concurrentCapacity !== undefined && (!Number.isInteger(input.concurrentCapacity) || Number(input.concurrentCapacity) < 0 || Number(input.concurrentCapacity) > 100)) return apiError('INVALID_CAPACITY', 'Invalid capacity', 400);
    const data = { name, operatingCountry, deliveryMode, availabilityNote: availabilityNote || 'Needs confirmation', weeklyHours: input.weeklyHours === undefined || input.weeklyHours === null ? null : Number(input.weeklyHours), concurrentCapacity: input.concurrentCapacity === undefined || input.concurrentCapacity === null ? null : Number(input.concurrentCapacity) };
    if (profile) {
      const changed = await prisma.companyOpportunityProfile.updateMany({ where: { id: profile.id, managerId: ownerId }, data });
      return changed.count ? apiSuccess({ saved: true }) : apiError('CONFLICT', 'Profile changed', 409);
    }
    try {
      await prisma.companyOpportunityProfile.create({ data: { key: 'rcentz-systems', managerId: ownerId, ...data } });
      return apiSuccess({ saved: true }, 201);
    } catch (e) { if (isRecord(e) && e.code === 'P2002') return apiError('CONFLICT', 'Company profile already created', 409); throw e; }
  }
  if (!profile) return apiError('PROFILE_REQUIRED', 'Create the company profile first', 409);
  if (operation === 'company:capability') {
    const id = input.id === undefined ? null : text(input.id, 160);
    const capKey = key(input.key), name = text(input.name, 120), purpose = text(input.purpose, 2000);
    const serviceId = text(input.serviceId, 160), status = input.status;
    const businessProblems = items(input.businessProblems), possibleWork = items(input.possibleWork), agreementTypes = items(input.agreementTypes), deliveryLimits = items(input.deliveryLimits);
    if (status === 'READY') return apiError('EVIDENCE_REVIEW_REQUIRED', 'Ready status requires independently reviewed evidence', 409);
    if (!capKey || !name || !purpose || !serviceId || !statuses.includes(status as typeof statuses[number]) || !businessProblems || !possibleWork || !agreementTypes || !deliveryLimits || (input.id !== undefined && !id)) return apiError('INVALID_CAPABILITY', 'Invalid capability fields', 400);
    // Enforce that the referenced Service actually exists, never synthesize a public service.
    const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
    if (!service) return apiError('INVALID_SERVICE', 'Select an existing service', 400);
    const data = { key: capKey, name, purpose, serviceId, status: status as typeof statuses[number], businessProblems, possibleWork, agreementTypes, deliveryLimits };
    if (id) {
      const changed = await prisma.companyCapability.updateMany({ where: { id, profileId: profile.id }, data });
      return changed.count ? apiSuccess({ saved: true }) : apiError('NOT_FOUND', 'Capability not found', 404);
    }
    try { const created = await prisma.companyCapability.create({ data: { profileId: profile.id, ...data } }); return apiSuccess({ id: created.id }, 201); }
    catch (e) { if (isRecord(e) && e.code === 'P2002') return apiError('CONFLICT', 'Capability key already exists', 409); throw e; }
  }
  if (operation === 'company:solution') {
    const id = input.id === undefined ? null : text(input.id, 160);
    const capabilityId = text(input.capabilityId, 160), solutionKey = key(input.key), name = text(input.name, 120), problem = text(input.problem, 2000), proposedWorkflow = text(input.proposedWorkflow, 4000);
    const intendedUsers = items(input.intendedUsers), deliverables = items(input.deliverables), buyerPhrases = items(input.buyerPhrases), discoveryQuestions = items(input.discoveryQuestions), exclusions = items(input.exclusions);
    const status = input.status;
    if (status === 'READY') return apiError('EVIDENCE_REVIEW_REQUIRED', 'Ready status requires independently reviewed evidence', 409);
    if (!capabilityId || !solutionKey || !name || !problem || !proposedWorkflow || !intendedUsers || !deliverables || !buyerPhrases || !discoveryQuestions || !exclusions || !statuses.includes(status as typeof statuses[number]) || (input.id !== undefined && !id)) return apiError('INVALID_SOLUTION', 'Invalid solution fields', 400);
    const ownerCap = await prisma.companyCapability.findFirst({ where: { id: capabilityId, profileId: profile.id }, select: { id: true } });
    if (!ownerCap) return apiError('NOT_FOUND', 'Capability not found', 404);
    const data = { key: solutionKey, name, problem, proposedWorkflow, intendedUsers, deliverables, buyerPhrases, discoveryQuestions, exclusions, status: status as typeof statuses[number] };
    if (id) {
      const changed = await prisma.capabilitySolution.updateMany({ where: { id, capabilityId }, data });
      return changed.count ? apiSuccess({ saved: true }) : apiError('NOT_FOUND', 'Solution not found', 404);
    }
    try { const created = await prisma.capabilitySolution.create({ data: { capabilityId, ...data } }); return apiSuccess({ id: created.id }, 201); }
    catch (e) { if (isRecord(e) && e.code === 'P2002') return apiError('CONFLICT', 'Solution key already exists', 409); throw e; }
  }
  return apiError('INVALID_OPERATION', 'Unsupported company operation', 400);
}

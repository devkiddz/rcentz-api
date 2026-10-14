import 'server-only';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { assessCommercialCandidate, canonicalPublicUrl, type CommercialSourceKind } from './client-discovery-intake';

type Input = Record<string, unknown>;
const text = (v: unknown, max: number, min = 1): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{10,160}$/.test(v);
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T00:00:00Z'));
const kindMap: Record<string, CommercialSourceKind> = { PUBLIC_RFP:'PUBLIC_RFP', PUBLIC_PROJECT_REQUEST:'PUBLIC_PROJECT_REQUEST', COMPANY_WEBSITE:'COMPANY_WEBSITE', BUSINESS_DIRECTORY:'BUSINESS_DIRECTORY', PARTNERSHIP_NOTICE:'PARTNERSHIP_NOTICE', OTHER_PUBLIC:'OTHER_PUBLIC' };

/** Explicit manual notice review; never fetches websites or starts collection. */
export async function clientManualNotice(operation: string, input: Input, ownerId: string) {
  const profile = await prisma.companyOpportunityProfile.findUnique({ where: { key: 'rcentz-systems' }, select: { id: true, managerId: true } });
  if (!profile || profile.managerId !== ownerId) return apiError('FORBIDDEN', 'Commercial catalogue is not assigned to this owner', 403);
  if (!id(input.sourceId) || !text(input.noticeUrl, 2048) || !text(input.title, 240) || !text(input.description, 4000, 12) ||
      !text(input.buyer, 180) || !text(input.eligibilityNotes, 1500, 10) ||
      (input.deadline !== undefined && input.deadline !== null && !date(input.deadline)) ||
      (input.country !== undefined && input.country !== null && !text(input.country, 100)))
    return apiError('INVALID_NOTICE', 'Source, notice URL, buyer, title, description and eligibility assessment are required', 400);
  const source = await prisma.clientDiscoverySource.findFirst({ where: { id: input.sourceId, profileId: profile.id },
    select: { id: true, key: true, name: true, kind: true, homepage: true, approval: true, method: true } });
  if (!source) return apiError('SOURCE_NOT_FOUND', 'Source not registered for this company', 404);
  const publicUrl = canonicalPublicUrl(input.noticeUrl);
  const homepage = canonicalPublicUrl(source.homepage);
  if (!publicUrl || !homepage) return apiError('INVALID_NOTICE_URL', 'Notice must have a valid public HTTPS URL', 400);
  // Public sourcing policy: don't silently attribute a notice from another host to an approved source.
  if (new URL(publicUrl).hostname !== new URL(homepage).hostname)
    return apiError('SOURCE_MISMATCH', 'Notice host must match registered source homepage; review source provenance', 400);
  const candidate = assessCommercialCandidate({ sourceKind: kindMap[source.kind] ?? 'OTHER_PUBLIC', sourceName: source.name,
    sourceUrl: publicUrl, title: input.title, description: input.description, capturedAt: new Date().toISOString() });
  if (candidate.decision === 'REJECT') return apiError('NOTICE_REJECTED', candidate.reason, 400);
  const normalized = candidate.normalizedUrl!;
  const notice = { sourceId: source.id, sourceName: source.name, noticeUrl: normalized,
    buyer: input.buyer.trim(), title: input.title.trim(), description: input.description.trim(),
    deadline: typeof input.deadline === 'string' ? input.deadline : null,
    country: typeof input.country === 'string' ? input.country.trim() : null,
    eligibilityNotes: input.eligibilityNotes.trim(), warnings: candidate.warnings,
    requiresHumanReview: true, matchingIsNotAnEligibilityDecision: true };
  if (operation === 'client:notice-preview') return apiSuccess({ notice, sourceApproval: source.approval, canSave: source.approval === 'APPROVED', collectionStarted: false });
  if (operation !== 'client:notice-save') return apiError('INVALID_OPERATION', 'Unsupported notice operation', 400);
  if (source.approval !== 'APPROVED') return apiError('SOURCE_NOT_APPROVED', 'Source must be explicitly approved for manual intake', 409);
  if (input.confirm !== 'SAVE-MANUAL-NOTICE') return apiError('CONFIRM_REQUIRED', 'Explicit manual review confirmation required', 400);
  const externalId = normalized; // stable canonical notice URL, independent of changing title
  // Store only evidence-backed facts. No invented fit score, contact address, or client intent.
  const details = [notice.title, notice.description, `Eligibility review: ${notice.eligibilityNotes}`,
    notice.deadline ? `Deadline (unverified): ${notice.deadline}` : 'Deadline: not provided'];
  const summary = details.join('\n\n').slice(0, 4000);
  try {
    const prospect = await prisma.clientProspect.create({ data: {
      companyProfileId: profile.id, ownerId, source: source.key, externalId, canonicalKey: `${source.key}:${normalized}`,
      businessName: notice.buyer, summary, website: null, country: notice.country,
      industry: null, budgetSignal: null, evidenceLinks: [normalized], problemSignals: [], engagementTypes: [],
      qualification: { kind: 'MANUAL_PUBLIC_NOTICE', sourceId: source.id, noticeUrl: normalized,
        title: notice.title, deadline: notice.deadline, eligibilityNotes: notice.eligibilityNotes,
        humanReviewRequired: true, sourceStatusAtIntake: source.approval },
      state: 'NEW',
    } });
    return apiSuccess({ id: prospect.id, state: prospect.state, requiresHumanReview: true, collectionStarted: false }, 201);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
      return apiError('ALREADY_EXISTS', 'Notice was already recorded for this source', 409);
    throw error;
  }
}

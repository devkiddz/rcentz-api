import "server-only";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/server/api/responses/api-response";

type Data = Record<string, unknown>;
const asRecord = (value: unknown): value is Data => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanText = (value: unknown, max = 300) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const optionalText = (value: unknown, max = 500) => value === null || value === undefined ? null : cleanText(value, max);
const stringList = (value: unknown, max = 24) => Array.isArray(value) && value.length <= max && value.every(x => cleanText(x, 120) !== null)
  ? [...new Set(value.map(x => (x as string).trim()))] : null;
const validUrl = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 600) return undefined;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !u.hash ? u.toString() : undefined; }
  catch { return undefined; }
};

export async function clientAcquisition(operation: string, input: Data, ownerId: string) {
  // Company owner and separate operation scopes are required; do not read the personal OpportunityProfile.
  const profile = await prisma.companyOpportunityProfile.findUnique({ where: { key: "rcentz-systems" }, select: { id: true, managerId: true } });
  if (!profile || profile.managerId !== ownerId) return apiError("FORBIDDEN", "Authorized company owner required", 403);
  if (operation === "client:list") {
    const requested = input.page === undefined ? 1 : input.page;
    if (!Number.isInteger(requested) || Number(requested) < 1 || Number(requested) > 100000) return apiError("INVALID_PAGE", "Invalid page", 400);
    const page = Number(requested);
    const state = input.state;
    if (state !== undefined && (typeof state !== "string" || !["NEW", "REVIEW", "QUALIFIED", "PURSUING", "WON", "LOST", "ARCHIVED"].includes(state))) return apiError("INVALID_STATE", "Invalid state", 400);
    const where = { companyProfileId: profile.id, ownerId, ...(state ? { state } : {}) };
    const [settings, total, prospects] = await Promise.all([
      prisma.clientAcquisitionSettings.findUnique({ where: { companyProfileId: profile.id } }),
      prisma.clientProspect.count({ where }),
      prisma.clientProspect.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * 30, take: 30,
        include: { matches: { select: { capabilityId: true, score: true, rationale: true }, take: 20 } } }),
    ]);
    return apiSuccess({ settings, total, page, pageSize: 30, prospects });
  }
  if (operation === "client:settings") {
    const regions = stringList(input.regions), industries = stringList(input.industries), engagementTypes = stringList(input.engagementTypes),
      preferredSources = stringList(input.preferredSources), businessProblems = stringList(input.businessProblems);
    if (!regions || !industries || !engagementTypes || !preferredSources || !businessProblems ||
      typeof input.includeUnpriced !== "boolean" || typeof input.requireBudget !== "boolean" || typeof input.discoveryEnabled !== "boolean" ||
      !Number.isInteger(input.minimumScore) || Number(input.minimumScore) < 0 || Number(input.minimumScore) > 100)
      return apiError("INVALID_SETTINGS", "Invalid acquisition configuration", 400);
    // P3 does not enable collection; first verify a dedicated collection service and its controls.
    if (input.discoveryEnabled) return apiError("COLLECTION_NOT_READY", "Collection activation requires a reviewed acquisition collector", 409);
    if (input.requireBudget && input.includeUnpriced) return apiError("INVALID_SETTINGS", "Budget requirements conflict", 400);
    const data = { regions, industries, engagementTypes, preferredSources, businessProblems,
      includeUnpriced: input.includeUnpriced, requireBudget: input.requireBudget, discoveryEnabled: false, minimumScore: Number(input.minimumScore) };
    const updated = await prisma.clientAcquisitionSettings.upsert({ where: { companyProfileId: profile.id },
      create: { companyProfileId: profile.id, ownerId, ...data }, update: { ...data } });
    return apiSuccess({ settings: updated });
  }
  if (operation === "client:prospect") {
    // Manual draft ingestion only; no crawlers, scheduling or automatic collection are enabled.
    const source = cleanText(input.source, 100), externalId = cleanText(input.externalId, 180), businessName = cleanText(input.businessName, 180),
      summary = cleanText(input.summary, 4000), country = optionalText(input.country, 100), industry = optionalText(input.industry, 160),
      budgetSignal = optionalText(input.budgetSignal, 300), website = validUrl(input.website),
      problemSignals = stringList(input.problemSignals), engagementTypes = stringList(input.engagementTypes), evidenceLinks = stringList(input.evidenceLinks, 10);
    if (!source || !externalId || !businessName || !summary || country === undefined || industry === undefined || budgetSignal === undefined ||
      website === undefined || !problemSignals || !engagementTypes || !evidenceLinks || evidenceLinks.some(x => validUrl(x) === undefined || validUrl(x) === null))
      return apiError("INVALID_PROSPECT", "Invalid prospect data", 400);
    if (input.state !== undefined && input.state !== "NEW") return apiError("INVALID_STATE", "New prospects must begin in NEW", 400);
    const existing = await prisma.clientProspect.findUnique({ where: { companyProfileId_source_externalId: { companyProfileId: profile.id, source, externalId } }, select: { id: true } });
    if (existing) return apiError("ALREADY_EXISTS", "Prospect source reference already recorded", 409);
    try {
      const prospect = await prisma.clientProspect.create({ data: { companyProfileId: profile.id, ownerId, source, externalId, businessName,
        summary, website, country, industry, budgetSignal, problemSignals, engagementTypes, evidenceLinks, state: "NEW" } });
      return apiSuccess({ prospect }, 201);
    } catch (error) {
      if (asRecord(error) && error.code === "P2002") return apiError("ALREADY_EXISTS", "Prospect source reference already recorded", 409);
      throw error;
    }
  }
  return apiError("INVALID_OPERATION", "Unsupported Client Acquisition operation", 400);
}

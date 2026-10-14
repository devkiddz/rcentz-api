import "server-only";
import { runCommercialCollection, commercialRunOverview } from "./client-collector";
import { prospectStates } from "./client-discovery-policy";
import { canonicalPublicUrl } from "./client-discovery-intake";
import type { Prisma } from "@/generated/prisma/client";
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
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try { return canonicalPublicUrl(value) ?? undefined; }
  catch { return undefined; }
};

export async function clientAcquisition(operation: string, input: Data, ownerId: string) {
  // Company owner and separate operation scopes are required; do not read the personal OpportunityProfile.
  const profile = await prisma.companyOpportunityProfile.findUnique({ where: { key: "rcentz-systems" }, select: { id: true, managerId: true } });
  if (!profile || profile.managerId !== ownerId) return apiError("FORBIDDEN", "Authorized company owner required", 403);

  if (operation === 'client:collect') return apiSuccess(await runCommercialCollection(ownerId));
  if (operation === 'client:detail' || operation === 'client:decision') {
    if(typeof input.id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(input.id))return apiError('INVALID_ID','Invalid lead identifier',400);
    const where={id:input.id,ownerId,companyProfileId:profile.id};
    if(operation==='client:detail'){
      const prospect=await prisma.clientProspect.findFirst({where,include:{matches:{take:20,select:{capabilityId:true,score:true,rationale:true}}}});
      if(!prospect)return apiError('NOT_FOUND','Lead not available',404);
      const history=await prisma.auditLog.findMany({where:{entityType:'ClientProspect',entityId:prospect.id,userId:ownerId,action:'CLIENT_PROSPECT_REVIEW'},orderBy:{createdAt:'desc'},take:50,select:{id:true,createdAt:true,metadata:true}});
      return apiSuccess({prospect,history});
    }
    if(typeof input.state!=='string'||!prospectStates.includes(input.state as typeof prospectStates[number])||typeof input.notes!=='string'||input.notes.length>6000||typeof input.updatedAt!=='string'||!Number.isFinite(Date.parse(input.updatedAt)))return apiError('INVALID_REVIEW','Invalid lead review',400);
    const state=input.state,notes=input.notes.trim(),version=new Date(input.updatedAt);
    const checked=input.confirmedChecks;
    const validChecks=['source','intent','eligibility','capacity'];
    if(!Array.isArray(checked)||checked.length>4||checked.some(v=>typeof v!=='string'||!validChecks.includes(v)))return apiError('INVALID_REVIEW','Invalid qualification checks',400);
    if(['QUALIFIED','PURSUING','WON'].includes(state)&&(validChecks.some(c=>!checked.includes(c))||notes.length<10))return apiError('QUALIFICATION_REQUIRED','Review source, buying intent, eligibility and capacity, then record your assessment before advancing.',400);
    const result=await prisma.$transaction(async tx=>{
      const current=await tx.clientProspect.findFirst({where});
      if(!current)return 'missing';
      if(current.updatedAt.getTime()!==version.getTime())return 'conflict';
      const oldQualification=asRecord(current.qualification)?current.qualification:{};
      const previousReview=asRecord(oldQualification.review)?oldQualification.review:{};
      if(current.state===state&&current.notes===notes&&JSON.stringify(previousReview.confirmedChecks??[])===JSON.stringify(checked))return 'unchanged';
      const count=await tx.clientProspect.updateMany({where:{...where,updatedAt:version},data:{state,notes,qualification:{...oldQualification,review:{confirmedChecks:checked,reviewedAt:new Date().toISOString()}} as Prisma.InputJsonValue}});
      if(count.count!==1)return 'conflict';
      await tx.auditLog.create({data:{userId:ownerId,action:'CLIENT_PROSPECT_REVIEW',entityType:'ClientProspect',entityId:current.id,metadata:{previousState:current.state,state,notes,confirmedChecks:checked}}});
      return 'saved';
    });
    if(result==='missing')return apiError('NOT_FOUND','Lead not available',404);
    if(result==='conflict')return apiError('REVIEW_CONFLICT','This lead changed. Reload it before saving.',409);
    return apiSuccess({id:input.id,status:result});
  }
  if (operation === "client:list") {
    const requested = input.page === undefined ? 1 : input.page;
    if (!Number.isInteger(requested) || Number(requested) < 1 || Number(requested) > 100000) return apiError("INVALID_PAGE", "Invalid page", 400);
    const requestedPage = Number(requested);
    const state = input.state;
    if (state !== undefined && (typeof state !== "string" || !(prospectStates as readonly string[]).includes(state))) return apiError("INVALID_STATE", "Invalid state", 400);
    const where = { companyProfileId: profile.id, ownerId, ...(state ? { state } : {}) };
    const [settings, discovery] = await Promise.all([
      prisma.clientAcquisitionSettings.findUnique({ where: { companyProfileId: profile.id } }),
      commercialRunOverview(profile.id, ownerId),
    ]);
    const {total,page,prospects}=await prisma.$transaction(async tx=>{
      const total=await tx.clientProspect.count({where});
      const page=Math.min(requestedPage,Math.max(1,Math.ceil(total/30)));
      const prospects=await tx.clientProspect.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*30,take:30,include:{matches:{select:{capabilityId:true,score:true,rationale:true},take:20}}});
      return {total,page,prospects};
    },{isolationLevel:'RepeatableRead'});
    return apiSuccess({ settings, total, page, pageSize: 30, prospects, discovery });
  }
  if (operation === "client:settings") {
    const regions = stringList(input.regions), industries = stringList(input.industries), engagementTypes = stringList(input.engagementTypes),
      preferredSources = stringList(input.preferredSources), businessProblems = stringList(input.businessProblems);
    if (!regions || !industries || !engagementTypes || !preferredSources || !businessProblems ||
      typeof input.includeUnpriced !== "boolean" || typeof input.requireBudget !== "boolean" || typeof input.discoveryEnabled !== "boolean" ||
      !Number.isInteger(input.minimumScore) || Number(input.minimumScore) < 0 || Number(input.minimumScore) > 100)
      return apiError("INVALID_SETTINGS", "Invalid acquisition configuration", 400);
    if (input.discoveryEnabled && !process.env.OPPORTUNITY_SEARCH_API_KEY) return apiError("SEARCH_NOT_CONFIGURED", "Configure public web search before enabling the daily hunt", 409);
    if (input.requireBudget && input.includeUnpriced) return apiError("INVALID_SETTINGS", "Budget requirements conflict", 400);
    const data = { regions, industries, engagementTypes, preferredSources, businessProblems,
      includeUnpriced: input.includeUnpriced, requireBudget: input.requireBudget, discoveryEnabled: input.discoveryEnabled, minimumScore: Number(input.minimumScore) };
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

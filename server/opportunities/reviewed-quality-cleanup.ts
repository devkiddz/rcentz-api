import type { PrismaClient, Prisma } from '@/generated/prisma/client';
import { assessWebLead } from './client-discovery-policy';

export const cleanupBatch = 'commercial-quality-20261016';
export const reviewedTargets = [
  ['cmvapphw7000708l1p5ur8tgj', '10 best client and customer portal software in 2026 (free and paid)', 'Software ranking article'],
  ['cmvapphrb000508l1jilzsu6o', 'r/devjobs on Reddit: looking for developers ( for my saas studio company )', 'In-house revenue-share recruitment'],
  ['cmvapphow000408l19lhbamhf', 'How Nigerian Businesses Can Use WhatsApp to Get Customers - Sonnywebs International', 'Instructional marketing article'],
  ['cmv8d6dwe000r08jvu37g8dlv', 'Top US Outsourcing Software Development Companies | 2026', 'Agency directory'],
  ['cmv8d6dto000q08jvv8e5sddw', 'Take App: Create your online store for WhatsApp', 'Seller product listing'],
  ['cmv8d6dqz000p08jvcy930hnu', 'Create an Online Store in 2026 (Guide to Success)', 'Instructional article'],
  ['cmv8d6doa000o08jv66ldasbk', 'Starting an E-commerce Business in Nigeria: What You Actually Need to Know | Eleo Blog', 'Instructional article'],
  ['cmv8d6dlk000n08jvo1sbs260', 'Best Freelance Web Designers for Hire (Oct 2026) - Upwork', 'Seller directory'],
  ['cmv8d6dfs000l08jvt47fsqlt', 'Web Design Company in Abuja | Professional Website Design & Development', 'Agency marketing'],
  ['cmv8d6dcs000k08jvrwndmwo5', 'Top Web Development Companies in 2026', 'Agency directory'],
] as const;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const preferences = {regions:[],industries:[],engagementTypes:[],preferredSources:[],businessProblems:[],minimumScore:0,requireBudget:false,includeUnpriced:true};

/** Explicit operational cleanup only. Preview is the default; all writes are one transaction. */
export async function cleanupReviewedLeads(db: PrismaClient, apply = false) {
  return db.$transaction(async tx => {
    const profile = await tx.companyOpportunityProfile.findUnique({where:{key:'rcentz-systems'},select:{id:true,managerId:true}});
    if (!profile?.managerId) throw Error('Assigned company manager required. No records changed.');
    const manager = await tx.user.findUnique({where:{id:profile.managerId},select:{role:true,status:true}});
    if (!manager || manager.status !== 'ACTIVE' || !['ADMIN','SUPER_ADMIN'].includes(manager.role)) throw Error('Active administrator required. No records changed.');
    const candidates = [];
    const alreadyArchived = [];
    for (const [id, title, reason] of reviewedTargets) {
      const row = await tx.clientProspect.findFirst({where:{id,ownerId:profile.managerId,companyProfileId:profile.id,source:'PUBLIC_WEB'}});
      if (!row) throw Error('Reviewed record missing or outside owner scope: '+id);
      const q = record(row.qualification) ? row.qualification : {};
      if (q.title !== title) throw Error('Reviewed title changed: '+id);
      const historyCount = await tx.auditLog.count({where:{entityType:'ClientProspect',entityId:id}});
      const priorCleanup = record(q.cleanup) ? q.cleanup : {};
      if (row.state === 'ARCHIVED' && priorCleanup.batch === cleanupBatch && historyCount === 1 && row.notes === '') {
        alreadyArchived.push(id);continue;
      }
      if (row.state !== 'NEW' || row.notes !== '' || historyCount !== 0 || q.review !== undefined || q.cleanup !== undefined) throw Error('Record has changed or has review history; preserve it: '+id);
      const url = typeof q.sourceUrl === 'string' ? q.sourceUrl : '';
      const description = row.summary.startsWith(title+'\n\n') ? row.summary.slice(title.length+2) : row.summary;
      if (assessWebLead({title,description,url,research:q.kind==='RESEARCH_LEAD'},[],preferences)) throw Error('Record now passes admission; manual review required: '+id);
      candidates.push({row,q,title,reason});
    }
    if (apply) for (const {row,q,reason} of candidates) {
      const qualification = {...q,cleanup:{batch:cleanupBatch,policyVersion:3,reason,archivedAt:new Date().toISOString()}} as Prisma.InputJsonValue;
      const changed = await tx.clientProspect.updateMany({where:{id:row.id,ownerId:profile.managerId,companyProfileId:profile.id,source:'PUBLIC_WEB',state:'NEW',notes:'',updatedAt:row.updatedAt},data:{state:'ARCHIVED',qualification}});
      if (changed.count !== 1) throw Error('Concurrent change; the entire cleanup is rolled back: '+row.id);
      await tx.auditLog.create({data:{userId:profile.managerId,action:'CLIENT_PROSPECT_REVIEW',entityType:'ClientProspect',entityId:row.id,metadata:{previousState:'NEW',state:'ARCHIVED',reviewType:'QUALITY_ARCHIVE',cleanupBatch,reason,notes:'Quality archive: '+reason,confirmedChecks:[]}}});
    }
    return {mode:apply?'APPLY':'READ_ONLY_PREVIEW',batch:cleanupBatch,count:candidates.length,alreadyArchived,records:candidates.map(({row,title,reason})=>({id:row.id,title,reason})),preserved:'All records, source evidence, notes and capability matches retained. Three other candidates are excluded from this batch.'};
  }, {isolationLevel:'Serializable',maxWait:5000,timeout:30000});
}

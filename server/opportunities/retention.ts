import { prisma } from "@/lib/prisma";
import { finderPolicy, retentionWhere, untouchedWhere } from "./policy";

export async function retentionSnapshot(ownerId: string, preview: boolean, now = new Date()) {
  if (!ownerId) throw Error("Owner identity required");
  const profile = await prisma.opportunityProfile.findUnique({where: {ownerId}, select: {id: true}});
  const cutoff = new Date(now.getTime() - finderPolicy.retentionDays * 86400000);
  const base = {profileExists: !!profile, retentionEnabled: process.env.OPPORTUNITY_RETENTION_ENABLED === "true", preview, deletionPerformed: false as const, checkedAt: now.toISOString(), cutoff: cutoff.toISOString(), limits: finderPolicy};
  if (!profile) return {...base, total: 0, untouched: 0, eligible: 0, ineligible: 0, candidates: []};
  const snapshot = await prisma.$transaction(async tx => {
    const where = retentionWhere(profile.id, now);
    const total = await tx.opportunity.count({where: {profileId: profile.id}});
    const untouched = await tx.opportunity.count({where: untouchedWhere(profile.id)});
    const eligible = await tx.opportunity.count({where});
    const candidates = preview ? await tx.opportunity.findMany({where, take: 6, orderBy: [{lastSeenAt: "asc"}, {id: "asc"}], select: {id:true, title:true, company:true, lastSeenAt:true, updatedAt:true}}) : [];
    return {total, untouched, eligible, ineligible: total - eligible, candidates: candidates.map(c => ({...c, title:c.title.slice(0,180), company:c.company.slice(0,100)}))};
  }, {isolationLevel: "RepeatableRead"});
  return {...base, ...snapshot};
}

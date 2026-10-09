import 'server-only';
import { prisma } from '@/lib/prisma';
import { assess } from '@/features/opportunities/lib/matching';
import { collectRemotive } from './remotive';
export async function runCollection(ownerId: string) {
  // Lock and cooldown span the fetch and writes: concurrent cron/manual runs cannot poll twice.
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'opportunity:' + ownerId}))`;
    const profile = await tx.opportunityProfile.findUnique({ where: { ownerId } });
    if (!profile?.enabled) return { status: 'disabled', added: 0 };
    const recent = await tx.opportunityRun.findFirst({ where: { profileId: profile.id, startedAt: { gt: new Date(Date.now() - 20 * 3600000) } }, orderBy: { startedAt: 'desc' } });
    if (recent) return { status: 'cooldown', added: 0 };
    let listings;
    try { listings = await collectRemotive(); } catch {
      await tx.opportunityRun.create({ data: { profileId: profile.id, source: 'REMOTIVE', status: 'FAILED', message: 'Source unavailable or invalid. Existing listings were preserved.', finishedAt: new Date() } });
      return { status: 'failed', added: 0 };
    }
    const now = new Date(); let added = 0; let strong = 0;
    for (const listing of listings) {
      const result = assess(listing, profile.skills, profile.experienceYears);
      const key = { profileId: profile.id, source: 'REMOTIVE', externalId: listing.externalId };
      const existing = await tx.opportunity.findUnique({ where: { profileId_source_externalId: key }, select: { id: true } });
      // Ignore unrelated NEW listings; keep updating already saved ones after profile changes.
      if (!existing && result.assessment.matched.length === 0) continue;
      if (!existing) { added++; if (result.score >= 50) strong++; }
      await tx.opportunity.upsert({ where: { profileId_source_externalId: key }, create: { ...key, ...listing, ...result, lastSeenAt: now }, update: { ...listing, ...result, sourceState: 'LISTED', lastSeenAt: now } });
    }
    // Absence is not proof of closure. Preserve the record and the user's application status.
    await tx.opportunity.updateMany({ where: { profileId: profile.id, source: 'REMOTIVE', externalId: { notIn: listings.map(item => item.externalId) } }, data: { sourceState: 'NOT_IN_FEED' } });
    await tx.opportunityRun.create({ data: { profileId: profile.id, source: 'REMOTIVE', status: 'SUCCESS', fetched: listings.length, added, finishedAt: now } });
    await tx.notification.create({ data: { userId: ownerId, type: 'SYSTEM', title: 'Your opportunity digest', message: added ? `${added} new stack-related opportunities; ${strong} merit closer review. Check eligibility before applying.` : 'No new stack-related opportunities today.', href: '/admin/opportunities' } });
    return { status: 'success', added };
  }, { timeout: 60000, maxWait: 5000 });
}

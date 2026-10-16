/** Read-only, owner-scoped audit. No archive, delete, update, contact or collection. */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { assessWebLead } from '../server/opportunities/client-discovery-policy';

async function audit() {
  const profile = await prisma.companyOpportunityProfile.findUnique({
    where: { key: 'rcentz-systems' }, select: { id: true, managerId: true },
  });
  if (!profile?.managerId) throw new Error('Assigned company manager required.');
  const where = { companyProfileId: profile.id, ownerId: profile.managerId, source: 'PUBLIC_WEB' };
  const total = await prisma.clientProspect.count({ where });
  const rows = await prisma.clientProspect.findMany({
    where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 100,
    select: { id: true, state: true, summary: true, notes: true, qualification: true, budgetSignal: true },
  });
  const preferences = {regions:[],industries:[],engagementTypes:[],preferredSources:[],businessProblems:[],minimumScore:0,requireBudget:false,includeUnpriced:true};
  const flagged = [];
  const retained = [];
  for (const row of rows) {
    const q: Record<string, unknown> = row.qualification && typeof row.qualification === 'object' && !Array.isArray(row.qualification) ? row.qualification : {};
    const title = typeof q.title === 'string' ? q.title : '';
    const url = typeof q.sourceUrl === 'string' ? q.sourceUrl : '';
    const description = row.summary.startsWith(title + '\n\n') ? row.summary.slice(title.length + 2) : row.summary;
    const assessed = assessWebLead({title,description,url,research:q.kind === 'RESEARCH_LEAD'},[],preferences);
    if (!assessed || row.budgetSignal !== assessed.budget) flagged.push({
      id:row.id,title:title.slice(0,160),state:row.state,
      savedPolicyVersion:q.admissionPolicyVersion ?? null,
      reason:!assessed?'Does not satisfy current buyer/research admission':'Budget needs source review',
      preserveReview:row.notes.trim().length > 0 || !['NEW','REVIEW'].includes(row.state),
    });
    else retained.push({id:row.id,title:title.slice(0,160),state:row.state,warning:'Admission only; verify original source, freshness, technology requirements and commercial fit.'});
  }
  console.log(JSON.stringify({mode:'READ_ONLY',scanned:rows.length,total,hasMore:total>rows.length,assessmentPolicyVersion:3,flagged,retained},null,2));
}
audit().catch(error => { console.error(error instanceof Error ? error.message : 'Audit failed');process.exitCode=1; }).finally(async () => prisma.$disconnect());

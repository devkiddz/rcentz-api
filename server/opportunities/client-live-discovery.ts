import 'server-only';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/server/api/responses/api-response';
import { assessCommercialCandidate } from './client-discovery-intake';
import { matchCommercialProblems } from './commercial-matching';

/** Fixed, publicly documented UK Contracts Finder OCDS endpoint. No user-configured URLs. */
const HOST = 'https://www.contractsfinder.service.gov.uk';
const PATH = '/Published/Notices/OCDS/Search';
const MAX_BYTES = 4_000_000;
// Narrow, explicit software-service signals. Ambiguous words such as "design", "system", and "application" alone are not enough.
const directSoftware = /\b(software development|software engineer(?:ing)?|web(?:site| application| development)|mobile app(?:lication)?|digital platform|customer portal|client portal|crm|database (?:development|management)|workflow automation|systems integration|information technology|IT services|application development|business intelligence|api integration|ecommerce|e-commerce|digital transformation|cloud migration|IT consultancy)\b/i;
const softwareTerms = /\b(software|website|webapp|web-based|portal|database|api|crm|ecommerce|e-commerce|cybersecurity|cloud|digital|automation)\b/gi;
const physicalTitle = /\b(grounds? maintenance|landscap(?:e|ing)|flooring|tiling|pavilion|building works|construction|catering|training courses?|certification|painting|roofing|cleaning|roadworks|electrical installation|mechanical installation)\b/i;
const specialistTitle = /\b(robot(?:ics)?|nuclear|swabbing|surface characterisation)\b/i;
function relevantSoftwareTender(title: string, description: string): boolean {
  // The headline must signal purchasable software work, or the body must give two distinct technical signals.
  // Reject clearly non-software scope, even if a boilerplate description mentions "systems" or "digital".
  if (physicalTitle.test(title) || specialistTitle.test(title)) return false;
  if (directSoftware.test(title)) return true;
  const bodyHits = new Set((`${title} ${description}`.match(softwareTerms) || []).map(x => x.toLowerCase()));
  return bodyHits.size >= 2 && /\b(develop(?:ment)?|implement(?:ation)?|build|upgrade|migration|integrat(?:ion|e)|maintain|procure|supply|support)\b/i.test(description);
}
const weakMatchWords = new Set(['not','but','may','through','request','process','contact','could','would','should','their','this','with','from','that']);
function credibleDisplayMatch(m: ReturnType<typeof matchCommercialProblems>[number]): boolean {
  if (m.score < 15) return false;
  const evidence = m.explanation.match(/Relevant words: (.*?)\. Human qualification/)?.[1] || '';
  const terms = evidence.split(',').map(x => x.trim().toLowerCase()).filter(x => x && !weakMatchWords.has(x));
  return terms.length >= 2;
}
type Data = Record<string, unknown>;
const object = (v: unknown): v is Data => typeof v === 'object' && v !== null && !Array.isArray(v);
const string = (v: unknown) => typeof v === 'string' ? v : '';
const arr = (v: unknown) => Array.isArray(v) ? v : [];
const clamp = (v: string, n: number) => v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0,n);
const safeDate = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;

async function publishedNotices(): Promise<unknown[]> {
  const url = new URL(PATH, HOST);
  const from = new Date(Date.now() - 35 * 86400_000).toISOString().slice(0, 10);
  url.searchParams.set('publishedFrom', from);
  url.searchParams.set('stages', 'tender');
  url.searchParams.set('limit', '100');
  const response = await fetch(url, { method:'GET', cache:'no-store', redirect:'error',
    signal:AbortSignal.timeout(12000), headers:{Accept:'application/json','User-Agent':'RcentzSystems-DiscoveryReview/1.0'} });
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('json')) throw new Error('SOURCE_RESPONSE_UNAVAILABLE');
  if (Number(response.headers.get('content-length') || '0') > MAX_BYTES) throw new Error('SOURCE_TOO_LARGE');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('SOURCE_EMPTY');
  let total=0; const parts: Uint8Array[]=[];
  try { while(true) { const next=await reader.read(); if(next.done) break; total += next.value.byteLength;
    if(total>MAX_BYTES) { await reader.cancel(); throw new Error('SOURCE_TOO_LARGE'); } parts.push(next.value); }
  } finally { reader.releaseLock(); }
  const parsed:unknown = JSON.parse(Buffer.concat(parts).toString('utf8'));
  if (!object(parsed)) throw new Error('SOURCE_FORMAT_UNEXPECTED');
  // OCDS release packages use releases; reject unknown formats rather than pretending the feed is empty.
  if (!Array.isArray(parsed.releases)) throw new Error('SOURCE_FORMAT_UNEXPECTED');
  return parsed.releases.slice(0, 100);
}

export async function clientDiscoveryReview(operation: string, _input: Data, ownerId: string) {
  if (operation !== 'client:discovery-review') return apiError('INVALID_OPERATION','Unsupported discovery operation',400);
  const profile = await prisma.companyOpportunityProfile.findUnique({ where:{key:'rcentz-systems'},select:{id:true,managerId:true} });
  if (!profile || profile.managerId !== ownerId) return apiError('FORBIDDEN','Company owner required',403);
  const [problems, groups] = await Promise.all([
    prisma.commercialBusinessProblem.findMany({where:{profileId:profile.id,status:{not:'ARCHIVED'}},take:200,
      select:{id:true,key:true,title:true,description:true,symptoms:true,impact:true,status:true,solutions:{take:40,
        select:{id:true,rationale:true,priority:true,qualificationCriteria:true,solution:{select:{id:true,key:true,name:true,problem:true,proposedWorkflow:true,status:true,groupId:true,capabilityId:true}}}}}}),
    prisma.commercialSolutionGroup.findMany({where:{profileId:profile.id},select:{id:true,name:true},take:100})
  ]);
  let releases:unknown[];
  try { releases=await publishedNotices(); }
  catch { return apiError('DISCOVERY_SOURCE_UNAVAILABLE','Official notice feed unavailable or its response changed. No prospects were created.',503); }
  const seen = new Set<string>();
  const candidates: {recommendation:string;id:string;title:string;buyer:string;description:string;url:string;deadline:string|null;publishedAt:string|null;warnings:string[];matches:ReturnType<typeof matchCommercialProblems>}[]=[];
  for (const unknownRelease of releases) {
    if (!object(unknownRelease) || !object(unknownRelease.tender)) continue;
    const tender=unknownRelease.tender;
    const title=clamp(string(tender.title),240);
    const description=clamp(string(tender.description),4000);
    if (!title || description.length<12 || !relevantSoftwareTender(title, description)) continue;
    const ocid=string(unknownRelease.ocid).slice(0,160);
    const id=string(unknownRelease.id).slice(0,160);
    const identity = ocid || id || `${title.toLowerCase()}|${string(unknownRelease.date).slice(0,10)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    // OCDS source often includes the canonical link in documents; otherwise use an official OCDS record link.
    const documents=arr(tender.documents);
    const doc=documents.find((d:unknown)=>object(d) && typeof d.url==='string' && d.url.startsWith(HOST));
    const verifiedUrl=object(doc) ? string(doc.url) : ocid ? `${HOST}/Published/Notice/records/${encodeURIComponent(ocid)}.json` : '';
    if (!verifiedUrl) continue;
    const parties=arr(unknownRelease.parties);
    const buyer=parties.find((p:unknown)=>object(p)&&arr(p.roles).includes('buyer'));
    const buyerName=object(buyer) ? clamp(string(buyer.name),180) : 'Buyer not confirmed';
    const assessment=assessCommercialCandidate({sourceKind:'PUBLIC_RFP',sourceName:'UK Contracts Finder',sourceUrl:verifiedUrl,title,description,capturedAt:new Date().toISOString(),externalId:id});
    if (assessment.decision==='REJECT'||!assessment.normalizedUrl) continue;
    const matched=matchCommercialProblems({text:`${title} ${description}`,problems,groups,limit:3}).filter(credibleDisplayMatch);
    const titleSignal=directSoftware.test(title);
    const recommendation=titleSignal ? 'STRONG_TECHNICAL_SIGNAL' : 'POTENTIAL_TECHNICAL_SIGNAL';
    candidates.push({recommendation,id:id||ocid,title,buyer:buyerName,description,url:assessment.normalizedUrl,
      deadline:safeDate(object(tender.tenderPeriod)?tender.tenderPeriod.endDate:null),publishedAt:safeDate(unknownRelease.date),
      warnings:[...assessment.warnings,'UK public procurement: supplier eligibility, jurisdiction and registration requirements must be checked.','Candidate discovered only; not a verified contract or qualified lead.'],
      matches:matched});
    if (candidates.length>=24) break;
  }
  candidates.sort((a,b) => (a.recommendation === 'STRONG_TECHNICAL_SIGNAL' ? 0 : 1) - (b.recommendation === 'STRONG_TECHNICAL_SIGNAL' ? 0 : 1) || b.matches.length - a.matches.length || a.title.localeCompare(b.title));
  return apiSuccess({source:'UK Contracts Finder',sourceUrl:HOST,readOnly:true,automaticCollectionEnabled:false,
    checked:releases.length,candidates,requiresHumanReview:true,note:'Public procurement feed preview only. No records saved, sources approved or clients contacted.'});
}

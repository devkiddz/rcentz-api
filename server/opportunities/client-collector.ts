import 'server-only';
import { prisma } from '@/lib/prisma';
import { searchWeb } from './search';
import { commercialQueries, assessWebLead, type Preferences } from './client-discovery-policy';
import { matchCommercialProblems } from './commercial-matching';
import type { Prisma } from '@/generated/prisma/client';
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const RUN='CLIENT_DISCOVERY_RUN';
export const commercialDefaults:Preferences={regions:[],industries:[],engagementTypes:[],preferredSources:[],businessProblems:[],includeUnpriced:true,requireBudget:false,minimumScore:0};
export async function commercialRunOverview(profileId:string,ownerId:string){
 const rows=await prisma.auditLog.findMany({where:{entityType:'CompanyOpportunityProfile',entityId:profileId,userId:ownerId,action:RUN},orderBy:{createdAt:'desc'},take:10,select:{id:true,createdAt:true,metadata:true}});
 return {searchConfigured:!!process.env.OPPORTUNITY_SEARCH_API_KEY,runs:rows.map(r=>({id:r.id,startedAt:r.createdAt.toISOString(),...(record(r.metadata)?r.metadata:{})})),schedule:'Daily at 07:00 UTC (08:00 Lagos), subject to hosting time window',cooldownHours:20,maxNewPerRun:25};
}
export async function runCommercialCollection(ownerId:string,scheduled=false){
 const profile=await prisma.companyOpportunityProfile.findUnique({where:{key:'rcentz-systems'},select:{id:true,managerId:true}});
 if(!profile||profile.managerId!==ownerId)return {status:'unavailable',added:0,message:'Company profile is not assigned to this owner.'};
 const settings=await prisma.clientAcquisitionSettings.findUnique({where:{companyProfileId:profile.id}});
 if(scheduled&&!settings?.discoveryEnabled)return {status:'disabled',added:0,message:'Scheduled commercial discovery is disabled.'};
 if(!process.env.OPPORTUNITY_SEARCH_API_KEY)return {status:'not_configured',added:0,message:'Public web search is not configured. Set OPPORTUNITY_SEARCH_API_KEY in the API deployment.'};
 const lease=await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'client-discovery:'+profile.id}))`;
  const recent=await tx.auditLog.findFirst({where:{action:RUN,entityType:'CompanyOpportunityProfile',entityId:profile.id,userId:ownerId},orderBy:{createdAt:'desc'}});
  if(recent){const metadata=record(recent.metadata)?recent.metadata:{};const wait=metadata.status==='FAILED'?30*60000:metadata.status==='RUNNING'?10*60000:20*3600000;
   if(recent.createdAt.getTime()+wait>Date.now())return {status:'cooldown' as const,nextEligibleAt:new Date(recent.createdAt.getTime()+wait).toISOString()};
  }
  const run=await tx.auditLog.create({data:{action:RUN,entityType:'CompanyOpportunityProfile',entityId:profile.id,userId:ownerId,metadata:{status:'RUNNING',scheduled,admissionPolicyVersion:3}}});
  return {status:'leased' as const,id:run.id};
 },{maxWait:5000,timeout:10000});
 if(lease.status!=='leased')return {status:'cooldown',added:0,nextEligibleAt:lease.nextEligibleAt,message:'The last run is still within the shared waiting period. Existing results remain available.'};
 const sources:{key:string;label:string;query:string;status:string;fetched:number;new:number;existing:number;skipped:number}[]=[];let added=0,existing=0;
 try{
  const [capabilities,problems,groups]=await Promise.all([
   prisma.companyCapability.findMany({where:{profileId:profile.id,status:{notIn:['ARCHIVED','PAUSED']}},take:100,orderBy:{id:'asc'},select:{id:true,name:true,purpose:true,businessProblems:true,possibleWork:true,status:true,buyerPhrases:true}}),
   prisma.commercialBusinessProblem.findMany({where:{profileId:profile.id,status:{not:'ARCHIVED'}},take:200,select:{id:true,key:true,title:true,description:true,symptoms:true,impact:true,status:true,solutions:{take:40,select:{id:true,rationale:true,priority:true,qualificationCriteria:true,solution:{select:{id:true,key:true,name:true,problem:true,proposedWorkflow:true,status:true,groupId:true,capabilityId:true}}}}}}),
   prisma.commercialSolutionGroup.findMany({where:{profileId:profile.id},take:100,select:{id:true,name:true}})
  ]);
  const preferences=settings??commercialDefaults;const plans=commercialQueries(preferences,capabilities);
  const batches:{plan:typeof plans[number];items:unknown[]}[]=[];
  for(const plan of plans){
   const stats={key:plan.key,label:plan.label,query:plan.query,status:'SUCCESS',fetched:0,new:0,existing:0,skipped:0};sources.push(stats);
   try{const response=await searchWeb(plan.query,8,plan.kind==='REQUEST'?'pm':'py');if(!record(response)||!record(response.web)||!Array.isArray(response.web.results))throw Error('SOURCE_FORMAT');const items=response.web.results.slice(0,8);stats.fetched=items.length;batches.push({plan,items});}
   catch{stats.status='FAILED';}
  }
  const seen=new Set<string>();
  // Round-robin: one broad source must not consume the entire daily new-lead budget.
  for(let index=0;index<8;index++)for(const batch of batches){
   const stats=sources.find(s=>s.key===batch.plan.key)!;const item=batch.items[index];if(!record(item))continue;
   const candidate=assessWebLead({title:typeof item.title==='string'?item.title:'',description:typeof item.description==='string'?item.description.slice(0,4000):'',url:typeof item.url==='string'?item.url:'',research:batch.plan.kind==='RESEARCH'},capabilities,preferences);
   if(!candidate||seen.has(candidate.url)){stats.skipped++;continue;}seen.add(candidate.url);
   const problemMatches=matchCommercialProblems({text:candidate.title+' '+candidate.description,problems,groups,limit:3});
   const qualification={kind:candidate.kind,admissionPolicyVersion:3,intentEvidenceOrigin:'PRIMARY_SEARCH_DESCRIPTION',intentEvidence:candidate.intentEvidence,title:candidate.title,sourceUrl:candidate.url,query:batch.plan.query,searchProvider:'Brave Search',capturedAt:new Date().toISOString(),warnings:candidate.warnings,problemMatches,humanReviewRequired:true};
   const outcome=await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'client-discovery:'+profile.id}))`;
    const previous=await tx.clientProspect.findFirst({where:{companyProfileId:profile.id,ownerId,OR:[{canonicalKey:candidate.url},{evidenceLinks:{has:candidate.url}},{source:'PUBLIC_WEB',externalId:candidate.url}]},select:{id:true}});
    if(previous){await tx.clientProspect.updateMany({where:{id:previous.id,ownerId,companyProfileId:profile.id},data:{lastSeenAt:new Date()}});return 'existing';}
    if(added>=25)return 'skipped';
    await tx.clientProspect.create({data:{companyProfileId:profile.id,ownerId,source:'PUBLIC_WEB',externalId:candidate.url,canonicalKey:candidate.url,businessName:new URL(candidate.url).hostname,summary:candidate.title+'\n\n'+candidate.description,website:null,country:null,industry:null,budgetSignal:candidate.budget,evidenceLinks:[candidate.url],fitScore:candidate.score,qualification:json(qualification),problemSignals:problemMatches.map(m=>m.title),engagementTypes:[],matches:{create:candidate.matches},state:'NEW'}});
    return 'new';
   },{maxWait:5000,timeout:10000});
   if(outcome==='new'){added++;stats.new++;}else if(outcome==='existing'){existing++;stats.existing++;}else stats.skipped++;
  }
  const successes=sources.filter(s=>s.status==='SUCCESS').length;const status=successes===0?'FAILED':successes===sources.length?'SUCCESS':'PARTIAL';
  const message=successes===0?'All web searches failed. Earlier leads and decisions remain unchanged.':`${added} new leads saved; ${existing} earlier leads seen again. Review source evidence before pursuit.`;
  await prisma.auditLog.update({where:{id:lease.id},data:{metadata:json({status,scheduled,admissionPolicyVersion:3,added,existing,sources,finishedAt:new Date().toISOString(),message})}});
  return {status:status.toLowerCase(),added,existing,sources,message};
 }catch{
  await prisma.auditLog.update({where:{id:lease.id},data:{metadata:json({status:'FAILED',scheduled,admissionPolicyVersion:3,added,existing,sources,finishedAt:new Date().toISOString(),message:'Collection stopped. Earlier records and decisions are preserved.'})}});
  return {status:'failed',added,message:'Collection stopped. Earlier records and decisions are preserved.'};
 }
}

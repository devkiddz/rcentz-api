import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { performReconciliationTransaction } from '../../server/projects/delivery/reconciliation-persistence';
import type { AttributionCandidate } from '../../server/projects/delivery/attribution-candidate';

if(process.env.RCENTZ_ISOLATED_TEST_DB!=='true') throw Error('TEST_DB_FLAG_REQUIRED');
const nonce=randomUUID().replaceAll('-','').slice(0,14);
const slug=`pm04final-${nonce}`;
const sourceId=`source-${nonce}`;
const sha='a'.repeat(40);
const reason='Reviewed the test merge evidence and approved link only.';
const rollbackSignal=`EXPECTED_ROLLBACK_${nonce}`;

async function main(){
 let rollback=false;
 try {
  await prisma.$transaction(async tx=>{
   const admin=await tx.user.create({data:{name:'Temporary reviewer',email:`pm04final-${nonce}@example.invalid`,role:'SUPER_ADMIN',status:'ACTIVE'}});
   const viewer=await tx.user.create({data:{name:'Unauthorized reviewer',email:`pm04final-view-${nonce}@example.invalid`,role:'USER',status:'ACTIVE'}});
   const project=await tx.project.create({data:{id:slug,name:'Rollback-only reconciliation',slug,type:'WEB_APP'}});
   const milestone=await tx.projectMilestone.create({data:{projectId:project.id,createdById:admin.id,title:'Test marker',slug:'PMC-01'}});
   const source=await tx.deliverySource.create({data:{id:sourceId,projectId:project.id,repository:`pm04final/fixture-${nonce}`,branch:'main',configHash:'isolated',cursorSha:sha,enabled:false}});
   const delivery=await tx.deliveryMilestone.create({data:{sourceId:source.id,milestoneId:milestone.id,key:'PMC-01'}});
   const commit=await tx.deliveryCommit.create({data:{sourceId:source.id,sha,committedAt:new Date('2026-10-01T00:00:00.000Z'),message:'unchanged merge message',issue:'NO_ACTIVE_MILESTONE'}});
   const candidate:AttributionCandidate={projectId:project.id,projectCode:slug.toUpperCase(),sourceRepository:source.repository,sourceBranch:source.branch,mergeSha:sha,prNumber:5,milestoneKey:'PMC-01',disposition:'REVIEW_REQUIRED',reason:'PR_EVIDENCE_REQUIRES_APPROVAL',requiresApproval:true,evidence:{prNumber:5,verifiedMerge:true,classification:'REVIEW_REQUIRED',reason:'VERIFIED_PR_REQUIRES_HUMAN_REVIEW',milestoneKey:'PMC-01',markers:[{sha:'b'.repeat(40),operation:'start',title:'Test',description:'Test marker'}]}};
   const base={actorId:admin.id,sourceId:source.id,commitId:commit.id,targetDeliveryMilestoneId:delivery.id,reason,candidate} as const;
   let unauthorized=false;
   try {await performReconciliationTransaction(tx,{...base,actorId:viewer.id,decision:'APPROVE'});}catch(e){unauthorized=String(e).includes('REVIEWER_NOT_AUTHORIZED');}
   assert.equal(unauthorized,true,'unauthorized actor blocked');
   const approved=await performReconciliationTransaction(tx,{...base,decision:'APPROVE'});
   assert.equal(approved.linkCreated,true);
   const persisted=await tx.deliveryCommit.findUniqueOrThrow({where:{id:commit.id}});
   assert.equal(persisted.deliveryMilestoneId,delivery.id);
   assert.equal(persisted.sha,sha);assert.equal(persisted.message,commit.message);assert.equal(persisted.issue,commit.issue);
   const resultMilestone=await tx.projectMilestone.findUniqueOrThrow({where:{id:milestone.id}});
   assert.equal(resultMilestone.status,milestone.status);assert.equal(resultMilestone.completedAt,null);
   const resultDelivery=await tx.deliveryMilestone.findUniqueOrThrow({where:{id:delivery.id}});
   assert.equal(resultDelivery.phase,'OPEN');assert.equal(resultDelivery.completionSha,null);
   assert.equal(await tx.projectGovernanceEvent.count({where:{projectId:project.id,operation:'delivery:reconciliation-approved'}}),1);
   let duplicateBlocked=false;
   try {await performReconciliationTransaction(tx,{...base,decision:'APPROVE'});}catch(e){duplicateBlocked=/PRIOR_DECISION_EXISTS|COMMIT_ALREADY_LINKED/.test(String(e));}
   assert.equal(duplicateBlocked,true,'duplicate blocked');
   throw new Error(rollbackSignal);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
 }catch(e){if(e instanceof Error && e.message===rollbackSignal)rollback=true;else throw e;}
 assert.equal(rollback,true);
 assert.equal(await prisma.project.count({where:{id:slug}}),0);
 assert.equal(await prisma.projectGovernanceEvent.count({where:{projectId:slug}}),0);
 assert.equal(await prisma.deliverySource.count({where:{id:sourceId}}),0);
 console.log(JSON.stringify({status:'PASS',verified:'production_transaction_body',authorizedApproval:true,auditWrite:true,unauthorizedBlocked:true,duplicateBlocked:true,historicalFieldsPreserved:true,completionUnchanged:true,rollback:true,persistentFixtures:0,externalGithubCalls:0,vercelUsed:false},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

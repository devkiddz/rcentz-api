import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { buildAttributionCandidate } from '../../server/projects/delivery/attribution-candidate';
import { reconcileDecisionPolicy } from '../../server/projects/delivery/reconciliation-policy';
import type { Get } from '../../server/projects/delivery/github-pr-review';

const TEST_FLAG = process.env.RCENTZ_ISOLATED_TEST_DB;
if (TEST_FLAG !== 'true') throw new Error('ISOLATED_TEST_FLAG_REQUIRED');
const id = randomUUID().replace(/-/g,'').slice(0,16);
const slug = `pm04b5-${id}`;
const projectCode = slug.toUpperCase();
const repo = `pm04b5/fixture-${id}`;
const sha = '9'.repeat(40);
const headSha = '8'.repeat(40);
const firstParent = '7'.repeat(40);
const sentinel = 'PM04B5_INTENTIONAL_ROLLBACK_'+id;
const get: Get = async (url) => {
  if (url.pathname.endsWith('/pulls/5'))
    return { number:5, merged:true, state:'closed', merge_commit_sha:sha, commits:1,
      base:{ref:'main',repo:{full_name:repo}}, head:{sha:headSha} };
  if (url.pathname.endsWith('/commits/'+sha))
    return {sha, parents:[{sha:firstParent},{sha:headSha}]};
  if (url.pathname.endsWith('/pulls/5/commits'))
    return [{sha:headSha,commit:{message:`milestone(MS-${projectCode}/PMC-01): verified test implementation`}}];
  throw new Error('UNEXPECTED_PROVIDER_REQUEST');
};

async function main(){
  const candidate = await buildAttributionCandidate({
    projectId:slug,projectSlug:slug,repository:repo,branch:'main'
  },{
    sourceProjectId:slug,sourceRepository:repo,sourceBranch:'main',sha,
    existingMilestoneId:null,issue:'NO_ACTIVE_MILESTONE'
  },5,get,'test-only');
  assert.equal(candidate.disposition,'REVIEW_REQUIRED','verified PR must generate review candidate');
  assert.equal(candidate.evidence?.verifiedMerge,true);
  const permitted = reconcileDecisionPolicy({
    actorRole:'SUPER_ADMIN',actorStatus:'ACTIVE',decision:'APPROVE',
    reason:'Verified merge and milestone marker using isolated test provider',
    candidate,expectedProjectId:slug,commitStillUnlinked:true,sourceId:`source-${id}`,
    priorDecision:'NONE',targetMilestone:{
      id:`milestone-${id}`,projectId:slug,deliverySourceId:`source-${id}`,deliveryKey:'PMC-01'
    }
  });
  assert.equal(permitted.intent,'LINK_ONLY');
  assert.equal(permitted.affectsCompletion,false);
  let rolledBack=false;
  try {
    await prisma.$transaction(async tx=>{
      const user=await tx.user.create({data:{
        name:'PM04B5 test reviewer',email:`pm04b5-${id}@example.invalid`,role:'SUPER_ADMIN',status:'ACTIVE'
      }});
      const project=await tx.project.create({data:{id:slug,slug,name:'PM04B5 isolated approval',type:'WEB_APP'}});
      const milestone=await tx.projectMilestone.create({data:{
        id:`milestone-${id}`,projectId:project.id,createdById:user.id,title:'Fixture',slug:'PMC-01'
      }});
      const source=await tx.deliverySource.create({data:{
        id:`source-${id}`,projectId:project.id,repository:repo,branch:'main',
        configHash:'pm04b5-fixture',cursorSha:sha,enabled:false
      }});
      const delivery=await tx.deliveryMilestone.create({data:{
        sourceId:source.id,key:'PMC-01',milestoneId:milestone.id
      }});
      const commit=await tx.deliveryCommit.create({data:{
        sourceId:source.id,sha,message:'original historical merge',issue:'NO_ACTIVE_MILESTONE',
        committedAt:new Date('2026-10-01T00:00:00Z')
      }});
      const updated=await tx.deliveryCommit.updateMany({where:{
        id:commit.id,sourceId:source.id,deliveryMilestoneId:null
      },data:{deliveryMilestoneId:delivery.id}});
      assert.equal(updated.count,1);
      const event=await tx.projectGovernanceEvent.create({data:{
        projectId:project.id,milestoneId:milestone.id,actorId:user.id,
        operation:'delivery:reconciliation-approved',
        snapshot:{sourceId:source.id,commitId:commit.id,sha,decision:'APPROVE',
          prNumber:5,targetDeliveryMilestoneId:delivery.id,reason:'PM04B5 rollback-only fixture'}
      }});
      const after=await tx.deliveryCommit.findUniqueOrThrow({where:{id:commit.id}});
      const afterMilestone=await tx.projectMilestone.findUniqueOrThrow({where:{id:milestone.id}});
      const afterDelivery=await tx.deliveryMilestone.findUniqueOrThrow({where:{id:delivery.id}});
      assert.equal(after.deliveryMilestoneId,delivery.id);
      assert.equal(after.message,commit.message);
      assert.equal(after.sha,commit.sha);
      assert.equal(after.issue,commit.issue);
      assert.equal(afterMilestone.status,milestone.status);
      assert.equal(afterMilestone.completedAt,milestone.completedAt);
      assert.equal(afterDelivery.phase,delivery.phase);
      assert.equal(afterDelivery.completionSha,delivery.completionSha);
      assert.equal(event.operation,'delivery:reconciliation-approved');
      throw new Error(sentinel);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
    throw new Error('ROLLBACK_NOT_TRIGGERED');
  } catch(e){
    if(e instanceof Error && e.message===sentinel) rolledBack=true;
    else throw e;
  }
  assert.equal(rolledBack,true);
  assert.equal(await prisma.project.count({where:{id:slug}}),0);
  assert.equal(await prisma.user.count({where:{email:`pm04b5-${id}@example.invalid`}}),0);
  assert.equal(await prisma.projectGovernanceEvent.count({where:{projectId:slug}}),0);
  assert.equal(await prisma.deliverySource.count({where:{id:`source-${id}`}}),0);
  console.log(JSON.stringify({
    status:'PASS',stage:'PM-04B5',verifiedProviderEvidence:true,
    policyApproval:'LINK_ONLY',approvalLinkInsideTransaction:true,
    governanceEventInsideTransaction:true,historyAndCompletionPreserved:true,
    rollbackConfirmed:true,persistentWrites:0,
    productionPersistenceFunctionInvoked:false,
    note:'Validates database write path using transaction-equivalent operations; final service wrapper test remains.'
  },null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());

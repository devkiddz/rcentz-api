/**
 * Rcentz API internal milestone governance service.
 * NOT a route or server action. Only call with a server-established actor after
 * authenticating and authorizing the actor for the specific project and operation.
 * Database tables must be deployed before calling these functions.
 */
import 'server-only';
import { prisma } from '@/lib/prisma';
import { Prisma } from '../../../generated/prisma/client';
import {
  canApproveMilestone,
  criteriaRevision,
  milestoneCriteriaProgress,
  projectCalculatedProgress,
  validateProgressOverride,
} from './milestone-policy';
import { persistGovernedProjectProgress } from './milestone-progress-persistence';
import { validateEvidence } from './verification-evidence';
import { createGovernanceActor } from './create-governance-actor';

type Tx = Prisma.TransactionClient;
type AuthorizedActor = Awaited<ReturnType<typeof createGovernanceActor>>;

function nonemptyId(value: string, name: string) {
  if (!value || value.trim() !== value || value.length > 128) throw new Error(`Invalid ${name}`);
}

async function lockMilestone(tx: Tx, milestoneId: string) {
  // Resolve the parent before locking; then lock Project -> Milestone everywhere.
  // The parent relation cannot be changed by these governance operations.
  const parent = await tx.projectMilestone.findUnique({ where: { id: milestoneId }, select: { projectId: true } });
  if (!parent) throw new Error('Milestone not found');
  const projects = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Project" WHERE "id" = ${parent.projectId} FOR UPDATE`;
  if (projects.length !== 1) throw new Error('Project not found');
  // Serialize governance changes to one milestone, including concurrent reviews.
  const rows = await tx.$queryRaw<{ id: string; projectId: string }[]>`
    SELECT "id", "projectId" FROM "ProjectMilestone" WHERE "id" = ${milestoneId} FOR UPDATE`;
  if (rows.length !== 1) throw new Error('Milestone not found');
  if (await tx.deliveryMilestone.findUnique({ where: { milestoneId } })) throw new Error('Provider-managed milestone: use commit markers');
  return rows[0];
}

async function milestoneState(tx: Tx, milestoneId: string) {
  const milestone = await tx.projectMilestone.findUniqueOrThrow({
    where: { id: milestoneId },
    include: { criteria: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }, reviews: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
  });
  return milestone;
}

/** Record evidence verification, invalidating earlier approvals by bumping the shared revision. */
export async function verifyMilestoneCriterion(input: {
  milestoneId: string; criterionId: string; verified: boolean;
  evidence: Prisma.InputJsonValue | null;
}) {
  nonemptyId(input.milestoneId, 'milestoneId');
  nonemptyId(input.criterionId, 'criterionId');
  const actor = await createGovernanceActor();
  nonemptyId(actor.userId, 'actor');
  if (input.verified) validateEvidence(input.evidence);
  return prisma.$transaction(async tx => {
    const milestone = await lockMilestone(tx, input.milestoneId);
    await actor.authorize(tx, milestone.projectId, 'criterion:verify');
    const state = await milestoneState(tx, input.milestoneId);
    const criterion = state.criteria.find(item => item.id === input.criterionId);
    if (!criterion) throw new Error('Criterion does not belong to milestone');
    const nextRevision = criteriaRevision(state.criteria) + 1;
    // Every criterion gets the same revision so changes cannot preserve stale approvals.
    await tx.projectMilestoneCriterion.updateMany({
      where: { milestoneId: input.milestoneId }, data: { revision: nextRevision },
    });
    await tx.projectMilestoneCriterion.update({
      where: { id: input.criterionId },
      data: {
        verified: input.verified,
        evidence: input.verified ? input.evidence! : Prisma.DbNull,
        verifiedById: input.verified ? actor.userId : null,
        verifiedAt: input.verified ? new Date() : null,
      },
    });
    await tx.projectGovernanceEvent.create({ data: {
      projectId: milestone.projectId, milestoneId: input.milestoneId, actorId: actor.userId,
      operation: input.verified ? 'criterion:verify' : 'criterion:revoke',
      snapshot: { criterionId: input.criterionId, previous: JSON.parse(JSON.stringify(criterion)),
        verified: input.verified, evidence: input.evidence, revision: nextRevision },
    } });
    const current = await milestoneState(tx, input.milestoneId);
    const projection = await persistGovernedProjectProgress(tx, milestone.projectId);
    return { revision: nextRevision, progress: milestoneCriteriaProgress(current.criteria), projection };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Approve or reject a milestone after a fresh locked-state review. */
export async function reviewMilestone(input: {
  milestoneId: string; decision: 'APPROVED' | 'REJECTED';
  expectedRevision: number; reason?: string;
}) {
  nonemptyId(input.milestoneId, 'milestoneId');
  const actor = await createGovernanceActor();
  nonemptyId(actor.userId, 'actor');
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) throw new Error('Invalid revision');
  if (input.decision === 'REJECTED' && (!input.reason || input.reason.trim().length < 10)) {
    throw new Error('Rejection requires a reason of at least 10 characters');
  }
  return prisma.$transaction(async tx => {
    const milestone = await lockMilestone(tx, input.milestoneId);
    await actor.authorize(tx, milestone.projectId, 'milestone:review');
    const state = await milestoneState(tx, input.milestoneId);
    const revision = criteriaRevision(state.criteria);
    if (revision !== input.expectedRevision) throw new Error('Stale criteria revision');
    if (input.decision === 'APPROVED' && !canApproveMilestone(state)) {
      throw new Error('Required criteria must be verified before approval');
    }
    const review = await tx.projectMilestoneReview.create({
      data: {
        milestoneId: input.milestoneId,
        reviewerId: actor.userId,
        decision: input.decision,
        criteriaRevision: revision,
        reason: input.reason?.trim() || null,
        criteriaSnapshot: state.criteria.map(c => ({
          id: c.id, required: c.required, verified: c.verified, revision: c.revision,
          verifiedById: c.verifiedById, verifiedAt: c.verifiedAt?.toISOString() ?? null,
        })),
      },
    });
    const projection = await persistGovernedProjectProgress(tx, milestone.projectId);
    return { review, projection };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Record an auditable one-time override and update displayed progress atomically.
 * A later governance recalculation supersedes the override; its audit entry remains. */
export async function recordProjectProgressOverride(input: {
  projectId: string; percent: number; reason: string;
}) {
  nonemptyId(input.projectId, 'projectId');
  const actor = await createGovernanceActor();
  nonemptyId(actor.userId, 'actor');
  const error = validateProgressOverride({ percent: input.percent, reason: input.reason });
  if (error) throw new Error(error);
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Project" WHERE "id" = ${input.projectId} FOR UPDATE`;
    if (rows.length !== 1) throw new Error('Project not found');
    await actor.authorize(tx, input.projectId, 'project:override');
    const milestones = await tx.projectMilestone.findMany({
      where: { projectId: input.projectId },
      include: { delivery: true, criteria: true, reviews: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    const calculated = projectCalculatedProgress(milestones);
    const audit = await tx.projectProgressOverride.create({
      data: {
        projectId: input.projectId, actorId: actor.userId,
        calculatedPercent: calculated.percent, overriddenPercent: input.percent,
        reason: input.reason.trim(),
      },
    });
    await tx.project.update({ where: { id: input.projectId }, data: { progress: input.percent } });
    return audit;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

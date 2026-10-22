/** Internal-only criterion authoring. No API route or server action. */
import 'server-only';
import { prisma } from '@/lib/prisma';
import { Prisma } from '../../../generated/prisma/client';
import { criteriaRevision } from './milestone-policy';
import { persistGovernedProjectProgress } from './milestone-progress-persistence';
import { createGovernanceActor } from './create-governance-actor';

type Tx = Prisma.TransactionClient;
type Actor = Awaited<ReturnType<typeof createGovernanceActor>>;

type CriterionInput = {
  title: string;
  description?: string | null;
  required: boolean;
  sortOrder: number;
};

function validate(input: CriterionInput) {
  if (typeof input.title !== 'string' || input.title.trim().length < 3 || input.title.trim().length > 160) {
    throw new Error('Criterion title must be 3–160 characters');
  }
  if (input.description != null && (typeof input.description !== 'string' || input.description.length > 2000)) {
    throw new Error('Criterion description is too long');
  }
  if (typeof input.required !== 'boolean') throw new Error('Invalid required flag');
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 100000) {
    throw new Error('Invalid criterion sort order');
  }
}

function id(value: string) {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > 128) {
    throw new Error('Invalid identifier');
  }
}

async function lockedState(tx: Tx, milestoneId: string, actor: Actor) {
  const parent = await tx.projectMilestone.findUnique({ where: { id: milestoneId }, select: { projectId: true } });
  if (!parent) throw new Error('Milestone not found');
  const project = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Project" WHERE "id" = ${parent.projectId} FOR UPDATE`;
  if (project.length !== 1) throw new Error('Project not found');
  const rows = await tx.$queryRaw<{ id: string; projectId: string }[]>`
    SELECT "id", "projectId" FROM "ProjectMilestone" WHERE "id" = ${milestoneId} FOR UPDATE`;
  if (rows.length !== 1) throw new Error('Milestone not found');
  await actor.authorize(tx, rows[0].projectId, 'criterion:manage');
  if (await tx.deliveryMilestone.findUnique({ where: { milestoneId } })) throw new Error('Provider-managed milestone: use commit markers');
  return { projectId: rows[0].projectId, criteria: await tx.projectMilestoneCriterion.findMany({ where: { milestoneId }, orderBy: { id: 'asc' } }) };
}

/** A revision invalidates approval; an edited criterion must be reverified. */
async function reviseAll(tx: Tx, milestoneId: string, nextRevision: number) {
  await tx.projectMilestoneCriterion.updateMany({
    where: { milestoneId }, data: { revision: nextRevision },
  });
}

export async function createMilestoneCriterion(input: {
  milestoneId: string; criterion: CriterionInput;
}) {
  id(input.milestoneId); validate(input.criterion);
  const actor = await createGovernanceActor();
  id(actor.userId);
  return prisma.$transaction(async tx => {
    const locked = await lockedState(tx, input.milestoneId, actor);
    const revision = criteriaRevision(locked.criteria) + 1;
    await reviseAll(tx, input.milestoneId, revision);
    const created = await tx.projectMilestoneCriterion.create({
      data: {
        milestoneId: input.milestoneId, title: input.criterion.title.trim(),
        description: input.criterion.description?.trim() || null,
        required: input.criterion.required, sortOrder: input.criterion.sortOrder,
        revision, verified: false,
      },
    });
    await tx.projectGovernanceEvent.create({ data: {
      projectId: locked.projectId, milestoneId: input.milestoneId, actorId: actor.userId,
      operation: 'criterion:amend', snapshot: { before: JSON.parse(JSON.stringify(locked.criteria)),
        input: JSON.parse(JSON.stringify(input)), revision },
    } });
    const projection = await persistGovernedProjectProgress(tx, locked.projectId);
    return { criterion: created, revision, projection };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Editing resets verification, even when only descriptive fields change. */
export async function updateMilestoneCriterion(input: {
  milestoneId: string; criterionId: string; criterion: CriterionInput;
}) {
  id(input.milestoneId); id(input.criterionId); validate(input.criterion);
  const actor = await createGovernanceActor();
  id(actor.userId);
  return prisma.$transaction(async tx => {
    const locked = await lockedState(tx, input.milestoneId, actor);
    if (!locked.criteria.some(c => c.id === input.criterionId)) throw new Error('Criterion does not belong to milestone');
    const revision = criteriaRevision(locked.criteria) + 1;
    await reviseAll(tx, input.milestoneId, revision);
    const updated = await tx.projectMilestoneCriterion.update({
      where: { id: input.criterionId },
      data: {
        title: input.criterion.title.trim(), description: input.criterion.description?.trim() || null,
        required: input.criterion.required, sortOrder: input.criterion.sortOrder,
        verified: false, evidence: Prisma.DbNull, verifiedById: null, verifiedAt: null,
      },
    });
    await tx.projectGovernanceEvent.create({ data: {
      projectId: locked.projectId, milestoneId: input.milestoneId, actorId: actor.userId,
      operation: 'criterion:amend', snapshot: { before: JSON.parse(JSON.stringify(locked.criteria)),
        input: JSON.parse(JSON.stringify(input)), revision },
    } });
    const projection = await persistGovernedProjectProgress(tx, locked.projectId);
    return { criterion: updated, revision, projection };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

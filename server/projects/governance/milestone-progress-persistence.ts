/** Internal projection. Invoke only inside an authorized governance transaction.
 * Caller must lock the Project row BEFORE milestone rows and criterion writes.
 * Do not call from an independent transaction or a client-facing endpoint.
 */
import 'server-only';
import { Prisma } from '../../../generated/prisma/client';
import { isMilestoneApproved, milestoneCriteriaProgress, projectCalculatedProgress } from './milestone-policy';

type Tx = Prisma.TransactionClient;

/** Rebuild governed progress from persisted criteria and reviews.
 * Caller owns the enclosing transaction and authorization.
 * Requires a locked Project row, with all governance writers sharing this lock order.
 */
export async function persistGovernedProjectProgress(tx: Tx, projectId: string) {
  if (typeof projectId !== 'string' || !projectId || projectId.trim() !== projectId || projectId.length > 128) {
    throw new Error('Invalid project identifier');
  }
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
  if (rows.length !== 1) throw new Error('Project not found');

  const milestones = await tx.projectMilestone.findMany({
    where: { projectId },
    orderBy: [{ id: 'asc' }],
    include: {
      delivery: true,
      criteria: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      reviews: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });
  const governed = milestones.filter(m => m.delivery || m.criteria.length > 0);
  for (const milestone of governed) {
    if (milestone.status === 'CANCELLED' || milestone.delivery?.phase === 'CANCELLED') continue;
    const criteriaProgress = milestoneCriteriaProgress(milestone.criteria);
    const approved = milestone.delivery ? milestone.delivery.phase === 'COMPLETE' : isMilestoneApproved(milestone);
    const status = milestone.delivery
      ? approved ? 'COMPLETED' : milestone.delivery.phase === 'AWAITING' ? 'REVIEW' : 'IN_PROGRESS'
      : approved ? 'COMPLETED' : criteriaProgress.percent === 100 ? 'REVIEW' : 'IN_PROGRESS';
    await tx.projectMilestone.update({
      where: { id: milestone.id },
      data: { progress: milestone.delivery ? (approved ? 100 : 0) : criteriaProgress.percent ?? 0,
        status, completedAt: approved ? milestone.completedAt ?? new Date() : null },
    });
  }
  const calculated = projectCalculatedProgress(milestones);
  // Preserve entirely legacy projects; once enrolled, zero eligible milestones is 0%.
  if (governed.length > 0) {
    await tx.project.update({ where: { id: projectId }, data: { progress: calculated.percent ?? 0 } });
  }
  return { measured: calculated.measured, calculatedPercent: calculated.percent, governedMilestones: governed.length };
}

/** Trusted server-only actor factory. Never construct actors from client-supplied roles. */
import 'server-only';
import { governanceRequestActor } from './governance-request-context';
import { getCurrentUser } from '@/features/auth/server/get-current-user';
import { Prisma } from '../../../generated/prisma/client';
import { canPerformGovernanceOperation, type GovernanceOperation } from './project-governance-authority-policy';

type Tx = Prisma.TransactionClient;

export async function createGovernanceActor() {
  const signedUserId = governanceRequestActor();
  const sessionUser = signedUserId ? null : await getCurrentUser();
  if (!signedUserId && (!sessionUser || sessionUser.status !== 'ACTIVE')) throw new Error('Authentication required');
  const userId = signedUserId ?? sessionUser!.id;
  return {
    userId,
    async authorize(tx: Tx, projectId: string, operation: GovernanceOperation): Promise<void> {
      // Re-read identity and membership inside the same transaction as the mutation.
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
      if (!user) throw new Error('Governance access denied');
      const assignment = await tx.projectAssignment.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { role: true, removedAt: true },
      });
      if (!canPerformGovernanceOperation({
        role: user.role,
        status: user.status,
        assignmentRole: assignment?.role ?? null,
        assignmentActive: Boolean(assignment && assignment.removedAt === null),
      }, operation)) throw new Error('Governance access denied');
    },
  };
}

import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { AttributionCandidate } from './attribution-candidate';
import { projectCodeFromSlug } from './scoped-commit';
import { reconcileDecisionPolicy, type ReconciliationDecision } from './reconciliation-policy';

export type ReconciliationRequest = {
  actorId: string;
  sourceId: string;
  commitId: string;
  targetDeliveryMilestoneId: string | null;
  decision: ReconciliationDecision;
  reason: string;
  candidate: AttributionCandidate;
};

function assertRequest(x: ReconciliationRequest) {
  if (!x.actorId || !x.sourceId || !x.commitId || !['APPROVE','REJECT'].includes(x.decision) ||
      x.reason.trim().length < 15 || x.reason.trim().length > 1000 ||
      (x.decision === 'APPROVE' && !x.targetDeliveryMilestoneId))
    throw new Error('INVALID_RECONCILIATION_REQUEST');
}

/**
 * PM-04B: transactional decision engine.
 * Dormant until wired to an authenticated admin-only controller.
 *
 * The caller must refresh/rebuild candidate from GitHub immediately before
 * calling this function. A client-submitted candidate is NEVER trusted.
 * This function does not fetch GitHub, complete milestones or edit commit text.
 */
export async function persistReconciliationDecision(x: ReconciliationRequest) {
  assertRequest(x);
  return prisma.$transaction(async tx => {
    // Serialize approvals with synchronization and concurrent reviewer attempts.
    const lockedSource = await tx.$queryRaw<{id:string}[]>`
      SELECT "id" FROM "DeliverySource" WHERE "id" = ${x.sourceId} FOR UPDATE`;
    if (lockedSource.length !== 1) throw new Error('SOURCE_NOT_FOUND');
    const source = await tx.deliverySource.findUniqueOrThrow({
      where: { id: x.sourceId },
      include: { project: { select: { slug: true } } }
    });
    const lockedCommit = await tx.$queryRaw<{id:string}[]>`
      SELECT "id" FROM "DeliveryCommit" WHERE "id" = ${x.commitId} FOR UPDATE`;
    if (lockedCommit.length !== 1) throw new Error('COMMIT_NOT_FOUND');
    const commit = await tx.deliveryCommit.findUniqueOrThrow({ where: { id: x.commitId } });
    if (commit.sourceId !== source.id || commit.sha !== x.candidate.mergeSha)
      throw new Error('COMMIT_SOURCE_OR_SHA_MISMATCH');

    const actor = await tx.user.findUniqueOrThrow({ where: { id: x.actorId },
      select: { role: true, status: true } });
    const target = x.targetDeliveryMilestoneId
      ? await tx.deliveryMilestone.findUnique({ where: { id: x.targetDeliveryMilestoneId },
          include: { milestone: { select: { projectId: true } } } })
      : null;

    // Recheck target inside transaction; link only within source and project.
    // The project/source row lock guarantees decisions serialize. Inspect all
    // source-level events to identify THIS commit (not a different commit).
    const historicalEvents = await tx.projectGovernanceEvent.findMany({
      where: { projectId: source.projectId,
        operation: { in: ['delivery:reconciliation-approved','delivery:reconciliation-rejected'] },
        snapshot: { path: ['sourceId'], equals: source.id } },
      select: { snapshot: true },
      take: 10001
    });
    if (historicalEvents.length > 10000) throw new Error('RECONCILIATION_EVENT_LIMIT');
    const decided = historicalEvents.some(event => {
      const s = event.snapshot;
      return Boolean(s && typeof s === 'object' && !Array.isArray(s) && (s as Record<string,unknown>).commitId === commit.id);
    });
    const outcome = reconcileDecisionPolicy({
      actorRole: actor.role, actorStatus: actor.status,
      decision: x.decision, reason: x.reason, candidate: x.candidate,
      expectedProjectId: source.projectId, commitStillUnlinked: commit.deliveryMilestoneId === null,
      sourceId: source.id, priorDecision: decided ? 'APPROVED' : 'NONE',
      targetMilestone: target ? {
        id: target.milestoneId, projectId: target.milestone.projectId,
        deliverySourceId: target.sourceId, deliveryKey: target.key
      } : null
    });
    if (!outcome.permitted) throw new Error(outcome.code);
    if (source.repository.toLowerCase() !== x.candidate.sourceRepository.toLowerCase() ||
        source.branch !== x.candidate.sourceBranch ||
        projectCodeFromSlug(source.project.slug) !== x.candidate.projectCode)
      throw new Error('CANDIDATE_SOURCE_MISMATCH');

    // Event snapshots are an append-only governance record. Commit messages,
    // milestone phases, and completion evidence are deliberately unchanged.
    const evidenceFingerprint = createHash('sha256').update(JSON.stringify(x.candidate.evidence)).digest('hex');
    if (outcome.intent === 'LINK_ONLY') {
      const updated = await tx.deliveryCommit.updateMany({
        where: { id: commit.id, sourceId: source.id, deliveryMilestoneId: null },
        data: { deliveryMilestoneId: target!.id }
      });
      if (updated.count !== 1) throw new Error('COMMIT_LINK_CONFLICT');
    }
    const event = await tx.projectGovernanceEvent.create({ data: {
      projectId: source.projectId,
      milestoneId: outcome.intent === 'LINK_ONLY' ? target!.milestoneId : null,
      actorId: x.actorId,
      operation: outcome.intent === 'LINK_ONLY'
        ? 'delivery:reconciliation-approved' : 'delivery:reconciliation-rejected',
      snapshot: {
        sourceId: source.id, commitId: commit.id, sha: commit.sha,
        repository: source.repository, branch: source.branch,
        prNumber: x.candidate.prNumber, candidateKey: x.candidate.milestoneKey,
        targetDeliveryMilestoneId: outcome.intent === 'LINK_ONLY' ? target!.id : null,
        reason: x.reason.trim(), evidenceFingerprint, decision: x.decision
      }
    } });
    return { eventId: event.id, decision: x.decision, linkCreated: outcome.intent === 'LINK_ONLY' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
}

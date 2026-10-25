import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { configHash, type SourceConfig } from './config';
import { applyCommit, completionReady, sealMarker, type State, type Phase } from './policy';
import { sealRequestDecision } from './seal-policy';
import { readCommits, readEvidence } from './providers';
import { persistGovernedProjectProgress } from '../governance/milestone-progress-persistence';

type Tx = Prisma.TransactionClient;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
/** An MSS event is an auditable request. Seal only after existing provider gates pass.
 * Unique behavior is enforced under the same locked Project/Source transaction.
 */
async function recordSealRequest(tx: Tx, config: SourceConfig, milestoneId: string, key: string, sha: string, phase: Phase, completionSha: string | null) {
  const decision = sealRequestDecision(phase, completionSha);
  if (decision === 'UNKNOWN' || decision === 'INCOMPLETE') return 'SEAL_REQUIRES_COMPLETION';
  const already = await tx.projectGovernanceEvent.findFirst({ where: {
    projectId: config.projectId, milestoneId, operation: 'delivery:seal-request',
  }, select: { id: true } });
  if (already) return 'DUPLICATE_SEAL_REQUEST';
  await tx.projectGovernanceEvent.create({ data: {
    projectId: config.projectId, milestoneId, actorId: config.actorId,
    operation: 'delivery:seal-request', snapshot: { key, sha, repository: config.repository, branch: config.branch, completionSha },
  } });
  if (decision === 'SEAL') await finalizeSeal(tx, config, milestoneId, key, completionSha!);
  return null;
}
async function finalizeSeal(tx: Tx, config: SourceConfig, milestoneId: string, key: string, completionSha: string) {
  const request = await tx.projectGovernanceEvent.findFirst({ where: {
    projectId: config.projectId, milestoneId, operation: 'delivery:seal-request',
  }, select: { id: true } });
  if (!request) return;
  const prior = await tx.projectGovernanceEvent.findFirst({ where: {
    projectId: config.projectId, milestoneId, operation: 'delivery:sealed',
  }, select: { id: true } });
  if (prior) return;
  await tx.projectGovernanceEvent.create({ data: {
    projectId: config.projectId, milestoneId, actorId: config.actorId,
    operation: 'delivery:sealed', snapshot: { key, completionSha, repository: config.repository, branch: config.branch, sealRequestId: request.id },
  } });
}
async function authorizedProject(tx: Tx, config: SourceConfig) {
  const project = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Project" WHERE "id" = ${config.projectId} FOR UPDATE`;
  if (project.length !== 1) throw new Error('PROJECT_NOT_FOUND');
  const actor = await tx.user.findUnique({ where: { id: config.actorId }, select: { role: true, status: true } });
  if (!actor || actor.status !== 'ACTIVE' || actor.role !== 'SUPER_ADMIN') throw new Error('ENGINE_ACTOR_NOT_AUTHORIZED');
}
async function assertLease(tx: Tx, config: SourceConfig, lease: string) {
  await authorizedProject(tx, config);
  await tx.$queryRaw`SELECT "id" FROM "DeliverySource" WHERE "id" = ${config.id} FOR UPDATE`;
  const source = await tx.deliverySource.findUniqueOrThrow({ where: { id: config.id } });
  if (source.configHash !== configHash(config) || source.leaseToken !== lease || !source.leaseUntil || source.leaseUntil <= new Date()) throw new Error('LEASE_OR_CONFIG_CHANGED');
  return source;
}
/** Provider requests happen outside DB transactions. A lease bounds concurrency;
 * cursor checks and project/source row locks protect atomic writes and replay.
 */
export async function synchronize(config: SourceConfig) {
  await prisma.$transaction(async tx => {
    await authorizedProject(tx, config);
    const source = await tx.deliverySource.upsert({ where: { id: config.id }, update: {}, create: {
      id: config.id, projectId: config.projectId, repository: config.repository, branch: config.branch,
      configHash: configHash(config), cursorSha: config.baselineSha,
    } });
    if (source.configHash !== configHash(config)) throw new Error('SOURCE_CONFIG_CHANGED');
  });
  const lease = randomUUID(), now = new Date();
  const claimed = await prisma.deliverySource.updateMany({
    where: { id: config.id, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseToken: lease, leaseUntil: new Date(now.getTime() + 300_000) },
  });
  if (claimed.count !== 1) return { sourceId: config.id, status: 'BUSY', commits: 0, reviewed: 0 };
  try {
    const source = await prisma.deliverySource.findUniqueOrThrow({ where: { id: config.id } });
    const commits = await readCommits(config, source.cursorSha);
    if (commits.length) await prisma.$transaction(async tx => {
      const current = await assertLease(tx, config, lease);
      if (current.cursorSha !== source.cursorSha) throw new Error('CURSOR_CHANGED');
      const rows = await tx.deliveryMilestone.findMany({ where: { sourceId: config.id }, include: { milestone: { select: { title: true } } }, take: 1001 });
      if (rows.length > 1000) throw new Error('SOURCE_MILESTONE_LIMIT');
      let state: State = { activeKey: current.activeKey, items: Object.fromEntries(rows.map(r => [r.key, { key: r.key, title: r.milestone.title, phase: r.phase as Phase, completionSha: r.completionSha }])) };
      const identities = new Map(rows.map(r => [r.key, { id: r.id, milestoneId: r.milestoneId }]));
      let issues = 0;
      for (const commit of commits) {
        const before = state;
        const next = applyCommit(state, commit); state = next.state;
        const seal = sealMarker(commit.message);
        let issue = next.issue;
        let activityKey = next.key;
        if (seal) {
          const identity = identities.get(seal.key);
          const item = state.items[seal.key];
          if (identity && item) {
            issue = await recordSealRequest(tx, config, identity.milestoneId, seal.key, commit.sha, item.phase, item.completionSha);
            activityKey = seal.key;
          } else issue = 'UNKNOWN_MILESTONE';
        }
        if (issue) issues++;
        // MSS must not rewrite an already verified project milestone's status.
        if (next.key && !seal) {
          const item = state.items[next.key];
          let identity = identities.get(next.key);
          if (!identity) {
            const milestone = await tx.projectMilestone.create({ data: {
              projectId: config.projectId, createdById: config.actorId, title: item.title,
              slug: `git-${config.id}-${next.key}`.toLowerCase(), status: 'IN_PROGRESS',
              visibility: 'CLIENT', progress: 0, gitCommitSha: commit.sha, startedAt: new Date(commit.date),
              description: `Tracked from ${config.repository} (${config.branch}). Milestone ${next.key}.`,
            } });
            const delivery = await tx.deliveryMilestone.create({ data: { sourceId: config.id, key: next.key, milestoneId: milestone.id, phase: item.phase, completionSha: item.completionSha } });
            identity = { id: delivery.id, milestoneId: milestone.id }; identities.set(next.key, identity);
          } else {
            await tx.deliveryMilestone.update({ where: { id: identity.id }, data: { phase: item.phase, completionSha: item.completionSha } });
          }
          await tx.projectMilestone.update({ where: { id: identity.milestoneId }, data: {
            status: item.phase === 'CANCELLED' ? 'CANCELLED' : item.phase === 'AWAITING' ? 'REVIEW' : 'IN_PROGRESS',
            progress: 0, completedAt: null,
          } });
          if (before.items[next.key]?.phase !== item.phase) await tx.projectGovernanceEvent.create({ data: {
            projectId: config.projectId, milestoneId: identity.milestoneId, actorId: config.actorId,
            operation: 'delivery:marker', snapshot: { sha: commit.sha, repository: config.repository, key: next.key, from: before.items[next.key]?.phase ?? null, to: item.phase },
          } });
        }
        await tx.deliveryCommit.create({ data: { sourceId: config.id, sha: commit.sha, message: commit.message,
          committedAt: new Date(commit.date), deliveryMilestoneId: activityKey ? identities.get(activityKey)!.id : null, issue } });
      }
      await persistGovernedProjectProgress(tx, config.projectId);
      await tx.deliverySource.update({ where: { id: config.id }, data: { activeKey: state.activeKey,
        cursorSha: commits.at(-1)!.sha, lastError: issues ? 'UNASSIGNED_COMMITS_REQUIRE_REVIEW' : null } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });
    // Rotate pending milestones fairly; a long-running deployment cannot starve others.
    const pending = await prisma.deliveryMilestone.findMany({ where: { sourceId: config.id, phase: 'AWAITING' }, orderBy: [{ checkedAt: 'asc' }, { id: 'asc' }], take: 3 });
    let reviewed = 0;
    for (const item of pending) {
      if (!item.completionSha) continue;
      const evidence = await readEvidence(config, item.completionSha);
      const { observedAt: _time, ...facts } = evidence;
      void _time;
      const fingerprint = createHash('sha256').update(JSON.stringify(facts)).digest('hex');
      await prisma.$transaction(async tx => {
        await assertLease(tx, config, lease);
        const current = await tx.deliveryMilestone.findUniqueOrThrow({ where: { id: item.id } });
        if (current.phase !== 'AWAITING' || current.completionSha !== evidence.sha) return;
        const previous = await tx.deliveryObservation.findFirst({ where: { deliveryMilestoneId: item.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
        if (previous?.fingerprint !== fingerprint) await tx.deliveryObservation.create({ data: {
          deliveryMilestoneId: item.id, commitSha: evidence.sha, fingerprint, snapshot: json(evidence),
        } });
        const complete = completionReady(current.completionSha, config.requiredChecks, Boolean(config.vercelProjectId), evidence);
        await tx.deliveryMilestone.update({ where: { id: item.id }, data: { phase: complete ? 'COMPLETE' : 'AWAITING', checkedAt: new Date() } });
        if (complete) {
          await tx.projectGovernanceEvent.create({ data: { projectId: config.projectId, milestoneId: item.milestoneId,
            actorId: config.actorId, operation: 'delivery:complete', snapshot: json(evidence) } });
          // An earlier MSS request can now seal; the provider verification result
          // remains the authority for milestone completion.
          await finalizeSeal(tx, config, item.milestoneId, (await tx.deliveryMilestone.findUniqueOrThrow({ where: { id: item.id } })).key, evidence.sha);
          await persistGovernedProjectProgress(tx, config.projectId);
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
      reviewed++;
    }
    await prisma.deliverySource.updateMany({ where: { id: config.id, leaseToken: lease }, data: { lastSyncedAt: new Date() } });
    return { sourceId: config.id, status: 'SYNCED', commits: commits.length, reviewed };
  } catch (error) {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{1,70}$/.test(error.message) ? error.message : 'SYNC_FAILED';
    await prisma.deliverySource.updateMany({ where: { id: config.id, leaseToken: lease }, data: { lastError: code } });
    throw new Error(code);
  } finally {
    await prisma.deliverySource.updateMany({ where: { id: config.id, leaseToken: lease }, data: { leaseToken: null, leaseUntil: null } });
  }
}

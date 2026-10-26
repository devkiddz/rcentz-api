import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { configHash, type SourceConfig } from './config';
import { readCommits } from './providers';

type Tx = Prisma.TransactionClient;

/**
 * GitHub ingestion is independent of administrative project milestones.
 * Every commit from the configured branch is evidence, whether or not it
 * carries a milestone marker. Existing milestone records are never mutated.
 */
async function assertAuthorized(tx: Tx, config: SourceConfig) {
  const project = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Project" WHERE "id" = ${config.projectId} FOR UPDATE`;
  if (project.length !== 1) throw new Error('PROJECT_NOT_FOUND');
  const actor = await tx.user.findUnique({
    where: { id: config.actorId },
    select: { role: true, status: true }
  });
  if (!actor || actor.role !== 'SUPER_ADMIN' || actor.status !== 'ACTIVE')
    throw new Error('ENGINE_ACTOR_NOT_AUTHORIZED');
}

async function assertLease(tx: Tx, config: SourceConfig, lease: string) {
  await assertAuthorized(tx, config);
  await tx.$queryRaw`SELECT "id" FROM "DeliverySource" WHERE "id" = ${config.id} FOR UPDATE`;
  const source = await tx.deliverySource.findUniqueOrThrow({ where: { id: config.id } });
  if (source.configHash !== configHash(config) ||
      source.leaseToken !== lease ||
      !source.leaseUntil || source.leaseUntil <= new Date())
    throw new Error('LEASE_OR_CONFIG_CHANGED');
  return source;
}

export async function synchronize(config: SourceConfig) {
  await prisma.$transaction(async tx => {
    await assertAuthorized(tx, config);
    const source = await tx.deliverySource.upsert({
      where: { id: config.id },
      update: {},
      create: {
        id: config.id, projectId: config.projectId,
        repository: config.repository, branch: config.branch,
        configHash: configHash(config), cursorSha: config.baselineSha
      }
    });
    if (source.configHash !== configHash(config)) throw new Error('SOURCE_CONFIG_CHANGED');
  });

  const lease = randomUUID();
  const now = new Date();
  const claimed = await prisma.deliverySource.updateMany({
    where: { id: config.id, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseToken: lease, leaseUntil: new Date(now.getTime() + 300_000) }
  });
  if (claimed.count !== 1)
    return { sourceId: config.id, status: 'BUSY', commits: 0, reviewed: 0 };

  try {
    const source = await prisma.deliverySource.findUniqueOrThrow({
      where: { id: config.id }
    });
    const commits = await readCommits(config, source.cursorSha);

    // Cursor update and commit writes must succeed or fail as a unit.
    await prisma.$transaction(async tx => {
      const current = await assertLease(tx, config, lease);
      if (current.cursorSha !== source.cursorSha) throw new Error('CURSOR_CHANGED');

      for (const commit of commits) {
        // Replays must not duplicate evidence previously collected.
        await tx.deliveryCommit.upsert({
          where: { sourceId_sha: { sourceId: config.id, sha: commit.sha } },
          update: {},
          create: {
            sourceId: config.id,
            sha: commit.sha,
            message: commit.message,
            committedAt: new Date(commit.date),
            deliveryMilestoneId: null,
            issue: null
          }
        });
      }

      await tx.deliverySource.update({
        where: { id: config.id },
        data: {
          cursorSha: commits.at(-1)?.sha ?? source.cursorSha,
          lastError: null
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });

    await prisma.deliverySource.updateMany({
      where: { id: config.id, leaseToken: lease },
      data: { lastSyncedAt: new Date() }
    });
    return { sourceId: config.id, status: 'SYNCED', commits: commits.length, reviewed: 0 };
  } catch (error) {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{1,70}$/.test(error.message)
      ? error.message : 'SYNC_FAILED';
    await prisma.deliverySource.updateMany({
      where: { id: config.id, leaseToken: lease },
      data: { lastError: code }
    });
    throw new Error(code);
  } finally {
    await prisma.deliverySource.updateMany({
      where: { id: config.id, leaseToken: lease },
      data: { leaseToken: null, leaseUntil: null }
    });
  }
}

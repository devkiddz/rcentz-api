import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { configHash, parseSources, type SourceConfig } from '../server/projects/delivery/config';
import { synchronize } from '../server/projects/delivery/engine';
import { object, providerGet, string } from '../server/projects/delivery/http';

// Run with: node --conditions=react-server --env-file=.env.local --import tsx
// scripts/register-managed-project-collectors.ts --actor=<id> [--apply]

const apply = process.argv.includes('--apply');
const actorId = process.argv.find(argument => argument.startsWith('--actor='))?.slice('--actor='.length);
const vercelProjects = new Map(
  process.argv
    .filter(argument => argument.startsWith('--vercel='))
    .map(argument => {
      const value = argument.slice('--vercel='.length);
      const separator = value.indexOf('=');
      if (separator < 1) throw new Error('INVALID_VERCEL_MAPPING');
      return [value.slice(0, separator).toLowerCase(), value.slice(separator + 1)] as const;
    })
);

function repositoryFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.search || url.hash) return null;
    const match = /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.pathname);
    return match ? `${match[1]}/${match[2]}`.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function githubSource(repository: string) {
  const token = process.env.RCENTZ_DELIVERY_GITHUB_TOKEN;
  const metadata = object(await providerGet(new URL(`https://api.github.com/repos/${repository}`), token));
  const branch = string(metadata.default_branch);
  const branchData = object(await providerGet(
    new URL(`https://api.github.com/repos/${repository}/branches/${encodeURIComponent(branch)}`),
    token
  ));
  const head = string(object(branchData.commit).sha);
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('INVALID_SHA');

  const commit = object(await providerGet(
    new URL(`https://api.github.com/repos/${repository}/commits/${head}`),
    token
  ));
  const parents = Array.isArray(commit.parents) ? commit.parents : [];
  const parent = parents.length ? string(object(parents[0]).sha) : head;
  if (!/^[a-f0-9]{40}$/.test(parent)) throw new Error('INVALID_SHA');

  return { branch, head, baselineSha: parent };
}

async function main() {
  if (!actorId || !/^[A-Za-z0-9_-]{1,128}$/.test(actorId)) {
    throw new Error('Use --actor=<active-super-admin-id>');
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true, status: true }
  });
  if (actor?.role !== 'SUPER_ADMIN' || actor.status !== 'ACTIVE') {
    throw new Error('Collector actor must be an active super administrator');
  }

  const projects = await prisma.project.findMany({
    where: {
      portfolio: { is: { repositoryUrl: { not: null } } },
      deliverySources: { none: {} }
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      portfolio: { select: { repositoryUrl: true } }
    }
  });

  const prepared: Array<{ project: string; source: SourceConfig; head: string }> = [];
  const skipped: Array<{ project: string; reason: string }> = [];

  for (const project of projects) {
    const repository = project.portfolio?.repositoryUrl
      ? repositoryFromUrl(project.portfolio.repositoryUrl)
      : null;
    if (!repository) {
      skipped.push({ project: project.name, reason: 'INVALID_REPOSITORY_URL' });
      continue;
    }

    try {
      const github = await githubSource(repository);
      const vercelProjectId = vercelProjects.get(repository) ?? null;
      const candidate: SourceConfig = {
        id: randomUUID(),
        projectId: project.id,
        repository,
        branch: github.branch,
        baselineSha: github.baselineSha,
        actorId,
        requiredChecks: vercelProjectId ? [] : ['status:manual-review'],
        vercelProjectId,
        vercelTeamId: null
      };
      const [source] = parseSources(JSON.stringify([candidate]));
      prepared.push({ project: project.name, source, head: github.head });
    } catch (error) {
      skipped.push({
        project: project.name,
        reason: error instanceof Error && error.message.includes('empty')
          ? 'EMPTY_REPOSITORY'
          : 'GITHUB_SOURCE_UNAVAILABLE'
      });
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'PREVIEW',
    prepared: prepared.map(item => ({
      project: item.project,
      repository: item.source.repository,
      branch: item.source.branch,
      initialHead: item.head,
      deploymentGate: item.source.vercelProjectId ? 'VERCEL' : 'MANUAL_REVIEW'
    })),
    skipped
  }, null, 2));

  if (!apply) return;

  for (const item of prepared) {
    await prisma.deliverySource.create({
      data: {
        ...item.source,
        configHash: configHash(item.source),
        cursorSha: item.source.baselineSha,
        enabled: true
      }
    });
    const result = await synchronize(item.source);
    console.log(JSON.stringify({ project: item.project, ...result }));
  }
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : 'Collector registration failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

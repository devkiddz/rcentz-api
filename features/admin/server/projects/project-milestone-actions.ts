'use server';

import {
  revalidatePath
} from 'next/cache';

import {
  prisma
} from '@/lib/prisma';

import { createGovernanceActor } from '@/server/projects/governance/create-governance-actor';

import {
  createNotificationInTransaction
} from '@/features/notifications/server/create-notification';

import {
  isAdminProjectMilestonePriority,
  isAdminProjectMilestoneStatus,
  isAdminProjectMilestoneVisibility
} from '@/features/admin/types/project-milestones';

export type ProjectMilestoneMutationResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export type ProjectMilestoneMutationInput = {
  projectId: string;

  title: string;
  slug: string;

  description: string;
  purpose: string;
  expectedOutcome: string;

  status: string;
  priority: string;
  visibility: string;

  progress: number;
  sortOrder: number;

  startedAt: string;
  dueDate: string;

  completionNotes: string;
};

type ResolvedMilestoneInput = {
  projectId: string;

  title: string;
  slug: string;

  description: string | null;
  purpose: string | null;
  expectedOutcome: string | null;

  status:
    | 'PLANNED'
    | 'IN_PROGRESS'
    | 'BLOCKED'
    | 'REVIEW'
    | 'COMPLETED'
    | 'CANCELLED';

  priority:
    | 'LOW'
    | 'NORMAL'
    | 'HIGH'
    | 'CRITICAL';

  visibility:
    | 'INTERNAL'
    | 'CLIENT'
    | 'PUBLIC';

  progress: number;
  sortOrder: number;

  startedAt: Date | null;
  dueDate: Date | null;

  completionNotes: string | null;
};

function normalizeText(
  value: string
) {
  return value.trim();
}

function normalizeNullableText(
  value: string
) {
  const normalized =
    value.trim();

  return normalized
    ? normalized
    : null;
}

function createSlug(
  value: string
) {
  return value
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )
    .slice(0, 120);
}

function parseDate(
  value: string
):
  | {
      success: true;
      value: Date | null;
    }
  | {
      success: false;
    } {
  const normalized =
    value.trim();

  if (!normalized) {
    return {
      success: true,
      value: null
    };
  }

  const parsed =
    new Date(
      `${normalized}T12:00:00.000Z`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return {
      success: false
    };
  }

  return {
    success: true,
    value: parsed
  };
}

function humanize(
  value: string
) {
  return value
    .toLowerCase()
    .split('_')
    .map(word => {
      return (
        word.charAt(0).toUpperCase() +
        word.slice(1)
      );
    })
    .join(' ');
}

function sameDate(
  first: Date | null,
  second: Date | null
) {
  if (
    first === null &&
    second === null
  ) {
    return true;
  }

  if (
    first === null ||
    second === null
  ) {
    return false;
  }

  return (
    first.getTime() ===
    second.getTime()
  );
}

function resolveInput(
  input: ProjectMilestoneMutationInput
):
  | {
      success: true;
      data: ResolvedMilestoneInput;
    }
  | {
      success: false;
      error: string;
    } {
  const projectId =
    normalizeText(
      input.projectId
    );

  const title =
    normalizeText(
      input.title
    );

  const slug =
    createSlug(
      input.slug || title
    );

  if (!projectId) {
    return {
      success: false,
      error:
        'Project reference is required.'
    };
  }

  if (
    title.length < 2 ||
    title.length > 160
  ) {
    return {
      success: false,
      error:
        'Milestone title must be between 2 and 160 characters.'
    };
  }

  if (
    slug.length < 2 ||
    slug.length > 120
  ) {
    return {
      success: false,
      error:
        'Enter a valid milestone slug.'
    };
  }

  if (
    !isAdminProjectMilestoneStatus(
      input.status
    )
  ) {
    return {
      success: false,
      error:
        'Select a valid milestone status.'
    };
  }

  if (
    !isAdminProjectMilestonePriority(
      input.priority
    )
  ) {
    return {
      success: false,
      error:
        'Select a valid milestone priority.'
    };
  }

  if (
    !isAdminProjectMilestoneVisibility(
      input.visibility
    )
  ) {
    return {
      success: false,
      error:
        'Select a valid milestone visibility.'
    };
  }

  let progress =
    Number(input.progress);

  if (
    !Number.isInteger(
      progress
    ) ||
    progress < 0 ||
    progress > 100
  ) {
    return {
      success: false,
      error:
        'Milestone progress must be a whole number between 0 and 100.'
    };
  }

  if (
    input.status ===
    'COMPLETED'
  ) {
    progress = 100;
  }

  const sortOrder =
    Number(
      input.sortOrder
    );

  if (
    !Number.isInteger(
      sortOrder
    ) ||
    sortOrder < 0 ||
    sortOrder > 9999
  ) {
    return {
      success: false,
      error:
        'Sort order must be a whole number between 0 and 9999.'
    };
  }

  const description =
    normalizeNullableText(
      input.description
    );

  const purpose =
    normalizeNullableText(
      input.purpose
    );

  const expectedOutcome =
    normalizeNullableText(
      input.expectedOutcome
    );

  const completionNotes =
    normalizeNullableText(
      input.completionNotes
    );

  if (
    description &&
    description.length > 5000
  ) {
    return {
      success: false,
      error:
        'Milestone description is too long.'
    };
  }

  if (
    purpose &&
    purpose.length > 5000
  ) {
    return {
      success: false,
      error:
        'Milestone purpose is too long.'
    };
  }

  if (
    expectedOutcome &&
    expectedOutcome.length >
      5000
  ) {
    return {
      success: false,
      error:
        'Expected outcome is too long.'
    };
  }

  if (
    completionNotes &&
    completionNotes.length >
      5000
  ) {
    return {
      success: false,
      error:
        'Completion notes are too long.'
    };
  }

  const startedAt =
    parseDate(
      input.startedAt
    );

  if (!startedAt.success) {
    return {
      success: false,
      error:
        'Enter a valid milestone start date.'
    };
  }

  const dueDate =
    parseDate(
      input.dueDate
    );

  if (!dueDate.success) {
    return {
      success: false,
      error:
        'Enter a valid milestone due date.'
    };
  }

  if (
    startedAt.value &&
    dueDate.value &&
    dueDate.value.getTime() <
      startedAt.value.getTime()
  ) {
    return {
      success: false,
      error:
        'Milestone due date cannot be before its start date.'
    };
  }

  return {
    success: true,

    data: {
      projectId,

      title,
      slug,

      description,
      purpose,
      expectedOutcome,

      status:
        input.status,

      priority:
        input.priority,

      visibility:
        input.visibility,

      progress,
      sortOrder,

      startedAt:
        startedAt.value,

      dueDate:
        dueDate.value,

      completionNotes
    }
  };
}

function revalidateProject(
  projectId: string,
  projectSlug: string
) {
  revalidatePath(
    '/admin/projects'
  );

  revalidatePath(
    `/admin/projects/${projectId}`
  );

  revalidatePath(
    '/dashboard/projects'
  );

  revalidatePath(
    `/dashboard/projects/${projectId}`
  );

  revalidatePath(
    `/portfolio/${projectSlug}`
  );
}

export async function createAdminProjectMilestone(
  input: ProjectMilestoneMutationInput
): Promise<ProjectMilestoneMutationResult> {
  const actor =
    await createGovernanceActor();

  const resolved =
    resolveInput(input);

  if (!resolved.success) {
    return resolved;
  }

  const data =
    resolved.data;
  if (data.status !== 'PLANNED' || data.progress !== 0) {
    return { success: false, error: 'New milestones begin as planned at 0%. Completion is governed by verified criteria and review.' };
  }

  const project =
    await prisma.project.findUnique({
      where: {
        id: data.projectId
      },

      select: {
        id: true,
        name: true,
        slug: true,
        clientId: true
      }
    });

  if (!project) {
    return {
      success: false,
      error:
        'Project could not be found.'
    };
  }

  const duplicate =
    await prisma.projectMilestone.findFirst({
      where: {
        projectId:
          project.id,

        slug:
          data.slug
      },

      select: {
        id: true
      }
    });

  if (duplicate) {
    return {
      success: false,
      error:
        'Another milestone already uses this slug.'
    };
  }

  await prisma.$transaction(
    async tx => {
      const projectLock = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Project" WHERE "id" = ${project.id} FOR UPDATE`;
      if (projectLock.length !== 1) throw new Error('Project no longer exists.');
      await actor.authorize(tx, project.id, 'milestone:manage');
      const milestone =
        await tx.projectMilestone.create({
          data: {
            projectId:
              project.id,

            createdById:
              actor.userId,

            title:
              data.title,

            slug:
              data.slug,

            description:
              data.description,

            purpose:
              data.purpose,

            expectedOutcome:
              data.expectedOutcome,

            status:
              data.status,

            priority:
              data.priority,

            visibility:
              data.visibility,

            progress:
              data.progress,

            sortOrder:
              data.sortOrder,

            startedAt:
              data.startedAt,

            dueDate:
              data.dueDate,

            completedAt:
              data.status ===
              'COMPLETED'
                ? new Date()
                : null,

            completionNotes:
              data.completionNotes
          },

          select: {
            id: true
          }
        });

      await tx.projectActivity.create({
        data: {
          projectId:
            project.id,

          userId:
            actor.userId,

          type:
            'CREATED',

          title:
            `Milestone created: ${data.title}`,

          description:
            `Milestone added with ${humanize(
              data.status
            )} status.`,

          visibility:
            data.visibility,

          metadata: {
            milestoneId:
              milestone.id,

            status:
              data.status,

            progress:
              data.progress
          }
        }
      });

      if (
        project.clientId &&
        data.visibility !==
          'INTERNAL'
      ) {
        await createNotificationInTransaction(
          tx,
          {
            userId:
              project.clientId,

            type:
              'PROJECT_UPDATE',

            title:
              'New project milestone',

            message:
              `${data.title} has been added to ${project.name}.`,

            href:
              `/dashboard/projects/${project.id}`,

            entityType:
              'PROJECT_MILESTONE',

            entityId:
              milestone.id,

            metadata: {
              projectId:
                project.id,

              milestoneId:
                milestone.id
            }
          }
        );
      }
    }
  );

  revalidateProject(
    project.id,
    project.slug
  );

  return {
    success: true
  };
}

export async function updateAdminProjectMilestone(
  milestoneId: string,
  input: ProjectMilestoneMutationInput
): Promise<ProjectMilestoneMutationResult> {
  const actor =
    await createGovernanceActor();

  const normalizedMilestoneId =
    milestoneId.trim();

  if (
    !normalizedMilestoneId
  ) {
    return {
      success: false,
      error:
        'Milestone reference is required.'
    };
  }

  const resolved =
    resolveInput(input);

  if (!resolved.success) {
    return resolved;
  }

  const data =
    resolved.data;

  const current =
    await prisma.projectMilestone.findFirst({
      where: {
        id:
          normalizedMilestoneId,

        projectId:
          data.projectId
      },

      select: {
        id: true,

        title: true,
        slug: true,

        status: true,
        visibility: true,

        progress: true,

        startedAt: true,
        dueDate: true,
        completedAt: true,

        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            clientId: true
          }
        }
      }
    });

  if (!current) {
    return {
      success: false,
      error:
        'Milestone could not be found.'
    };
  }

  if (current.status !== data.status || current.progress !== data.progress) {
    return { success: false, error: 'Milestone status and progress are controlled by governance review, not direct editing.' };
  }

  const duplicate =
    await prisma.projectMilestone.findFirst({
      where: {
        projectId:
          data.projectId,

        slug:
          data.slug,

        id: {
          not:
            current.id
        }
      },

      select: {
        id: true
      }
    });

  if (duplicate) {
    return {
      success: false,
      error:
        'Another milestone already uses this slug.'
    };
  }

  const statusChanged =
    current.status !==
    data.status;

  const progressChanged =
    current.progress !==
    data.progress;

  const titleChanged =
    current.title !==
    data.title;

  const dueDateChanged =
    !sameDate(
      current.dueDate,
      data.dueDate
    );

  const becameCompleted =
    current.status !==
      'COMPLETED' &&
    data.status ===
      'COMPLETED';

  await prisma.$transaction(
    async tx => {
      // All governance writers acquire Project -> Milestone locks in that order.
      const parentLock = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Project" WHERE "id" = ${data.projectId} FOR UPDATE`;
      if (parentLock.length !== 1) throw new Error('Project no longer exists.');
      await actor.authorize(tx, data.projectId, 'milestone:manage');
      if (await tx.deliveryMilestone.findUnique({ where: { milestoneId: current.id } })) throw new Error('Provider-managed milestone: use commit markers');
      const locked = await tx.$queryRaw<{ id: string; status: string; progress: number; completedAt: Date | null }[]>`
        SELECT "id", "status", "progress", "completedAt" FROM "ProjectMilestone"
        WHERE "id" = ${current.id} AND "projectId" = ${data.projectId}
        FOR UPDATE`;
      if (locked.length !== 1) throw new Error('Milestone no longer exists.');
      if (locked[0].status !== data.status || locked[0].progress !== data.progress) {
        throw new Error('Governed milestone status and progress must be changed through the approval workflow.');
      }
      await tx.projectMilestone.update({
        where: {
          id:
            current.id
        },

        data: {
          title:
            data.title,

          slug:
            data.slug,

          description:
            data.description,

          purpose:
            data.purpose,

          expectedOutcome:
            data.expectedOutcome,

          status:
            data.status,

          priority:
            data.priority,

          visibility:
            data.visibility,

          progress:
            data.progress,

          sortOrder:
            data.sortOrder,

          startedAt:
            data.startedAt,

          dueDate:
            data.dueDate,

          completedAt: locked[0].completedAt,

          completionNotes:
            data.completionNotes
        }
      });

      await tx.projectActivity.create({
        data: {
          projectId:
            current.project.id,

          userId:
            actor.userId,

          type:
            becameCompleted
              ? 'MILESTONE_COMPLETED'
              : statusChanged
                ? 'STATUS_CHANGED'
                : progressChanged
                  ? 'PROGRESS_UPDATED'
                  : 'UPDATED',

          title:
            becameCompleted
              ? `Milestone completed: ${data.title}`
              : `Milestone updated: ${data.title}`,

          description:
            statusChanged
              ? `Status changed from ${humanize(
                  current.status
                )} to ${humanize(
                  data.status
                )}.`
              : progressChanged
                ? `Progress updated from ${current.progress}% to ${data.progress}%.`
                : 'Milestone details were updated.',

          visibility:
            data.visibility,

          metadata: {
            milestoneId:
              current.id,

            previousStatus:
              current.status,

            status:
              data.status,

            previousProgress:
              current.progress,

            progress:
              data.progress
          }
        }
      });

      const meaningfulClientChange =
        statusChanged ||
        progressChanged ||
        titleChanged ||
        dueDateChanged;

      if (
        current.project.clientId &&
        data.visibility !==
          'INTERNAL' &&
        meaningfulClientChange
      ) {
        await createNotificationInTransaction(
          tx,
          {
            userId:
              current.project
                .clientId,

            type:
              'PROJECT_UPDATE',

            title:
              becameCompleted
                ? 'Milestone completed'
                : 'Project milestone updated',

            message:
              becameCompleted
                ? `${data.title} has been completed.`
                : `${data.title} is now ${humanize(
                    data.status
                  )} at ${data.progress}% progress.`,

            href:
              `/dashboard/projects/${current.project.id}`,

            entityType:
              'PROJECT_MILESTONE',

            entityId:
              current.id,

            metadata: {
              projectId:
                current.project.id,

              milestoneId:
                current.id,

              status:
                data.status,

              progress:
                data.progress
            }
          }
        );
      }
    }
  );

  revalidateProject(
    current.project.id,
    current.project.slug
  );

  return {
    success: true
  };
}

export async function deleteAdminProjectMilestone(
  projectId: string,
  milestoneId: string
): Promise<ProjectMilestoneMutationResult> {
  const actor =
    await createGovernanceActor();

  const normalizedProjectId =
    projectId.trim();

  const normalizedMilestoneId =
    milestoneId.trim();

  if (
    !normalizedProjectId ||
    !normalizedMilestoneId
  ) {
    return {
      success: false,
      error:
        'Project and milestone references are required.'
    };
  }

  const milestone =
    await prisma.projectMilestone.findFirst({
      where: {
        id:
          normalizedMilestoneId,

        projectId:
          normalizedProjectId
      },

      select: {
        id: true,
        title: true,

        status: true,
        visibility: true,

        project: {
          select: {
            id: true,
            slug: true
          }
        },

        _count: {
          select: {
            records: true,
            assignments: true,
            deliverables: true,
            processes: true,
            features: true,
            updates: true,
            files: true,
            dependencies: true,
            dependents: true
          }
        }
      }
    });

  if (!milestone) {
    return {
      success: false,
      error:
        'Milestone could not be found.'
    };
  }

  if (
    milestone.status !==
    'PLANNED'
  ) {
    return {
      success: false,
      error:
        'Only a planned milestone can be permanently deleted. Cancel active or historical milestones instead.'
    };
  }

  if (
    milestone.visibility !==
    'INTERNAL'
  ) {
    return {
      success: false,
      error:
        'Only an internal milestone can be permanently deleted. Client-visible milestones should be cancelled instead.'
    };
  }

  const relatedRecords =
    Object.values(
      milestone._count
    ).reduce(
      (
        total,
        count
      ) => {
        return (
          total + count
        );
      },
      0
    );

  if (
    relatedRecords > 0
  ) {
    return {
      success: false,
      error:
        'This milestone already owns project records and cannot be permanently deleted. Cancel it instead.'
    };
  }

  await prisma.$transaction(
    async tx => {
      const projectLock = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Project" WHERE "id" = ${normalizedProjectId} FOR UPDATE`;
      if (projectLock.length !== 1) throw new Error('Project no longer exists.');
      await actor.authorize(tx, normalizedProjectId, 'milestone:manage');
      if (await tx.deliveryMilestone.findUnique({ where: { milestoneId: normalizedMilestoneId } })) throw new Error('Provider-managed milestones cannot be deleted');
      const milestoneLock = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "ProjectMilestone" WHERE "id" = ${milestone.id}
        AND "projectId" = ${normalizedProjectId} FOR UPDATE`;
      if (milestoneLock.length !== 1) throw new Error('Milestone no longer exists.');
      const criteriaCount = await tx.projectMilestoneCriterion.count({ where: { milestoneId: milestone.id } });
      if (criteriaCount > 0) throw new Error('Governed milestones cannot be deleted through the legacy action.');
      await tx.projectMilestone.delete({
        where: {
          id:
            milestone.id
        }
      });

      await tx.projectActivity.create({
        data: {
          projectId:
            milestone.project.id,

          userId:
            actor.userId,

          type:
            'UPDATED',

          title:
            `Milestone deleted: ${milestone.title}`,

          description:
            'An unused internal planned milestone was permanently removed.',

          visibility:
            'INTERNAL',

          metadata: {
            deletedMilestoneId:
              milestone.id
          }
        }
      });
    }
  );

  revalidateProject(
    milestone.project.id,
    milestone.project.slug
  );

  return {
    success: true
  };
}

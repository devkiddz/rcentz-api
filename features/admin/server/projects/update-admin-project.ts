'use server';

import {
  revalidatePath
} from 'next/cache';

import {
  redirect
} from 'next/navigation';

import {
  prisma
} from '@/lib/prisma';

import {
  requireAdmin
} from '@/features/auth/server/require-admin';

import {
  isAdminProjectCurrency,
  isAdminProjectStatus,
  isAdminProjectType,
  isAdminProjectVisibility
} from '@/features/admin/types/projects';

export type UpdateAdminProjectState = {
  error: string | null;
};

function getText(
  formData: FormData,
  key: string
) {
  const value =
    formData.get(key);

  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  return value.trim();
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
  | Date
  | null
  | undefined {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      `${value}T12:00:00.000Z`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return undefined;
  }

  return date;
}

export async function updateAdminProject(
  _previousState: UpdateAdminProjectState,
  formData: FormData
): Promise<UpdateAdminProjectState> {
  await requireAdmin();

  const projectId =
    getText(
      formData,
      'projectId'
    );

  const name =
    getText(
      formData,
      'name'
    );

  const rawSlug =
    getText(
      formData,
      'slug'
    );

  const clientId =
    getText(
      formData,
      'clientId'
    );

  const description =
    getText(
      formData,
      'description'
    );

  const purpose =
    getText(
      formData,
      'purpose'
    );

  const vision =
    getText(
      formData,
      'vision'
    );

  const expectedOutcome =
    getText(
      formData,
      'expectedOutcome'
    );

  const type =
    getText(
      formData,
      'type'
    );

  const status =
    getText(
      formData,
      'status'
    );

  const visibility =
    getText(
      formData,
      'visibility'
    );

  const progressText =
    getText(
      formData,
      'progress'
    );

  const budgetText =
    getText(
      formData,
      'budget'
    );

  const currency =
    getText(
      formData,
      'currency'
    ).toUpperCase();

  const startedAtText =
    getText(
      formData,
      'startedAt'
    );

  const expectedEndAtText =
    getText(
      formData,
      'expectedEndAt'
    );

  if (!projectId) {
    return {
      error:
        'Project reference is missing.'
    };
  }

  const currentProject =
    await prisma.project.findUnique({
      where: {
        id: projectId
      },

      select: {
        id: true,
        slug: true,
        clientId: true,
        status: true,
        completedAt: true
      }
    });

  if (!currentProject) {
    return {
      error:
        'Project could not be found.'
    };
  }

  if (
    name.length < 2 ||
    name.length > 160
  ) {
    return {
      error:
        'Project name must be between 2 and 160 characters.'
    };
  }

  const slug =
    createSlug(
      rawSlug || name
    );

  if (
    slug.length < 2 ||
    slug.length > 120
  ) {
    return {
      error:
        'Enter a valid project slug.'
    };
  }

  if (
    !isAdminProjectType(
      type
    )
  ) {
    return {
      error:
        'Select a valid project type.'
    };
  }

  if (
    !isAdminProjectStatus(
      status
    )
  ) {
    return {
      error:
        'Select a valid project status.'
    };
  }

  if (
    !isAdminProjectVisibility(
      visibility
    )
  ) {
    return {
      error:
        'Select a valid project visibility.'
    };
  }

  if (
    !isAdminProjectCurrency(
      currency
    )
  ) {
    return {
      error:
        'Select a supported project currency.'
    };
  }

  const progress =
    Number(
      progressText || '0'
    );

  if (
    !Number.isInteger(
      progress
    ) ||
    progress < 0 ||
    progress > 100
  ) {
    return {
      error:
        'Project progress must be a whole number between 0 and 100.'
    };
  }

  let budget:
    | number
    | null = null;

  if (budgetText) {
    const parsedBudget =
      Number(
        budgetText
      );

    if (
      !Number.isFinite(
        parsedBudget
      ) ||
      parsedBudget < 0
    ) {
      return {
        error:
          'Project budget must be a valid positive amount.'
      };
    }

    budget =
      parsedBudget;
  }

  if (
    description.length >
    5000
  ) {
    return {
      error:
        'Project description is too long.'
    };
  }

  if (
    purpose.length >
    5000
  ) {
    return {
      error:
        'Project purpose is too long.'
    };
  }

  if (
    vision.length >
    5000
  ) {
    return {
      error:
        'Project vision is too long.'
    };
  }

  if (
    expectedOutcome.length >
    5000
  ) {
    return {
      error:
        'Expected outcome is too long.'
    };
  }

  const startedAt =
    parseDate(
      startedAtText
    );

  const expectedEndAt =
    parseDate(
      expectedEndAtText
    );

  if (
    startedAt ===
    undefined
  ) {
    return {
      error:
        'Enter a valid project start date.'
    };
  }

  if (
    expectedEndAt ===
    undefined
  ) {
    return {
      error:
        'Enter a valid expected completion date.'
    };
  }

  if (
    startedAt &&
    expectedEndAt &&
    expectedEndAt.getTime() <
      startedAt.getTime()
  ) {
    return {
      error:
        'Expected completion cannot be before the project start date.'
    };
  }

  const duplicateSlug =
    await prisma.project.findFirst({
      where: {
        slug,

        id: {
          not: projectId
        }
      },

      select: {
        id: true
      }
    });

  if (duplicateSlug) {
    return {
      error:
        'Another project already uses this slug.'
    };
  }

  if (clientId) {
    const client =
      await prisma.user.findFirst({
        where: {
          id: clientId,
          role: 'CLIENT',
          status: 'ACTIVE'
        },

        select: {
          id: true
        }
      });

    if (!client) {
      return {
        error:
          'The selected client is no longer available.'
      };
    }
  }

  await prisma.$transaction(async tx => {
    // Serialize with governance operations and evaluate the persisted state,
    // not the earlier form-read snapshot.
    const locked = await tx.$queryRaw<{ id: string; status: string; progress: number; completedAt: Date | null }[]>`
      SELECT "id", "status", "progress", "completedAt" FROM "Project"
      WHERE "id" = ${projectId} FOR UPDATE`;
    if (locked.length !== 1) throw new Error('Project no longer exists.');
    const governed = await tx.projectMilestoneCriterion.count({
      where: { milestone: { projectId } },
    });
    const deliveryCount = await tx.deliveryMilestone.count({ where: { milestone: { projectId } } });
    if ((governed > 0 || deliveryCount > 0) &&
        (locked[0].progress !== progress || locked[0].status !== status)) {
      throw new Error('Governed project progress and completion status must be changed through the governance workflow.');
    }
    await tx.project.update({
    where: {
      id: projectId
    },

    data: {
      clientId:
        clientId || null,

      name,
      slug,

      description:
        description || null,

      purpose:
        purpose || null,

      vision:
        vision || null,

      expectedOutcome:
        expectedOutcome || null,

      type,
      status,
      visibility,

      progress,

      budget,
      currency,

      startedAt,
      expectedEndAt,
      completedAt: (governed > 0 || deliveryCount > 0)
        ? locked[0].completedAt
        : status === 'COMPLETED'
          ? locked[0].completedAt ?? new Date()
          : null
    }
    });
  });

  revalidatePath(
    '/admin'
  );

  revalidatePath(
    '/admin/projects'
  );

  revalidatePath(
    `/admin/projects/${projectId}`
  );

  revalidatePath(
    `/admin/projects/${projectId}/edit`
  );

  revalidatePath(
    '/dashboard'
  );

  revalidatePath(
    '/dashboard/projects'
  );

  revalidatePath(
    `/dashboard/projects/${projectId}`
  );

  revalidatePath(
    '/portfolio'
  );

  revalidatePath(
    `/portfolio/${currentProject.slug}`
  );

  revalidatePath(
    `/portfolio/${slug}`
  );

  redirect(
    `/admin/projects/${projectId}`
  );
}
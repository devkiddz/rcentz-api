import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

import {
  projectSeedManifest,
  type SeedProjectMilestone,
} from "./seed-data/projects";

import { rcentzProductSeedManifest } from "./seed-data/rcentz-products";
import { serviceSeedManifest } from "./seed-data/services";
import { rcentzProductExposureManifest } from "./seed-data/rcentz-product-exposure";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function getMilestoneProgress(
  status: SeedProjectMilestone["status"],
) {
  switch (status) {
    case "COMPLETED":
      return 100;

    case "REVIEW":
      return 75;

    case "IN_PROGRESS":
      return 40;

    case "PLANNED":
    default:
      return 0;
  }
}

function getProjectProgress(
  milestones: SeedProjectMilestone[],
) {
  if (milestones.length === 0) {
    return 0;
  }

  const total = milestones.reduce(
    (sum, milestone) =>
      sum + getMilestoneProgress(milestone.status),
    0,
  );

  return Math.round(total / milestones.length);
}

function validateProgress(
  name: string,
  progress: number | null,
) {
  if (progress === null) {
    return;
  }

  if (
    !Number.isInteger(progress) ||
    progress < 0 ||
    progress > 100
  ) {
    throw new Error(
      `${name} has invalid progress "${progress}". Progress must be an integer between 0 and 100.`,
    );
  }
}


// =========================================================
// OFFICIAL ADMINISTRATOR
// =========================================================

async function seedOfficialAdmin() {
  const name = getRequiredEnv("SEED_ADMIN_NAME");

  const email =
    getRequiredEnv("SEED_ADMIN_EMAIL").toLowerCase();

  const password =
    getRequiredEnv("SEED_ADMIN_PASSWORD");

  if (password.length < 12) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must contain at least 12 characters.",
    );
  }

  if (password.length > 128) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must not exceed 128 characters.",
    );
  }

  let createdNow = false;

  let user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    console.log(
      "Creating official Rcentz administrator...",
    );

    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });

    createdNow = true;

    user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new Error(
        "Better Auth created no recoverable administrator user.",
      );
    }
  } else {
    console.log(
      "Official Rcentz administrator already exists.",
    );
  }

  const credentialAccount =
    await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },

      select: {
        id: true,
      },
    });

  if (!credentialAccount) {
    throw new Error(
      "Administrator exists but has no Better Auth credential account. Password credentials were not modified.",
    );
  }

  const admin = await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      name,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerified: true,
    },

    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
    },
  });

  if (createdNow) {
    await prisma.session.deleteMany({
      where: {
        userId: admin.id,
      },
    });
  }

  console.log(
    "Official Rcentz administrator ready:",
  );

  console.log({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    status: admin.status,
    emailVerified: admin.emailVerified,
  });

  return admin;
}

// =========================================================
// OFFICIAL PROJECT HISTORY
// =========================================================

async function seedOfficialProjects(
  adminId: string,
) {
  console.log(
    "Seeding official Rcentz project history...",
  );

  for (const projectData of projectSeedManifest) {
    const progress = getProjectProgress(
      projectData.milestones,
    );

    validateProgress(
      projectData.name,
      progress,
    );

    const project =
      await prisma.project.upsert({
        where: {
          slug: projectData.slug,
        },

        update: {
          name: projectData.name,
          description:
            projectData.description,

          purpose: projectData.purpose,
          vision: projectData.vision,

          expectedOutcome:
            projectData.expectedOutcome,

          type: projectData.type,
          status: projectData.status,

          visibility:
            projectData.visibility,

          progress,

          startedAt: toDate(
            projectData.startedAt,
          ),

          completedAt: toDate(
            projectData.completedAt,
          ),
        },

        create: {
          name: projectData.name,
          slug: projectData.slug,

          description:
            projectData.description,

          purpose: projectData.purpose,
          vision: projectData.vision,

          expectedOutcome:
            projectData.expectedOutcome,

          type: projectData.type,
          status: projectData.status,

          visibility:
            projectData.visibility,

          progress,

          startedAt: toDate(
            projectData.startedAt,
          ),

          completedAt: toDate(
            projectData.completedAt,
          ),
        },
      });

    await prisma.portfolioProfile.upsert({
      where: {
        projectId: project.id,
      },

      update: {
        tagline:
          projectData.portfolio.tagline,

        summary:
          projectData.portfolio.summary,

        challenge:
          projectData.portfolio.challenge,

        solution:
          projectData.portfolio.solution,

        outcome:
          projectData.portfolio.outcome,

        liveUrl:
          projectData.portfolio.liveUrl ??
          null,

        repositoryUrl:
          projectData.portfolio
            .repositoryUrl,

        featured:
          projectData.portfolio.featured,

        publishedAt: toDate(
          projectData.portfolio.publishedAt,
        ),
      },

      create: {
        projectId: project.id,

        tagline:
          projectData.portfolio.tagline,

        summary:
          projectData.portfolio.summary,

        challenge:
          projectData.portfolio.challenge,

        solution:
          projectData.portfolio.solution,

        outcome:
          projectData.portfolio.outcome,

        liveUrl:
          projectData.portfolio.liveUrl ??
          null,

        repositoryUrl:
          projectData.portfolio
            .repositoryUrl,

        featured:
          projectData.portfolio.featured,

        publishedAt: toDate(
          projectData.portfolio.publishedAt,
        ),
      },
    });

    for (
      const technology of
      projectData.technologies
    ) {
      await prisma.projectTechnology.upsert({
        where: {
          projectId_slug: {
            projectId: project.id,
            slug: technology.slug,
          },
        },

        update: {
          name: technology.name,
          icon: technology.icon ?? null,

          category: technology.category,

          description:
            technology.description,

          purpose: technology.purpose,

          rationale:
            technology.rationale,

          sortOrder: technology.sortOrder,

          featured:
            technology.featured ?? false,
        },

        create: {
          projectId: project.id,

          name: technology.name,
          slug: technology.slug,

          icon: technology.icon ?? null,

          category: technology.category,

          description:
            technology.description,

          purpose: technology.purpose,

          rationale:
            technology.rationale,

          sortOrder: technology.sortOrder,

          featured:
            technology.featured ?? false,
        },
      });
    }

    for (
      const milestoneData of
      projectData.milestones
    ) {
      const milestoneProgress =
        getMilestoneProgress(
          milestoneData.status,
        );

      validateProgress(
        `${projectData.name}: ${milestoneData.title}`,
        milestoneProgress,
      );

      await prisma.projectMilestone.upsert({
        where: {
          projectId_slug: {
            projectId: project.id,
            slug: milestoneData.slug,
          },
        },

        update: {
          createdById: adminId,

          title: milestoneData.title,

          description:
            milestoneData.description,

          purpose: milestoneData.purpose,

          expectedOutcome:
            milestoneData.expectedOutcome,

          status: milestoneData.status,

          priority:
            milestoneData.priority,

          visibility:
            milestoneData.visibility,

          sortOrder:
            milestoneData.sortOrder,

          progress: milestoneProgress,

          startedAt: toDate(
            milestoneData.startedAt,
          ),

          completedAt: toDate(
            milestoneData.completedAt,
          ),

          gitCommitSha:
            milestoneData.gitCommitSha ??
            null,

          gitTag:
            milestoneData.gitTag ?? null,

          completionNotes:
            milestoneData.completionNotes ??
            null,
        },

        create: {
          projectId: project.id,
          createdById: adminId,

          title: milestoneData.title,
          slug: milestoneData.slug,

          description:
            milestoneData.description,

          purpose: milestoneData.purpose,

          expectedOutcome:
            milestoneData.expectedOutcome,

          status: milestoneData.status,

          priority:
            milestoneData.priority,

          visibility:
            milestoneData.visibility,

          sortOrder:
            milestoneData.sortOrder,

          progress: milestoneProgress,

          startedAt: toDate(
            milestoneData.startedAt,
          ),

          completedAt: toDate(
            milestoneData.completedAt,
          ),

          gitCommitSha:
            milestoneData.gitCommitSha ??
            null,

          gitTag:
            milestoneData.gitTag ?? null,

          completionNotes:
            milestoneData.completionNotes ??
            null,
        },
      });
    }

    console.log(
      `Project ready: ${projectData.name} — ${progress}%`,
    );
  }

  console.log(
    `${projectSeedManifest.length} official Rcentz projects ready.`,
  );
}

// =========================================================
// OFFICIAL SERVICE CATALOGUE
// =========================================================

async function seedOfficialServices(
  adminId: string,
) {
  console.log(
    "Seeding official Rcentz service catalogue...",
  );

  let categoryCount = 0;
  let serviceCount = 0;
  let priceCount = 0;

  for (
    const categoryData of
    serviceSeedManifest
  ) {
    const category =
      await prisma.serviceCategory.upsert({
        where: {
          slug: categoryData.slug,
        },

        update: {
          name: categoryData.name,

          description:
            categoryData.description,
        },

        create: {
          name: categoryData.name,
          slug: categoryData.slug,

          description:
            categoryData.description,
        },
      });

    categoryCount += 1;

    for (
      const serviceData of
      categoryData.services
    ) {
      const service =
        await prisma.service.upsert({
          where: {
            slug: serviceData.slug,
          },

          update: {
            categoryId: category.id,
            createdById: adminId,

            name: serviceData.name,

            shortDescription:
              serviceData.shortDescription,

            description:
              serviceData.description,

            type: serviceData.type,
            status: serviceData.status,

            featured:
              serviceData.featured,
          },

          create: {
            categoryId: category.id,
            createdById: adminId,

            name: serviceData.name,
            slug: serviceData.slug,

            shortDescription:
              serviceData.shortDescription,

            description:
              serviceData.description,

            type: serviceData.type,
            status: serviceData.status,

            featured:
              serviceData.featured,
          },
        });

      serviceCount += 1;

      for (
        const priceData of
        serviceData.prices
      ) {
        await prisma.servicePrice.upsert({
          where: {
            serviceId_currency: {
              serviceId: service.id,

              currency:
                priceData.currency,
            },
          },

          update: {
            priceFrom:
              priceData.priceFrom,

            priceTo:
              priceData.priceTo,
          },

          create: {
            serviceId: service.id,

            currency:
              priceData.currency,

            priceFrom:
              priceData.priceFrom,

            priceTo:
              priceData.priceTo,
          },
        });

        priceCount += 1;
      }
    }

    console.log(
      `Service category ready: ${categoryData.name} — ${categoryData.services.length} services`,
    );
  }

  console.log(
    `Service catalogue ready: ${categoryCount} categories, ${serviceCount} services, ${priceCount} price entries.`,
  );
}

// =========================================================
// RCENTZ-OWNED PRODUCTS
//
// These are products built and operated by Rcentz.
// They are NOT Store / commerce Product records.
// =========================================================

async function seedRcentzProducts() {
  console.log(
    "Seeding official Rcentz products...",
  );

  for (
    const productData of
    rcentzProductSeedManifest
  ) {
    validateProgress(
      productData.name,
      productData.progress,
    );

    const product =
      await prisma.rcentzProduct.upsert({
        where: {
          slug: productData.slug,
        },

        update: {
          name: productData.name,

          tagline:
            productData.tagline,

          shortDescription:
            productData.shortDescription,

          description:
            productData.description,

          aboutNotes:
            productData.aboutNotes,

          purpose:
            productData.purpose,

          intendedUse:
            productData.intendedUse,

          contribution:
            productData.contribution,

          stage:
            productData.stage,

          progress:
            productData.progress,

          isReleased:
            productData.isReleased,

          currentVersion:
            productData.currentVersion,

          productUrl:
            productData.productUrl,

          featured:
            productData.featured,

          betaAvailable:
            productData.betaAvailable,

          waitlistEnabled:
            productData.waitlistEnabled,

          sortOrder:
            productData.sortOrder,
        },

        create: {
          name: productData.name,
          slug: productData.slug,

          tagline:
            productData.tagline,

          shortDescription:
            productData.shortDescription,

          description:
            productData.description,

          aboutNotes:
            productData.aboutNotes,

          purpose:
            productData.purpose,

          intendedUse:
            productData.intendedUse,

          contribution:
            productData.contribution,

          stage:
            productData.stage,

          progress:
            productData.progress,

          isReleased:
            productData.isReleased,

          currentVersion:
            productData.currentVersion,

          productUrl:
            productData.productUrl,

          featured:
            productData.featured,

          betaAvailable:
            productData.betaAvailable,

          waitlistEnabled:
            productData.waitlistEnabled,

          sortOrder:
            productData.sortOrder,
        },
      });

    for (
      const galleryData of
      productData.galleries
    ) {
      await prisma.rcentzProductGallery.upsert({
        where: {
          productId_slug: {
            productId: product.id,
            slug: galleryData.slug,
          },
        },

        update: {
          name: galleryData.name,

          description:
            galleryData.description,

          type: galleryData.type,

          featured:
            galleryData.featured,

          sortOrder:
            galleryData.sortOrder,
        },

        create: {
          productId: product.id,

          name: galleryData.name,
          slug: galleryData.slug,

          description:
            galleryData.description,

          type: galleryData.type,

          featured:
            galleryData.featured,

          sortOrder:
            galleryData.sortOrder,
        },
      });
    }

    console.log(
      `Product ready: ${productData.name} — ${productData.stage} — ${
        productData.progress === null
          ? "progress not formally measured"
          : `${productData.progress}%`
      }`,
    );
  }

  console.log(
    `${rcentzProductSeedManifest.length} official Rcentz products ready.`,
  );
}

async function seedRcentzProductExposure() {
  console.log(
    "Synchronizing Rcentz product publication authority...",
  );

  const products = await prisma.rcentzProduct.findMany({
    select: {
      id: true,
      slug: true,
      publishedAt: true,

      galleries: {
        select: {
          id: true,
          slug: true,
          publishedAt: true,
        },
      },

      productionHistory: {
        select: {
          id: true,
          slug: true,
          publishedAt: true,
        },
      },

      publications: {
        select: {
          id: true,
          slug: true,
          publishedAt: true,
        },
      },

      policies: {
        select: {
          id: true,
          slug: true,
          publishedAt: true,
        },
      },
    },
  });

  const now = new Date();

  for (const product of products) {
    const exposure =
      rcentzProductExposureManifest.find(
        (entry) => entry.slug === product.slug,
      );

    const cataloguePublished =
      exposure?.catalogue === true;

    await prisma.rcentzProduct.update({
      where: {
        id: product.id,
      },

      data: {
        publishedAt: cataloguePublished
          ? product.publishedAt ?? now
          : null,
      },
    });

    for (const gallery of product.galleries) {
      const shouldPublish =
        cataloguePublished &&
        exposure?.galleries.includes(
          gallery.slug as never,
        );

      await prisma.rcentzProductGallery.update({
        where: {
          id: gallery.id,
        },

        data: {
          publishedAt: shouldPublish
            ? gallery.publishedAt ?? now
            : null,
        },
      });
    }

    for (
      const update of product.productionHistory
    ) {
      const shouldPublish =
        cataloguePublished &&
        exposure?.updates.includes(
          update.slug as never,
        );

      await prisma.rcentzProductUpdate.update({
        where: {
          id: update.id,
        },

        data: {
          publishedAt: shouldPublish
            ? update.publishedAt ?? now
            : null,
        },
      });
    }

    for (
      const publication of product.publications
    ) {
      const shouldPublish =
        cataloguePublished &&
        exposure?.publications.includes(
          publication.slug as never,
        );

      await prisma.rcentzProductPublication.update({
        where: {
          id: publication.id,
        },

        data: {
          publishedAt: shouldPublish
            ? publication.publishedAt ?? now
            : null,
        },
      });
    }

    for (const policy of product.policies) {
      const shouldPublish =
        cataloguePublished &&
        exposure?.policies.includes(
          policy.slug as never,
        );

      await prisma.rcentzProductPolicy.update({
        where: {
          id: policy.id,
        },

        data: {
          publishedAt: shouldPublish
            ? policy.publishedAt ?? now
            : null,
        },
      });
    }

    console.log(
      `${product.slug}: ${
        cataloguePublished
          ? "PUBLIC CATALOGUE"
          : "PRIVATE"
      }`,
    );
  }

  console.log(
    "Rcentz product publication authority synchronized.",
  );
}

// =========================================================
// SEED ORCHESTRATOR
// =========================================================

async function main() {
  console.log(
    "Starting Rcentz database seed...",
  );

  const admin =
    await seedOfficialAdmin();

    await seedOfficialProjects(admin.id);
    await seedOfficialServices(admin.id);

    await seedRcentzProducts();
    await seedRcentzProductExposure();

  console.log(
    "Rcentz database seed completed.",
  );
}

main()
  .catch((error) => {
    console.error(
      "Rcentz seed failed.",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
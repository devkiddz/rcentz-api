import "server-only";

import { prisma } from "@/lib/prisma";

export async function getRcentzProductBySlug(
  slug: string,
) {
  return prisma.rcentzProduct.findFirst({
    where: {
      slug,

      publishedAt: {
        not: null,
      },
    },

    select: {
      id: true,
      name: true,
      slug: true,

      tagline: true,
      shortDescription: true,
      description: true,

      aboutNotes: true,
      purpose: true,
      intendedUse: true,
      contribution: true,

      stage: true,
      progress: true,
      isReleased: true,
      currentVersion: true,

      productUrl: true,

      featured: true,

      betaAvailable: true,
      waitlistEnabled: true,

      productionStartedAt: true,
      expectedReleaseAt: true,
      firstReleasedAt: true,
      latestReleasedAt: true,
      retiredAt: true,
      publishedAt: true,

      galleries: {
        where: {
          publishedAt: {
            not: null,
          },
        },

        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          type: true,
          featured: true,
          sortOrder: true,
          publishedAt: true,

          media: {
            select: {
              id: true,
              url: true,
              alt: true,
              caption: true,
              width: true,
              height: true,
              sortOrder: true,
            },

            orderBy: {
              sortOrder: "asc",
            },
          },
        },

        orderBy: [
          {
            featured: "desc",
          },
          {
            sortOrder: "asc",
          },
        ],
      },

      seo: {
        select: {
          title: true,
          description: true,
          keywords: true,
          canonicalUrl: true,
          ogTitle: true,
          ogDescription: true,
          ogImage: true,
          robots: true,
        },
      },
    },
  });
}
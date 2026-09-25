import "server-only";

import { prisma } from "@/lib/prisma";

export async function getRcentzProducts() {
  return prisma.rcentzProduct.findMany({
    where: {
      visible: true,
      publishedAt: {
        not: null,
      },
      status: {
        notIn: ["DRAFT", "RETIRED"],
      },
    },

    select: {
      id: true,
      name: true,
      slug: true,

      shortDescription: true,
      description: true,

      status: true,
      progress: true,

      productUrl: true,

      featured: true,
      sortOrder: true,

      betaAvailable: true,
      waitlistEnabled: true,

      expectedLaunchAt: true,
      launchedAt: true,
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

    orderBy: [
      {
        featured: "desc",
      },
      {
        sortOrder: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}
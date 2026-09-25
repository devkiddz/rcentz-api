export const rcentzProductExposureManifest = [
  {
    slug: "waffi",

    catalogue: true,

    galleries: [
      "product-gallery",
      "development",
    ],

    updates: [],
    publications: [],
    policies: [],
  },

  {
    slug: "rcentz-fintech-lab",

    catalogue: true,

    galleries: [
      "product-gallery",
      "development",
    ],

    updates: [],
    publications: [],
    policies: [],
  },

  {
    slug: "aj-logik",

    catalogue: true,

    galleries: [
      "product-gallery",
    ],

    updates: [],
    publications: [],
    policies: [],
  },

  {
    slug: "shelsea-commerce",

    catalogue: true,

    galleries: [
      "product-gallery",
    ],

    updates: [],
    publications: [],
    policies: [],
  },

  {
    slug: "jobman",

    catalogue: true,

    galleries: [
      "development",
    ],

    updates: [],
    publications: [],
    policies: [],
  },

  {
    slug: "hotel-management",

    catalogue: true,

    galleries: [],

    updates: [],
    publications: [],
    policies: [],
  },

  {
    slug: "real-estate",

    catalogue: true,

    galleries: [],

    updates: [],
    publications: [],
    policies: [],
  },

  {
    slug: "rcentz-vault",

    catalogue: true,

    galleries: [],

    updates: [],
    publications: [],
    policies: [],
  },
] as const;

export type RcentzProductExposureEntry =
  (typeof rcentzProductExposureManifest)[number];
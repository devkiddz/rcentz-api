import { apiSuccess } from "@/server/api/responses/api-response";

export const revalidate = 3600;

const brand = {
  name: "Rcentz",
  version: 1,
  assets: {
    logo: {
      light: "/brands/rcentz/rcentz-mark-light.svg",
      dark: "/brands/rcentz/rcentz-mark-dark.svg",
    },
    symbol: "/brands/rcentz/rcentz-mark-dark.svg",
    favicon: "/brands/rcentz/rcentz-mark-dark.svg",
  },
  colors: {
    primary: "#4260E6",
    foreground: "#0D0D0D",
    foregroundOnDark: "#FAFAFA",
  },
  typography: {
    brand: "RcentzBrand",
    brandWeight: "Regular",
    website: "Geist Sans",
    files: {
      ttf: "/brands/rcentz/RcentzBrand-Regular.ttf",
      woff: "/brands/rcentz/RcentzBrand-Regular.woff",
    },
  },
  usage: {
    primaryLogo: "Use the approved complete Rcentz CR lockup.",
    darkLogo: "Use the dark lockup on dark backgrounds.",
    symbol: "Use the standalone CR symbol for compact brand placements.",
    restrictions: [
      "Do not distort or rearrange the approved logo.",
      "Do not recreate or independently recolour the logo.",
      "Preserve the original SVG proportions.",
    ],
  },
};

export function GET() {
  return apiSuccess(brand);
}

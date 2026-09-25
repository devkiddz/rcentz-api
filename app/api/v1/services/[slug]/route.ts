import type { NextRequest } from "next/server";

import { getServiceBySlug } from "@/features/services/server/get-service-by-slug";
import { getVisitorCurrency } from "@/features/services/server/get-visitor-currency";
import {
  defaultLocale,
  isSupportedLocale,
} from "@/i18n/config";
import {
  apiError,
  apiSuccess,
} from "@/server/api/responses/api-response";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    const requestedLocale =
      request.nextUrl.searchParams.get("locale");

    const locale =
      requestedLocale && isSupportedLocale(requestedLocale)
        ? requestedLocale
        : defaultLocale;

    const requestedCurrency =
      request.nextUrl.searchParams
        .get("currency")
        ?.toUpperCase();

    const currency =
      requestedCurrency === "NGN" ||
      requestedCurrency === "USD"
        ? requestedCurrency
        : await getVisitorCurrency();

    const service = await getServiceBySlug(
      slug,
      currency,
      locale
    );

    if (!service) {
      return apiError(
        "SERVICE_NOT_FOUND",
        "Service not found",
        404
      );
    }

    return apiSuccess(service);
  } catch (error) {
    console.error("[api:v1:services:detail]", error);

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Service could not be loaded",
      500
    );
  }
}
import { getServiceCategories } from "@/features/services/server/get-service-categories";
import {
  apiError,
  apiSuccess,
} from "@/server/api/responses/api-response";

export async function GET() {
  try {
    const categories = await getServiceCategories();

    return apiSuccess(categories);
  } catch (error) {
    console.error("[api:v1:services:categories]", error);

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Service categories could not be loaded",
      500
    );
  }
}
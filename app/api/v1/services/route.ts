import { getServices } from "@/features/services/server/get-services";
import {
  apiError,
  apiSuccess,
} from "@/server/api/responses/api-response";

export async function GET() {
  try {
    const services = await getServices();

    return apiSuccess(services);
  } catch (error) {
    console.error("[api:v1:services]", error);

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Services could not be loaded",
      500
    );
  }
}
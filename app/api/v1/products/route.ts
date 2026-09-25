import { getRcentzProducts } from "@/features/rcentz-products/server/get-rcentz-products";
import {
  apiError,
  apiSuccess,
} from "@/server/api/responses/api-response";

export async function GET() {
  try {
    const products = await getRcentzProducts();

    return apiSuccess(products);
  } catch (error) {
    console.error("[api:v1:products]", error);

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Products could not be loaded",
      500
    );
  }
}
import { getRcentzProductBySlug } from "@/features/rcentz-products/server/get-rcentz-product-by-slug";
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
  _request: Request,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    const product = await getRcentzProductBySlug(slug);

    if (!product) {
      return apiError(
        "PRODUCT_NOT_FOUND",
        "Product not found",
        404
      );
    }

    return apiSuccess(product);
  } catch (error) {
    console.error("[api:v1:products:detail]", error);

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Product could not be loaded",
      500
    );
  }
}
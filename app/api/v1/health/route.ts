import { apiSuccess } from "@/server/api/responses/api-response";

export async function GET() {
  return apiSuccess({
    service: "rcentz-api",
    version: "v1",
    status: "healthy",
  });
}
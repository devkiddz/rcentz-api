import "server-only";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/features/auth/server/get-current-user";

export async function requireApiAdmin() {
  const user = await getCurrentUser();

  if (!user || user.status !== "ACTIVE") {
    return {
      ok: false as const,

      response: NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        {
          status: 401,
        }
      ),
    };
  }

  if (
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN"
  ) {
    return {
      ok: false as const,

      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Insufficient permissions",
          },
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    ok: true as const,
    user,
  };
}
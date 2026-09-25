import "server-only";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/features/auth/server/get-current-user";

export async function requireApiAuth() {
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

  return {
    ok: true as const,
    user,
  };
}
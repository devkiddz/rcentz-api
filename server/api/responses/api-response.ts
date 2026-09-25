import { NextResponse } from "next/server";

export function apiSuccess<T>(
  data: T,
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
    }
  );
}

export function apiError(
  code: string,
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
    }
  );
}
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { runCommercialCollection } from "@/server/opportunities/client-collector";
import { runCollection } from "@/server/opportunities/collector";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from("Bearer " + (secret || ""));
  const received = Buffer.from(request.headers.get("authorization") || "");
  if (
    !secret ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = process.env.OPPORTUNITY_OWNER_ID;
  if (!ownerId)
    return Response.json(
      { error: "Finder owner not configured" },
      { status: 503 },
    );
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { role: true, status: true },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !["ADMIN", "SUPER_ADMIN"].includes(user.role)
  )
    return Response.json(
      { error: "Finder owner unavailable" },
      { status: 503 },
    );
  await prisma.applicationRequestNonce.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
  });
  // Commercial and personal records, preferences and waiting periods remain independent.
  const [result, commercial] = await Promise.all([runCollection(ownerId), runCommercialCollection(ownerId, true)]);
  return Response.json({ ...result, commercial }, {
    status: result.status === "failed" || commercial.status === "failed" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}

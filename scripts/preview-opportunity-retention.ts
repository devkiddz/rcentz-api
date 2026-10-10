import { prisma } from "../lib/prisma";
import {
  finderPolicy,
  retentionWhere,
  untouchedWhere,
} from "../server/opportunities/policy";
async function main() {
  const ownerId = process.env.OPPORTUNITY_OWNER_ID;
  if (!ownerId)
    throw Error("Set the existing API OPPORTUNITY_OWNER_ID privately.");
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { status: true, role: true },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !["ADMIN", "SUPER_ADMIN"].includes(user.role)
  )
    throw Error("Active administrator owner required.");
  const profile = await prisma.opportunityProfile.findUnique({
    where: { ownerId },
    select: { id: true },
  });
  if (!profile) {
    console.log(
      JSON.stringify({ mode: "preview", profileExists: false, eligible: 0 }),
    );
    return;
  }
  const snapshot = await prisma.$transaction(
    async (tx) => ({
      untouched: await tx.opportunity.count({
        where: untouchedWhere(profile.id),
      }),
      eligible: await tx.opportunity.count({
        where: retentionWhere(profile.id),
      }),
    }),
    { isolationLevel: "RepeatableRead" },
  );
  console.log(
    JSON.stringify(
      {
        mode: "preview",
        deletionPerformed: false,
        retentionEnabled: process.env.OPPORTUNITY_RETENTION_ENABLED === "true",
        ...finderPolicy,
        ...snapshot,
        protected:
          "Notes, decision events, non-NEW statuses, quarantined and recently seen/updated records are excluded.",
      },
      null,
      2,
    ),
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
